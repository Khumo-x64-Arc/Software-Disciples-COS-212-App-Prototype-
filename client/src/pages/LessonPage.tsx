import { Link, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState, type ComponentType } from 'react';
import { EXAM, LEGACY_IDS, LESSONS, OUTCOMES, PART1, PART2, POINTS, REFS, cite, unitById } from '../../../shared/units.mjs';
import { videoById } from '../../../shared/videos.mjs';
import { api } from '../api';
import { useApp, useTimeOnUnit } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { Quiz } from '../components/Quiz';
import { useSpeech } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';
import { ApplicationsWidget, ArrayListWidget, FriendsWidget, TraversalWidget, WalkthroughWidget } from './lessonWidgets';
import { U1Widget, U3Widget, L9Widget, L10Widget, L11Widget, L12Widget } from './unitWidgets';

const WIDGETS: Record<string, ComponentType> = {
  L1: ArrayListWidget,
  L2: FriendsWidget,
  L3: U1Widget,
  L4: ApplicationsWidget,
  L5: U3Widget,
  L6: () => <TraversalWidget kind="BFS" />,
  L7: () => <TraversalWidget kind="DFS" />,
  L8: WalkthroughWidget,
  L9: L9Widget,
  L10: L10Widget,
  L11: L11Widget,
  L12: L12Widget,
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

/** The bonus quest card: the final exam, after the last lesson. */
export function ExamCard() {
  const { progress } = useApp();
  const { examRecommended } = useRewards();
  const { t } = useI18n();
  return (
    <Link to="/exam" className={`lesson-card exam-card ${progress.examBest !== undefined ? 'is-done' : ''}`}>
      <span className="lesson-icon" aria-hidden>🏆</span>
      <span className="lesson-card-body">
        <span className="lesson-id">{t('exam.eyebrow')}</span>
        <span className="lesson-card-title">{t('exam.title')}</span>
        <span className="lesson-card-short">{examRecommended ? t('exam.ready') : t('exam.short', { n: LESSONS.length * EXAM.perLesson, pts: POINTS.examPass })}</span>
      </span>
      <span className="lesson-card-status">{progress.examBest !== undefined && <span className="best">{progress.examBest}%</span>}</span>
    </Link>
  );
}

export function LessonsPage() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="page-title">{t('lessons.title')}</h1>
      <p className="lead">{t('lessons.intro')}</p>
      <h2 className="section-title">{t('lessons.part1')}</h2>
      <div className="lesson-grid">{PART1.map(l => <LessonCard key={l.id} id={l.id} />)}</div>
      <h2 className="section-title">🔗 {t('lessons.part2')}</h2>
      <div className="lesson-grid">{PART2.map(l => <LessonCard key={l.id} id={l.id} />)}</div>
      <h2 className="section-title">🏆 {t('exam.eyebrow')}</h2>
      <p className="callout small">{t('lessons.examNote')}</p>
      <div className="lesson-grid"><ExamCard /></div>
    </div>
  );
}

/** Videos for a lesson, embedded (privacy-enhanced YouTube), with a link out. */
function LessonVideos({ ids }: { ids: string[] }) {
  const { t } = useI18n();
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    api
      .videos()
      .then(r => live && setTitles(Object.fromEntries(r.videos.filter(v => v.title).map(v => [v.id, v.title as string]))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <div className="lesson-videos">
      {ids.map(id => {
        const v = videoById(id);
        if (!v) return null;
        const title = titles[id] ?? t('lesson.videoFallback', { n: v.n });
        return (
          <figure key={id} className="lesson-video">
            <div className="video-frame">
              <iframe
                src={v.embedUrl}
                title={title}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <figcaption className="small">
              <strong>{title}</strong> · <a href={v.watchUrl} target="_blank" rel="noopener noreferrer">{t('videos.watch')} <span aria-hidden>↗</span><span className="sr-only"> (opens in a new tab)</span></a>
              {v.lessons.length > 1 && <span className="muted"> · {t('lesson.videoShared', { ids: v.lessons.join(', ') })}</span>}
            </figcaption>
          </figure>
        );
      })}
      <p className="small muted">{t('lesson.videoTip')}</p>
    </div>
  );
}

export default function LessonPage() {
  const { id = 'L1' } = useParams();
  const l = unitById(id);
  const { progress } = useApp();
  const { lesson, t, isDraft } = useI18n();
  const { speak, stop, active, supported } = useSpeech();
  useTimeOnUnit(id);
  // Old links (U5–U8) go to the renumbered lessons (L9–L12).
  if (LEGACY_IDS[id]) return <Navigate to={`/lesson/${LEGACY_IDS[id]}`} replace />;
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
          <p className="eyebrow">{l.track === 'graphs' ? t('lessons.part1') : t('lessons.part2')} · {t('lesson.nOfM', { n: n + 1, m: LESSONS.length })}</p>
          <h1>{txt.title}</h1>
          <div className="chips">
            {progress.done?.[id] ? <span className="chip chip-good">✓ {t('lesson.done')}</span> : <span className="chip">{t('lesson.notDone')}</span>}
            {progress.quizBest?.[id] !== undefined && <span className="chip">🏆 {progress.quizBest[id]}%</span>}
            {l.videos?.length ? <span className="chip">🎬 {t('lesson.hasVideo')}</span> : null}
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

      {l.videos?.length ? (
        <section className="card" aria-labelledby="s-watch">
          <h2 id="s-watch"><span className="step-num">2</span> {t('lesson.watch')}</h2>
          <LessonVideos ids={l.videos} />
        </section>
      ) : null}

      <section className="card" aria-labelledby="s2">
        <h2 id="s2"><span className="step-num">{l.videos?.length ? 3 : 2}</span> {t('lesson.try')}</h2>
        <Widget />
      </section>

      <div aria-labelledby="s3">
        <h2 id="s3" className="section-title"><span className="step-num">{l.videos?.length ? 4 : 3}</span> {t('lesson.quiz')}</h2>
        <p className="small muted">{t('quiz.intro')}</p>
        <Quiz key={id} lesson={id} />
      </div>

      <nav className="lesson-footer" aria-label="Next and previous lesson">
        {prev ? <Link className="button secondary" to={`/lesson/${prev.id}`}>← {t('lesson.prev')}</Link> : <span />}
        {next ? <Link className="button" to={`/lesson/${next.id}`}>{t('lesson.next')}: {lesson(next.id).title} →</Link> : <Link className="button glow" to="/exam">🏆 {t('exam.title')} →</Link>}
      </nav>
    </article>
  );
}
