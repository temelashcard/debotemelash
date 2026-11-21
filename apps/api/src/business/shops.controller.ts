import { Controller, Get, Inject, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { Sql } from '@temelash/db';
import { SQL } from '../db/db.module';
import { notFound } from '../common/api-error';
import { RateLimitGuard } from '../auth/rate-limit.guard';
import { MoneyService } from '../money/money.service';
import { SettingsService } from '../settings/settings.service';

export interface PublicShop {
  name: string;
  shopCode: string;
  color: string;
  logoUrl: string | null;
  /** Shop page: the line under the name, and the cover photo (null shows the brand colour). */
  tagline: string | null;
  coverUrl: string | null;
  /** Guest Wi-Fi, only when the owner has turned it on. */
  wifi: { ssid: string; password: string; security: string; hidden: boolean } | null;
  stampsNeeded: number | null;
  rewards: Array<{ at: number; reward: string }>;
}

/** What a shop's join page (ScanJoin) shows before anyone signs in. */
@Controller('shops')
@UseGuards(RateLimitGuard)
export class ShopsController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Get(':code')
  async shop(@Param('code') code: string): Promise<PublicShop> {
    const [s] = await this.sql<{ name: string; shop_code: string; brand_color: string; tagline: string | null; logo_version: number | null; cover_version: string | null; stamps_needed: number | null; ladder: Array<{ at: number; reward: string }> | null; wifi_ssid: string | null; wifi_password: string; wifi_security: string; wifi_hidden: boolean }[]>`
      select b.name, b.shop_code, b.brand_color, b.tagline, l.version as logo_version, c.version as cover_version, r.stamps_needed, r.ladder,
        w.ssid as wifi_ssid, w.password as wifi_password, w.security as wifi_security, w.hidden as wifi_hidden
      from tc.business b
      left join tc.business_logo l on l.business_id = b.id
      left join tc.business_cover c on c.business_id = b.id
      left join tc.business_wifi w on w.business_id = b.id and w.enabled
      left join lateral (select stamps_needed, ladder from tc.rule_set where business_id = b.id order by version desc limit 1) r on true
      where b.shop_code = ${code.toUpperCase()} and b.status in ('trial', 'active')`;
    if (!s) throw notFound('no_shop');
    return {
      name: s.name,
      shopCode: s.shop_code,
      color: s.brand_color,
      logoUrl: s.logo_version ? `/api/v1/shops/${s.shop_code}/logo?v=${s.logo_version}` : null,
      tagline: s.tagline,
      coverUrl: s.cover_version ? `/api/v1/shops/${s.shop_code}/cover?v=${s.cover_version}` : null,
      wifi: s.wifi_ssid ? { ssid: s.wifi_ssid, password: s.wifi_password, security: s.wifi_security, hidden: s.wifi_hidden } : null,
      stampsNeeded: s.stamps_needed,
      rewards: (s.ladder ?? []).map((l) => ({ at: l.at, reward: l.reward })),
    };
  }

  /** BusinessPage: category, city, branches with address and hours, and the card. Public, like the join page. */
  @Get(':code/details')
  async details(@Param('code') code: string) {
    const [b] = await this.sql<{ id: string; name: string; category: string; city: string; shop_code: string; brand_color: string; logo_version: number | null; stamps_needed: number | null; ladder: Array<{ at: number; reward: string }> | null; reward_valid_days: number | null }[]>`
      select b.id, b.name, b.category, b.city, b.shop_code, b.brand_color, l.version as logo_version, r.stamps_needed, r.ladder, r.reward_valid_days
      from tc.business b
      left join tc.business_logo l on l.business_id = b.id
      left join lateral (select stamps_needed, ladder, reward_valid_days from tc.rule_set where business_id = b.id order by version desc limit 1) r on true
      where b.shop_code = ${code.toUpperCase()} and b.status in ('trial', 'active', 'paused', 'closing')`;
    if (!b) throw notFound('no_shop');
    const branches = await this.sql<{ name: string; address: string | null; hours: Record<string, string[][]> }[]>`
      select name, address, hours from tc.branch where business_id = ${b.id} and status = 'active' order by created_at`;
    return {
      name: b.name, category: b.category, city: b.city, shopCode: b.shop_code, color: b.brand_color,
      logoUrl: b.logo_version ? `/api/v1/shops/${b.shop_code}/logo?v=${b.logo_version}` : null,
      stampsNeeded: b.stamps_needed, rewardValidDays: b.reward_valid_days,
      rewards: (b.ladder ?? []).map((t) => ({ at: t.at, reward: t.reward })),
      branches,
    };
  }

  /** The shop logo. The URL carries the version, so it can be cached for a long time. */
  @Get(':code/logo')
  async logo(@Param('code') code: string, @Res() res: Response) {
    const [l] = await this.sql<{ mime: string; bytes: Buffer }[]>`
      select l.mime, l.bytes from tc.business_logo l join tc.business b on b.id = l.business_id where b.shop_code = ${code.toUpperCase()}`;
    if (!l) throw notFound('no_logo');
    res.setHeader('Content-Type', l.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(l.bytes);
  }

  /** The shop page cover photo. Versioned URL, like the logo. */
  @Get(':code/cover')
  async cover(@Param('code') code: string, @Res() res: Response) {
    const [c] = await this.sql<{ mime: string; bytes: Buffer }[]>`
      select c.mime, c.bytes from tc.business_cover c join tc.business b on b.id = c.business_id where b.shop_code = ${code.toUpperCase()}`;
    if (!c) throw notFound('no_cover');
    res.setHeader('Content-Type', c.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(c.bytes);
  }
}

/** What the public website shows: prices, the trial and contact details, all from the settings. */
@Controller('site')
@UseGuards(RateLimitGuard)
export class SiteController {
  constructor(
    @Inject(SQL) private readonly sql: Sql,
    private readonly money: MoneyService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  async site() {
    const [p, trialDays, graceDays, rows] = await Promise.all([
      this.money.prices(), this.settings.number('plan.trial_days', 15), this.settings.number('billing.grace_days', 7),
      this.sql<{ key: string; value: unknown }[]>`select key, value from tc.setting where key in ('support.phone', 'support.telegram')`,
    ]);
    const contact = (k: string) => { const v = rows.find((r) => r.key === k)?.value; return typeof v === 'string' ? v : ''; };
    return {
      trialDays, graceDays, starter: p.starter, full: p.full, extraBranch: p.extra, fullBranches: p.included,
      support: { phone: contact('support.phone'), telegram: contact('support.telegram') },
    };
  }
}
