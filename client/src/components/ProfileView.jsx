import { Link } from 'react-router-dom';
import { LevelIcon, LEVELS, ago, pct } from '../lib.jsx';

const PSTATUS = { passed: ['pass', 'Passed'], failing: ['fail', 'Failing'], 'not-started': ['', 'Not started'] };

export default function ProfileView({ p, self = false }) {
  if (!p) return null;
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{self ? 'Your progress' : `Student profile · ${p.id}`}</h2>
        <span className="small muted">{p.name} · {p.group} · last active {ago(p.lastActive)} · about {p.timeMinutes} min on checks and tests{p.demo ? ' · demo learner' : ''}</span>
      </div>
      <div className="dash-grid">
        <div className="card">
          <h3>Units</h3>
          <p className="small">{p.counts.secure} secure · {p.counts.developing} developing · {p.counts.struggling} struggling · {p.counts.notStarted} not started</p>
          <table className="plain"><tbody>{p.units.map(u => (
            <tr key={u.id}><td style={{ width: 28 }}><LevelIcon level={u.level} /></td><td><b>{u.id}</b> {u.title}</td><td>{LEVELS[u.level].label}</td><td className="small">{u.best !== null ? `best ${pct(u.best)}` : ''}{u.attempts ? ` · ${u.attempts} tr${u.attempts > 1 ? 'ies' : 'y'}` : ''}</td></tr>
          ))}</tbody></table>
        </div>
        <div className="card">
          <h3>Tests</h3>
          <table className="plain"><tbody>{p.problems.map(x => {
            const [cls, word] = PSTATUS[x.status];
            return <tr key={x.id}><td><b>{x.id}</b> {self ? <Link to={`/tests/${x.id}`}>{x.title}</Link> : x.title}</td><td><span className={`badge ${cls}`}>{word}</span></td><td className="small">{x.attempts ? `${x.attempts} submission${x.attempts > 1 ? 's' : ''}` : ''}{x.status === 'failing' && x.lastFailedCategories?.length ? ` · failing on ${x.lastFailedCategories.join(', ')}` : ''}</td></tr>;
          })}</tbody></table>
        </div>
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Mistakes the app spotted</h3>
          {p.misconceptions.length ? <ul>{p.misconceptions.map(m => <li key={m.id}>{m.title} <span className="small muted">(matched {m.count} time{m.count > 1 ? 's' : ''}{m.unit ? ` · ${m.unit}` : ''})</span></li>)}</ul> : <p>None so far.</p>}
          <p className="small">Highest hint level reached: <b>{p.maxHintLevel || 'none'}</b></p>
          <div className="hintbox"><b>{self ? 'Suggested next step' : 'Suggested follow-up'}</b><ul style={{ margin: '6px 0 0' }}>{p.followUp.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
        </div>
      </div>
    </div>
  );
}
