import { Link, useParams } from 'react-router-dom';
import type { ComponentType } from 'react';
import { CLOSURE, CORE, LESSONS, OUTCOMES, REFS, cite, unitById } from '../../../shared/units.mjs';
import { useApp, useTimeOnUnit } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { Quiz } from '../components/Quiz';
import { useSpeech } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';
import { ApplicationsWidget, ArrayListWidget, FriendsWidget, TraversalWidget, WalkthroughWidget } from './lessonWidgets';
import { U1Widget, U3Widget, U5Widget, U6Widget, U7Widget, U8Widget } from './unitWidgets';

const WIDGETS: Record<string, ComponentType> = {
  L1: ArrayListWidget,
  L2: FriendsWidget,
  L3: U1Widget,
  L4: ApplicationsWidget,
  L5: U3Widget,
  L6: () => <TraversalWidget kind="BFS" />,
  L7: () => <TraversalWidget kind="DFS" />,
  L8: WalkthroughWidget,
  U5: U5Widget,
  U6: U6Widget,
  U7: U7Widget,
  U8: U8Widget,
};

/** A lesson card on the Lessons page and Home. */
export function LessonCard({ id }: { id: string }) {
  const { progress } = useApp();
  const { lesson, t } = useI18n();
  const l = unitById(id)!;
  const txt = lesson(id);
  const done = progress.done?.[id];
  const best = progress.quizBest?.[id];
  return (
    <Link to={`/lesson/${id}`} className={`lesson-card ${done ? 'is-done' : ''} track-${l.track}`}>
      <span className="lesson-icon" aria-hidden>{l.icon}</span>
      <span className="lesson-card-body">
        <span className="lesson-id">{id}</span>
        <span className="lesson-card-title">{txt.title}</span>
        <span className="lesson-card-short">{txt.short}</span>
      </span>
      <span className="lesson-card-status">
        {done ? <span className="done-tick" title={t('lesson.done')}>✓<span className="sr-only">{t('lesson.done')}</span></span> : <span className="sr-only">{t('lesson.notDone')}</span>}
        {best !== undefined && <span className="best">{best}%</span>}
      </span>
    </Link>
  );
}

export function LessonsPage() {
  const { t } = useI18n();
  const { closureRecommended } = useRewards();
  return (
    <div>
      <h1 className="page-title">{t('lessons.title')}</h1>
      <p className="lead">{t('lessons.intro')}</p>
      <h2 className="section-title">{t('lessons.core')}</h2>
      <div className="lesson-grid">{CORE.map(l => <LessonCard key={l.id} id={l.id} />)}</div>
      <h2 className="section-title">🔗 {t('lessons.closure')}</h2>
      <p className={`callout small ${closureRecommended ? 'callout-good' : ''}`}>{closureRecommended ? t('home.closureReady') : t('lessons.closureNote')}</p>
      <div className="lesson-grid">{CLOSURE.map(l => <LessonCard key={l.id} id={l.id} />)}</div>
    </div>
  );
}

export default function LessonPage() {
  const { id = 'L1' } = useParams();
  const l = unitById(id);
  const { progress } = useApp();
  const { closureRecommended } = useRewards();
  const { lesson, t, isDraft } = useI18n();
  const { speak, stop, active, supported } = useSpeech();
  useTimeOnUnit(id);
  if (!l) return <p>That lesson does not exist. <Link to="/lessons">{t('nav.lessons')}</Link></p>;
  const txt = lesson(id);
  const n = LESSONS.findIndex(x => x.id === id);
  const prev = LESSONS[n - 1];
  const next = LESSONS[n + 1];
  const Widget = WIDGETS[id];
  const ref = REFS[l.ref];
  const reading = active?.key.startsWith('learn');
  const readAll = () => speak([txt.goal, ...txt.points, txt.example].map((p, i) => ({ key: `learn-${i}`, say: toSpoken(p) })));

  return (
    <article className="lesson">
      <nav className="unit-nav small" aria-label="Lesson navigation">
        <Link to="/lessons">← {t('nav.lessons')}</Link>
        <span className="spacer" />
        {prev && <Link to={`/lesson/${prev.id}`}>← {prev.id}</Link>}
        {next && <Link to={`/lesson/${next.id}`}>{next.id} →</Link>}
      </nav>
      <header className="lesson-head">
        <span className="lesson-head-icon" aria-hidden>{l.icon}</span>
        <div>
          <p className="eyebrow">{l.track === 'core' ? t('lessons.core') : t('lessons.closure')} · {l.id}</p>
          <h1>{txt.title}</h1>
          <div className="chips">
            {progress.done?.[id] ? <span className="chip chip-good">✓ {t('lesson.done')}</span> : <span className="chip">{t('lesson.notDone')}</span>}
            {progress.quizBest?.[id] !== undefined && <span className="chip">🏆 {progress.quizBest[id]}%</span>}
            {l.track === 'closure' && !closureRecommended && <span className="chip chip-warn">{t('home.closureSoon')}</span>}
            {l.outcomes.map(o => <span key={o} className="chip outcome" title={OUTCOMES[o]}>{o}<span className="sr-only">: {OUTCOMES[o]}</span></span>)}
          </div>
        </div>
      </header>
      {isDraft && <p className="draft-note small">🌍 {t('lesson.draft')}</p>}

      <section className="card" aria-labelledby="s1">
        <h2 id="s1"><span className="step-num">1</span> {t('lesson.learn')}</h2>
        <p className={`lead ${active?.key === 'learn-0' ? 'reading-block' : ''}`}>{txt.goal}</p>
        <h3 className="small-heading">{t('lesson.keyIdeas')}</h3>
        <ul className="key-ideas">
          {txt.points.map((p, i) => <li key={i} className={active?.key === `learn-${i + 1}` ? 'reading-block' : ''}>{p}</li>)}
        </ul>
        <div className={`example ${active?.key === `learn-${txt.points.length + 1}` ? 'reading-block' : ''}`}>
          <span className="example-label">💡 {t('lesson.example')}:</span> {txt.example}
        </div>
        {supported && (
          <button type="button" className={`speaker ${reading ? 'reading' : ''}`} onClick={() => (reading ? stop() : readAll())}>
            {reading ? '■' : '🔊'} {t('lesson.readAloud')}
          </button>
        )}
        <p className="small muted ref-line">
          📚 {t('lesson.readMore')}: {cite(ref)}. {t('lesson.slides')}: {ref.slides}.
        </p>
      </section>

      <section className="card" aria-labelledby="s2">
        <h2 id="s2"><span className="step-num">2</span> {t('lesson.try')}</h2>
        <Widget />
      </section>

      <div aria-labelledby="s3">
        <h2 id="s3" className="section-title"><span className="step-num">3</span> {t('lesson.quiz')}</h2>
        <p className="small muted">{t('quiz.intro')}</p>
        <Quiz key={id} lesson={id} />
      </div>

      <nav className="lesson-footer" aria-label="Next and previous lesson">
        {prev ? <Link className="button secondary" to={`/lesson/${prev.id}`}>← {t('lesson.prev')}</Link> : <span />}
        {next ? <Link className="button" to={`/lesson/${next.id}`}>{t('lesson.next')}: {lesson(next.id).title} →</Link> : <Link className="button" to="/roadmap">{t('nav.roadmap')} →</Link>}
      </nav>
    </article>
  );
}
