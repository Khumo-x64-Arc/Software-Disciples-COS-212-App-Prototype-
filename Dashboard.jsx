import { useCallback, useEffect, useState } from 'react';
import { api, download, LevelIcon, LEVELS, pct, useApp } from '../lib.jsx';
import ProfileView from '../components/ProfileView.jsx';

const RANGES = { week: ['This week', 7], fortnight: ['Last 14 days', 14], all: ['Whole semester', null] };
const GROUPS = ['all', 'Group A', 'Group B', 'Group C', 'Group D'];

function Bar({ value, max = 1 }) {
  return <div className="bar" style={{ width: `${Math.max(2, (value / (max || 1)) * 100)}%` }} aria-hidden="true" />;
}

export default function Dashboard() {
  const { user } = useApp();
  const [tab, setTab] = useState('questions');
  const [range, setRange] = useState('week');
  const [group, setGroup] = useState(user.role === 'tutor' ? user.group : 'all');
  const [data, setData] = useState({});
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState('');

  const qs = useCallback(() => {
    const days = RANGES[range][1];
    const p = new URLSearchParams({ group });
    if (days) p.set('from', String(Date.now() - days * 864e5));
    return p.toString();
  }, [range, group]);

  useEffect(() => {
    setErr('');
    Promise.all([api(`/dashboard/questions?${qs()}`), api(`/dashboard/class?${qs()}`), api(`/dashboard/struggle?${qs()}`), api(`/dashboard/students?group=${group}`)])
      .then(([questions, cls, struggle, st]) => { setData({ questions, cls, struggle }); setStudents(st); })
      .catch(e => setErr(e.message));
  }, [qs, group]);
  useEffect(() => { if (!studentId) { setProfile(null); return; } api(`/dashboard/student/${studentId}`).then(setProfile).catch(e => setErr(e.message)); }, [studentId]);

  const openStudent = id => { setStudentId(id); setTab('student'); };
  const exportCsv = view => download(`/dashboard/export?view=${view}&${qs()}`, `cos212-${view}.csv`);
  const { questions, cls, struggle } = data;
  const demo = struggle?.rows?.some(r => r.demo);

  return (
    <div className="stack">
      <h1>Lecturer dashboard</h1>
      {demo && (
        <div className="demo-banner row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Includes demo learners so the views have data to show. Real students appear alongside them.</span>
          {user.role === 'lecturer' && <button className="btn small" onClick={async () => { if (confirm('Remove all demo learners and their data?')) { await api('/admin/clear-demo', { method: 'POST' }); location.reload(); } }}>Clear demo data</button>}
        </div>
      )}
      <div className="toolbar" role="group" aria-label="Filters" style={{ alignItems: 'flex-end' }}>
        <label className="field small">Dates<select value={range} onChange={e => setRange(e.target.value)}>{Object.entries(RANGES).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="field small">Tutorial group
          <select value={group} onChange={e => setGroup(e.target.value)} disabled={user.role === 'tutor'}>{GROUPS.map(g => <option key={g} value={g}>{g === 'all' ? 'All groups' : g}</option>)}</select>
        </label>
        <span className="spacer" />
        <button className="btn small" onClick={() => exportCsv(tab === 'questions' ? 'questions' : tab === 'class' ? 'class' : 'struggle')}>⤓ Export CSV</button>
      </div>
      {user.role === 'tutor' && <p className="small muted">As a tutor you see {user.group} only.</p>}
      <div className="tabs" role="tablist">
        {[['questions', 'Most-asked questions'], ['class', 'Class overview'], ['struggle', 'Struggle map'], ['student', 'Student profile']].map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {err && <p className="feedback bad">{err}</p>}
      <div className="panel" role="tabpanel">
        {tab === 'questions' && questions && (
          <div className="dash-grid">
            <div className="card stack">
              <div className="row" style={{ justifyContent: 'space-between' }}><h3 style={{ margin: 0 }}>Most-asked questions</h3><span className="small muted">{questions.total} questions · {questions.graphQuestions} about learners' own graphs</span></div>
              <table className="plain"><thead><tr><th>Question</th><th>Asks</th><th style={{ width: '30%' }} /><th>Trend</th></tr></thead>
                <tbody>{questions.top.slice(0, 12).map(t => (
                  <tr key={t.cardId}><td>{t.question}<div className="small muted">{t.group}{t.unit ? ` · ${t.unit}` : ''}</div></td><td><b>{t.count}</b></td><td><Bar value={t.count} max={questions.top[0]?.count} /></td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>{t.trend === 'up' ? '▲ rising' : t.trend === 'down' ? '▼ falling' : '● steady'}</td></tr>
                ))}</tbody></table>
              <p className="small muted">Chat questions are stored without names: this shows what is asked, never who asked it.</p>
            </div>
            <div className="stack">
              <div className="card">
                <h3>By topic</h3>
                <table className="plain"><tbody>{Object.entries(questions.byGroup).sort((a, b) => b[1] - a[1]).map(([g, n]) => <tr key={g}><td>{g}</td><td><b>{n}</b></td></tr>)}</tbody></table>
              </div>
              <div className="card">
                <h3>Unanswered by the chatbot ({questions.unanswered.length})</h3>
                <p className="small muted">Write knowledge-base cards for these, or cover them in a lecture.</p>
                <ul>{questions.unanswered.slice(0, 15).map((u, i) => <li key={i}>{u.text}</li>)}</ul>
              </div>
            </div>
          </div>
        )}
        {tab === 'class' && cls && (
          <div className="stack">
            <p><span className="kpi">{cls.students}</span> students in view</p>
            <div className="dash-grid">
              <div className="card">
                <h3>Unit checks: share secure</h3>
                <table className="plain"><thead><tr><th>Unit</th><th>Secure</th><th style={{ width: '35%' }} /><th>Struggling</th></tr></thead>
                  <tbody>{cls.units.map(u => <tr key={u.id}><td><b>{u.id}</b> {u.title}</td><td>{pct(u.passRate)}<div className="small muted">{u.secure}/{u.attempted}</div></td><td>{u.passRate !== null && <Bar value={u.passRate} />}</td><td>{u.struggling ? <><LevelIcon level="struggling" /> {u.struggling}</> : '–'}</td></tr>)}</tbody></table>
              </div>
              <div className="card">
                <h3>Java problems: share passed</h3>
                <table className="plain"><thead><tr><th>Problem</th><th>Passed</th><th style={{ width: '35%' }} /></tr></thead>
                  <tbody>{cls.problems.map(p => <tr key={p.id}><td><b>{p.id}</b> {p.title}</td><td>{pct(p.passRate)}<div className="small muted">{p.passed}/{p.attempted}</div></td><td>{p.passRate !== null && <Bar value={p.passRate} />}</td></tr>)}</tbody></table>
              </div>
              <div className="card">
                <h3>Most common mistakes</h3>
                <table className="plain"><tbody>{cls.misconceptions.map(m => <tr key={m.id}><td>{m.title}<div className="small muted">{m.unit}</div></td><td><b>{m.count}</b> submissions</td></tr>)}</tbody></table>
              </div>
              <div className="card">
                <h3>By CS2023 outcome</h3>
                <table className="plain"><thead><tr><th>Outcome</th><th>Success</th><th>From</th></tr></thead>
                  <tbody>{cls.outcomes.map(o => <tr key={o.outcome}><td>{o.outcome}</td><td>{pct(o.rate)}</td><td className="small">{[...o.units, ...o.problems].join(', ')}</td></tr>)}</tbody></table>
              </div>
            </div>
          </div>
        )}
        {tab === 'struggle' && struggle && (
          <div className="stack">
            <div className="legend"><b>Mastery:</b>{Object.entries(LEVELS).map(([k, v]) => <span key={k}><LevelIcon level={k} /> {v.label}</span>)}</div>
            <div className="row">
              <div style={{ overflowX: 'auto' }} className="grow">
                <table className="smap">
                  <caption className="sr-only">Students by unit mastery. Select a row to open the student profile.</caption>
                  <thead><tr><th scope="col">Student</th>{struggle.units.map(u => <th key={u.id} scope="col" title={u.title}>{u.id}</th>)}</tr></thead>
                  <tbody>{struggle.rows.map(r => (
                    <tr key={r.id} className={`clickable ${studentId === r.id ? 'sel' : ''}`} onClick={() => openStudent(r.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') openStudent(r.id); }} aria-label={`${r.id} ${r.name}: ${r.levels.map((l, i) => `${struggle.units[i].id} ${LEVELS[l].label}`).join(', ')}`}>
                      <td className="name"><b>{r.id}</b> <span className="small muted">{r.name}</span></td>
                      {r.levels.map((l, i) => <td key={i} className="center"><LevelIcon level={l} /></td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="card" style={{ minWidth: 260 }}>
                <h3>Needs help ({struggle.needsHelp.length})</h3>
                <p className="small muted">Struggling: 3+ check attempts below 80%, or the same mistake matched 3+ times.</p>
                <ul>{struggle.needsHelp.map(n => <li key={n.id}><button className="btn small ghost" onClick={() => openStudent(n.id)}>{n.id} {n.name}</button> <span className="small">{n.units.join(', ')}</span></li>)}</ul>
              </div>
            </div>
          </div>
        )}
        {tab === 'student' && (
          <div className="stack">
            <label className="field" style={{ maxWidth: 360 }}>Student
              <select value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Choose a student…</option>{students.map(s => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}</select>
            </label>
            {profile ? <ProfileView p={profile} /> : <p className="muted">Choose a student, or select a row in the struggle map.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
