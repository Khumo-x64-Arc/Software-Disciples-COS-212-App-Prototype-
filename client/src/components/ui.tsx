import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { useSpeech } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';

// ---------------------------------------------------------------------------
// Announcement bar: every change is written to a polite live region, shown on
// screen, and (if the learner turned it on) read aloud.
// ---------------------------------------------------------------------------
const AnnounceCtx = createContext<(text: string) => void>(() => {});
export const useAnnounce = () => useContext(AnnounceCtx);

export function AnnounceProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState('');
  const { settings } = useApp();
  const announce = useCallback(
    (t: string) => {
      if (!t) return;
      // Clear first so a repeated message is announced again.
      setText('');
      requestAnimationFrame(() => setText(t));
      if (settings.announceAloud && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(toSpoken(t));
        u.rate = settings.rate;
        window.speechSynthesis.speak(u);
      }
    },
    [settings.announceAloud, settings.rate],
  );
  return (
    <AnnounceCtx.Provider value={announce}>
      {children}
      <div className="sr-only" aria-live="polite" role="status">
        {text}
      </div>
    </AnnounceCtx.Provider>
  );
}

/** The visible announcement bar (Build a graph). */
export function AnnouncementBar({ text }: { text: string }) {
  const { speak, stop, active, supported } = useSpeech();
  return (
    <div className="announce-bar">
      <span aria-hidden className="announce-icon">ℹ</span>
      <span className="announce-text">{text || 'Changes you make are described here.'}</span>
      {supported && text && (
        <button type="button" className="speaker" onClick={() => (active ? stop() : speak([{ key: 'announce', say: toSpoken(text) }]))}>
          {active ? '■ Stop' : '🔊 Read'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matrices with a text form (screen readers read a real table).
// ---------------------------------------------------------------------------
export function MatrixTable({
  labels, cols, matrix, caption, changed = [], kRow = null, format = String, rowHeader = 'from', colHeader = 'to',
}: {
  labels: string[];
  cols?: string[];
  matrix: number[][];
  caption: string;
  changed?: { i: number; j: number }[];
  kRow?: number | null; // highlights row k and column k (Warshall)
  format?: (n: number) => string;
  rowHeader?: string;
  colHeader?: string;
}) {
  const c = cols ?? labels;
  const isChanged = (i: number, j: number) => changed.some(x => x.i === i && x.j === j);
  return (
    <div className="table-wrap">
      <table className="matrix">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">{rowHeader} \ {colHeader}</span></th>
            {c.map((l, j) => (
              <th key={l + j} scope="col" className={kRow === j ? 'k-line' : ''}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th scope="row" className={kRow === i ? 'k-line' : ''}>{labels[i]}</th>
              {row.map((v, j) => (
                <td key={j} className={[v ? 'has-edge' : '', isChanged(i, j) ? 'changed' : '', kRow === i || kRow === j ? 'k-line' : ''].join(' ')}>
                  {format(v)}
                  {isChanged(i, j) && <span className="cell-new" aria-label=", new"> ★</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step-by-step control. No auto-play: the learner moves every step.
// ---------------------------------------------------------------------------
export function Stepper({ index, count, onIndex, note, label = 'Step' }: { index: number; count: number; onIndex: (i: number) => void; note: string; label?: string }) {
  const { settings } = useApp();
  const { speak, stop, active, supported } = useSpeech();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (settings.narration) speak([{ key: 'step', say: toSpoken(note) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') onIndex(Math.min(count - 1, index + 1));
    else if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    else if (e.key === 'Home') onIndex(0);
    else if (e.key === 'End') onIndex(count - 1);
    else return;
    e.preventDefault();
  };
  return (
    <div className="stepper" onKeyDown={onKey}>
      <div className="controls" role="group" aria-label={`${label} controls`}>
        <button type="button" className="secondary" onClick={() => onIndex(0)} disabled={index === 0} aria-label="First step">⏮</button>
        <button type="button" className="secondary" onClick={() => onIndex(index - 1)} disabled={index === 0}>◀ Back</button>
        <span className="step-count" aria-live="off">
          {label} {index + 1} of {count}
        </span>
        <button type="button" onClick={() => onIndex(index + 1)} disabled={index >= count - 1}>Next ▶</button>
        <button type="button" className="secondary" onClick={() => onIndex(count - 1)} disabled={index >= count - 1} aria-label="Last step">⏭</button>
      </div>
      <p className="step-note" aria-live="polite">
        {note}{' '}
        {supported && (
          <button type="button" className="speaker" onClick={() => (active ? stop() : speak([{ key: 'step', say: toSpoken(note) }]))}>
            {active ? '■ Stop' : '🔊 Read'}
          </button>
        )}
      </p>
      <p className="muted small">Keys: ← and → step, Home and End jump to the ends.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Glossary pop-ups
// ---------------------------------------------------------------------------
export const GLOSSARY: Record<string, string> = {
  vertex: 'A point in a graph (also called a node). Here vertices are labelled a, b, c, …',
  edge: 'A connection between two vertices (also called an arc in a directed graph).',
  directed: 'In a directed graph (digraph) every edge has a direction: an edge from u to v does not give one from v to u.',
  weighted: 'Each edge carries a number, its weight (a cost, distance or time).',
  loop: 'An edge from a vertex to itself.',
  multigraph: 'A graph that may have two or more edges between the same pair of vertices (parallel edges), but no loops.',
  pseudograph: 'A multigraph that also allows loops.',
  'complete graph': 'Kₙ: every pair of distinct vertices is joined by an edge. It has n(n − 1)/2 edges.',
  degree: 'The number of edge ends at a vertex. A loop adds 2. In a digraph, in-degree counts arrows in and out-degree counts arrows out.',
  path: 'A sequence of edges where each edge starts where the last one ended.',
  cycle: 'A path of at least one edge that ends where it started without repeating an edge.',
  connected: 'An undirected graph is connected when there is a path between every pair of vertices.',
  'strongly connected': 'A digraph is strongly connected when every vertex can reach every other vertex following the arrows.',
  'weakly connected': 'A digraph is weakly connected when it is connected if you ignore the arrows, but not strongly connected.',
  'adjacency matrix': 'A V × V table: the cell in row u, column v says whether (or how many times) u is joined to v.',
  'adjacency list': 'For each vertex, a list of its neighbours. A star representation stores all lists in one array.',
  'incidence matrix': 'A V × E table: the cell in row v, column e says whether vertex v is an end of edge e.',
  relation: 'A set of ordered pairs (u, v). The edges of a digraph form a relation on its vertices.',
  'transitive closure': 'R⁺: the pair (u, v) is in R⁺ when there is a path of one or more edges from u to v. Its matrix is the reachability matrix.',
  reachability: 'v is reachable from u when a path leads from u to v.',
  DFS: 'Depth-first search: go as deep as possible along one branch before backing up. Uses a stack (or recursion).',
  BFS: 'Breadth-first search: visit all neighbours first, then their neighbours. Uses a queue.',
  'dynamic programming': 'Solving a problem by building each answer from smaller answers already stored in a table.',
  'Θ(V³)': 'Grows like V × V × V: double the vertices and the work goes up about eight times.',
  sparse: 'A graph with few edges compared with V² (E close to V).',
  dense: 'A graph with many edges, close to V².',
};

export function Term({ t, children }: { t: keyof typeof GLOSSARY | string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const def = GLOSSARY[t] ?? '';
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span className="term" ref={ref}>
      <button type="button" className="term-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        {children ?? t}
      </button>
      {open && (
        <span id={id} role="note" className="term-pop">
          <strong>{t}</strong>: {def}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confetti (skipped when reduced motion is on)
// ---------------------------------------------------------------------------
export function Confetti({ show }: { show: boolean }) {
  const { settings } = useApp();
  if (!show || settings.reducedMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  const colours = ['var(--brand)', 'var(--good)', 'var(--active)', 'var(--alt)', 'var(--mark)'];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 60 }, (_, i) => (
        <span
          key={i}
          style={{ left: `${(i * 37) % 100}%`, background: colours[i % colours.length], animationDelay: `${(i % 12) * 0.08}s`, transform: `rotate(${i * 29}deg)` }}
        />
      ))}
    </div>
  );
}

export function MasteryBadge({ level }: { level: string }) {
  const map: Record<string, [string, string]> = {
    secure: ['●', 'Secure'],
    developing: ['◐', 'Developing'],
    struggling: ['▲', 'Struggling'],
    'not-started': ['○', 'Not started'],
  };
  const [shape, label] = map[level] ?? map['not-started'];
  return (
    <span className={`mastery m-${level}`}>
      <span aria-hidden>{shape}</span> {label}
    </span>
  );
}

/** Read-aloud block of explanation text, paragraph by paragraph. */
export function Explain({ id, paras }: { id: string; paras: string[] }) {
  const { speak, stop, active, supported } = useSpeech();
  const reading = active?.key.startsWith(id);
  return (
    <div className="explain">
      {paras.map((p, i) => (
        <p key={i} className={active?.key === `${id}-${i}` ? 'reading-block' : ''}>{p}</p>
      ))}
      {supported && (
        <button type="button" className="speaker" onClick={() => (reading ? stop() : speak(paras.map((p, i) => ({ key: `${id}-${i}`, say: toSpoken(p) }))))}>
          {reading ? '■ Stop' : '🔊 Read aloud'}
        </button>
      )}
    </div>
  );
}
