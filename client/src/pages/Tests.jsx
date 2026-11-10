import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib.jsx';

const STATUS = { passed: ['pass', 'Passed'], failing: ['fail', 'Not passing yet'], 'not-started': ['', 'Not started'] };

export default function Tests() {
  const [list, setList] = useState(null);
  useEffect(() => { api('/problems').then(setList).catch(() => setList([])); }, []);
  if (!list) return <p>Loading…</p>;
  return (
    <div className="stack">
      <h1>Test section: Java problems</h1>
      <p>Write Java in the browser; the app compiles it with Java 8 rules and runs it against sample tests and hidden tests made just for you. No <code>java.util</code> collections: the study guide forbids built-in data structures. Stuck? Feedback points at the exact mistake, and hints get stronger step by step. They never give you the code.</p>
      <div className="problem-grid">
        {list.map(p => {
          const [cls, word] = STATUS[p.status];
          return (
            <Link key={p.id} to={`/tests/${p.id}`} className="unit-card" style={{ minHeight: 140 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="id">{p.id}</span><span className="chip">{p.level}</span></div>
              <b>{p.title}</b>
              <span className="small muted">{p.outcomes.join(' · ')}</span>
              <span style={{ marginTop: 'auto' }}><span className={`badge ${cls}`}>{word}</span>{p.attempts ? <span className="small muted"> · {p.attempts} submission{p.attempts > 1 ? 's' : ''}</span> : null}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
