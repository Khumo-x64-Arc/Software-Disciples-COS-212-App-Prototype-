import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, getToken, type Dashboard as D, type StudentProfile } from '../api';
import { OUTCOMES as OUTCOME_TEXT, UNITS } from '../../../shared/units.mjs';
import { useApp } from '../state/AppContext';
import { MasteryBadge } from '../components/ui';

const PROBLEM_IDS = Array.from({ length: 9 }, (_, i) => `P${i + 1}`);
const OUTCOMES = [...new Set(UNITS.flatMap(u => u.outcomes))].sort();
// Rates arrive from the server as percentages (0–100).
const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x)}%`);

function useFilters() {
  const [params, setParams] = useSearchParams();
  const q: Record<string, string> = {};
  for (const k of ['unit', 'problem', 'outcome', 'group', 'from', 'to']) {
    const v = params.get(k);
    if (v) q[k] = v;
  }
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  return { q, set };
}

async function downloadCsv(view: string, q: Record<string, string>) {
  const res = await fetch(api.exportUrl(view, q), { headers: { Authorization: `Bearer ${getToken()}` } });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cos212-${view}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Filters({ q, set, tutor, group }: { q: Record<string, string>; set: (k: string, v: string) => void; tutor: boolean; group: string | null }) {
  return (
    <form className="filters" onSubmit={e => e.preventDefault()} aria-label="Filters">
      <label>Lesson
        <select value={q.unit ?? ''} onChange={e => set('unit', e.target.value)}>
          <option value="">All</option>
          {UNITS.map(u => <option key={u.id} value={u.id}>{u.id} {u.title}</option>)}
        </select>
      </label>
      <label>Problem
        <select value={q.problem ?? ''} onChange={e => set('problem', e.target.value)}>
          <option value="">All</option>
          {PROBLEM_IDS.map(p => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label>Outcome
        <select value={q.outcome ?? ''} onChange={e => set('outcome', e.target.value)}>
          <option value="">All</option>
          {OUTCOMES.map(o => <option key={o} value={o} title={OUTCOME_TEXT[o]}>{o}</option>)}
        </select>
      </label>
      <label>Group
        {tutor ? (
          <input value={group ?? ''} readOnly aria-describedby="tutor-note" />
        ) : (
          <select value={q.group ?? ''} onChange={e => set('group', e.target.value)}>
            <option value="">All</option>
            {['G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map(g => <option key={g}>{g}</option>)}
          </select>
        )}
      </label>
      <label>From <input type="date" value={q.from ?? ''} onChange={e => set('from', e.target.value)} /></label>
      <label>To <input type="date" value={q.to ?? ''} onChange={e => set('to', e.target.value)} /></label>
      {tutor && <p id="tutor-note" className="small muted">Tutors see only their own group.</p>}
    </form>
  );
}

export default function Dashboard() {
  const { user } = useApp();
  const { q, set } = useFilters();
  const [d, setD] = useState<D | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(q);
  const load = useCallback(async () => {
    try {
      setD(await api.dashboard(JSON.parse(key)));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [key]);
  useEffect(() => void load(), [load]);
  const tutor = user?.role === 'tutor';
  const shown = (u: string) => !q.unit || q.unit === u;

  return (
    <div className="dashboard">
      <h1 className="page-title">Lecturer page</h1>
      <p className="muted">{tutor ? `Tutor view: group ${user?.group}.` : 'All groups.'} {d ? `${d.students} students. Questions compared over ${d.range.from} to ${d.range.to}.` : ''}</p>
      <Filters q={q} set={set} tutor={tutor} group={user?.group ?? null} />
      {error && <p className="error" role="alert">{error}</p>}
      {!d ? (
        <p>Loading…</p>
      ) : (
        <>
          <section className="card asked-hero" aria-labelledby="asked-h">
            <h2 id="asked-h">🔥 Most-asked questions</h2>
            <p className="small muted">What students asked Graph Helper most ({d.range.from} to {d.range.to}), compared with the period before. Questions are stored without names.</p>
            {d.mostAsked.length === 0 ? <p className="muted">No questions in this period.</p> : (
              <>
                <ol className="asked-top">
                  {d.mostAsked.slice(0, 3).map((x, i) => (
                    <li key={x.question} className={`asked-card rank-${i + 1}`}>
                      <span className="asked-rank" aria-hidden>#{i + 1}</span>
                      <span className="asked-q">{x.question}</span>
                      <span className="asked-count"><strong>{x.count}</strong> asks <span className={`trend trend-${x.trend}`}><span aria-hidden>{x.trend === 'rising' ? '▲' : x.trend === 'falling' ? '▼' : '▬'}</span> {x.trend}</span></span>
                    </li>
                  ))}
                </ol>
                <table className="cost-table">
                  <caption className="sr-only">All most-asked questions</caption>
                  <thead><tr><th scope="col">Question</th><th scope="col">Count</th><th scope="col">Trend</th></tr></thead>
                  <tbody>
                    {d.mostAsked.map(x => (
                      <tr key={x.question}>
                        <td>{x.question}</td>
                        <td>{x.count}</td>
                        <td className={`trend trend-${x.trend}`}>
                          <span aria-hidden>{x.trend === 'rising' ? '▲' : x.trend === 'falling' ? '▼' : '▬'}</span> {x.trend} <span className="small muted">(was {x.previous})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <button type="button" className="link-button" onClick={() => void downloadCsv('questions', q)}>Export CSV</button>
            <h3 className="small-heading">Unanswered (Graph Helper fell back)</h3>
            {d.unanswered.length === 0 ? <p className="muted">None. Every question matched the graph engine or a card.</p> : (
              <ul>{d.unanswered.map(u => <li key={u}>{u}</li>)}</ul>
            )}
            <p className="small muted">These are candidates for new knowledge-base cards.</p>
          </section>

          <section className="card" aria-labelledby="ov-h">
            <h2 id="ov-h">Class overview</h2>
            <div className="two-col">
              <div>
                <h3 className="small-heading">By lesson (share secure, quiz 80%+)</h3>
                <ul className="bars">
                  {d.overview.units.map(u => (
                    <li key={u.id}>
                      <span>{u.id} {u.title}</span>
                      <span className="bar"><span style={{ width: u.rate === null ? 0 : `${u.rate}%` }} /></span>
                      <span>{pct(u.rate)}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="small-heading">By outcome</h3>
                <ul className="bars">
                  {d.overview.outcomes.map(o => (
                    <li key={o.outcome}>
                      <span title={OUTCOME_TEXT[o.outcome]}>{o.outcome}</span>
                      <span className="bar"><span style={{ width: o.rate === null ? 0 : `${o.rate}%` }} /></span>
                      <span>{pct(o.rate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="small-heading">By problem (share passed)</h3>
                <ul className="bars">
                  {d.overview.problems.map(p => (
                    <li key={p.id}>
                      <span>{p.id} {p.title}</span>
                      <span className="bar"><span style={{ width: p.rate === null ? 0 : `${p.rate}%` }} /></span>
                      <span>{pct(p.rate)}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="small-heading">Final exam (bonus quest)</h3>
                <p className="small">
                  {d.overview.exam.attempted
                    ? `${d.overview.exam.attempted} tried it; ${d.overview.exam.passed} scored ${d.overview.exam.passMark}% or more (${pct(d.overview.exam.rate)}).`
                    : 'No one has tried it yet.'}
                </p>
                <h3 className="small-heading">Most common misconceptions</h3>
                <ol>{d.overview.misconceptions.map(m => <li key={m.id}>{m.label} <span className="muted">({m.count})</span></li>)}</ol>
              </div>
            </div>
            <button type="button" className="link-button" onClick={() => void downloadCsv('overview', q)}>Export CSV</button>
          </section>

          <section className="card" aria-labelledby="map-h">
            <h2 id="map-h">Struggle map</h2>
            <p className="small legend-row">
              <MasteryBadge level="secure" /> <MasteryBadge level="developing" /> <MasteryBadge level="struggling" /> <MasteryBadge level="not-started" />
            </p>
            {d.needsHelp.length > 0 && (
              <p className="callout callout-bad small">
                <strong>Needs follow-up:</strong> {d.needsHelp.map((s, i) => <span key={s.id}>{i > 0 && ', '}<Link to={`/lecturer/student/${s.id}`}>{s.studentNumber}</Link> ({s.units.join(', ')})</span>)}
              </p>
            )}
            <div className="table-wrap">
              <table className="struggle">
                <caption className="sr-only">Mastery level per student and unit</caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Group</th>
                    <th scope="col">Points</th>
                    <th scope="col">Level</th>
                    {d.struggle.units.filter(shown).map(u => <th key={u} scope="col">{u}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {d.struggle.rows.map(r => (
                    <tr key={r.id}>
                      <th scope="row"><Link to={`/lecturer/student/${r.id}`}>{r.guest ? 'Guest' : r.studentNumber}</Link><span className="small muted block">{r.guest ? r.studentNumber.replace('guest:', '#') : r.name}</span></th>
                      <td>{r.group ?? '–'}</td>
                      <td>{r.points}</td>
                      <td>{r.rank}</td>
                      {d.struggle.units.filter(shown).map(u => (
                        <td key={u} className={`cell m-${r.levels[u]}`} title={r.levels[u]}>
                          <span aria-hidden>{{ secure: '●', developing: '◐', struggling: '▲', 'not-started': '○' }[r.levels[u]]}</span>
                          <span className="sr-only">{r.levels[u]}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="link-button" onClick={() => void downloadCsv('struggle', q)}>Export CSV</button>
          </section>
          <p className="small muted"><Link to="/lecturer/plan">Lesson plan for the 8 + 4 lessons →</Link></p>
        </>
      )}
    </div>
  );
}

export function StudentProfilePage() {
  const { id = '' } = useParams();
  const { q } = useFilters();
  const [p, setP] = useState<StudentProfile | null>(null);
  const [error, setError] = useState('');
  const key = JSON.stringify(q);
  useEffect(() => {
    api.student(id, JSON.parse(key)).then(setP, e => setError((e as Error).message));
  }, [id, key]);
  if (error) return <p className="error" role="alert">{error} <Link to="/lecturer">Back</Link></p>;
  if (!p) return <p>Loading…</p>;
  return (
    <div>
      <nav className="unit-nav small"><Link to="/lecturer">← Lecturer page</Link></nav>
      <h1>{p.student.studentNumber} <span className="muted">· {p.student.name} · {p.student.group}</span></h1>
      <section className="card callout" aria-labelledby="sug-h">
        <h2 id="sug-h">Suggested follow-up</h2>
        <p>{p.suggestion}</p>
      </section>
      <div className="stat-row">
        {(['secure', 'developing', 'struggling', 'not-started'] as const).map(l => <span key={l} className="stat"><MasteryBadge level={l} />: {p.summary[l]}</span>)}
        <span className="stat">🏆 {p.points} points · {p.rank}</span>
        <span className="stat">Time on lessons: {p.timeSpentMinutes} min</span>
        <span className="stat">Highest hint level: {p.highestHintLevel}</span>
        <span className="stat">Final exam: {p.exam.best === null ? 'not tried' : `best ${p.exam.best}% (${p.exam.attempts} ${p.exam.attempts === 1 ? 'try' : 'tries'})`}</span>
        <span className="stat">Last active: {p.lastActivity ? new Date(p.lastActivity).toLocaleString('en-ZA') : 'never'}</span>
      </div>
      <div className="two-col">
        <section className="card">
          <h2>Lessons</h2>
          <table className="cost-table">
            <thead><tr><th scope="col">Lesson</th><th scope="col">Level</th><th scope="col">Attempts</th><th scope="col">Best</th><th scope="col">Last</th></tr></thead>
            <tbody>
              {p.units.map(u => (
                <tr key={u.id}><th scope="row">{u.id} {u.title}</th><td><MasteryBadge level={u.level} /></td><td>{u.attempts}</td><td>{u.best ?? '–'}</td><td>{u.last ?? '–'}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2>Problems</h2>
          <table className="cost-table">
            <thead><tr><th scope="col">Problem</th><th scope="col">Status</th><th scope="col">Tries</th><th scope="col">Failing cases</th><th scope="col">Hints</th></tr></thead>
            <tbody>
              {p.problems.map(x => (
                <tr key={x.id}><th scope="row">{x.id}</th><td>{x.status}</td><td>{x.attempts}</td><td className="small">{x.failedCaseTypes.join(', ') || '–'}{x.misconception ? <span className="block muted">{x.misconception}</span> : null}</td><td>{x.hintLevel}</td></tr>
              ))}
            </tbody>
          </table>
          <h3 className="small-heading">Misconceptions</h3>
          {p.misconceptions.length ? <ul>{p.misconceptions.map(m => <li key={m.id}>{m.label} ({m.count})</li>)}</ul> : <p className="muted">None recorded.</p>}
        </section>
      </div>
    </div>
  );
}
