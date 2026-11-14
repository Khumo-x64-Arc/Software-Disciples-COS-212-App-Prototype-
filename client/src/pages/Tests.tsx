import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type GradeResult, type Problem, type ProblemState } from '../api';
import { exportText } from '../../../shared/graph-core.mjs';
import { useApp } from '../state/AppContext';
import { useHelper } from '../components/HelperChat';
import { Confetti, useAnnounce } from '../components/ui';
import { useRewards } from '../state/rewards';
import { useI18n } from '../i18n';
import { CORE, POINTS } from '../../../shared/units.mjs';
import { useSpeech } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';

function useProblems() {
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState('');
  const [java, setJava] = useState<boolean | null>(null);
  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.problems(), api.health()]);
      setProblems(p.problems);
      setJava(h.java);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => void load(), [load]);
  return { problems, error, java, setProblems };
}

/** The coding questions open once every core lesson is finished (staff can always look). */
export function CodingGate({ children }: { children: React.ReactNode }) {
  const { progress, user } = useApp();
  const { t, lesson } = useI18n();
  const done = CORE.filter(l => progress.done?.[l.id]).length;
  if (done === CORE.length || user?.role !== 'student') return <>{children}</>;
  const next = CORE.find(l => !progress.done?.[l.id])!;
  return (
    <div>
      <h1 className="page-title">{t('coding.title')}</h1>
      <section className="card locked-card">
        <p className="lock-icon" aria-hidden>🔒</p>
        <p className="lead">{t('coding.locked', { n: done })}</p>
        <div className="progress" role="progressbar" aria-label={t('lessons.core')} aria-valuemin={0} aria-valuemax={CORE.length} aria-valuenow={done}>
          <div className="progress-fill" style={{ width: `${(100 * done) / CORE.length}%` }} />
        </div>
        <p>{t('coding.lockedNext', { lesson: `${next.id} ${lesson(next.id).title}` })}</p>
        <Link className="button" to={`/lesson/${next.id}`}>{next.icon} {lesson(next.id).title} →</Link>
      </section>
    </div>
  );
}

