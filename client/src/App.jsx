import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { api, store, useApp } from './lib.jsx';
import Home from './pages/Home.jsx';
import Unit from './pages/Unit.jsx';
import Builder from './pages/Builder.jsx';
import Tests from './pages/Tests.jsx';
const Problem = lazy(() => import('./pages/Problem.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
import Progress from './pages/Progress.jsx';
import Chat from './components/Chat.jsx';

function Login() {
  const { setUser } = useApp();
  const [role, setRole] = useState('student');
  const [form, setForm] = useState({ studentNumber: '', name: '', passcode: '', group: 'Group A' });
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault(); setErr('');
    try {
      const d = await api('/login', { method: 'POST', body: { role, ...form } });
      store.set('token', d.token);
      setUser({ ...d.user, consentNeeded: d.consentNeeded });
    } catch (ex) { setErr(ex.message); }
  };
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <main>
      <div className="row" style={{ alignItems: 'center', gap: 40 }}>
        <div className="grow">
          <h1>Graphs &amp; Transitive Closure</h1>
          <p style={{ fontSize: '1.15rem' }}>COS212 pre-lecture practice: build graphs with your hands, step through Warshall's algorithm, code it in Java, and ask Graph Helper when you're stuck.</p>
          <img src="/favicon.svg" alt="" width="120" height="120" />
        </div>
        <form className="card grow stack" onSubmit={submit} aria-labelledby="signin">
          <h2 id="signin">Sign in</h2>
          <div className="row" role="radiogroup" aria-label="I am a">
            {['student', 'tutor', 'lecturer'].map(r => <button type="button" key={r} className="btn small" aria-pressed={role === r} onClick={() => setRole(r)}>{r[0].toUpperCase() + r.slice(1)}</button>)}
          </div>
          {role === 'student' ? (
            <>
              <label className="field">Student number<input type="text" value={form.studentNumber} onChange={set('studentNumber')} placeholder="u21000001" autoComplete="username" required /></label>
              <label className="field">Name (optional)<input type="text" value={form.name} onChange={set('name')} autoComplete="name" /></label>
            </>
          ) : (
            <>
              <label className="field">Name<input type="text" value={form.name} onChange={set('name')} required /></label>
              {role === 'tutor' && <label className="field">Tutorial group<select value={form.group} onChange={set('group')}>{['Group A', 'Group B', 'Group C', 'Group D'].map(g => <option key={g}>{g}</option>)}</select></label>}
              <label className="field">Staff passcode<input type="password" value={form.passcode} onChange={set('passcode')} required /></label>
            </>
          )}
          {err && <p className="feedback bad" role="alert">{err}</p>}
          <button className="btn primary">Sign in</button>
          <p className="small muted">Pilot sign-in. In production this is replaced by UP single sign-on.</p>
        </form>
      </div>
    </main>
  );
}

function Consent() {
  const { user, setUser } = useApp();
  const accept = async () => { await api('/consent', { method: 'POST' }); setUser({ ...user, consentNeeded: false, consentAt: Date.now() }); };
  return (
    <main>
      <section className="card stack" style={{ maxWidth: 720 }} aria-labelledby="privacy">
        <h1 id="privacy">Before you start: what this app records</h1>
        <ul>
          <li><b>Your results</b> on unit checks and Java tests, the mistakes the app spots, and the hints you open, linked to your student number.</li>
          <li><b>Who sees them:</b> COS212 lecturers see every student; tutors see only their own tutorial group; you can see your own progress page.</li>
          <li><b>Chat questions</b> to Graph Helper are stored without your name. Lecturers see which questions are asked most, never who asked them.</li>
          <li>Data stays on the app's server and is kept only as long as UP policy allows (POPIA).</li>
        </ul>
        <button className="btn primary" onClick={accept}>I understand, continue</button>
      </section>
    </main>
  );
}

export default function App() {
  const { user, ready, readAloud, setReadAloud, setUser } = useApp();
  const loc = useLocation();
  useEffect(() => { document.getElementById('main')?.focus(); window.scrollTo(0, 0); }, [loc.pathname]);
  if (!ready) return null;
  if (!user) return <Login />;
  if (user.consentNeeded) return <Consent />;
  const staff = user.role !== 'student';
  const logout = async () => { try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ } store.del('token'); setUser(null); };
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="topbar">
        <NavLink to="/" className="brand"><img src="/favicon.svg" alt="" />COS212 Graphs</NavLink>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Learn</NavLink>
          <NavLink to="/build">Build a graph</NavLink>
          <NavLink to="/tests">Tests</NavLink>
          {staff ? <NavLink to="/dashboard">Dashboard</NavLink> : <NavLink to="/progress">My progress</NavLink>}
        </nav>
        <span className="spacer" />
        <button className="btn small" aria-pressed={readAloud} onClick={() => setReadAloud(!readAloud)}>🔊 Read aloud</button>
        <span className="small"><b>{user.name}</b> · {user.role}{user.group ? ` · ${user.group}` : ''}</span>
        <button className="btn small" onClick={logout}>Sign out</button>
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<p>Loading…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/unit/:id" element={<Unit />} />
          <Route path="/build" element={<Builder />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/tests/:id" element={<Problem />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/dashboard" element={staff ? <Dashboard /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </Suspense>
      </main>
      <Chat />
    </>
  );
}
