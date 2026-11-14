// The Student page (account, stats, badges) and the Lecturer page (staff code
// first, then the class dashboard with the most-asked questions on top).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CLOSURE, CORE } from '../../../shared/units.mjs';
import { api, type Problem } from '../api';
import { useApp } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { BadgeGrid, LevelCard } from './Home';
import { SignInForm, StaffForm } from './Welcome';
import Dashboard from './Dashboard';

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
  const lessonsDone = [...CORE, ...CLOSURE].filter(l => progress.done?.[l.id]).length;
  return (
    <div>
      <h1 className="page-title">{t('student.title')}</h1>
      <div className="home-grid">
        <LevelCard />
        <section className="card" aria-labelledby="stats-h">
          <h2 id="stats-h">{t('student.stats')}</h2>
          <dl className="stat-list">
            <dt>{t('student.lessonsDone')}</dt><dd>{lessonsDone} / {CORE.length + CLOSURE.length}</dd>
            <dt>{t('student.problemsPassed')}</dt><dd>{problems ? `${problems.filter(p => p.state.passed).length} / ${problems.length}` : '…'}</dd>
            <dt>{t('student.badges')}</dt><dd>{earned.length}</dd>
            <dt>🔥</dt><dd>{t('home.streak', { n: progress.bestStreak ?? 0 })}</dd>
          </dl>
        </section>
      </div>
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
