// The start screen: choose Student or Lecturer. Students can start straight
// away as a guest; signing in is optional. Lecturers need the staff code.
import { useState, type FormEvent } from 'react';
import { useApp } from '../state/AppContext';
import { useI18n } from '../i18n';
import { LanguagePicker } from './Info';

const GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];

export function SignInForm({ onDone }: { onDone?: () => void }) {
  const { signIn } = useApp();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [num, setNum] = useState('');
  const [group, setGroup] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(name.trim(), num.trim(), group);
      onDone?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="signin-form">
      <label>{t('signin.name')}<input value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></label>
      <label>
        {t('signin.number')}
        <input value={num} onChange={e => setNum(e.target.value)} required inputMode="numeric" pattern="[uU]?[0-9]{8}" placeholder="u21000000" />
      </label>
      <label>
        {t('signin.group')}
        <select value={group} onChange={e => setGroup(e.target.value)}>
          <option value="">{t('signin.none')}</option>
          {GROUPS.map(g => <option key={g}>{g}</option>)}
        </select>
      </label>
      <p className="small muted">{t('signin.keep')}</p>
      <div className="consent-box small">
        <strong>{t('consent.title')}</strong>
        <p>{t('consent.body')}</p>
        <label className="toggle"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} required /> {t('consent.agree')}</label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || !agree}>{busy ? '…' : t('signin.submit')}</button>
    </form>
  );
}

export function StaffForm() {
  const { staffSignIn } = useApp();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<'lecturer' | 'tutor'>('lecturer');
  const [group, setGroup] = useState('G1');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await staffSignIn(name.trim(), code, role, group);
      window.location.hash = '#/lecturer';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="signin-form">
      <p className="small muted">{t('staff.need')}</p>
      <label>{t('staff.name')}<input value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></label>
      <label>
        {t('staff.role')}
        <select value={role} onChange={e => setRole(e.target.value as 'lecturer' | 'tutor')}>
          <option value="lecturer">{t('staff.lecturer')}</option>
          <option value="tutor">{t('staff.tutor')}</option>
        </select>
      </label>
      {role === 'tutor' && (
        <label>{t('staff.group')}<select value={group} onChange={e => setGroup(e.target.value)}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select></label>
      )}
      <label>{t('staff.code')}<input type="password" value={code} onChange={e => setCode(e.target.value)} required autoComplete="current-password" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? '…' : t('staff.submit')}</button>
    </form>
  );
}

export default function Welcome() {
  const { startGuest } = useApp();
  const { t } = useI18n();
  const [panel, setPanel] = useState<'none' | 'signin' | 'staff'>('none');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const guest = async () => {
    setBusy(true);
    setError('');
    try {
      await startGuest();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <main className="welcome" id="main">
      <div className="welcome-top"><LanguagePicker id="welcome-lang" /></div>
      <img className="welcome-logo" src="/software-disciples.png" alt="Software Disciples" width={768} height={512} />
      <p className="welcome-tag">{t('app.tagline')}</p>
      <h1 className="welcome-title">{t('welcome.title')}</h1>
      <p className="lead">{t('welcome.who')}</p>
      <div className="role-cards">
        <section className={`role-card ${panel === 'staff' ? 'dim' : ''}`} aria-labelledby="role-student">
          <span className="role-icon" aria-hidden>🧑🏾‍💻</span>
          <h2 id="role-student">{t('welcome.student')}</h2>
          <p className="small">{t('welcome.studentNote')}</p>
          <button type="button" className="big glow" onClick={() => void guest()} disabled={busy}>▶ {t('welcome.guest')}</button>
          <p className="small muted">{t('welcome.guestNote')}</p>
          <button type="button" className="link-button" aria-expanded={panel === 'signin'} onClick={() => setPanel(panel === 'signin' ? 'none' : 'signin')}>{t('welcome.signin')}</button>
          {panel === 'signin' && <SignInForm />}
          {error && <p className="error" role="alert">{error}</p>}
        </section>
        <section className={`role-card ${panel === 'signin' ? 'dim' : ''}`} aria-labelledby="role-lect">
          <span className="role-icon" aria-hidden>👩🏽‍🏫</span>
          <h2 id="role-lect">{t('welcome.lecturer')}</h2>
          <p className="small">{t('welcome.lecturerNote')}</p>
          {panel === 'staff' ? <StaffForm /> : <button type="button" className="secondary" onClick={() => setPanel('staff')}>🔑 {t('staff.code')}</button>}
        </section>
      </div>
    </main>
  );
}
