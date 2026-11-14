import { Link } from 'react-router-dom';
import { CLOSURE, CORE, LEVELS } from '../../../shared/units.mjs';
import { useApp } from '../state/AppContext';
import { BADGES, useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { useHelper } from '../components/HelperChat';

export function LevelCard() {
  const { points, level } = useRewards();
  const { t } = useI18n();
  return (
    <section className="level-card" aria-labelledby="lvl-card-h">
      <div className="level-medal" aria-hidden>{level.icon}</div>
      <div className="level-body">
        <h2 id="lvl-card-h" className="level-name">{t('home.level', { n: level.n, name: t(`level.${level.name}`) })}</h2>
        <p className="level-points"><strong>{points}</strong> {t('common.points')}</p>
        <div className="progress" role="progressbar" aria-label={t('home.level', { n: level.n, name: t(`level.${level.name}`) })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
          <div className="progress-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
        </div>
        <p className="small muted">{level.next ? t('home.toNext', { n: level.toNext, name: t(`level.${level.next.name}`) }) : t('home.max')}</p>
        <ol className="level-ladder" aria-label="Levels">
          {LEVELS.map(l => (
            <li key={l.n} className={l.n <= level.n ? 'reached' : ''}>
              <span aria-hidden>{l.icon}</span> {t(`level.${l.name}`)} <span className="muted small">{l.min}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function BadgeGrid({ compact = false }: { compact?: boolean }) {
  const { earned } = useRewards();
  const { t } = useI18n();
  const got = new Set(earned.map(b => b.id));
  let list = compact ? BADGES.filter(b => got.has(b.id)) : BADGES;
  // Nothing earned yet: show a few locked badges as a preview, so the card is not empty.
  const preview = compact && !list.length;
  if (preview) list = BADGES.slice(0, 6);
  return (
    <>
    {preview && <p className="small muted badge-preview-note">{t('home.noBadges')}</p>}
    <ul className="badge-grid">
      {list.map(b => (
        <li key={b.id} className={`badge-tile ${got.has(b.id) ? 'earned' : 'locked'}`} style={got.has(b.id) ? { background: `linear-gradient(135deg, ${b.colors[0]}, ${b.colors[1]})` } : undefined}>
          <span className="badge-emoji" aria-hidden>{b.icon}</span>
          <span className="badge-label">{t(`badge.${b.id}`)}</span>
          <span className="sr-only">{got.has(b.id) ? ', earned' : ', not earned yet'}</span>
        </li>
      ))}
    </ul>
    </>
  );
}

export function nextLesson(done: Record<string, boolean> | undefined) {
  return CORE.find(l => !done?.[l.id]) ?? CLOSURE.find(l => !done?.[l.id]) ?? null;
}

export default function Home() {
  const { user, progress } = useApp();
  const { closureRecommended, streak } = useRewards();
  const { t, lesson } = useI18n();
  const helper = useHelper();
  const coreDone = CORE.filter(l => progress.done?.[l.id]).length;
  const next = nextLesson(progress.done);
  const name = user && !user.guest ? user.name.split(' ')[0] : null;

  return (
    <div className="home">
      <section className="hero">
        <img className="hero-logo" src="/software-disciples.png" alt="Software Disciples" width={768} height={512} />
        <div className="hero-text">
          <h1 className="hero-title">{name ? t('home.hi', { name }) : t('home.hiGuest')}</h1>
          <p className="lead">{t('home.sub')}</p>
          {streak >= 2 && <p className="streak-pill">🔥 {t('home.streak', { n: streak })}</p>}
          {next ? (
            <Link className="button big glow" to={`/lesson/${next.id}`}>
              {coreDone === 0 && !progress.done?.[next.id] && next.id === 'L1' ? t('home.start') : t('home.continue', { lesson: `${next.icon} ${lesson(next.id).title}` })}
            </Link>
          ) : (
            <Link className="button big glow" to="/coding">{t('home.allDone')}</Link>
          )}
        </div>
      </section>

      <div className="home-grid">
        <LevelCard />
        <section className="card" aria-labelledby="badges-h">
          <h2 id="badges-h">{t('home.badges')}</h2>
          <BadgeGrid compact />
          <p className="small"><Link to="/student">{t('nav.student')} →</Link></p>
        </section>
      </div>

      <section className="card" aria-labelledby="road-h">
        <h2 id="road-h">{t('home.roadmap')}</h2>
        <ol className="mini-road">
          {[...CORE, ...CLOSURE].map(l => (
            <li key={l.id} className={`${progress.done?.[l.id] ? 'done' : ''} ${next?.id === l.id ? 'here' : ''} track-${l.track}`}>
              <Link to={`/lesson/${l.id}`} title={lesson(l.id).title}>
                <span className="mini-road-dot" aria-hidden>{progress.done?.[l.id] ? '✓' : l.icon}</span>
                <span className="mini-road-id">{l.id}</span>
                <span className="sr-only">{lesson(l.id).title}{progress.done?.[l.id] ? `, ${t('lesson.done')}` : ''}</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="small"><Link to="/roadmap">{t('road.title')} →</Link></p>
      </section>

      <div className="tile-grid">
        <Link to="/coding" className={`tile ${coreDone === CORE.length ? 'tile-open' : 'tile-locked'}`}>
          <span className="tile-icon" aria-hidden>{coreDone === CORE.length ? '💻' : '🔒'}</span>
          <strong>{t('nav.coding')}</strong>
          <span className="small">{coreDone === CORE.length ? t('home.codingOpen') : t('home.codingLocked', { n: coreDone })}</span>
        </Link>
        <Link to="/lesson/U5" className={`tile ${closureRecommended ? 'tile-open' : ''}`}>
          <span className="tile-icon" aria-hidden>🔗</span>
          <strong>{t('lessons.closure')}</strong>
          <span className="small">{closureRecommended ? t('home.closureReady') : t('home.closureSoon')}</span>
        </Link>
        <Link to="/videos" className="tile">
          <span className="tile-icon" aria-hidden>🎬</span>
          <strong>{t('nav.videos')}</strong>
          <span className="small">{t('home.videos')}</span>
        </Link>
        <Link to="/build" className="tile">
          <span className="tile-icon" aria-hidden>🧪</span>
          <strong>{t('nav.build')}</strong>
          <span className="small">{t('home.build')}</span>
        </Link>
        <button type="button" className="tile" onClick={() => helper.open()}>
          <span className="tile-icon" aria-hidden>🤖</span>
          <strong>{t('chat.title')}</strong>
          <span className="small">{t('home.ask')}</span>
        </button>
      </div>
    </div>
  );
}
