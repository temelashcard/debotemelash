'use client';

import { useEffect, useState } from 'react';
import { t, type Lang, type MessageKey } from '@temelash/i18n';
import { apiGet } from '@temelash/ui';
import s from './shop-page.module.css';

/**
 * Shop page (no prototype board; DECISIONS 2026-11-21). A shop's QR code opens the
 * language wheel, then this page: the shop's cover photo (or its brand colour), logo,
 * name and tagline, then what a customer can do there. For now that is only
 * "Start earning rewards", which opens the join / sign-in screen (ScanJoin).
 */

interface PublicShop {
  name: string;
  shopCode: string;
  color: string;
  logoUrl: string | null;
  tagline: string | null;
  coverUrl: string | null;
  /** Only when the owner has turned Wi-Fi on. */
  wifi: { ssid: string; password: string; security: string; hidden: boolean } | null;
}

const HEART = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';
const CHEVRON = 'M9 6l6 6-6 6';
const BACK = 'M15 6l-6 6 6 6';
const WIFI = 'M2 8.8a15 15 0 0 1 20 0M5.5 12.4a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01';
const CLOSE = 'M6 6l12 12M18 6L6 18';

/** Copy text; older browsers without the clipboard API fall back to a hidden text box. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** The guest Wi-Fi, in a sheet: name and password to copy, and how to join. */
function WifiSheet({ L, wifi, onClose }: { L: (k: MessageKey, v?: Record<string, string | number>) => string; wifi: NonNullable<PublicShop['wifi']>; onClose: () => void }) {
  const [copied, setCopied] = useState<'ssid' | 'password' | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const copy = async (what: 'ssid' | 'password', text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    }
  };
  const row = (what: 'ssid' | 'password', label: string, value: string) => (
    <div className={s.wifiRow}>
      <div className={s.wifiText}>
        <span className={s.wifiLabel}>{label}</span>
        <span className={s.wifiValue}>{value}</span>
      </div>
      <button type="button" className={s.copy} onClick={() => copy(what, value)} aria-label={`${L('shop.wifiCopy')}: ${label}`}>
        {copied === what ? L('shop.wifiCopied') : L('shop.wifiCopy')}
      </button>
    </div>
  );
  return (
    <div className={s.scrim} onClick={onClose}>
      <div className={`${s.sheet} tc-sheet`} role="dialog" aria-modal="true" aria-labelledby="wifi-title" onClick={(e) => e.stopPropagation()}>
        <div className={s.sheetHead}>
          <h2 id="wifi-title" className={s.sheetTitle}>{L('shop.wifi')}</h2>
          <button type="button" className={s.close} onClick={onClose} aria-label={L('shop.close')} autoFocus>
            <Icon d={CLOSE} size={20} color="#333" />
          </button>
        </div>
        {row('ssid', L('shop.wifiName'), wifi.ssid)}
        {wifi.security === 'nopass'
          ? <p className={s.wifiOpen}>{L('shop.wifiOpen')}</p>
          : row('password', L('shop.wifiPassword'), wifi.password)}
        <p className={s.wifiHow}>{wifi.hidden ? L('shop.wifiHowHidden', { a: wifi.ssid }) : L('shop.wifiHow', { a: wifi.ssid })}</p>
      </div>
    </div>
  );
}

function Icon({ d, size = 20, color = '#444', fill = 'none' }: { d: string; size?: number; color?: string; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Text on the brand colour: white when it reads at 4.5:1, dark otherwise (as in the owner's Look). */
function fgFor(hex: string): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (lum + 0.05) >= 4.5 ? '#ffffff' : '#222222';
}

export function ShopPage({ lang, shopCode, onStart, onBack }: { lang: Lang; shopCode: string; onStart: () => void; onBack: () => void }) {
  const L = (k: MessageKey, vars?: Record<string, string | number>) => t(lang, k, vars);
  const [shop, setShop] = useState<PublicShop | null>(null);
  const [missing, setMissing] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);

  useEffect(() => {
    apiGet<PublicShop>(`/shops/${encodeURIComponent(shopCode)}`)
      .then(setShop)
      .catch(() => setMissing(true));
  }, [shopCode]);

  if (missing) {
    return (
      <div className={s.screen}>
        <div className={`${s.missing} tc-wfade`}>
          <p role="alert">{L('join.noShop')}</p>
          <button type="button" className={s.backPlain} onClick={onBack}>{L('common.back')}</button>
        </div>
      </div>
    );
  }
  if (!shop) return <div className={s.screen} aria-busy="true" />;

  const color = /^#[0-9A-F]{6}$/i.test(shop.color) ? shop.color : '#222222';
  const fg = fgFor(color);
  const initials = shop.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'JD';

  return (
    <div className={s.screen}>
      <main className="tc-wfade">
        <div className={s.cover} style={{ background: color }}>
          {shop.coverUrl && <img src={shop.coverUrl} alt="" className={s.coverImg} />}
          <button type="button" className={s.back} onClick={onBack} aria-label={L('common.back')}>
            <Icon d={BACK} size={22} color="#333" />
          </button>
        </div>

        <header className={s.head}>
          {shop.logoUrl
            ? <img src={shop.logoUrl} alt="" className={s.logo} />
            : <span className={s.logo} aria-hidden="true" style={{ background: color, color: fg }}>{initials}</span>}
          <div className={s.titles}>
            <h1 className={s.name}>{shop.name}</h1>
            {shop.tagline && <p className={s.tagline}>{shop.tagline}</p>}
          </div>
        </header>

        <ul className={s.actions}>
          <li>
            <button type="button" className={s.action} onClick={onStart}>
              <span className={s.actionIcon} style={{ background: '#fbe4e8' }}>
                <Icon d={HEART} color="#c8344f" fill="#c8344f" />
              </span>
              <span className={s.actionText}>
                <span className={s.actionTitle}>{L('shop.start')}</span>
                <span className={s.actionSub}>{L('shop.startSub')}</span>
              </span>
              <Icon d={CHEVRON} size={18} color="#9a9a9a" />
            </button>
          </li>
          {shop.wifi && (
            <li>
              <button type="button" className={s.action} onClick={() => setWifiOpen(true)} aria-haspopup="dialog">
                <span className={s.actionIcon} style={{ background: '#e2f3e6' }}>
                  <Icon d={WIFI} color="#2e8b47" />
                </span>
                <span className={s.actionText}>
                  <span className={s.actionTitle}>{L('shop.wifi')}</span>
                  <span className={s.actionSub}>{shop.wifi.ssid}</span>
                </span>
                <Icon d={CHEVRON} size={18} color="#9a9a9a" />
              </button>
            </li>
          )}
        </ul>

        <p className={s.by}>{L('shop.by', { a: L('common.appName') })}</p>
      </main>
      {wifiOpen && shop.wifi && <WifiSheet L={L} wifi={shop.wifi} onClose={() => setWifiOpen(false)} />}
    </div>
  );
}
