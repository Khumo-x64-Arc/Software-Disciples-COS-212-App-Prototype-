// The Student page (account, stats, badges) and the Lecturer page (staff code
// first, then the class dashboard with the most-asked questions on top).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LESSONS } from '../../../shared/units.mjs';
import { api, type Problem } from '../api';
import { useApp } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { BadgeGrid, LevelCard } from './Home';
import { SignInForm, StaffForm } from './Welcome';
import Dashboard from './Dashboard';
import { focusRows, toImprove, topMistakes, type FocusRow } from '../lib/focus';

export function StudentPage() {
  const { user, progress, signOut } = useApp();
  const { earned } = useRewards();
  const { t } = useI18n();
  const [problems, setProblems] = useState<Problem[] | null>(null);
  useEffect(() => {
    api.problems().then(r => setProblems(r.problems)).catch(() => setProblems([]));
  }, []);
  if (user && user.role !== 'student') {
    return (
      <div>
        <h1 className="page-title">{t('student.title')}</h1>
        <p className="card">{t('signin.as', { name: user.name })} ({user.role}). <button type="button" className="link-button" onClick={() => void signOut()}>{t('staff.back')}</button></p>
      </div>
    );
  }
  const lessonsDone = LESSONS.filter(l => progress.done?.[l.id]).length;
  return (
    <div>
      <h1 className="page-title">{t('student.title')}</h1>
      <div className="home-grid">
        <LevelCard />
        <section className="card" aria-labelledby="stats-h">
          <h2 id="stats-h">{t('student.stats')}</h2>
          <dl className="stat-list">
            <dt>{t('student.lessonsDone')}</dt><dd>{lessonsDone} / {LESSONS.length}</dd>
            <dt>{t('student.problemsPassed')}</dt><dd>{problems ? `${problems.filter(p => p.state.passed).length} / ${problems.length}` : '…'}</dd>
            <dt>{t('student.badges')}</dt><dd>{earned.length}</dd>
            <dt>🔥</dt><dd>{t('home.streak', { n: progress.bestStreak ?? 0 })}</dd>
          </dl>
        </section>
      </div>
      <WorkOn problems={problems} />
      <section className="card" aria-labelledby="acct-h">
        <h2 id="acct-h">{t('student.account')}</h2>
        {user?.guest ? (
          <>
            <p>{t('signin.guest')}</p>
            <details>
              <summary>{t('welcome.signin')}</summary>
              <SignInForm />
            </details>
          </>
        ) : (
          <>
            <p>{t('signin.as', { name: user?.name ?? '' })} · {user?.studentNumber}{user?.group ? ` · ${user.group}` : ''}</p>
            <button type="button" className="secondary" onClick={() => void signOut()}>{t('signin.out')}</button>
          </>
        )}
      </section>
      <section className="card" aria-labelledby="allbadges-h">
        <h2 id="allbadges-h">{t('home.badges')}</h2>
        <BadgeGrid />
      </section>
    </div>
  );
}

