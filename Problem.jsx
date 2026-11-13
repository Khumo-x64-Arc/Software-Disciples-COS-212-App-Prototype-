import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { api, confetti, ReadButton, useApp } from '../lib.jsx';

function HintLadder({ problemId, mis, category }) {
  const { openChat, announce } = useApp();
  const nav = useNavigate();
  const [steps, setSteps] = useState([{ level: 1, text: mis.hint }]);
  const more = async () => {
    const level = steps.length + 1;
    const h = await api(`/problems/${problemId}/hint`, { method: 'POST', body: { misconception: mis.id, category, level } });
    setSteps(s => [...s, h]);
    announce(`Hint ${h.level}: ${h.text}`);
  };
  return (
    <div className="hintbox stack">
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{mis.title}</b><ReadButton text={steps.map(s => s.text).join(' ')} /></div>
      {steps.map(s => (
        <div key={s.level}>
          <span className="badge hint">Hint {s.level}</span> {s.text}
          {s.demo && <div style={{ marginTop: 6 }}><button className="btn small" onClick={() => nav(`/build?g=${encodeURIComponent(s.demo)}`)}>🧩 Open the demo on Build a graph</button>{s.unit?.startsWith('U') && <Link className="btn small" to={`/unit/${s.unit}`} style={{ marginLeft: 6 }}>Revisit {s.unit}</Link>}</div>}
        </div>
      ))}
      <div className="row">
        {steps.length < 3 && <button className="btn small" onClick={more}>Next hint</button>}
        <button className="btn small" onClick={() => openChat({ context: { problemId, category, misconception: mis.id }, prefill: 'Explain this feedback' })}>💬 Ask about this feedback</button>
      </div>
    </div>
  );
}

