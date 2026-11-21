/**
 * Phase 3, the rest of the owner board: look (colour and logo), security
 * (change own PIN, sign out other phones) and date and time settings.
 */
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Sql } from '@temelash/db';
import { GOOD_PIN, createTestApp, describeDb, lastSmsCode, resetDb, seedWorld, type World } from './harness';

// A real 1 x 1 PNG.
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describeDb('Phase 3: look, security, date and time', () => {
  let sql: Sql;
  let app: INestApplication;
  let w: World;
  const api = () => request(app.getHttpServer());
  const local = (e164: string) => e164.slice(4);
  async function business(phone: string) {
    const s = await api().post('/api/v1/auth/business/signin').send({ phone: local(phone), pin: GOOD_PIN }).expect(200);
    return (await api().post('/api/v1/auth/business/signin/verify').send({ ticket: s.body.ticket, code: await lastSmsCode(sql, phone) }).expect(200)).body as { accessToken: string; refreshToken: string };
  }

  beforeAll(async () => {
    sql = await resetDb();
    app = await createTestApp(sql);
    w = await seedWorld(sql);
  });
  afterAll(async () => {
    await app?.close();
    await sql?.end();
  });

  it('owner sets a card colour from the palette and a logo; customers see both', async () => {
    const { accessToken: t } = await business(w.owner.phone);
    await api().post('/api/v1/owner/look').auth(t, { type: 'bearer' }).send({ color: '#123456' }).expect(400);
    await api().post('/api/v1/owner/look').auth(t, { type: 'bearer' }).send({ color: '#0F6E4B' }).expect(201);
    await api().post('/api/v1/owner/look/logo').auth(t, { type: 'bearer' }).send({ dataUrl: 'data:image/png;base64,bm90IGFuIGltYWdl' }).expect(400);
    await api().post('/api/v1/owner/look/logo').auth(t, { type: 'bearer' }).send({ dataUrl: PNG_1PX }).expect(201);
    const shop = (await api().get('/api/v1/shops/MOKA01').expect(200)).body;
    expect(shop).toMatchObject({ color: '#0F6E4B', logoUrl: expect.stringContaining('/api/v1/shops/MOKA01/logo') });
    const img = await api().get('/api/v1/shops/MOKA01/logo').expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    const look = (await api().get('/api/v1/owner/look').auth(t, { type: 'bearer' }).expect(200)).body;
    expect(look).toMatchObject({ color: '#0F6E4B', logoUrl: expect.any(String) });
  });

  it('a manager cannot change the look', async () => {
    const { accessToken: m } = await business(w.manager.phone);
    await api().post('/api/v1/owner/look').auth(m, { type: 'bearer' }).send({ color: '#C8341F' }).expect(403);
    await api().post('/api/v1/owner/look/logo').auth(m, { type: 'bearer' }).send({ dataUrl: PNG_1PX }).expect(403);
    await api().post('/api/v1/owner/look/stamp-icon').auth(m, { type: 'bearer' }).send({ icon: 'star' }).expect(403);
    await api().post('/api/v1/owner/look/tagline').auth(m, { type: 'bearer' }).send({ tagline: 'Hi' }).expect(403);
    await api().post('/api/v1/owner/look/cover').auth(m, { type: 'bearer' }).send({ dataUrl: PNG_1PX }).expect(403);
  });

  // Shop page Wi-Fi (DECISIONS 2026-11-21): the owner saves the network and turns it on or off.
  it('owner saves the Wi-Fi and turns it on and off; the shop page shows it only when on', async () => {
    const { accessToken: t } = await business(w.owner.phone);
    const { accessToken: m } = await business(w.manager.phone);
    const wifi = (tok: string) => api().get('/api/v1/owner/wifi').auth(tok, { type: 'bearer' });
    const save = (tok: string, body: Record<string, unknown>) => api().post('/api/v1/owner/wifi').auth(tok, { type: 'bearer' }).send(body);
    const pub = async () => (await api().get('/api/v1/shops/MOKA01').expect(200)).body.wifi;

    expect((await wifi(t).expect(200)).body).toEqual({ enabled: false, ssid: '', password: '', security: 'WPA', hidden: false });
    expect(await pub()).toBeNull();

    // Checks: a name is needed to turn it on; WPA needs 8 to 63 characters; no password for an open network.
    await save(t, { enabled: true, ssid: '', password: 'longenough', security: 'WPA', hidden: false }).expect(400);
    await save(t, { enabled: true, ssid: 'Moka Guest', password: 'short', security: 'WPA', hidden: false }).expect(400);
    await save(t, { enabled: true, ssid: 'Moka Guest', password: 'x', security: 'nopass', hidden: false }).expect(400);
    await save(t, { enabled: true, ssid: 'x'.repeat(33), password: 'longenough', security: 'WPA', hidden: false }).expect(400);
    await save(t, { enabled: true, ssid: 'Moka Guest', password: 'longenough', security: 'WPA3', hidden: false }).expect(400);
    await save(m, { enabled: true, ssid: 'Moka Guest', password: 'coffee2026', security: 'WPA', hidden: false }).expect(403);

    await save(t, { enabled: true, ssid: ' Moka Guest ', password: 'coffee2026', security: 'WPA', hidden: true }).expect(201);
    expect(await pub()).toEqual({ ssid: 'Moka Guest', password: 'coffee2026', security: 'WPA', hidden: true });
    expect((await wifi(m).expect(200)).body).toMatchObject({ enabled: true, ssid: 'Moka Guest' });

    // Off: the details are kept for later but customers no longer see them.
    await save(t, { enabled: false, ssid: 'Moka Guest', password: 'coffee2026', security: 'WPA', hidden: true }).expect(201);
    expect(await pub()).toBeNull();
    expect((await wifi(t).expect(200)).body).toEqual({ enabled: false, ssid: 'Moka Guest', password: 'coffee2026', security: 'WPA', hidden: true });

    // Off with an empty form is allowed (the owner has no Wi-Fi to share).
    await save(t, { enabled: false, ssid: '', password: '', security: 'WPA', hidden: false }).expect(201);

    // An open network has no password.
    await save(t, { enabled: true, ssid: 'Moka Free', password: '', security: 'nopass', hidden: false }).expect(201);
    expect(await pub()).toEqual({ ssid: 'Moka Free', password: '', security: 'nopass', hidden: false });

    // The audit log records the change but never the password.
    const logs = await sql<{ type: string; detail: Record<string, unknown> }[]>`select type, detail from tc.audit_log where business_id = ${w.bizA} and type = 'shop.wifi' order by id`;
    expect(logs).toHaveLength(4);
    expect(JSON.stringify(logs)).not.toContain('coffee2026');
  });

  // Shop page (no board; DECISIONS 2026-11-21): the QR opens a page with cover, logo, name and tagline.
  it('owner sets a tagline and a cover photo; the public shop page shows both', async () => {
    const { accessToken: t } = await business(w.owner.phone);
    expect((await api().get('/api/v1/shops/MOKA01').expect(200)).body).toMatchObject({ tagline: null, coverUrl: null });

    await api().post('/api/v1/owner/look/tagline').auth(t, { type: 'bearer' }).send({ tagline: 'x'.repeat(61) }).expect(400);
    await api().post('/api/v1/owner/look/tagline').auth(t, { type: 'bearer' }).send({ tagline: '  Fresh coffee, warm cake  ' }).expect(201);
    await api().post('/api/v1/owner/look/cover').auth(t, { type: 'bearer' }).send({ dataUrl: 'data:image/png;base64,bm90IGFuIGltYWdl' }).expect(400);
    await api().post('/api/v1/owner/look/cover').auth(t, { type: 'bearer' }).send({ dataUrl: PNG_1PX }).expect(201);

    const shop = (await api().get('/api/v1/shops/MOKA01').expect(200)).body;
    expect(shop).toMatchObject({ tagline: 'Fresh coffee, warm cake', coverUrl: expect.stringContaining('/api/v1/shops/MOKA01/cover?v=') });
    const img = await api().get('/api/v1/shops/MOKA01/cover').expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect((await api().get('/api/v1/owner/look').auth(t, { type: 'bearer' }).expect(200)).body).toMatchObject({ tagline: 'Fresh coffee, warm cake', coverUrl: expect.any(String) });

    // A second cover replaces the first and changes the URL, so phones fetch the new one.
    await api().post('/api/v1/owner/look/cover').auth(t, { type: 'bearer' }).send({ dataUrl: PNG_1PX }).expect(201);
    const second = (await api().get('/api/v1/shops/MOKA01').expect(200)).body.coverUrl as string;
    expect(second).not.toBe(shop.coverUrl);

    // An empty tagline clears it; removing the cover goes back to the brand colour.
    await api().post('/api/v1/owner/look/tagline').auth(t, { type: 'bearer' }).send({ tagline: '' }).expect(201);
    await api().post('/api/v1/owner/look/cover/remove').auth(t, { type: 'bearer' }).expect(201);
    expect((await api().get('/api/v1/shops/MOKA01').expect(200)).body).toMatchObject({ tagline: null, coverUrl: null });
    await api().get('/api/v1/shops/MOKA01/cover').expect(404);

    // A new cover after a removal never reuses an old URL (phones cache covers for good).
    await api().post('/api/v1/owner/look/cover').auth(t, { type: 'bearer' }).send({ dataUrl: PNG_1PX }).expect(201);
    const third = (await api().get('/api/v1/shops/MOKA01').expect(200)).body.coverUrl as string;
    expect([shop.coverUrl, second]).not.toContain(third);

    const logs = await sql<{ type: string }[]>`select type from tc.audit_log where business_id = ${w.bizA} and type in ('shop.tagline', 'shop.cover') order by id`;
    expect(logs.map((l) => l.type)).toEqual(['shop.tagline', 'shop.cover', 'shop.cover', 'shop.tagline', 'shop.cover', 'shop.cover']);
  });

  it('stamp face: numbers by default; an owner picks an icon, customers see it, and no new rule version starts', async () => {
    const { accessToken: t } = await business(w.owner.phone);
    const c = (await api().post('/api/v1/auth/customer/join').send({ phone: '913800077', pin: GOOD_PIN, language: 'en', consent: true, shopCode: 'MOKA01' }).expect(201)).body.accessToken as string;
    const card = async () => (await api().get('/api/v1/customer/cards').auth(c, { type: 'bearer' }).expect(200)).body[0];
    expect((await card()).shop.stampIcon).toBe('number');
    expect((await api().get('/api/v1/owner/look').auth(t, { type: 'bearer' }).expect(200)).body).toMatchObject({ stampIcon: 'number', stampIcons: expect.arrayContaining(['number', 'cup']) });
    const versions = async () => (await sql<{ n: number }[]>`select count(*)::int as n from tc.rule_set where business_id = ${w.bizA}`)[0].n;
    const before = await versions();

    await api().post('/api/v1/owner/look/stamp-icon').auth(t, { type: 'bearer' }).send({ icon: 'skull' }).expect(400);
    await api().post('/api/v1/owner/look/stamp-icon').auth(t, { type: 'bearer' }).send({ icon: 'cup' }).expect(201);
    expect((await card()).shop.stampIcon).toBe('cup');
    expect((await api().get('/api/v1/owner/look').auth(t, { type: 'bearer' }).expect(200)).body.stampIcon).toBe('cup');
    expect(await versions()).toBe(before);
    const [log] = await sql<{ type: string }[]>`select type from tc.audit_log where business_id = ${w.bizA} order by id desc limit 1`;
    expect(log.type).toBe('shop.stamp_icon');
  });

  it('change own PIN needs the current one, refuses weak PINs, and keeps this phone signed in', async () => {
    const { accessToken: t } = await business(w.ownerB.phone);
    const wrong = await api().post('/api/v1/owner/security/pin').auth(t, { type: 'bearer' }).send({ current: '000001', pin: '730194' }).expect(401);
    expect(wrong.body.error).toBe('wrong_pin');
    await api().post('/api/v1/owner/security/pin').auth(t, { type: 'bearer' }).send({ current: GOOD_PIN, pin: '111111' }).expect(400);
    const ok = await api().post('/api/v1/owner/security/pin').auth(t, { type: 'bearer' }).send({ current: GOOD_PIN, pin: '730194' }).expect(201);
    expect(ok.body.accessToken).toBeTruthy();
    await api().get('/api/v1/me').auth(ok.body.accessToken, { type: 'bearer' }).expect(200);
    await api().post('/api/v1/auth/business/signin').send({ phone: local(w.ownerB.phone), pin: '730194' }).expect(200);
  });

  it('sign out of all other phones keeps only this one', async () => {
    const a = await business(w.manager.phone);
    const b = await business(w.manager.phone);
    await api().post('/api/v1/owner/security/signout-others').auth(a.accessToken, { type: 'bearer' }).expect(201);
    await api().get('/api/v1/me').auth(a.accessToken, { type: 'bearer' }).expect(200);
    await api().get('/api/v1/me').auth(b.accessToken, { type: 'bearer' }).expect(401);
  });

  it('date and time settings are kept per person', async () => {
    const { accessToken: t } = await business(w.owner.phone);
    await api().post('/api/v1/owner/prefs').auth(t, { type: 'bearer' }).send({ calendar: 'moon' }).expect(400);
    await api().post('/api/v1/owner/prefs').auth(t, { type: 'bearer' }).send({ calendar: 'eth', clock: 'eth' }).expect(201);
    expect((await api().get('/api/v1/owner/prefs').auth(t, { type: 'bearer' }).expect(200)).body).toEqual({ calendar: 'eth', clock: 'eth' });
  });
});
