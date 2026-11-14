// The roadmap: a feedback view of the learner's whole journey, stop by stop.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CLOSURE, CORE, POINTS, type Lesson } from '../../../shared/units.mjs';
import { api, type Problem } from '../api';
import { useApp } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { LevelCard, nextLesson } from './Home';

function pointsFor(awarded: Record<string, number>, lesson: string) {
  return Object.entries(awarded).filter(([k]) => k === `lesson:${lesson}` || k.startsWith(`q:${lesson}:`)).reduce((a, [, v]) => a + v, 0);
}

export default function Roadmap() {
  const { progress, mastery } = useApp();
  const { closureRecommended } = useRewards();
  const { t, lesson } = useI18n();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  useEffect(() => {
    api.problems().then(r => setProblems(r.problems)).catch(() => setProblems([]));
  }, []);
  const awarded = progress.rewards?.awarded ?? {};
  const here = nextLesson(progress.done);
  const coreDone = CORE.filter(l => progress.done?.[l.id]).length;
  const passed = problems?.filter(p => p.state.passed).length ?? 0;

  const stop = (l: Lesson) => {
    const done = progress.done?.[l.id];
    const best = progress.quizBest?.[l.id] ?? (mastery[l.id]?.attempts ? mastery[l.id].best : undefined);
    const fb = best === undefined ? null : best >= 80 ? t('road.strong') : best >= 60 ? t('road.ok') : t('road.revisit');
    const tone = best === undefined ? '' : best >= 80 ? 'good' : best >= 60 ? 'ok' : 'bad';
    return (
      <li key={l.id} className={`road-stop ${done ? 'done' : ''} ${here?.id === l.id ? 'here' : ''}`}>
        <span className="road-marker" aria-hidden>{done ? '✓' : here?.id === l.id ? '📍' : l.icon}</span>
        <div className="road-card">
          <div className="road-top">
            <Link to={`/lesson/${l.id}`} className="road-title">{l.id} · {lesson(l.id).title}</Link>
            {here?.id === l.id && <span className="chip chip-brand">{t('road.youAreHere')}</span>}
            <span className="spacer" />
            {pointsFor(awarded, l.id) > 0 && <span className="points-pill small">+{pointsFor(awarded, l.id)} {t('common.pts')}</span>}
          </div>
          {best !== undefined ? (
            <>
              <div className="road-bar" aria-hidden><span className={`road-fill tone-${tone}`} style={{ width: `${best}%` }} /></div>
              <p className={`small road-fb tone-${tone}`}>{t('road.best', { n: best })}. {fb}</p>
            </>
          ) : (
            <p className="small muted">{t('road.notStarted')}</p>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="roadmap">
      <h1 className="page-title">{t('road.title')}</h1>
      <p className="lead">{t('road.intro')}</p>
      <LevelCard />
      <h2 className="section-title">{t('lessons.core')} · {t('road.done', { n: coreDone, m: CORE.length })}</h2>
      <ol className="road">{CORE.map(stop)}</ol>

      <h2 className="section-title">💻 {t('road.coding')}</h2>
      <div className={`card road-coding ${coreDone === CORE.length ? '' : 'locked'}`}>
        {coreDone < CORE.length ? (
          <p>🔒 {t('coding.locked', { n: coreDone })}</p>
        ) : problems === null ? (
          <p>{t('common.loading')}</p>
        ) : (
          <>
            <p>{t('road.done', { n: passed, m: problems.length })} · +{POINTS.problem} {t('common.pts')} each</p>
            <ul className="problem-dots">
              {problems.map(p => (
                <li key={p.id}><Link to={`/coding/${p.id}`} className={`pdot ${p.state.passed ? 'passed' : p.state.attempts ? 'tried' : ''}`} title={`${p.id} ${p.title}`}>{p.id}<span className="sr-only">: {p.title}, {p.state.passed ? t('coding.passed') : t('coding.notTried')}</span></Link></li>
              ))}
            </ul>
          </>
        )}
      </div>

      <h2 className="section-title">🔗 {t('lessons.closure')}</h2>
      <p className={`small callout ${closureRecommended ? 'callout-good' : ''}`}>{closureRecommended ? t('home.closureReady') : t('lessons.closureNote')}</p>
      <ol className="road">{CLOSURE.map(stop)}</ol>
      <p className="road-finish" aria-hidden>👑 {t('road.finish')}</p>
    </div>
  );
}
