import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, confetti, LevelIcon, LEVELS, ReadButton, useApp, pct } from '../lib.jsx';

function Block({ b }) {
  const nav = useNavigate();
  switch (b.type) {
    case 'h': return <h2>{b.text}</h2>;
    case 'p': return <p>{b.text}</p>;
    case 'list': return <ul>{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
    case 'note': return <p className="note">💡 {b.text}</p>;
    case 'formula': return <p className="formula" aria-label={b.text}>{b.text}</p>;
    case 'def': return <dl className="def">{b.items.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>;
    case 'table': return <table><thead><tr>{b.head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>;
    case 'demo': return <p><button className="btn" onClick={() => nav(`/build?g=${encodeURIComponent(b.graph)}`)}>🧩 {b.label}</button></p>;
    default: return null;
  }
}
const blockText = b => b.text || (b.items ? b.items.map(x => (Array.isArray(x) ? x.join(': ') : x)).join('. ') : '') || (b.rows ? b.rows.map(r => r.join(', ')).join('. ') : '');

function MatrixInput({ q, value, onChange }) {
  const n = q.n;
  const m = value || Array.from({ length: n }, () => Array(n).fill(0));
  const toggle = (i, j) => { const c = m.map(r => [...r]); c[i][j] = c[i][j] ? 0 : 1; onChange(c); };
  return (
    <div className="row">
      {q.given && (
        <div>
          <p className="small"><b>Before k = {q.labels[q.k]}</b></p>
          <table className="mx"><thead><tr><th />{q.labels.map((l, j) => <th key={j} className={j === q.k ? 'k' : ''}>{l}</th>)}</tr></thead>
            <tbody>{q.given.map((r, i) => <tr key={i}><th className={i === q.k ? 'k' : ''}>{q.labels[i]}</th>{r.map((v, j) => <td key={j} className={v ? 'on' : ''}>{v}</td>)}</tr>)}</tbody></table>
        </div>
      )}
      <div>
        {q.given && <p className="small"><b>Your answer: after k = {q.labels[q.k]}</b></p>}
        <table className="mx" aria-label="Answer matrix. Each cell is a toggle button.">
          <thead><tr><th />{q.labels.map((l, j) => <th key={j} scope="col">{l}</th>)}</tr></thead>
          <tbody>{m.map((r, i) => (
            <tr key={i}><th scope="row">{q.labels[i]}</th>{r.map((v, j) => (
              <td key={j} style={{ border: 'none', padding: 0 }}><button type="button" className="cell" aria-pressed={!!v} aria-label={`row ${q.labels[i]}, column ${q.labels[j]}: ${v ? 1 : 0}`} onClick={() => toggle(i, j)}>{v ? 1 : 0}</button></td>
            ))}</tr>
          ))}</tbody>
        </table>
        {q.given && <button type="button" className="btn small" onClick={() => onChange(q.given.map(r => [...r]))}>Start from the matrix before</button>}
      </div>
    </div>
  );
}
function CellsInput({ q, value = [], onChange }) {
  const on = (i, j) => value.some(([a, b]) => a === i && b === j);
  const toggle = (i, j) => onChange(on(i, j) ? value.filter(([a, b]) => !(a === i && b === j)) : [...value, [i, j]]);
  return (
    <table className="mx" aria-label="Select the cells that change">
      <thead><tr><th />{q.labels.map((l, j) => <th key={j} scope="col">{l}</th>)}</tr></thead>
      <tbody>{q.labels.map((l, i) => (
        <tr key={i}><th scope="row">{l}</th>{q.labels.map((_, j) => (
          <td key={j} style={{ border: 'none', padding: 0 }}><button type="button" className="cell" aria-pressed={on(i, j)} aria-label={`cell row ${l}, column ${q.labels[j]}`} onClick={() => toggle(i, j)}>{on(i, j) ? '✓' : ''}</button></td>
        ))}</tr>
      ))}</tbody>
    </table>
  );
}
function SetInput({ q, value = [], onChange }) {
  return (
    <fieldset style={{ border: 'none', padding: 0 }}>
      <legend className="sr-only">{q.prompt}</legend>
      <div className="row">{q.labels.map((l, i) => (
        <label key={i} className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={value.includes(i)} onChange={e => onChange(e.target.checked ? [...value, i] : value.filter(x => x !== i))} /> {l}</label>
      ))}</div>
    </fieldset>
  );
}

function Question({ q, i, value, onChange, result }) {
  return (
    <section className="card stack" aria-labelledby={`${q.id}-p`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 id={`${q.id}-p`} style={{ margin: 0 }}>Question {i + 1}</h3>
        <ReadButton text={q.prompt + (q.options ? ' Options: ' + q.options.map(o => o.text).join('; ') : '')} />
      </div>
      <p style={{ margin: 0 }}>{q.prompt}</p>
      {q.type === 'mcq' && (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="sr-only">{q.prompt}</legend>
          <div className="stack">{q.options.map(o => (
            <label key={o.id} className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name={q.id} checked={value === o.id} onChange={() => onChange(o.id)} /> {o.text}
            </label>
          ))}</div>
        </fieldset>
      )}
      {q.type === 'matrix' && <MatrixInput q={q} value={value} onChange={onChange} />}
      {q.type === 'cells' && <CellsInput q={q} value={value} onChange={onChange} />}
      {q.type === 'set' && <SetInput q={q} value={value} onChange={onChange} />}
      {q.type === 'text' && <label className="field"><span className="sr-only">Your answer</span><textarea value={value || ''} onChange={e => onChange(e.target.value)} /></label>}
      {result && (
        <div className={`feedback ${result.correct ? 'ok' : 'bad'}`} role="status">
          <span className={`badge ${result.correct ? 'pass' : 'fail'}`}>{result.correct ? 'Right' : 'Not yet'}</span>{' '}{result.feedback}
          {result.rubric && <ul className="small">{result.rubric.map(r => <li key={r.idea}>{r.met ? '✓' : '✗'} {r.idea}</li>)}</ul>}
          <ReadButton text={result.feedback} />
        </div>
      )}
    </section>
  );
}

export default function Unit() {
  const { id } = useParams();
  const { announce } = useApp();
  const [unit, setUnit] = useState(null);
  const [check, setCheck] = useState(null);
  const [resp, setResp] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setUnit(null); setCheck(null); setResult(null); setResp({}); api(`/units/${id}`).then(setUnit).catch(e => setErr(e.message)); }, [id]);
  if (err) return <p className="feedback bad">{err}</p>;
  if (!unit) return <p>Loading…</p>;
  if (!unit.unlocked) return <div className="card"><h1>{unit.id} {unit.title}</h1><p><span className="badge lock">Locked</span> Reach 80% on the previous unit's check to open this one.</p><Link to="/" className="btn">Back to the learning path</Link></div>;
  const start = async () => {
    setErr(''); setResult(null); setResp({});
    try { setCheck(await api(`/units/${id}/check/start`, { method: 'POST' })); setTimeout(() => document.getElementById('check')?.scrollIntoView({ behavior: 'smooth' }), 50); } catch (e) { setErr(e.message); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api(`/units/${id}/check/submit`, { method: 'POST', body: { attempt: check.attempt, startedAt: check.startedAt, responses: resp } });
      setResult(r);
      setUnit(u => ({ ...u, mastery: r.mastery }));
      if (r.secure) { confetti(); announce(`Well done: ${r.correct} of ${r.total}. ${unit.id} is secure.${r.nextUnlocked && r.next ? ` ${r.next} is now open.` : ''}`); }
      else announce(`${r.correct} of ${r.total} right. Read the feedback under each question, then try again with fresh questions.`);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const byId = Object.fromEntries((result?.results || []).map(r => [r.id, r]));
  return (
    <div className="stack">
      <p><Link to="/">← Learning path</Link></p>
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>{unit.id} {unit.title}</h1>
        <span className="chip"><LevelIcon level={unit.mastery.level} /> {LEVELS[unit.mastery.level].label}{unit.mastery.best !== null ? ` · best ${pct(unit.mastery.best)}` : ''}</span>
      </div>
      {unit.outcomes.length > 0 && <p className="small muted">CS2023: {unit.outcomes.join(' · ')}</p>}
      <article className="lesson card">
        <div className="row" style={{ justifyContent: 'flex-end' }}><ReadButton text={unit.content.map(blockText).join(' ')} /></div>
        {unit.content.map((b, i) => <Block key={i} b={b} />)}
      </article>
      <section id="check" className="stack" aria-labelledby="checkh">
        <h2 id="checkh">{unit.advisory ? 'Readiness check (advisory)' : 'Unit check'}</h2>
        <p>{unit.advisory ? 'This check does not lock anything; it shows what to revise first.' : 'Reach 80% to open the next unit. Every retry gives you fresh questions.'}</p>
        {!check && <button className="btn primary" onClick={start}>Start the check</button>}
        {check && check.questions.map((q, i) => <Question key={q.id} q={q} i={i} value={resp[q.id]} onChange={v => setResp(r => ({ ...r, [q.id]: v }))} result={byId[q.id]} />)}
        {check && !result && <button className="btn primary" onClick={submit} disabled={busy}>{busy ? 'Marking…' : 'Submit answers'}</button>}
        {result && (
          <div className={`card ${result.secure ? '' : 'soft'}`} role="status">
            <h3>{result.correct} of {result.total} right ({pct(result.score)}) {result.secure ? '🎉' : ''}</h3>
            <p>{result.secure ? (result.next ? `${unit.id} is secure.${result.nextUnlocked ? ` ${result.next} is open.` : ''}` : 'You have finished the last unit. Try the Java tests next.') : 'Read the feedback under each question, then try again with fresh questions.'}</p>
            <div className="row">
              <button className="btn" onClick={start}>Try again with fresh questions</button>
              {result.secure && result.next && <Link className="btn primary" to={`/unit/${result.next}`}>Go to {result.next}</Link>}
              <Link className="btn" to="/tests">Java tests</Link>
            </div>
          </div>
        )}
        {err && <p className="feedback bad" role="alert">{err}</p>}
      </section>
    </div>
  );
}