export function TestList() {
  const { problems, error, java } = useProblems();
  const { t } = useI18n();
  if (error) return <p className="error">{error}</p>;
  if (!problems) return <p>{t('common.loading')}</p>;
  return (
    <div>
      <h1 className="page-title">{t('coding.title')}</h1>
      <p className="muted">{t('coding.intro')}</p>
      {java === false && <p className="callout callout-bad">Java is not installed on this server, so code cannot be marked right now. You can still read and write solutions.</p>}
      <table className="cost-table problem-table">
        <caption className="sr-only">Problems</caption>
        <thead>
          <tr><th scope="col">{t('nav.coding')}</th><th scope="col">{t('coding.level')}</th><th scope="col">{t('coding.lesson')}</th><th scope="col">{t('coding.status')}</th></tr>
        </thead>
        <tbody>
          {problems.map(p => (
            <tr key={p.id}>
              <th scope="row"><Link to={`/coding/${p.id}`}>{p.id} {p.title}</Link></th>
              <td><span className={`tier tier-${p.level === 'Warm-up' ? 1 : p.level === 'Core' ? 2 : 3}`}>{t(`quiz.tier${p.level === 'Warm-up' ? 1 : p.level === 'Core' ? 2 : 3}`)}</span></td>
              <td><Link to={`/lesson/${p.unit}`}>{p.unit}</Link></td>
              <td>
                {p.state.passed ? <span className="status status-done">✓ {t('coding.passed')}</span> : p.state.attempts ? <span className="status">{t('coding.attempts', { n: p.state.attempts })}</span> : <span className="status status-locked">{t('coding.notTried')}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const draftKey = (id: string) => `cos212-graphs:draft:${id}`;

export function ProblemPage() {
  const { id = 'P1' } = useParams();
  const { problems, error, java, setProblems } = useProblems();
  const p = problems?.find(x => x.id === id);
  if (error) return <p className="error">{error}</p>;
  if (!problems) return <p>Loading…</p>;
  if (!p) return <p>Unknown problem. <Link to="/coding">All problems</Link></p>;
  return <ProblemView key={p.id} p={p} java={java} onState={st => setProblems(ps => ps!.map(x => (x.id === p.id ? { ...x, state: st } : x)))} problems={problems} />;
}

function ProblemView({ p, java, onState, problems }: { p: Problem; java: boolean | null; onState: (s: ProblemState) => void; problems: Problem[] }) {
  const { progress } = useApp();
  const { award, notify } = useRewards();
  const { t } = useI18n();
  const helper = useHelper();
  const { setContext } = helper;
  const announce = useAnnounce();
  const { speak, stop, active, supported } = useSpeech();
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem(draftKey(p.id)) ?? (p.state.code || p.starter);
    } catch {
      return p.state.code || p.starter;
    }
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [err, setErr] = useState('');
  const [tryInput, setTryInput] = useState(() => (progress.graph ? exportText(progress.graph) : '3 2 1\n0 1\n1 2\n'));
  const [tryOut, setTryOut] = useState<Awaited<ReturnType<typeof api.tryInput>> | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLHeadingElement>(null);
  const st = p.state;
  const idx = problems.findIndex(x => x.id === p.id);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(p.id), code);
    } catch {
      /* ignore */
    }
  }, [code, p.id]);

  useEffect(() => {
    setContext(c => ({ ...c, unit: p.unit, problem: { id: p.id, hintLevel: st.hintLevel }, feedback: result?.misconception ? { problem: p.id, failedCaseTypes: result.failedCaseTypes, misconception: result.misconception } : c.feedback?.problem === p.id ? c.feedback : null }));
  }, [p.id, p.unit, st.hintLevel, result, setContext]);
  useEffect(() => () => setContext(c => ({ ...c, problem: null, feedback: null })), [setContext]);

  const submit = async () => {
    stop();
    setBusy(true);
    setErr('');
    try {
      const hadSolution = Boolean(st.solution);
      const r = await api.submit(p.id, code);
      setResult(r.result);
      onState(r.state);
      if (r.result.passed) {
        const pts = award(`problem:${p.id}`, hadSolution ? POINTS.problemAfterSolution : POINTS.problem);
        notify('good', pts ? t('fb.problem', { n: pts }) : t('fb.welldoneNoPts'), '💻');
      } else notify('retry', t('fb.tryagain'), '🤖');
      const sum = summary(r.result);
      announce(sum);
      requestAnimationFrame(() => feedbackRef.current?.focus());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const getHint = async () => {
    try {
      const r = await api.hint(p.id);
      onState(r.state);
      announce(`Hint ${r.state.hintLevel}: ${r.state.hints[r.state.hintLevel - 1]}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const runTry = async () => {
    setTryOut(null);
    try {
      setTryOut(await api.tryInput(p.id, code, tryInput));
    } catch (e) {
      setTryOut({ status: 'error', actual: (e as Error).message });
    }
  };

  const goToLine = (line: number | null) => {
    const ta = editorRef.current;
    if (!ta || !line) return;
    const lines = code.split('\n');
    const pos = lines.slice(0, line - 1).reduce((a, l) => a + l.length + 1, 0);
    ta.focus();
    ta.setSelectionRange(pos, pos + (lines[line - 1]?.length ?? 0));
    ta.scrollTop = Math.max(0, (line - 4) * 21);
  };

  const onEditorKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    } else if (e.key === 'Tab' && !e.shiftKey && !e.altKey) {
      // Tab indents; Esc then Tab leaves the editor (announced in the help text).
      const ta = e.currentTarget;
      if (ta.dataset.escaped === '1') return;
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd;
      const next = code.slice(0, s) + '    ' + code.slice(en);
      setCode(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + 4, s + 4));
    } else if (e.key === 'Escape') {
      e.currentTarget.dataset.escaped = '1';
    } else e.currentTarget.dataset.escaped = '';
  };

  const lineCount = code.split('\n').length;
  const allPassed = result?.passed ?? false;

  return (
    <div className="problem">
      <Confetti show={allPassed} />
      <nav className="unit-nav small" aria-label="Problem navigation">
        <Link to="/coding">← {t('coding.title')}</Link>
        <span className="spacer" />
        {idx > 0 && <Link to={`/coding/${problems[idx - 1].id}`}>← {problems[idx - 1].id}</Link>}
        {idx < problems.length - 1 && <Link to={`/coding/${problems[idx + 1].id}`}>{problems[idx + 1].id} →</Link>}
      </nav>
      <header className="unit-head">
        <p className="eyebrow">{p.level} · {t('coding.lesson')} <Link to={`/lesson/${p.unit}`}>{p.unit}</Link></p>
        <h1>{p.id} {p.title}</h1>
        <div className="chips">
          {st.passed && <span className="mastery m-secure">● Passed</span>}
          <span className="chip">{st.attempts} attempt{st.attempts === 1 ? '' : 's'}</span>
          {p.outcomes.map(o => <span key={o} className="chip outcome">{o}</span>)}
        </div>
      </header>

      <div className="problem-grid">
        <section className="card" aria-labelledby="task-h">
          <h2 id="task-h">Task</h2>
          <div className="task-text">
            {p.task.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
          </div>
          {supported && (
            <button type="button" className={`speaker ${active?.key === 'task' ? 'reading' : ''}`} onClick={() => (active ? stop() : speak([{ key: 'task', say: toSpoken(p.task) }]))}>
              {active?.key === 'task' ? '■ Stop' : '🔊 Read the task'}
            </button>
          )}
          {p.api.length > 0 && (
            <>
              <h3 className="small-heading">Methods to write</h3>
              <ul className="api-list">{p.api.map(a => <li key={a}><code>{a}</code></li>)}</ul>
            </>
          )}
          {p.samples.length > 0 && (
            <>
              <h3 className="small-heading">Sample tests</h3>
              {p.samples.map((s, i) => (
                <div key={i} className="sample">
                  <div><span className="small muted">Input</span><pre className="code-block">{s.input}</pre></div>
                  <div><span className="small muted">Expected output</span><pre className="code-block">{s.expected}</pre></div>
                </div>
              ))}
            </>
          )}

          <h3 className="small-heading">{t('coding.hints')}</h3>
          <ol className="hint-ladder">
            {[0, 1, 2].map(i => (
              <li key={i} className={i < st.hintLevel ? 'open' : ''}>
                {i < st.hintLevel ? st.hints[i] : <span className="muted">Hint {i + 1}{i === 2 ? ' (worked example)' : ''}: locked</span>}
              </li>
            ))}
          </ol>
          {st.hintAvailable && (
            <p className="small">
              <button type="button" className="secondary" onClick={() => void getHint()}>💡 {t('coding.openHint', { n: st.hintLevel + 1 })}</button>
            </p>
          )}
        </section>

        <section className="card editor-card" aria-labelledby="code-h">
          <h2 id="code-h">Your code: {p.className}.java</h2>
          <div className="editor">
            <div className="gutter" ref={gutterRef} aria-hidden>
              {Array.from({ length: lineCount }, (_, i) => <span key={i}>{i + 1}</span>)}
            </div>
            <textarea
              ref={editorRef}
              className="code-input"
              value={code}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label={`Java code for ${p.className}`}
              aria-describedby="editor-help"
              onChange={e => setCode(e.target.value)}
              onKeyDown={onEditorKey}
              onScroll={e => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; }}
              rows={22}
            />
          </div>
          <p id="editor-help" className="small muted">Tab indents. Press Esc then Tab to leave the editor. Ctrl + Enter submits.</p>
          <div className="button-row">
            <button type="button" onClick={() => void submit()} disabled={busy || java === false} aria-keyshortcuts="Control+Enter">
              {busy ? t('coding.marking') : t('coding.submit')}
            </button>
            <button type="button" className="secondary" onClick={() => { if (confirmReset()) setCode(p.starter); }}>Reset to starter</button>
          </div>
          {err && <p className="error" role="alert">{err}</p>}
        </section>
      </div>

      {result && (
        <section className={`card feedback-card ${result.passed ? 'ok' : 'no'}`} aria-labelledby="fb-h">
          <h2 id="fb-h" ref={feedbackRef} tabIndex={-1}>{result.passed ? '✓ All tests passed' : result.status === 'compile-error' ? '✗ Your code did not compile' : result.status === 'blocked' ? '✗ Not allowed in this problem' : `✗ ${result.passedCount ?? 0} of ${result.total ?? 0} tests passed`}</h2>
          <Feedback result={result} goToLine={goToLine} />
          <div className="button-row">
            {supported && (
              <button type="button" className="speaker" onClick={() => (active ? stop() : speak([{ key: 'fb', say: toSpoken(summary(result)) }]))}>
                {active?.key === 'fb' ? '■ Stop' : '🔊 Read feedback'}
              </button>
            )}
            {!result.passed && (
              <button type="button" className="secondary" onClick={() => helper.open(result.status === 'compile-error' ? 'Why does my code not compile?' : 'Why did my code fail?')}>
                💬 Ask about this feedback
              </button>
            )}
            {result.passed && idx < problems.length - 1 && <Link className="button" to={`/coding/${problems[idx + 1].id}`}>Next: {problems[idx + 1].id} →</Link>}
          </div>
        </section>
      )}

      {(result ? !result.passed && (result.solution ?? st.solution) : !st.passed && st.solution) && (
        <section className="card solution-card" aria-labelledby="sol-h">
          <h2 id="sol-h">🧩 {t('coding.solution')}: {p.className}.java</h2>
          <p className="small">{t('coding.solutionNote')}</p>
          <pre className="code-block solution-code"><code>{result?.solution ?? st.solution}</code></pre>
        </section>
      )}

      {['P5', 'P6', 'P7', 'P9'].includes(p.id) && (
        <section className="card" aria-labelledby="try-h">
          <h2 id="try-h">Try your own graph</h2>
          <p className="small muted">Pre-filled with the graph from <Link to="/build">Build a graph</Link> (Export format). Not marked.</p>
          <textarea className="mono" rows={5} value={tryInput} onChange={e => setTryInput(e.target.value)} aria-label="Input graph" />
          <button type="button" className="secondary" onClick={() => void runTry()} disabled={java === false}>Run on this input</button>
          {tryOut && (
            <div className="sample" role="status">
              {tryOut.compileErrors ? (
                <p className="error">Compile error: {tryOut.compileErrors.map(c => `line ${c.line}: ${c.message}`).join('; ')}</p>
              ) : tryOut.issues ? (
                <p className="error">{tryOut.issues.map(i => i.message).join(' ')}</p>
              ) : (
                <>
                  <div><span className="small muted">Your output {tryOut.passed ? '✓ matches' : '✗ differs'}</span><pre className="code-block">{tryOut.actual || '(nothing)'}</pre></div>
                  {tryOut.expected && <div><span className="small muted">Expected</span><pre className="code-block">{tryOut.expected}</pre></div>}
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const confirmReset = () => window.confirm?.('Replace your code with the starter code?') ?? true;

function summary(r: GradeResult): string {
  if (r.passed) return 'All tests passed. Well done.';
  if (r.status === 'compile-error') return `Your code did not compile. ${(r.compileErrors ?? []).map(c => `Line ${c.line}: ${c.message}`).join(' ')}`;
  if (r.status === 'blocked') return (r.issues ?? []).map(i => `Line ${i.line}: ${i.message}`).join(' ');
  const parts = [`${r.passedCount} of ${r.total} tests passed.`];
  if (r.failedCaseTypes?.length) parts.push(`Failing case types: ${r.failedCaseTypes.join(', ')}.`);
  if (r.misconception) parts.push(`${r.misconception.label}. ${r.misconception.hint}`);
  return parts.join(' ');
}

function Feedback({ result: r, goToLine }: { result: GradeResult; goToLine: (n: number | null) => void }) {
  return (
    <>
      {r.compileErrors && (
        <ul className="error-list">
          {r.compileErrors.map((c, i) => (
            <li key={i}>
              {c.line ? <button type="button" className="link-button" onClick={() => goToLine(c.line)}>Line {c.line}</button> : 'Somewhere'}: {c.message}
              <details><summary className="small">Java’s exact message</summary><pre className="code-block small">{c.raw}</pre></details>
            </li>
          ))}
        </ul>
      )}
      {r.issues && (
        <ul className="error-list">
          {r.issues.map((x, i) => (
            <li key={i}><button type="button" className="link-button" onClick={() => goToLine(x.line)}>Line {x.line}</button>: {x.message}</li>
          ))}
        </ul>
      )}
      {r.misconception && (
        <div className="misconception callout">
          <p><strong>Likely misconception: {r.misconception.label}.</strong></p>
          <p>{r.misconception.hint}</p>
          {r.misconception.pointsTo && (
            <p className="small">
              Revisit: {r.misconception.pointsTo}
              {/\b[LU]\d\b/.test(r.misconception.pointsTo) && <> · <Link to={`/lesson/${r.misconception.pointsTo.match(/\b[LU]\d\b/)![0]}`}>open {r.misconception.pointsTo.match(/\b[LU]\d\b/)![0]} →</Link></>}
            </p>
          )}
        </div>
      )}
      {r.runtimeError && <p className="error">Runtime error: {r.runtimeError}</p>}
      {r.tests && (
        <ul className="test-list">
          {r.tests.map(t => (
            <li key={t.name} className={t.passed ? 'pass' : 'fail'}>
              <span aria-hidden>{t.passed ? '✓' : '✗'}</span> <strong>{t.name}</strong>
              {!t.visible && !t.passed && <span className="muted small"> ({t.status})</span>}
              {t.visible && !t.passed && (
                <div className="sample">
                  <div><span className="small muted">Input</span><pre className="code-block">{t.input}</pre></div>
                  <div><span className="small muted">Expected</span><pre className="code-block">{t.expected}</pre></div>
                  <div><span className="small muted">Your output{t.status !== 'OK' ? ` (${t.status})` : ''}</span><pre className="code-block">{t.actual || '(nothing)'}</pre></div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
