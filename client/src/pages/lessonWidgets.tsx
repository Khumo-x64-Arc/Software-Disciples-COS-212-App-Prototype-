// "Try it" activities for the new lessons (L1, L2, L4, L6, L7, L8).
// L3, L5 and U5–U8 reuse the activities in unitWidgets.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import { bfsTrace, dfsTrace, ids, neighbours, properties, type Graph } from '../../../shared/graph-core.mjs';
import { GraphCanvas, type Selection } from '../components/GraphCanvas';
import { Stepper } from '../components/ui';
import { build } from '../lib/examples';
import { CAMPUS, CAMPUS_NAMES } from '../lib/quizBank';
import { useApp } from '../state/AppContext';
import { QueueVsStack } from './unitWidgets';

// ---------------------------------------------------------------- L1
const VALUES = ['Sipho', 'Lerato', 'Thandi', 'Karabo', 'Ayesha', 'Johan'];

/** Reading item i: one jump in an array, a walk along a linked list. */
export function ArrayListWidget() {
  const [i, setI] = useState(3);
  const [walk, setWalk] = useState(0); // how many list nodes have been visited
  const [extra, setExtra] = useState<string[]>([]);
  const items = [...VALUES, ...extra];
  useEffect(() => setWalk(0), [i]);
  const listDone = walk > i;
  const append = () => setExtra(x => (x.length < 3 ? [...x, ['Naledi', 'Mpho', 'Zanele'][x.length]] : x));
  return (
    <div className="al-widget">
      <label className="inline-label">
        Read item number <select value={i} onChange={e => setI(Number(e.target.value))}>{items.map((_, k) => <option key={k} value={k}>{k}</option>)}</select>
      </label>

      <h3 className="small-heading">Array: items side by side</h3>
      <div className="array-row" role="list" aria-label="Array">
        {items.map((v, k) => (
          <div key={k} role="listitem" className={`array-cell ${k === i ? 'hit' : ''} ${k >= VALUES.length ? 'new' : ''}`}>
            <span className="array-index">[{k}]</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <p className="small">✅ <strong>1 step:</strong> the array works out where a[{i}] is and jumps there. {extra.length > 0 && `Growing it meant copying all ${VALUES.length + extra.length - 1} items into a bigger array.`}</p>

      <h3 className="small-heading">Linked list: nodes joined by next</h3>
      <div className="list-row" role="list" aria-label="Linked list">
        <span className="list-head">head</span>
        {items.map((v, k) => (
          <div key={k} role="listitem" className="list-item">
            <span className={`list-node ${k < walk ? (k === i ? 'hit' : 'passed') : ''} ${k >= VALUES.length ? 'new' : ''}`}>{v}</span>
            <span className="list-arrow" aria-hidden>{k < items.length - 1 ? '→' : '→ null'}</span>
          </div>
        ))}
      </div>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => setWalk(w => Math.min(w + 1, i + 1))} disabled={listDone}>Follow next ({walk} of {i + 1} nodes)</button>
        <button type="button" className="secondary" onClick={() => setWalk(0)}>Start again at head</button>
        <button type="button" className="secondary" onClick={append} disabled={extra.length >= 3}>Add a node at the end</button>
      </div>
      <p className="small" aria-live="polite">
        {listDone ? `🚶 ${i + 1} steps: the list had to walk past ${i} node${i === 1 ? '' : 's'} to reach item ${i}.` : 'Press “Follow next” to walk the list one node at a time.'}
      </p>
      <p className="callout small">Graphs use both: an <strong>adjacency matrix</strong> is a 2D array (fast to check one edge), an <strong>adjacency list</strong> is an array of linked lists (small when there are few edges).</p>
    </div>
  );
}

// ---------------------------------------------------------------- L2
const FRIENDS = build({ directed: false }, { a: [110, 120], b: [290, 70], c: [470, 120], d: [200, 290], e: [400, 300], f: [560, 280] }, 'ab ad bc bd be ce');
const FRIEND_NAMES: Record<string, string> = { a: 'Thandi', b: 'Sipho', c: 'Lerato', d: 'Ayesha', e: 'Johan', f: 'Mpho' };

export function FriendsWidget() {
  const [sel, setSel] = useState<Selection>(null);
  const v = sel?.kind === 'vertex' ? sel.id : null;
  const p = properties(FRIENDS);
  const nb = v ? neighbours(FRIENDS, v) : [];
  const name = (x: string) => FRIEND_NAMES[x];
  return (
    <div>
      <p className="small muted">Friends at res. Each person is a vertex, each friendship an edge. Select a person (click, or Tab and Enter).</p>
      <div className="two-col">
        <GraphCanvas graph={FRIENDS} selected={sel} onSelect={setSel} title="Friendship graph" highlight={{ tags: FRIEND_NAMES, current: v, vertices: nb }} />
        <div>
          <p className="callout" aria-live="polite">
            {v
              ? nb.length
                ? `${name(v)} (${v}) has degree ${p.deg[v]}: neighbours ${nb.map(x => `${name(x)} (${x})`).join(', ')}.`
                : `${name(v)} (${v}) has degree 0: an isolated vertex, with no friends in this graph yet.`
              : 'Select someone to see their neighbours and degree.'}
          </p>
          <table className="cost-table">
            <caption>Degrees</caption>
            <thead><tr><th scope="col">Vertex</th><th scope="col">Degree</th></tr></thead>
            <tbody>{ids(FRIENDS).map(x => <tr key={x} className={x === v ? 'row-on' : ''}><th scope="row">{name(x)} ({x})</th><td>{p.deg[x]}</td></tr>)}</tbody>
          </table>
          <p className="small"><strong>Handshake rule:</strong> {ids(FRIENDS).map(x => p.deg[x]).join(' + ')} = {p.degreeSum} = 2 × {p.edges} edges.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- L4
type App = { name: string; icon: string; graph: Graph; tags: Record<string, string>; vertices: string; edges: string; kind: string; question: string };
const APPS: App[] = [
  {
    name: 'Taxi routes', icon: '🚕',
    graph: build({ directed: false, weighted: true }, { a: [100, 200], b: [260, 90], c: [280, 300], d: [450, 160], e: [560, 300] }, 'ab ac bd cd de', [12, 9, 15, 7, 11]),
    tags: { a: 'Bosman', b: 'Hatfield', c: 'Menlyn', d: 'Brooklyn', e: 'Centurion' },
    vertices: 'Taxi ranks', edges: 'Routes, weighted by fare (rand)', kind: 'Undirected, weighted', question: 'What is the cheapest way from Bosman to Centurion?',
  },
  {
    name: 'Social network', icon: '💬',
    graph: build({ directed: true }, { a: [120, 110], b: [300, 70], c: [480, 130], d: [210, 290], e: [420, 300] }, 'ab ba bc ad de ec'),
    tags: { a: 'Thandi', b: 'Sipho', c: 'Lerato', d: 'Kagiso', e: 'Naledi' },
    vertices: 'People', edges: '“follows”, an arrow', kind: 'Directed, unweighted', question: 'Whose posts can reach Lerato through shares?',
  },
  {
    name: 'The web', icon: '🌐',
    graph: build({ directed: true }, { a: [100, 190], b: [260, 80], c: [270, 300], d: [440, 190], e: [570, 90] }, 'ab ac bd cd de eb'),
    tags: { a: 'up.ac.za', b: 'cs.up.ac.za', c: 'library', d: 'COS212', e: 'clickUP' },
    vertices: 'Web pages', edges: 'Links, one way', kind: 'Directed, cyclic', question: 'Which pages can a crawler reach from up.ac.za?',
  },
  {
    name: 'Prerequisites', icon: '🎓',
    graph: build({ directed: true }, { a: [90, 190], b: [250, 100], c: [250, 290], d: [420, 190], e: [570, 190] }, 'ab ac bd cd de'),
    tags: { a: 'COS110', b: 'COS132', c: 'COS151', d: 'COS212', e: 'COS226' },
    vertices: 'Modules', edges: '“needed before”, an arrow', kind: 'Directed, acyclic (no circular prerequisites)', question: 'Which modules depend on COS110, directly or not?',
  },
];

export function ApplicationsWidget() {
  const [i, setI] = useState(0);
  const app = APPS[i];
  return (
    <div>
      <div className="app-cards" role="group" aria-label="Applications">
        {APPS.map((a, k) => (
          <button key={a.name} type="button" className={`app-card ${k === i ? 'on' : ''}`} aria-pressed={k === i} onClick={() => setI(k)}>
            <span className="app-icon" aria-hidden>{a.icon}</span>{a.name}
          </button>
        ))}
      </div>
      <div className="two-col">
        <GraphCanvas graph={app.graph} title={app.name} highlight={{ tags: app.tags }} />
        <dl className="app-facts">
          <dt>Vertices</dt><dd>{app.vertices}</dd>
          <dt>Edges</dt><dd>{app.edges}</dd>
          <dt>Kind of graph</dt><dd>{app.kind}</dd>
          <dt>A question a graph algorithm answers</dt><dd>{app.question}</dd>
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- L6 / L7
const TRAVERSAL_GRAPH = build({ directed: false }, { a: [90, 190], b: [250, 80], c: [250, 300], d: [420, 80], e: [420, 300], f: [560, 190] }, 'ab ac bd ce df ef');

/** One traversal, one step at a time, with its queue or stack beside the graph. */
export function TraversalWidget({ kind }: { kind: 'BFS' | 'DFS' }) {
  const g = TRAVERSAL_GRAPH;
  const [s, setS] = useState('a');
  const [i, setI] = useState(0);
  const tr = useMemo(() => (kind === 'DFS' ? dfsTrace(g, s) : bfsTrace(g, s)), [g, kind, s]);
  useEffect(() => setI(0), [s]);
  const step = tr.steps[Math.min(i, tr.steps.length - 1)];
  const isStack = kind === 'DFS';
  const front = isStack ? step.frontier.length - 1 : 0;
  return (
    <div>
      <label className="inline-label">Start at <select value={s} onChange={e => setS(e.target.value)}>{ids(g).map(x => <option key={x}>{x}</option>)}</select></label>
      <div className="two-col">
        <GraphCanvas graph={g} title={`${kind} from ${s}`} highlight={{ vertices: step.reached, frontier: step.frontier, current: step.current, activeEdge: step.edge, source: s }} />
        <div>
          <div className="aux">
            <span className="small-heading">{isStack ? 'Stack (top last)' : 'Queue (front first)'}</span>
            <ol className="queue">
              {step.frontier.length ? step.frontier.map((v, k) => <li key={v + k} className={k === front ? 'front' : ''}>{v}{k === front && <span className="sr-only">{isStack ? ' (top)' : ' (front)'}</span>}</li>) : <li className="muted">empty</li>}
            </ol>
            <span className="small-heading">Visited so far</span>
            <ol className="queue">{step.reached.length ? step.reached.map(v => <li key={v}>{v}</li>) : <li className="muted">none</li>}</ol>
          </div>
          <Stepper index={i} count={tr.steps.length} onIndex={setI} note={step.note} />
          <p className="small muted">Neighbours are taken in alphabetical order. Final order: {tr.order.join(' → ')}.</p>
        </div>
      </div>
      {kind === 'DFS' && <QueueVsStack />}
    </div>
  );
}

// ---------------------------------------------------------------- L8
/**
 * The walkthrough animation: BFS or DFS on the campus map. Press Play to watch
 * (it never starts by itself), or step with the buttons and the arrow keys.
 */
export function WalkthroughWidget() {
  const { settings } = useApp();
  const [kind, setKind] = useState<'BFS' | 'DFS'>('BFS');
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1400);
  const [guess, setGuess] = useState<string | null>(null);
  const tr = useMemo(() => (kind === 'DFS' ? dfsTrace(CAMPUS, 'a') : bfsTrace(CAMPUS, 'a')), [kind]);
  const step = tr.steps[Math.min(i, tr.steps.length - 1)];
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const name = (v: string) => CAMPUS_NAMES[v] ?? v;
  const story = (note: string) => note.replace(/\b([a-g])\b/g, (_m, v: string) => name(v));

  useEffect(() => {
    setI(0);
    setPlaying(false);
    setGuess(null);
  }, [kind]);
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => setI(x => (x + 1 < tr.steps.length ? x + 1 : x)), settings.reducedMotion ? Math.max(speed, 2000) : speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, tr.steps.length, settings.reducedMotion]);
  useEffect(() => {
    if (i >= tr.steps.length - 1) setPlaying(false);
    setGuess(null);
  }, [i, tr.steps.length]);

  // The next building this traversal will visit (for "predict the next stop").
  const nextVisit = (() => {
    for (let k = i + 1; k < tr.steps.length; k++) {
      const c = tr.steps[k].current;
      if (c && !tr.steps.slice(0, i + 1).some(sx => sx.current === c)) return c;
    }
    return null;
  })();
  const choices = ids(CAMPUS).filter(v => !tr.steps.slice(0, i + 1).some(sx => sx.current === v));

  return (
    <div className="walkthrough">
      <p className="story">🎒 <strong>Orientation Week.</strong> Naledi starts at the <strong>Library</strong> and wants to visit every building she can reach. Watch {kind === 'BFS' ? 'breadth-first search explore the closest buildings first' : 'depth-first search follow one path as far as it goes'}.</p>
      <div className="walk-controls">
        <div className="segmented" role="group" aria-label="Traversal">
          {(['BFS', 'DFS'] as const).map(k => <button key={k} type="button" className={k === kind ? 'on' : ''} aria-pressed={k === kind} onClick={() => setKind(k)}>{k} ({k === 'BFS' ? 'queue' : 'stack'})</button>)}
        </div>
        <button type="button" onClick={() => { if (i >= tr.steps.length - 1) setI(0); setPlaying(p => !p); }} aria-pressed={playing}>
          {playing ? '⏸ Pause' : i >= tr.steps.length - 1 ? '↺ Replay' : '▶ Play'}
        </button>
        <label className="inline-label">Speed
          <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>
            <option value={2200}>Slow</option><option value={1400}>Normal</option><option value={800}>Fast</option>
          </select>
        </label>
      </div>
      <div className="two-col">
        <GraphCanvas graph={CAMPUS} title={`${kind} on the campus map`} highlight={{ tags: CAMPUS_NAMES, vertices: step.reached, frontier: step.frontier, current: step.current, activeEdge: step.edge, source: 'a' }} />
        <div>
          <div className="aux">
            <span className="small-heading">{kind === 'DFS' ? 'Stack (top last)' : 'Queue (front first)'}</span>
            <ol className="queue">{step.frontier.length ? step.frontier.map((v, k) => <li key={v + k}>{name(v)}</li>) : <li className="muted">empty</li>}</ol>
            <span className="small-heading">Visited</span>
            <ol className="queue">{step.reached.map(v => <li key={v}>{name(v)}</li>)}</ol>
          </div>
          <Stepper index={i} count={tr.steps.length} onIndex={x => { setPlaying(false); setI(x); }} note={story(step.note)} />
          {!playing && nextVisit && (
            <fieldset className="checkpoint">
              <legend>Predict: which building does {kind} visit next?</legend>
              <div className="button-row">
                {choices.map(v => (
                  <button key={v} type="button" className={`secondary mini-choice ${guess === v ? (v === nextVisit ? 'pick-right' : 'pick-wrong') : ''}`} onClick={() => setGuess(v)} aria-pressed={guess === v}>{name(v)}</button>
                ))}
              </div>
              {guess && <p className={`small callout ${guess === nextVisit ? 'callout-good' : 'callout-bad'}`} role="status">{guess === nextVisit ? `✓ Yes: ${name(nextVisit)} is next.` : `✗ Not this time. Press Next to see where ${kind} goes.`}</p>}
            </fieldset>
          )}
        </div>
      </div>
      <p className="small muted">Map letters: {ids(CAMPUS).map(v => `${v} = ${name(v)}`).join(' · ')}.</p>
    </div>
  );
}
