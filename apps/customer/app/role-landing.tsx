'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { isLang, t, type Lang, type MessageKey } from '@temelash/i18n';
import { apiGet } from '@temelash/ui';
import s from './role-landing.module.css';

/**
 * The public website at /: header, hero, the choice of owner, staff or customer, how it works,
 * what businesses get, pricing, questions and footer. It has no prototype board (DECISIONS.md,
 * 2026-11-06). Prices, the trial and contact details come from the settings through GET /site,
 * never from here. Links are plain anchors because /owner and /staff are separate apps behind
 * Caddy. Shop QR codes go to /j/CODE, so they never pass through this page.
 */

interface Site {
  trialDays: number;
  graceDays: number;
  starter: number;
  full: number;
  extraBranch: number;
  fullBranches: number;
  support: { phone: string; telegram: string };
}

const LANGS: Array<[Lang, string]> = [['en', 'English'], ['am', 'አማርኛ'], ['om', 'Afaan Oromoo']];
const OWNER = '/owner?start=1', STAFF = '/staff', CUSTOMER = '/?start=1';

const NAV: Array<[string, MessageKey]> = [['#how', 'land.navHow'], ['#business', 'land.navBusiness'], ['#pricing', 'land.navPricing'], ['#faq', 'land.navFaq']];
const ROLES: Array<{ href: string; title: MessageKey; sub: MessageKey; icon: string }> = [
  { href: OWNER, title: 'land.owner', sub: 'land.ownerSub', icon: 'M4 21V9l8-5 8 5v12M9 21v-6h6v6' },
  { href: STAFF, title: 'land.staff', sub: 'land.staffSub', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0' },
  { href: CUSTOMER, title: 'land.customer', sub: 'land.customerSub', icon: 'M3 8h18v10H3zM3 12h18M8 8V6h8v2' },
];
const STEPS: Array<[MessageKey, MessageKey]> = [['land.how1', 'land.how1S'], ['land.how2', 'land.how2S'], ['land.how3', 'land.how3S'], ['land.how4', 'land.how4S']];
const FEATURES: Array<[MessageKey, MessageKey, string]> = [
  ['land.f1', 'land.f1S', 'M4 6h16v12H4zM8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01'],
  ['land.f2', 'land.f2S', 'M8 3h8v18H8zM11 18h2'],
  ['land.f3', 'land.f3S', 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a3 3 0 0 0 0-6M21 20a6 6 0 0 0-4-5.6'],
  ['land.f4', 'land.f4S', 'M4 20V10M10 20V4M16 20v-7M21 20H3'],
  ['land.f5', 'land.f5S', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4'],
  ['land.f6', 'land.f6S', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18'],
];
const CATS: Array<[MessageKey, string]> = [
  ['owner.catFood', 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 5h-2M8 3v3M12 3v3'],
  ['owner.catSalon', 'M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 7l11 11M9 17L20 6'],
  ['owner.catSpa', 'M12 21c-5 0-8-3-8-8 4 0 6 1 8 4 2-3 4-4 8-4 0 5-3 8-8 8zM12 15c-2-3-2-7 0-11 2 4 2 8 0 11z'],
  ['owner.catCar', 'M4 16v-4l2-5h12l2 5v4zM4 12h16M7 16v2M17 16v2'],
];

function Icon({ d, size = 26 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Section({ id, title, sub, tint, children }: { id?: string; title: string; sub?: string; tint?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`${s.section} ${tint ? s.tint : ''}`}>
      <div className={s.inner}>
        <h2 className={s.heading}>{title}</h2>
        {sub && <p className={s.sub}>{sub}</p>}
        {children}
      </div>
    </section>
  );
}

export function RoleLanding() {
  // The server renders English; a language saved earlier is applied after mount.
  const [lang, setLang] = useState<Lang>('en');
  const [menu, setMenu] = useState(false);
  const [site, setSite] = useState<Site | null>(null);
  const L = (k: MessageKey, v?: Record<string, string | number>) => t(lang, k, v);
  const birr = (n: number) => L('owner.birr', { a: n.toLocaleString('en-US') });

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )tc_lang=(\w+)/);
    if (m && isLang(m[1])) setLang(m[1]);
    // Without it the page still works: pricing and contact details stay hidden.
    apiGet<Site>('/site').then(setSite).catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const pickLang = (l: Lang) => {
    setLang(l);
    document.cookie = `tc_lang=${l}; path=/; max-age=31536000; samesite=lax`;
  };
  const langs = LANGS.map(([code, name]) => (
    <button key={code} type="button" className={s.lang} aria-pressed={lang === code} onClick={() => pickLang(code)}>{name}</button>
  ));

  return (
    <div className={`${s.page} tc-fade`}>
      <header className={s.header}>
        <div className={s.headerIn}>
          <a href="#top" className={s.logo}>{L('common.appName')}</a>
          <nav className={s.nav} aria-label={L('land.navMenu')}>
            {NAV.map(([href, k]) => <a key={href} href={href} className={s.navLink}>{L(k)}</a>)}
          </nav>
          <div className={s.langs}>{langs}</div>
          <a href="#start" className={s.headerCta}>{L('land.navStart')}</a>
          <button type="button" className={s.menuBtn} aria-label={L('land.navMenu')} aria-expanded={menu} aria-controls="site-menu" onClick={() => setMenu(!menu)}>
            <Icon d={menu ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} size={24} />
          </button>
        </div>
        {menu && (
          <div id="site-menu" className={s.menuPanel}>
            {NAV.map(([href, k]) => <a key={href} href={href} className={s.menuLink} onClick={() => setMenu(false)}>{L(k)}</a>)}
            <div className={s.menuLangs}>{langs}</div>
          </div>
        )}
      </header>

      <main id="top">
        <section className={s.hero}>
          <div className={s.heroBody}>
            <h1 className={s.title}>{L('land.title')}</h1>
            <p className={s.help}>{L('land.help')}</p>
            <div className={s.heroBtns}>
              <a href="#start" className={s.btnLight}>{L('land.navStart')}</a>
              <a href="#how" className={s.btnGhost}>{L('land.heroHow')}</a>
            </div>
          </div>
        </section>

        <Section id="start" title={L('land.pick')}>
          <div className={s.roles}>
            {ROLES.map((r) => (
              <a key={r.href} href={r.href} className={s.role}>
                <span className={s.roleIcon}><Icon d={r.icon} size={28} /></span>
                <span className={s.roleText}>
                  <strong className={s.roleTitle}>{L(r.title)}</strong>
                  <span className={s.roleSub}>{L(r.sub)}</span>
                </span>
                <span className={s.roleArrow}><Icon d="M9 6l6 6-6 6" size={20} /></span>
              </a>
            ))}
          </div>
        </Section>

        <Section id="how" title={L('land.navHow')} sub={L('land.howSub')} tint>
          <ol className={s.steps}>
            {STEPS.map(([title, sub], i) => (
              <li key={title} className={s.card}>
                <span className={s.stepNum} aria-hidden="true">{i + 1}</span>
                <strong className={s.cardTitle}>{L(title)}</strong>
                <span className={s.cardText}>{L(sub)}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="business" title={L('land.bizTitle')} sub={L('land.bizSub')}>
          <ul className={s.features}>
            {FEATURES.map(([title, sub, icon]) => (
              <li key={title} className={s.feature}>
                <span className={s.roleIcon}><Icon d={icon} /></span>
                <strong className={s.cardTitle}>{L(title)}</strong>
                <span className={s.cardText}>{L(sub)}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={L('land.whoTitle')} tint>
          <ul className={s.cats}>
            {CATS.map(([label, icon]) => (
              <li key={label} className={s.cat}><span className={s.roleIcon}><Icon d={icon} /></span><span className={s.cardTitle}>{L(label)}</span></li>
            ))}
          </ul>
        </Section>

        {site && (
          <Section id="pricing" title={L('land.priceTitle')} sub={L('land.priceSub', { a: site.trialDays })}>
            <div className={s.prices}>
              <div className={s.price}>
                <h3 className={s.planName}>{L('owner.plStarter')}</h3>
                <p className={s.amount}>{L('land.perYear', { a: birr(site.starter) })}</p>
                <p className={s.cardText}>{L('land.priceStarter')}</p>
                <a href={OWNER} className={s.btnOutline}>{L('land.priceCta')}</a>
              </div>
              <div className={`${s.price} ${s.priceMain}`}>
                <h3 className={s.planName}>{L('owner.plFull')}</h3>
                <p className={s.amount}>{L('land.perYear', { a: birr(site.full) })}</p>
                <p className={s.cardText}>{L('land.priceFull', { a: site.fullBranches, b: birr(site.extraBranch) })}</p>
                <a href={OWNER} className={s.btnDark}>{L('land.priceCta')}</a>
              </div>
            </div>
            <p className={s.note}>{L('land.priceCash')}</p>
          </Section>
        )}

        <Section id="faq" title={L('land.navFaq')} tint>
          <div className={s.faq}>
            <details className={s.q}><summary className={s.qT}>{L('land.q1')}</summary><p className={s.cardText}>{L('land.a1')}</p></details>
            <details className={s.q}><summary className={s.qT}>{L('land.q2')}</summary><p className={s.cardText}>{L('land.a2')}</p></details>
            <details className={s.q}><summary className={s.qT}>{L('land.q3')}</summary><p className={s.cardText}>{L('land.a3')}</p></details>
            <details className={s.q}><summary className={s.qT}>{L('land.q4')}</summary><p className={s.cardText}>{L('land.a4')}</p></details>
            {site && <details className={s.q}><summary className={s.qT}>{L('land.q5')}</summary><p className={s.cardText}>{L('land.a5', { a: site.graceDays })}</p></details>}
          </div>
        </Section>

        <section className={s.closing}>
          <h2 className={s.closingTitle}>{L('land.ctaTitle')}</h2>
          <a href={OWNER} className={s.btnLight}>{L('land.priceCta')}</a>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.footerIn}>
          <div>
            <div className={s.footerLogo}>{L('common.appName')}</div>
            <p className={s.footerText}>{L('land.title')}</p>
          </div>
          <nav aria-label={L('land.footSite')}>
            <h3 className={s.footerHead}>{L('land.footSite')}</h3>
            {NAV.map(([href, k]) => <a key={href} href={href} className={s.footerLink}>{L(k)}</a>)}
          </nav>
          <nav aria-label={L('land.footSign')}>
            <h3 className={s.footerHead}>{L('land.footSign')}</h3>
            <a href={OWNER} className={s.footerLink}>{L('land.footOwner')}</a>
            <a href={STAFF} className={s.footerLink}>{L('land.footStaff')}</a>
            <a href={CUSTOMER} className={s.footerLink}>{L('land.footCustomer')}</a>
          </nav>
          {site && (site.support.phone || site.support.telegram) && (
            <div>
              <h3 className={s.footerHead}>{L('land.footContact')}</h3>
              {site.support.phone && <a href={`tel:${site.support.phone.replace(/\s+/g, '')}`} className={s.footerLink}>{site.support.phone}</a>}
              {site.support.telegram && <span className={s.footerLink}>{site.support.telegram}</span>}
            </div>
          )}
        </div>
        <p className={s.copy}>{L('land.rights', { a: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
}
