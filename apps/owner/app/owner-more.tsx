'use client';

import { useEffect, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { ethiopianDateOf, formatEthiopianDate, formatOromoDate, formatTimeWithLocal, toEat, type Lang as CalLang } from '@temelash/ethiopian-calendar';
import { t, type Lang, type MessageKey } from '@temelash/i18n';
import { ApiFailure, authed, saveSession, type Session } from '@temelash/ui';
import s from './app.module.css';

/** OwnLook, OwnPoster, OwnSecurity and OwnDateTime, plus the shared date formatting they set. */

type Lfn = (k: string, v?: Record<string, string | number>, n?: number) => string;
const EAT = 'Africa/Addis_Ababa';

// ---------------------------------------------------------------- date and time preferences
export interface Prefs { calendar: 'greg' | 'eth'; clock: '24' | '12' | 'eth' }
let prefs: Prefs = { calendar: 'greg', clock: '24' };
export const setPrefs = (p: Prefs) => { prefs = p; };

/** A date and time the way this person chose (OwnDateTime), always in East Africa Time. */
export function formatWhen(iso: string | Date, lang: Lang, withDate = true): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const eat = toEat(d);
  const time = prefs.clock === 'eth'
    ? formatTimeWithLocal(eat.hour, eat.minute)
    : d.toLocaleTimeString(prefs.clock === '12' ? 'en-US' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: prefs.clock === '12', timeZone: EAT });
  if (!withDate) return time;
  const date = prefs.calendar === 'eth'
    ? formatEthiopianDate(ethiopianDateOf(d), lang as CalLang)
    : lang === 'om' ? formatOromoDate(d) : d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang, { day: 'numeric', month: 'short', timeZone: EAT });
  return `${date}, ${time}`;
}

export function formatDay(d: Date, lang: Lang): string {
  return prefs.calendar === 'eth'
    ? formatEthiopianDate(ethiopianDateOf(d), lang as CalLang)
    : lang === 'om' ? formatOromoDate(d, true) : d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang, { weekday: 'long', day: 'numeric', month: 'long', timeZone: EAT });
}

export function DateTime({ L, lang, onSaved }: { L: Lfn; lang: Lang; onSaved: (m: string) => void }) {
  const [p, setP] = useState<Prefs>(prefs);
  const chip = <K extends keyof Prefs>(key: K, val: Prefs[K], label: string, sub?: string) => (
    <button key={val} type="button" className={s.chip} aria-pressed={p[key] === val} onClick={() => setP((c) => ({ ...c, [key]: val }))} title={sub}>{label}</button>
  );
  const now = new Date();
  const preview = (() => { const was = prefs; prefs = p; const out = formatWhen(now, lang); prefs = was; return out; })();
  return (
    <>
      <p className={s.help}>{L('owner.dtHelp')}</p>
      <div className={s.label}>{L('owner.calLbl')}</div>
      <div className={s.chips} style={{ marginTop: 0 }}>{chip('calendar', 'greg', L('owner.calGreg'))}{chip('calendar', 'eth', L('owner.calEth'))}</div>
      <div className={s.label}>{L('staff.clockLbl')}</div>
      <div className={s.chips} style={{ marginTop: 0 }}>{chip('clock', '24', L('staff.clk24'))}{chip('clock', '12', L('staff.clk12'))}{chip('clock', 'eth', L('staff.clkEth'))}</div>
      <div className={s.section}>{L('owner.dtPreview')}</div>
      <div className={`${s.card} ${s.pad}`}><div className={s.rowTitle}>{preview}</div></div>
      <p className={s.muted} style={{ margin: '10px 4px 0' }}>{L('owner.dtNote')}</p>
      <button type="button" className={s.cta} onClick={async () => { await authed('owner', 'POST', '/owner/prefs', p); setPrefs(p); onSaved(L('owner.snSavedToast')); }}>{L('owner.save')}</button>
    </>
  );
}

