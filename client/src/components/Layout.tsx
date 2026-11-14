import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';

export default function Layout() {
  const { user } = useApp();
  const { points, level } = useRewards();
  const { t } = useI18n();
  const staff = user?.role === 'lecturer' || user?.role === 'tutor';
  const loc = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState(false);
  // Move focus to the page on navigation so screen readers announce the new page.
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus();
    setMenu(false);
  }, [loc.pathname]);
  const links: [string, string, boolean?][] = [
    ['/', t('nav.home'), true],
    ['/lessons', t('nav.lessons')],
    ['/roadmap', t('nav.roadmap')],
    ['/coding', t('nav.coding')],
    ['/videos', t('nav.videos')],
    ['/build', t('nav.build')],
    ['/student', t('nav.student')],
    ['/lecturer', t('nav.lecturer')],
    ['/settings', `⚙ ${t('nav.settings')}`],
  ];
  return (
    <>
      <a className="skip-link" href="#main" onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>{t('nav.skip')}</a>
      <header className="topbar">
        <NavLink to={staff ? '/lecturer' : '/'} className="brand" aria-label="Software Disciples, home">
          <img src="/disciples-mark.png" alt="" className="brand-mark" width={92} height={30} />
          <span className="brand-words">
            <span className="brand-top">SOFTWARE</span>
            <span className="brand-bottom">DISCIPLES</span>
          </span>
        </NavLink>
        {!staff && (
          <NavLink to="/roadmap" className="level-chip" title={t('home.level', { n: level.n, name: t(`level.${level.name}`) })}>
            <span aria-hidden>{level.icon}</span>
            <span className="level-chip-name">{t(`level.${level.name}`)}</span>
            <span className="level-chip-pts">{points} {t('common.pts')}</span>
            <span className="level-chip-bar" aria-hidden><span style={{ width: `${Math.round(level.progress * 100)}%` }} /></span>
          </NavLink>
        )}
        <button type="button" className="menu-toggle secondary" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(m => !m)}>☰ <span className="sr-only">Menu</span></button>
        <nav id="main-nav" className={`topnav ${menu ? 'open' : ''}`} aria-label="Main">
          {links.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
        </nav>
      </header>
      <main id="main" className={`container ${loc.pathname.startsWith('/build') || loc.pathname.startsWith('/lecturer') ? 'wide' : ''}`} ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer small">
        <span>SOFTWARE <span className="accent">DISCIPLES</span> · COS212</span>
        <span className="muted">{t('app.tagline')}</span>
      </footer>
    </>
  );
}