/** "What to work on": the lessons to revisit, weakest first, from every quiz and exam answer. */
function WorkOn({ problems }: { problems: Problem[] | null }) {
  const { progress } = useApp();
  const { t, lesson } = useI18n();
  const rows = focusRows(progress.answerLog, progress.quizBest);
  const improve = toImprove(rows);
  const strong = rows.filter(r => r.status === 'strong');
  const untried = rows.filter(r => r.status === 'untried');
  const mistakes = topMistakes(progress.answerLog);
  const answers = rows.reduce((a, r) => a + r.total, 0);
  const coding = (problems ?? []).filter(p => !p.state.passed && p.state.failedAttempts > 0);
  const title = (id: string) => `${id} · ${lesson(id).title}`;
  const nothingYet = rows.every(r => r.status === 'untried');
  return (
    <section className="card work-on" aria-labelledby="work-h">
      <h2 id="work-h">🎯 {t('focus.title')}</h2>
      {nothingYet ? (
        <p>{t('focus.empty')} <Link to="/lessons">{t('focus.startLessons')}</Link></p>
      ) : (
        <>
          <p className="small muted">{answers ? t('focus.basedOn', { n: answers, l: rows.filter(r => r.right + r.wrong > 0).length }) : t('focus.basedOnScores')}</p>
          {improve.length === 0 ? (
            <p className="feedback ok">✓ {t('focus.allStrong')}</p>
          ) : (
            <ol className="focus-list">
              {improve.map(r => <FocusItem key={r.id} r={r} title={title(r.id)} />)}
            </ol>
          )}
          {mistakes.length > 0 && (
            <div className="focus-block">
              <h3>{t('focus.mistakes')}</h3>
              <ul className="focus-mistakes">
                {mistakes.map(m => (
                  <li key={m.id}>
                    <strong>{m.label}</strong> <span className="muted small">× {m.count}</span>
                    <span className="small"> · {m.lessons.map((id, i) => <span key={id}>{i ? ', ' : ''}<Link to={`/lesson/${id}`}>{id}</Link></span>)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {coding.length > 0 && (
            <div className="focus-block">
              <h3>{t('focus.coding')}</h3>
              <ul className="focus-mistakes">
                {coding.map(p => (
                  <li key={p.id}>
                    <Link to={`/coding/${p.id}`}>{p.id} · {p.title}</Link> <span className="muted small">· {t('focus.failedTries', { n: p.state.failedAttempts })} · {p.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="focus-chips">
            {strong.length > 0 && (
              <p><span className="small muted">{t('focus.strong')}:</span> {strong.map(r => <Link key={r.id} to={`/lesson/${r.id}`} className="chip chip-good">✓ {r.id}</Link>)}</p>
            )}
            {untried.length > 0 && (
              <p><span className="small muted">{t('focus.untried')}:</span> {untried.map(r => <Link key={r.id} to={`/lesson/${r.id}`} className="chip">{r.id}</Link>)}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function FocusItem({ r, title }: { r: FocusRow; title: string }) {
  const { t } = useI18n();
  const pct = r.accuracy ?? 0;
  return (
    <li className={`focus-item status-${r.status}`}>
      <div className="focus-head">
        <Link to={`/lesson/${r.id}`} className="focus-title">{title}</Link>
        <span className={`chip ${r.status === 'work' ? 'chip-bad' : 'chip-warn'}`}>{r.status === 'work' ? t('focus.needsWork') : t('focus.nearly')}</span>
      </div>
      <div className="focus-bar" role="img" aria-label={t('focus.accuracy', { n: pct })}><span style={{ width: `${pct}%` }} /></div>
      <p className="small">
        <strong>{pct}%</strong> {t('focus.right')}
        {r.total > 0 && <> · {t('focus.counts', { r: r.right, w: r.wrong, s: r.skipped })}</>}
        {r.best !== null && <> · {t('focus.best', { n: r.best })}</>}
      </p>
      {r.mistakes.length > 0 && (
        <p className="small">{t('focus.usualMistake')}: <strong>{r.mistakes[0].label}</strong>{r.mistakes.length > 1 && <span className="muted"> {t('focus.andMore', { n: r.mistakes.length - 1 })}</span>}</p>
      )}
      <div className="button-row">
        <Link className="button" to={`/lesson/${r.id}`}>{t('focus.revisit')}</Link>
      </div>
    </li>
  );
}

export function LecturerPage() {
  const { user, signOut } = useApp();
  const { t } = useI18n();
  const staff = user?.role === 'lecturer' || user?.role === 'tutor';
  if (!staff) {
    return (
      <div>
        <h1 className="page-title">🔑 {t('staff.title')}</h1>
        <section className="card narrow-card"><StaffForm /></section>
      </div>
    );
  }
  return (
    <div>
      <p className="small staff-bar">
        {t('signin.as', { name: user.name })} ({user.role === 'tutor' ? `${t('staff.tutor')}, ${user.group}` : t('staff.lecturer')}) ·{' '}
        <Link to="/lecturer/plan">Lesson plan</Link> · <button type="button" className="link-button" onClick={() => void signOut()}>{t('staff.back')}</button>
      </p>
      <Dashboard />
    </div>
  );
}