// ---------------------------------------------------------------- look
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** Text on a colour: white when it reads at 4.5:1, dark otherwise (the board's fgFor). */
export const fgFor = (hex: string) => (1.05 / (lum(hex) + 0.05) >= 4.5 ? '#ffffff' : '#222222');

/** Crop to a centred square and scale to 400 x 400; PNG unless JPEG is needed to stay small. */
async function squareLogo(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 400;
  c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 400, 400);
  const png = c.toDataURL('image/png');
  return png.length * 0.75 <= 280_000 ? png : c.toDataURL('image/jpeg', 0.85);
}

/** Shop page cover: crop to a centred 2:1 and scale to 1200 x 600, as JPEG small enough to upload. */
async function wideCover(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const w = Math.min(img.width, img.height * 2);
  const h = w / 2;
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 600;
  c.getContext('2d')!.drawImage(img, (img.width - w) / 2, (img.height - h) / 2, w, h, 0, 0, 1200, 600);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const jpg = c.toDataURL('image/jpeg', q);
    if (jpg.length * 0.75 <= 480_000) return jpg;
  }
  return c.toDataURL('image/jpeg', 0.3);
}

const TAGLINE_MAX = 60;
type LookData = { color: string; swatches: string[]; logoUrl: string | null; tagline: string | null; coverUrl: string | null };