export default function Problem() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { announce } = useApp();
  const [p, setP] = useState(null);
  const [code, setCode] = useState('');
  const [report, setReport] = useState('');
  const [custom, setCustom] = useState(params.get('input') || '');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [startedAt] = useState(Date.now());
  useEffect(() => {
    setP(null); setRes(null);
    api(`/problems/${id}`).then(d => { setP(d); setCode(d.saved || d.starter); }).catch(e => setErr(e.message));
  }, [id]);
  if (err && !p) return <p className="feedback bad">{err}</p>;
  if (!p) return <p>Loading…</p>;

  const run = async mode => {
    setBusy(mode); setErr(''); setRes(null);
    try {
      const r = await api(`/problems/${id}/run`, { method: 'POST', body: { code, mode, report, startedAt, input: custom } });
      setRes(r);
      if (r.phase === 'compile') announce(`Your code did not compile. ${r.compileErrors[0]?.plain || ''}`);
      else if (r.phase === 'static') announce(r.message);
      else if (r.allPassed && mode === 'submit') { confetti(); announce(`All ${r.total} tests passed. Well done!`); }
      else announce(`${r.passed} of ${r.total} tests passed.${r.misconceptions?.[0] ? ` ${r.misconceptions[0].hint}` : ''}`);
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const timing = res?.cases?.find(c => c.timing)?.output;
  const timeRows = timing ? timing.trim().split('\n').filter(l => l.startsWith('TIME')).map(l => l.split(' ').slice(1)) : [];

  return (
    <div className="stack">
      <p><Link to="/tests">← All problems</Link></p>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{p.id} {p.title}</h1>
        <span className="chip">{p.level} · {p.unit}</span>
      </div>
      <div className="row">
        <div className="grow stack" style={{ maxWidth: 520 }}>
          <div className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}><b>The task</b><ReadButton text={p.statement} /></div>
            <p style={{ margin: 0 }}>{p.statement.split('`').map((t, i) => (i % 2 ? <code key={i}>{t}</code> : t))}</p>
            <p className="small muted" style={{ margin: 0 }}>Drozdek {p.drozdek} · CS2023: {p.outcomes.join(', ')}</p>
            <p className="small" style={{ margin: 0 }}>Your file: <code>{p.file}.java</code>. Do not use <code>java.util</code> collections.</p>
          </div>
          <div className="card stack">
            <b>Sample test</b>
            {p.sampleNote && <p className="small muted" style={{ margin: 0 }}>{p.sampleNote}</p>}
            {p.samples.map((s, i) => <div className="io" key={i} style={{ gridTemplateColumns: '1fr 1fr' }}><div><span className="small">Input</span><pre>{s.input}</pre></div><div><span className="small">Expected output</span><pre>{s.expected}</pre></div></div>)}
            <p className="small muted" style={{ margin: 0 }}>Graph input: <code>n m d</code> (d = 1 means directed), then one <code>u v</code> line per edge, vertices numbered from 0.</p>
          </div>
          {p.customOk && (
            <div className="card stack">
              <b>Try your own graph</b>
              <p className="small muted" style={{ margin: 0 }}>Paste a graph exported from Build a graph. The app works out the right answer and compares yours.</p>
              <textarea className="mono" value={custom} onChange={e => setCustom(e.target.value)} placeholder={'4 3 1\n0 1\n1 2\n2 3'} aria-label="Your own graph in the test format" />
              <button className="btn small" onClick={() => run('custom')} disabled={!!busy || !custom.trim()}>{busy === 'custom' ? 'Running…' : 'Run on my graph'}</button>
            </div>
          )}
        </div>
        <div className="grow stack" style={{ minWidth: 340 }}>
          <div className="editor-wrap">
            <CodeMirror value={code} height="520px" extensions={[java()]} onChange={setCode} aria-label={`${p.file}.java editor`} basicSetup={{ tabSize: 4 }} />
          </div>
          {p.report && (
            <label className="field">Your report: compare your times with the theory (sparse vs dense, V³ vs V(V + E))
              <textarea value={report} onChange={e => setReport(e.target.value)} />
            </label>
          )}
          <div className="row">
            <button className="btn" onClick={() => run('visible')} disabled={!!busy}>{busy === 'visible' ? 'Running…' : '▶ Run sample'}</button>
            <button className="btn primary" onClick={() => run('submit')} disabled={!!busy}>{busy === 'submit' ? 'Running hidden tests…' : '✓ Submit (hidden tests)'}</button>
            <button className="btn ghost" onClick={() => { if (confirm('Replace your code with the starter code?')) setCode(p.starter); }}>Reset to starter</button>
          </div>
          {err && <p className="feedback bad" role="alert">{err}</p>}
        </div>
      </div>

      {res && (
        <section id="results" className="card stack" aria-labelledby="resh">
          <h2 id="resh">Results</h2>
          {res.phase === 'static' && <div className="feedback bad"><span className="badge fail">Not run</span> {res.message}</div>}
          {res.phase === 'compile' && (
            <div className="stack">
              <div className="feedback bad"><span className="badge fail">Did not compile</span> Fix these, starting with the first:</div>
              {res.compileErrors.map((c, i) => <div key={i} className="feedback bad"><b>{c.line ? `Line ${c.line}: ` : ''}</b>{c.plain}<div className="small muted mono">{c.message}</div></div>)}
            </div>
          )}
          {res.phase === 'run' && (
            <>
              <p style={{ margin: 0 }}><span className={`badge ${res.allPassed ? 'pass' : 'fail'}`}>{res.passed} of {res.total} passed</span> {res.submit ? 'Hidden tests are made just for you; their contents stay hidden, but you see each one\'s type.' : 'Sample only. Submit to run the hidden tests.'}</p>
              <table className="cases">
                <thead><tr><th>Test</th><th>Result</th><th>Details</th></tr></thead>
                <tbody>{res.cases.map((c, i) => (
                  <tr key={i}>
                    <td>{c.visible ? 'Sample' : 'Hidden'}: {c.categoryLabel}</td>
                    <td><span className={`badge ${c.passed ? 'pass' : 'fail'}`}>{c.passed ? 'Pass' : c.status === 'timeout' ? 'Too slow' : c.status === 'exception' ? c.exception : c.status === 'not-run' ? 'Not run' : 'Wrong'}</span></td>
                    <td>{c.visible && !c.passed && c.status === 'done' && (
                      <div className="io"><div><span className="small">Input</span><pre>{c.input}</pre></div><div><span className="small">Expected</span><pre>{c.expected}</pre></div><div><span className="small">Yours</span><pre>{c.output || '(nothing printed)'}</pre></div></div>
                    )}{c.formatOnly && <span className="small"> Right values, wrong spacing.</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
              {timeRows.length > 0 && (
                <div>
                  <b>Timing run (best of 3, in milliseconds)</b>
                  <table className="plain"><thead><tr><th>Vertices</th><th>Density</th><th>Warshall's</th><th>Repeated DFS</th></tr></thead>
                    <tbody>{timeRows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{(r[2] / 1000).toFixed(1)}</td><td>{(r[3] / 1000).toFixed(1)}</td></tr>)}</tbody></table>
                </div>
              )}
              {res.rubric && <div className="feedback"><b>Report checklist</b><ul>{res.rubric.results.map(r => <li key={r.idea}>{r.met ? '✓' : '✗'} {r.idea}</li>)}</ul></div>}
              {res.misconceptions?.map(m => <HintLadder key={m.id} problemId={p.id} mis={m} category={res.failedCategories?.[0]} />)}
            </>
          )}
          {res.phase !== 'run' && res.misconceptions?.map(m => <HintLadder key={m.id} problemId={p.id} mis={m} category={null} />)}
        </section>
      )}
    </div>
  );
}
