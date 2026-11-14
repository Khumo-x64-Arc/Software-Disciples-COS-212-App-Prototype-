// The bonus quest: a final exam that combines every lesson (L1 to L12).
// It is recommended once all twelve lessons are done, but it is never locked.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EXAM, LESSONS, POINTS } from '../../../shared/units.mjs';
import { useApp } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { Quiz } from '../components/Quiz';

export default function Exam() {
  const { progress } = useApp();
  const { examRecommended } = useRewards();
  const { t, lesson } = useI18n();
  const [started, setStarted] = useState(false);
  const done = LESSONS.filter(l => progress.done?.[l.id]).length;
  const next = LESSONS.find(l => !progress.done?.[l.id]);
  const total = LESSONS.length * EXAM.perLesson;

  return (
    <div className="exam-page">
      <p className="eyebrow">🏆 {t('exam.eyebrow')}</p>
      <h1 className="page-title">{t('exam.title')}</h1>
      <p className="lead">{t('exam.intro', { n: total, per: EXAM.perLesson, lessons: LESSONS.length })}</p>
      <ul className="chips exam-facts">
        <li className="chip">📝 {t('exam.questions', { n: total })}</li>
        <li className="chip">⭐ +{POINTS.examQuestion} {t('exam.perRight')}</li>
        <li className="chip">🎖️ +{POINTS.examPass} {t('exam.passBonus', { n: EXAM.passMark })}</li>
        {progress.examBest !== undefined && <li className="chip chip-good">🏆 {t('exam.best', { n: progress.examBest })}</li>}
      </ul>

      {examRecommended ? (
        <p className="callout callout-good">✓ {t('exam.ready')}</p>
      ) : (
        <p className="callout">
          {t('exam.recommended', { n: done, m: LESSONS.length })}{' '}
          {next && <Link to={`/lesson/${next.id}`}>{t('exam.nextLesson', { lesson: `${next.id} ${lesson(next.id).title}` })}</Link>}
        </p>
      )}

      {started ? (
        <Quiz lesson={EXAM.id} exam />
      ) : (
        <section className="card exam-start">
          <h2>{t('exam.covers')}</h2>
          <ol className="exam-lessons">
            {LESSONS.map(l => (
              <li key={l.id} className={progress.done?.[l.id] ? 'done' : ''}>
                <span aria-hidden>{progress.done?.[l.id] ? '✓' : l.icon}</span> {l.id} · {lesson(l.id).title}
              </li>
            ))}
          </ol>
          <button type="button" className="big glow" onClick={() => setStarted(true)}>{t('exam.start')}</button>
        </section>
      )}
    </div>
  );
}