export function Look({ L, shopName, onSaved }: { L: Lfn; shopName: string; onSaved: (m: string) => void }) {
  const [look, setLook] = useState<LookData | null>(null);
  const [color, setColor] = useState('');
  const [tagline, setTagline] = useState('');
  const [err, setErr] = useState('');
  const [coverErr, setCoverErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const coverFile = useRef<HTMLInputElement>(null);
  const load = (keepTagline = false) => authed<LookData>('owner', 'GET', '/owner/look').then((l) => {
    setLook(l);
    setColor(l.color);
    if (!keepTagline) setTagline(l.tagline ?? '');
  });
  useEffect(() => { load(); }, []);
  if (!look) return null;
  const fg = fgFor(color);
  const save = async () => {
    await authed('owner', 'POST', '/owner/look', { color });
    if (tagline.trim() !== (look.tagline ?? '')) await authed('owner', 'POST', '/owner/look/tagline', { tagline });
    await load();
    onSaved(L('owner.snSavedToast'));
  };
  return (
    <>
      <p className={s.help}>{L('owner.lkHelp')}</p>
      <div className={s.card} style={{ marginTop: 16, padding: 18, borderRadius: 10, background: color, color: fg, display: 'flex', alignItems: 'center', gap: 14 }} aria-label={L('owner.psPreview')}>
        {look.logoUrl ? <img src={look.logoUrl} alt="" width={56} height={56} style={{ borderRadius: '50%', background: '#fff' }} /> : <span style={{ width: 56, height: 56, borderRadius: '50%', background: fg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{shopName.slice(0, 2).toUpperCase()}</span>}
        <span style={{ fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{shopName}</span>
      </div>
      <div className={s.label}>{L('owner.lkLogo')}</div>
      <p className={s.muted} style={{ marginTop: 0 }}>{L('owner.lkLogoHelp')}</p>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          await authed('owner', 'POST', '/owner/look/logo', { dataUrl: await squareLogo(f) });
          await load();
          setErr('');
          onSaved(L('owner.snSavedToast'));
        } catch (x) {
          setErr(x instanceof ApiFailure && x.code !== 'offline' ? L('owner.lkLogoHelp') : L('common.offline'));
        }
      }} />
      <button type="button" className={s.outline} style={{ marginTop: 8 }} onClick={() => file.current?.click()}>{L('owner.lkChange')}</button>
      <p role="alert" className={s.alert}>{err}</p>
      <div className={s.label}>{L('owner.lkColor')}</div>
      <div role="radiogroup" aria-label={L('owner.lkColor')} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 48px)', gap: 10 }}>
        {look.swatches.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={L('owner.colorN', { a: i + 1 })} onClick={() => setColor(c)}
            style={{ width: 48, height: 48, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2.5px solid #333' : '1.5px solid rgba(0,0,0,0.25)', boxShadow: color === c ? 'inset 0 0 0 2.5px #fff' : 'none' }} />
        ))}
      </div>
      <p className={s.muted}>{fg === '#ffffff' ? L('owner.lkContrastW') : L('owner.lkContrastD')}</p>

      {/* Shop page (no board; DECISIONS 2026-11-21): what customers see after scanning the QR code. */}
      <div className={s.section}>{L('owner.lkPage')}</div>
      <p className={s.muted} style={{ marginTop: 0 }}>{L('owner.lkPageHelp')}</p>
      <div className={s.card} style={{ marginTop: 10, overflow: 'hidden', borderRadius: 10 }} aria-label={L('owner.psPreview')}>
        <div style={{ height: 120, background: look.coverUrl ? `${color} url(${look.coverUrl}) center / cover no-repeat` : color }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: '0 14px 14px' }}>
          {look.logoUrl
            ? <img src={look.logoUrl} alt="" width={64} height={64} style={{ marginTop: -32, borderRadius: '50%', background: '#fff', border: '3px solid #fff', flex: 'none' }} />
            : <span style={{ marginTop: -32, width: 64, height: 64, borderRadius: '50%', border: '3px solid #fff', background: fg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flex: 'none' }}>{shopName.slice(0, 2).toUpperCase()}</span>}
          <div style={{ minWidth: 0, paddingTop: 10 }}>
            <div className={s.rowTitle}>{shopName}</div>
            {tagline.trim() && <div className={s.muted} style={{ overflowWrap: 'anywhere' }}>{tagline.trim()}</div>}
          </div>
        </div>
      </div>
      <div className={s.label}>{L('owner.lkCover')}</div>
      <p className={s.muted} style={{ marginTop: 0 }}>{L('owner.lkCoverHelp')}</p>
      <input ref={coverFile} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
          await authed('owner', 'POST', '/owner/look/cover', { dataUrl: await wideCover(f) });
          await load(true);
          setCoverErr('');
          onSaved(L('owner.snSavedToast'));
        } catch (x) {
          setCoverErr(x instanceof ApiFailure && x.code !== 'offline' ? L('owner.lkCoverHelp') : L('common.offline'));
        }
      }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className={s.outline} style={{ flex: 1 }} onClick={() => coverFile.current?.click()}>{look.coverUrl ? L('owner.lkCoverChange') : L('owner.lkCoverAdd')}</button>
        {look.coverUrl && (
          <button type="button" className={s.outline} style={{ flex: 1 }} onClick={async () => {
            try {
              await authed('owner', 'POST', '/owner/look/cover/remove');
              await load(true);
              setCoverErr('');
              onSaved(L('owner.snSavedToast'));
            } catch {
              setCoverErr(L('common.offline'));
            }
          }}>{L('owner.lkCoverRemove')}</button>
        )}
      </div>
      <p role="alert" className={s.alert}>{coverErr}</p>
      <label className={s.label} htmlFor="shop-tagline">{L('owner.lkTagline')}</label>
      <input id="shop-tagline" className={s.input} value={tagline} maxLength={TAGLINE_MAX} placeholder={L('owner.lkTaglinePh')}
        onChange={(e) => setTagline(e.target.value)} aria-describedby="shop-tagline-count" />
      <p id="shop-tagline-count" className={s.muted} style={{ textAlign: 'right' }}>{L('owner.lkTaglineCount', { a: tagline.length, b: TAGLINE_MAX })}</p>

      <button type="button" className={s.cta} onClick={save}>{L('owner.save')}</button>
    </>
  );
}

// ---------------------------------------------------------------- shop page Wi-Fi
type WifiData = { enabled: boolean; ssid: string; password: string; security: 'WPA' | 'WEP' | 'nopass'; hidden: boolean };

/** A row switch, the same as on Alerts (OwnAlertSet). */
function Switch({ on, title, sub, onToggle }: { on: boolean; title: string; sub: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={s.rowBtn} onClick={onToggle}
      style={{ width: '100%', minHeight: 60, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: '#333' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, lineHeight: '20px', fontWeight: 700 }}>{title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: '18px', color: '#555' }}>{sub}</span>
      </span>
      <span style={{ flex: 'none', width: 46, height: 28, borderRadius: 14, background: on ? '#333' : '#cfcfcf', position: 'relative' }}>
        <span className="tc-knob" style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
      </span>
    </button>
  );
}

/** Shop page Wi-Fi (DECISIONS 2026-11-21): customers see it on the shop page only while it is on. */
export function Wifi({ L, onSaved }: { L: Lfn; onSaved: (m: string) => void }) {
  const [w, setW] = useState<WifiData | null>(null);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { authed<WifiData>('owner', 'GET', '/owner/wifi').then(setW).catch(() => setErr(L('common.offline'))); }, []);
  if (!w) return <p role="alert" className={s.alert}>{err}</p>;
  const set = (p: Partial<WifiData>) => { setW({ ...w, ...p }); setErr(''); };
  const errText = (e: unknown) => {
    if (!(e instanceof ApiFailure) || e.code === 'offline') return L('common.offline');
    if (e.code === 'need_wifi_name' || e.code === 'bad_wifi_name') return L('owner.wfErrName');
    if (e.code === 'need_wifi_password' || e.code === 'bad_wifi_password') return w.security === 'WEP' ? L('owner.wfErrWep') : L('owner.wfErrWpa');
    return L('common.offline');
  };
  const save = async () => {
    setBusy(true);
    try {
      await authed('owner', 'POST', '/owner/wifi', { ...w, password: w.security === 'nopass' ? '' : w.password });
      onSaved(L('owner.snSavedToast'));
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className={s.help}>{L('owner.wfHelp')}</p>
      <div className={s.kvCard} style={{ marginTop: 16, padding: '0 16px' }}>
        <Switch on={w.enabled} title={L('owner.wfShow')} sub={w.enabled ? L('owner.wfShowOn') : L('owner.wfShowOff')} onToggle={() => set({ enabled: !w.enabled })} />
      </div>

      <label className={s.label} htmlFor="wifi-ssid">{L('owner.wfName')}</label>
      <input id="wifi-ssid" className={s.input} value={w.ssid} maxLength={32} autoComplete="off" placeholder={L('owner.wfNamePh')} onChange={(e) => set({ ssid: e.target.value })} />

      <div className={s.label}>{L('owner.wfSecurity')}</div>
      <div className={s.chips} style={{ marginTop: 0 }}>
        {([['WPA', 'owner.wfWpa'], ['WEP', 'owner.wfWep'], ['nopass', 'owner.wfOpen']] as const).map(([v, k]) => (
          <button key={v} type="button" className={s.chip} aria-pressed={w.security === v} onClick={() => set({ security: v })}>{L(k)}</button>
        ))}
      </div>

      {w.security !== 'nopass' && (
        <>
          <label className={s.label} htmlFor="wifi-pass">{L('owner.wfPassword')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="wifi-pass" className={s.input} style={{ flex: 1, minWidth: 0 }} type={show ? 'text' : 'password'} value={w.password} maxLength={63} autoComplete="off"
              placeholder={L('owner.wfPasswordPh')} onChange={(e) => set({ password: e.target.value })} />
            <button type="button" className={s.chip} aria-pressed={show} onClick={() => setShow(!show)}>{show ? L('owner.wfHide') : L('owner.wfReveal')}</button>
          </div>
        </>
      )}

      <div className={s.kvCard} style={{ marginTop: 16, padding: '0 16px' }}>
        <Switch on={w.hidden} title={L('owner.wfHidden')} sub={L('owner.wfHiddenSub')} onToggle={() => set({ hidden: !w.hidden })} />
      </div>

      <p className={s.muted} style={{ margin: '12px 4px 0' }}>{L('owner.wfNote')}</p>
      <p role="alert" className={s.alert}>{err}</p>
      <button type="button" className={s.cta} disabled={busy} onClick={save}>{L('owner.save')}</button>
    </>
  );
}

// ---------------------------------------------------------------- join poster
function QrSvg({ text, size }: { text: string; size: number }) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return <svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} shapeRendering="crispEdges" aria-hidden="true"><rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" /><path d={d} fill="#111" /></svg>;
}

export function Poster({ L, shop }: { L: Lfn; shop: { name: string; shopCode: string } | null }) {
  const [format, setFormat] = useState<'poster' | 'tent' | 'sticker'>('poster');
  const [plang, setPlang] = useState<Lang | 'all'>('all');
  const [look, setLook] = useState<{ color: string; logoUrl: string | null } | null>(null);
  const [big, setBig] = useState(false);
  useEffect(() => { authed<{ color: string; logoUrl: string | null }>('owner', 'GET', '/owner/look').then(setLook).catch(() => {}); }, []);
  if (!shop || !look) return null;
  const url = `${location.origin}/j/${shop.shopCode}`;
  const langs: Lang[] = plang === 'all' ? ['en', 'am', 'om'] : [plang];
  const fg = fgFor(look.color);
  const size = { poster: 220, tent: 170, sticker: 140 }[format];
  const sheet = (
    <div className="tc-poster" style={{ marginTop: 16, padding: format === 'sticker' ? 16 : 24, borderRadius: 14, background: '#fff', textAlign: 'center', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.13))', borderTop: `10px solid ${look.color}` }}>
      {look.logoUrl ? <img src={look.logoUrl} alt="" width={64} height={64} style={{ borderRadius: '50%' }} /> : <div style={{ margin: '0 auto', width: 64, height: 64, borderRadius: '50%', background: look.color, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22 }}>{shop.name.slice(0, 2).toUpperCase()}</div>}
      <div style={{ marginTop: 10, fontSize: format === 'sticker' ? 16 : 22, fontWeight: 700, letterSpacing: 1, color: '#222', textTransform: 'uppercase' }}>{shop.name}</div>
      {format !== 'sticker' && langs.map((l) => <div key={l} style={{ marginTop: 6, fontSize: 15, color: '#333' }}>{t(l, 'main.emptyS2')}</div>)}
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}><QrSvg text={url} size={size} /></div>
      <div style={{ marginTop: 10, fontSize: 13, letterSpacing: 0.7, color: '#555' }}>{langs.map((l) => t(l, 'main.codeLbl')).join(' · ')}</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, color: '#222' }}>{shop.shopCode}</div>
    </div>
  );
  if (big) {
    return (
      <div className="tc-fade" style={{ textAlign: 'center' }}>
        <div style={{ marginTop: 20, display: 'inline-block', padding: 12, background: '#fff', borderRadius: 12 }}><QrSvg text={url} size={300} /></div>
        <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, letterSpacing: 3 }}>{shop.shopCode}</div>
        <button type="button" className={s.outline} onClick={() => setBig(false)}>{L('owner.back')}</button>
      </div>
    );
  }
  return (
    <>
      <style>{'@media print { body * { visibility: hidden } .tc-poster, .tc-poster * { visibility: visible } .tc-poster { position: fixed; inset: 0; margin: 0 !important; filter: none !important; border-radius: 0 !important } }'}</style>
      <p className={s.help}>{L('owner.psHelp')}</p>
      <div className={s.label}>{L('owner.psFormat')}</div>
      <div className={s.chips} style={{ marginTop: 0 }}>
        {(['poster', 'tent', 'sticker'] as const).map((f) => <button key={f} type="button" className={s.chip} aria-pressed={format === f} onClick={() => setFormat(f)}>{L({ poster: 'owner.psPoster', tent: 'owner.psTent', sticker: 'owner.psSticker' }[f])}</button>)}
      </div>
      <div className={s.label}>{L('owner.psLang')}</div>
      <div className={s.chips} style={{ marginTop: 0 }}>
        <button type="button" className={s.chip} aria-pressed={plang === 'all'} onClick={() => setPlang('all')}>{L('owner.psAll')}</button>
        {(['en', 'am', 'om'] as Lang[]).map((l) => <button key={l} type="button" className={s.chip} aria-pressed={plang === l} onClick={() => setPlang(l)}>{{ en: 'English', am: 'አማርኛ', om: 'Afaan Oromoo' }[l]}</button>)}
      </div>
      {sheet}
      <button type="button" className={s.cta} onClick={() => { authed('owner', 'POST', '/owner/setup/poster', {}).catch(() => {}); window.print(); }}>{L('owner.psDownload')}</button>
      <button type="button" className={s.ghost} onClick={() => setBig(true)}>{L('owner.psShowQr')}</button>
    </>
  );
}

// ---------------------------------------------------------------- security
export function Security({ L, onSaved }: { L: Lfn; onSaved: (m: string) => void }) {
  const [cur, setCur] = useState('');
  const [np1, setNp1] = useState('');
  const [np2, setNp2] = useState('');
  const [err, setErr] = useState('');
  const pinInput = (id: string, label: string, v: string, set: (x: string) => void) => (
    <>
      <label htmlFor={id} className={s.label}>{label}</label>
      <input id={id} className={s.input} type="password" inputMode="numeric" maxLength={6} placeholder="------" value={v} onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </>
  );
  const save = async () => {
    if (!/^\d{6}$/.test(np1)) return setErr(L('owner.spErrLen'));
    if (np1 !== np2) return setErr(L('owner.spErrMatch'));
    try {
      const sess = await authed<Session>('owner', 'POST', '/owner/security/pin', { current: cur, pin: np1 });
      saveSession('owner', sess);
      setCur(''); setNp1(''); setNp2(''); setErr('');
      onSaved(L('owner.pinSaved'));
    } catch (e) {
      const code = e instanceof ApiFailure ? e.code : 'offline';
      setErr(code === 'wrong_pin' ? L('owner.secWrongCur') : code === 'weak_pin' ? L('owner.spErrWeak') : code === 'same_pin' ? L('owner.spErrSame') : L('common.offline'));
    }
  };
  return (
    <>
      <div className={s.section}>{L('owner.secPinT')}</div>
      {pinInput('sc', L('owner.secCur'), cur, setCur)}
      {pinInput('s1', L('owner.newPin'), np1, setNp1)}
      {pinInput('s2', L('owner.confirmPin'), np2, setNp2)}
      <p role="alert" className={s.alert}>{err}</p>
      <button type="button" className={s.cta} style={{ marginTop: 8 }} onClick={save}>{L('owner.secSave')}</button>
      <div className={`${s.card} ${s.pad}`} style={{ marginTop: 20 }}>
        <div className={s.rowTitle}>{L('owner.secSmsT')}</div>
        <div className={s.rowSub}>{L('owner.secSmsText')}</div>
      </div>
      <div className={s.section}>{L('owner.secDevices')}</div>
      <button type="button" className={s.outline} style={{ marginTop: 0 }} onClick={async () => { await authed('owner', 'POST', '/owner/security/signout-others'); onSaved(L('owner.secOutToast')); }}>{L('owner.secOutAll')}</button>
    </>
  );
}

// ---------------------------------------------------------------- activity log wording
const LOG_KEYS: Record<string, MessageKey | string> = {
  'team.added': 'owner.addPerson', 'team.pin_reset': 'owner.sdReset', 'team.unlocked': 'owner.sdUnlock', 'team.removed': 'owner.sdOff',
  'team.limit': 'owner.limSecLbl', 'rules.changed': 'owner.lgCardRules', 'shop.details': 'owner.lgDetails', 'shop.look': 'owner.lgLook',
  'shop.logo': 'owner.lgLook', 'shop.stamp_icon': 'owner.lgLook', 'branch.added': 'owner.brAdd', 'branch.saved': 'owner.lgHours', 'stamp.approved': 'owner.rvApprovedToast',
  'stamp.rejected': 'owner.rvDeclinedToast', 'stamp.checked': 'owner.rvFineToast', 'stamp.added': 'staff.stampLine', 'stamp.pending': 'staff.needsApproval',
  'reward.redeemed': 'staff.rewardLine', 'card.fix_add': 'owner.fixAdd', 'card.fix_remove': 'owner.fixRemove', 'card.fix_undo': 'owner.fixUndo',
  'card.fix_extend': 'owner.fixExtend', 'card.fix_pause': 'owner.fixPause', 'card.fix_resume': 'owner.fixResume', 'auth.signin': 'owner.siBtn',
  'auth.signout_others': 'owner.secOutAll', 'auth.pin_changed': 'owner.pinSaved',
};

/** The log entry in the reader's language when we have the words for it, else the stored text. */
export function logText(lang: Lang, type: string, text: string): string {
  const k = LOG_KEYS[type];
  return k ? t(lang, k as MessageKey) : text;
}
