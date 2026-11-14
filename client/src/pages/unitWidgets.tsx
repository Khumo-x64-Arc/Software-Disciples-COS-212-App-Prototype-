// The interaction step of each unit (design doc, "Unit design").
import { useEffect, useMemo, useState } from 'react';
import {
  addEdge, addVertex, adjacencyList, adjacencyMatrix, booleanMatrix, closureAddedPairs, closureFromLists, closureFromMatrixDFS,
  ids, properties, randomAdjacency, removeEdge, removeVertex, typeSentence, warshall, warshallTrace, type Graph,
} from '../../../shared/graph-core.mjs';
import { GraphCanvas, type Selection } from '../components/GraphCanvas';
import { MatrixTable, Stepper, useAnnounce } from '../components/ui';
import { LivePanel, type Tab } from './BuildGraph';
import { EXAMPLES, build } from '../lib/examples';
import { useHelper } from '../components/HelperChat';

const arrow = (g: Graph) => (g.directed ? '→' : '–');

// ---------------------------------------------------------------- U1
const U1_GRAPHS: { name: string; graph: Graph }[] = [
  { name: 'Simple graph', graph: build({ directed: false }, { a: [120, 90], b: [300, 70], c: [480, 120], d: [200, 280], e: [400, 290] }, 'ab bc ad be de') },
  { name: 'Multigraph', graph: build({ directed: false, allowMulti: true }, { a: [140, 110], b: [320, 70], c: [470, 220], d: [220, 290] }, 'ab ab bc cd da') },
  { name: 'Pseudograph', graph: build({ directed: false, allowMulti: true, allowLoops: true }, { a: [140, 140], b: [320, 120], c: [470, 260], d: [220, 290] }, 'aa ab ab bc cd') },
  { name: 'Complete K₅', graph: build({ directed: false }, { a: [300, 50], b: [480, 160], c: [410, 320], d: [190, 320], e: [120, 160] }, 'ab ac ad ae bc bd be cd ce de') },
  { name: 'Tree', graph: build({ directed: false }, { a: [300, 60], b: [170, 180], c: [430, 180], d: [100, 310], e: [240, 310], f: [430, 310] }, 'ab ac bd be cf') },
  { name: 'Digraph', graph: build({ directed: true }, { a: [120, 100], b: [320, 80], c: [470, 230], d: [220, 290] }, 'ab bc cd db') },
];

export function U1Widget() {
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<Selection>(null);
  const g = U1_GRAPHS[i].graph;
  const p = properties(g);
  const v = sel?.kind === 'vertex' ? sel.id : null;
  return (
    <div>
      <div className="segmented" role="group" aria-label="Example graphs">
        {U1_GRAPHS.map((x, j) => (
          <button key={x.name} type="button" className={j === i ? 'on' : ''} aria-pressed={j === i} onClick={() => { setI(j); setSel(null); }}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="two-col">
        <GraphCanvas graph={g} selected={sel} onSelect={setSel} title={U1_GRAPHS[i].name} highlight={v ? { current: v } : {}} />
        <div>
          <p><strong>{typeSentence(p)}</strong></p>
          <ul className="small">
            <li>V = {p.vertices}, E = {p.edges}. K{p.vertices} would have {p.knEdges} edges.</li>
            <li>{p.loops ? 'Has a loop.' : 'No loops.'} {p.parallel ? 'Has parallel edges.' : 'No parallel edges.'}</li>
            <li>Sum of degrees = {p.degreeSum} = 2 × {p.edges}.</li>
          </ul>
          <p className="callout small" aria-live="polite">
            {v
              ? g.directed
                ? `Vertex ${v}: in-degree ${p.indeg[v]}, out-degree ${p.outdeg[v]}.`
                : `Vertex ${v}: degree ${p.deg[v]}${g.edges.some(e => e.from === v && e.to === v) ? ' (its loop counts 2)' : ''}.`
              : 'Select a vertex (click it, or Tab to it and press Enter) to see its degree.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- U2
export function U2Widget() {
  const [g, setG] = useState<Graph>(EXAMPLES[2].graph);
  const [tab, setTab] = useState<Tab>('Matrix');
  const [sel, setSel] = useState<Selection>(null);
  const announce = useAnnounce();
  return (
    <div>
      <p className="small muted">Edit the graph (click to add a vertex, drag a knob to add an edge) and watch every representation change. Switch Directed to see the matrix lose its symmetry.</p>
      <div className="button-row">
        <button type="button" className="secondary" aria-pressed={g.directed} onClick={() => { setG({ ...g, directed: !g.directed }); announce(g.directed ? 'Undirected.' : 'Directed.'); }}>
          {g.directed ? '☑' : '☐'} Directed
        </button>
        <button type="button" className="secondary" onClick={() => setG(EXAMPLES[2].graph)}>Reset</button>
      </div>
      <div className="two-col">
        <GraphCanvas graph={g} editable onChange={(ng, t) => { setG(ng); announce(t); }} selected={sel} onSelect={setSel} title="Graph to represent" />
        <LivePanel graph={g} tab={tab} setTab={setTab} stepK={null} trace={[]} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- U3
type Op = { label: string; matrix: string; list: string; changed: { i: number; j: number }[] };
export function U3Widget() {
  const start = EXAMPLES[2].graph;
  const [g, setG] = useState<Graph>(start);
  const [log, setLog] = useState<Op[]>([]);
  const [form, setForm] = useState({ u: 'a', v: 'c' });
  const announce = useAnnounce();
  const L = ids(g);
  const last = log[0];

  const run = (op: 'addEdge' | 'removeEdge' | 'addVertex' | 'removeVertex') => {
    const { u, v } = form;
    let next = g, entry: Op | null = null;
    if (op === 'addEdge') {
      const r = addEdge(g, u, v);
      if (!r.ok) return announce(r.reason ?? 'Not added.');
      next = r.graph;
      const i = L.indexOf(u), j = L.indexOf(v);
      entry = {
        label: `addEdge(${u}, ${v})`,
        matrix: g.directed ? `Set [${u}][${v}] = 1. Θ(1).` : `Set [${u}][${v}] and [${v}][${u}] = 1. Θ(1).`,
        list: g.directed ? `Append ${v} to ${u}'s list. Θ(1).` : `Append ${v} to ${u}'s list and ${u} to ${v}'s list. Θ(1).`,
        changed: g.directed ? [{ i, j }] : [{ i, j }, { i: j, j: i }],
      };
    } else if (op === 'removeEdge') {
      const e = g.edges.find(x => (x.from === u && x.to === v) || (!g.directed && x.from === v && x.to === u));
      if (!e) return announce(`There is no edge ${u} ${arrow(g)} ${v}.`);
      next = removeEdge(g, e.id);
      const i = L.indexOf(u), j = L.indexOf(v);
      entry = {
        label: `removeEdge(${u}, ${v})`,
        matrix: `Clear [${u}][${v}]${g.directed ? '' : ` and [${v}][${u}]`}. Θ(1).`,
        list: `Find and unlink ${v} in ${u}'s list${g.directed ? '' : ` and ${u} in ${v}'s`}: Θ(deg). `,
        changed: g.directed ? [{ i, j }] : [{ i, j }, { i: j, j: i }],
      };
    } else if (op === 'addVertex') {
      const r = addVertex(g, 80 + ((L.length * 97) % 440), 60 + ((L.length * 151) % 260));
      if (!r.id) return announce(r.reason ?? 'Not added.');
      next = r.graph;
      const n = L.length;
      entry = {
        label: `addVertex(${r.id})`,
        matrix: `Allocate a ${n + 1} × ${n + 1} array and copy ${n * n} cells. Θ(V²).`,
        list: `Add an empty list for ${r.id}. Θ(1) (amortised).`,
        changed: [...Array(n + 1).keys()].flatMap(k => [{ i: n, j: k }, { i: k, j: n }]),
      };
    } else {
      if (!L.includes(u)) return;
      const d = properties(g).deg[u];
      next = removeVertex(g, u);
      entry = {
        label: `removeVertex(${u})`,
        matrix: `Drop row and column ${u}: copy into a ${L.length - 1} × ${L.length - 1} array. Θ(V²).`,
        list: `Delete ${u}'s list and remove ${u} from every other list. Θ(V + E). It had ${d} edge end${d === 1 ? '' : 's'}.`,
        changed: [],
      };
    }
    setG(next);
    setLog(l => [entry!, ...l].slice(0, 6));
    announce(`${entry!.label}. Matrix: ${entry!.matrix} List: ${entry!.list}`);
  };

  return (
    <div>
      <div className="edge-form" role="group" aria-label="Operation arguments">
        <label>u <select value={form.u} onChange={e => setForm(f => ({ ...f, u: e.target.value }))}>{L.map(x => <option key={x}>{x}</option>)}</select></label>
        <label>v <select value={form.v} onChange={e => setForm(f => ({ ...f, v: e.target.value }))}>{L.map(x => <option key={x}>{x}</option>)}</select></label>
        <button type="button" onClick={() => run('addEdge')}>addEdge(u, v)</button>
        <button type="button" onClick={() => run('removeEdge')}>removeEdge(u, v)</button>
        <button type="button" className="secondary" onClick={() => run('addVertex')}>addVertex()</button>
        <button type="button" className="secondary" onClick={() => run('removeVertex')}>removeVertex(u)</button>
        <button type="button" className="link-button" onClick={() => { setG(start); setLog([]); }}>Reset</button>
      </div>
      <div className="two-col">
        <div>
          <GraphCanvas graph={g} title="Graph" />
          <ul className="linked-lists" aria-label="Adjacency lists">
            {adjacencyList(g).map(row => (
              <li key={row.id}>
                <span className="ll-head">{row.id}</span>
                {row.list.map((n, i) => <span key={i} className="ll-node"><span aria-hidden>→</span> {n.to}</span>)}
                <span className="ll-null"><span aria-hidden>→</span> null</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <MatrixTable labels={ids(g)} matrix={adjacencyMatrix(g)} caption="Adjacency matrix" changed={last?.changed ?? []} />
          <ol className="op-log" aria-label="Operation log, newest first">
            {log.map((o, i) => (
              <li key={i} className={i === 0 ? 'latest' : ''}>
                <code>{o.label}</code>
                <ul>
                  <li>Matrix: {o.matrix}</li>
                  <li>List: {o.list}</li>
                </ul>
              </li>
            ))}
            {!log.length && <li>Run an operation to see what each representation has to do.</li>}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** The "Connection: queue vs stack" box with its checkpoint. */
export function QueueVsStack() {
  const [pick, setPick] = useState<string | null>(null);
  const options = ['a, b, d, c', 'a, b, c, d', 'a, c, b, d'];
  const right = 'a, b, d, c';
  return (
    <section className="connection-box" aria-labelledby="qvs-h">
      <h3 id="qvs-h" className="small-heading">Connection: queue vs stack</h3>
      <p className="small">
        Same loop, different container: take the next vertex from the front of a <strong>queue</strong> and you get BFS; take it from the top of a <strong>stack</strong> (or recurse) and you get DFS. Both mark vertices as visited, so a cycle cannot trap them, and both are O(V + E) on adjacency lists.
      </p>
      <fieldset className="checkpoint">
        <legend>Checkpoint: DFS from a with edges a–b, a–c, b–d (neighbours in alphabetical order). What order?</legend>
        <div className="button-row">
          {options.map(o => (
            <button
              key={o}
              type="button"
              className={`secondary ${pick === o ? (o === right ? 'pick-right' : 'pick-wrong') : ''}`}
              aria-pressed={pick === o}
              onClick={() => setPick(o)}
            >
              {o}
            </button>
          ))}
        </div>
        {pick && (
          <p className={`callout small ${pick === right ? 'callout-good' : 'callout-bad'}`} role="status">
            {pick === right
              ? '✓ Right: from b, DFS goes on to d before backing up to c.'
              : pick === 'a, b, c, d'
                ? '✗ That is the BFS order (both neighbours of a first). DFS goes deep: a, b, then d, and only then back to c.'
                : '✗ Neighbours are taken in alphabetical order, so b comes before c. Then DFS goes deep to d before c.'}
          </p>
        )}
      </fieldset>
    </section>
  );
}

// ---------------------------------------------------------------- U5
export function U5Widget() {
  const [ex, setEx] = useState(0);
  const graphs = [EXAMPLES[0].graph, EXAMPLES[1].graph, EXAMPLES[3].graph];
  const g = graphs[ex];
  const L = ids(g);
  const R = useMemo(() => warshall(booleanMatrix(g)), [g]);
  const [guess, setGuess] = useState<number[][]>(() => booleanMatrix(g));
  const [checked, setChecked] = useState(false);
  const [showClosure, setShowClosure] = useState(false);
  useEffect(() => {
    setGuess(booleanMatrix(g));
    setChecked(false);
    setShowClosure(false);
  }, [g]);
  const wrong = checked ? guess.flatMap((row, i) => row.map((v, j) => (v !== R[i][j] ? `${L[i]}${L[j]}` : null))).filter(Boolean) : [];
  const pairs = (m: number[][]) => m.flatMap((row, i) => row.map((v, j) => (v ? `(${L[i]}, ${L[j]})` : null))).filter(Boolean).join(', ');
  const p = properties(g);
  return (
    <div>
      <div className="segmented" role="group" aria-label="Example digraphs">
        {['Closure demo', 'Prerequisites', 'Cycle'].map((n, k) => (
          <button key={n} type="button" className={k === ex ? 'on' : ''} aria-pressed={k === ex} onClick={() => setEx(k)}>{n}</button>
        ))}
      </div>
      <div className="two-col">
        <div>
          <GraphCanvas graph={g} title="Relation R as a digraph" highlight={showClosure ? { closure: closureAddedPairs(g) } : {}} />
          <p className="small"><strong>R</strong> = {'{'}{pairs(booleanMatrix(g))}{'}'}</p>
          {showClosure && <p className="small"><strong>R⁺</strong> = {'{'}{pairs(R)}{'}'}</p>}
          <p className="small">This digraph is <strong>{p.connectivity}</strong>.</p>
        </div>
        <div>
          <h3 className="small-heading">Predict R⁺: click cells to toggle 0 and 1</h3>
          <div className="table-wrap">
            <table className="matrix guess">
              <caption>Your R⁺ (starts as R)</caption>
              <thead><tr><th scope="col"><span className="sr-only">from \ to</span></th>{L.map(v => <th key={v} scope="col">{v}</th>)}</tr></thead>
              <tbody>
                {guess.map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{L[i]}</th>
                    {row.map((v, j) => {
                      const bad = wrong.includes(`${L[i]}${L[j]}`);
                      return (
                        <td key={j} className={checked ? (bad ? 'cell-wrong' : 'cell-right') : v ? 'has-edge' : ''}>
                          <button
                            type="button"
                            className="cell-btn"
                            aria-label={`Row ${L[i]}, column ${L[j]}: ${v}${checked ? (bad ? ', wrong' : ', right') : ''}`}
                            onClick={() => { setChecked(false); setGuess(m => m.map((r, a) => r.map((x, b) => (a === i && b === j ? 1 - x : x)))); }}
                          >
                            {v}{checked && (bad ? ' ✗' : '')}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => { setChecked(true); setShowClosure(true); }}>Check my R⁺</button>
            <button type="button" className="secondary" onClick={() => setShowClosure(s => !s)} aria-pressed={showClosure}>{showClosure ? 'Hide' : 'Show'} closure on the graph</button>
          </div>
          {checked && (
            <p className={`callout ${wrong.length ? 'callout-bad' : 'callout-good'}`} role="status">
              {wrong.length
                ? `${wrong.length} cell${wrong.length === 1 ? ' is' : 's are'} different (marked ✗). Remember: a 1 needs a path of one or more edges, and the diagonal is 1 only for a vertex on a cycle.`
                : 'All correct: that is R⁺.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- U6
const CODE = [
  'for (int k = 0; k < n; k++)        // intermediate vertex',
  '  for (int i = 0; i < n; i++)',
  '    for (int j = 0; j < n; j++)',
  '      r[i][j] = r[i][j] || (r[i][k] && r[k][j]);',
];
export function U6Widget() {
  const [ex, setEx] = useState(0);
  const graphs = [EXAMPLES[0].graph, EXAMPLES[1].graph, EXAMPLES[3].graph];
  const g = graphs[ex];
  const L = ids(g);
  const trace = useMemo(() => warshallTrace(g), [g]);
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [g]);
  const s = trace[i];
  const adj = booleanMatrix(g);
  const closure: [string, string][] = [];
  s.matrix.forEach((row, a) => row.forEach((v, b) => v && !adj[a][b] && closure.push([L[a], L[b]])));
  const k = typeof s.k === 'number' ? s.k : null;
  return (
    <div>
      <div className="segmented" role="group" aria-label="Example digraphs">
        {['Closure demo', 'Prerequisites', 'Cycle'].map((n, j) => (
          <button key={n} type="button" className={j === ex ? 'on' : ''} aria-pressed={j === ex} onClick={() => setEx(j)}>{n}</button>
        ))}
      </div>
      <div className="two-col">
        <div>
          <GraphCanvas graph={g} title="Warshall trace" highlight={{ closure, newClosure: s.changed.map(c => [L[c.i], L[c.j]] as [string, string]), current: k !== null ? L[k] : null }} />
          <pre className="code-block code-lines" aria-label="Warshall's algorithm in Java">
            {CODE.map((line, n) => (
              <span key={n} className={k !== null && (n === 0 || (n === 3 && s.changed.length)) ? 'line-on' : ''}>{line}{'\n'}</span>
            ))}
          </pre>
        </div>
        <div>
          <MatrixTable labels={L} matrix={s.matrix} caption={k !== null ? `R(${k + 1}): stops through ${L.slice(0, k + 1).join(', ')} allowed` : s.k === 'done' ? 'R⁺ = R(n)' : 'R(0) = adjacency matrix'} changed={s.changed} kRow={k} />
          <Stepper index={i} count={trace.length} onIndex={setI} note={s.note} label="k step" />
          <p className="small muted">Row k and column k are shaded: a new 1 at [i][j] needs a 1 in row i of column k and a 1 in column j of row k. ★ marks cells that changed.</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- U7
type Timing = { v: number; dfs: number; warshall: number; same: boolean };
export function U7Widget() {
  const [density, setDensity] = useState(0.02);
  const [rows, setRows] = useState<Timing[]>([]);
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState<'lists' | 'matrix'>('lists');
  const run = async () => {
    setBusy(true);
    setRows([]);
    const out: Timing[] = [];
    for (const v of [100, 200, 400]) {
      await new Promise(r => setTimeout(r, 20)); // let the page repaint between sizes
      const { matrix, lists } = randomAdjacency(v, density, v);
      let t = performance.now();
      const a = rep === 'lists' ? closureFromLists(lists) : closureFromMatrixDFS(matrix);
      const dfsMs = performance.now() - t;
      t = performance.now();
      const b = warshall(matrix);
      const wMs = performance.now() - t;
      const same = a.every((row, i) => row.every((x, j) => x === b[i][j]));
      out.push({ v, dfs: dfsMs, warshall: wMs, same });
      setRows([...out]);
    }
    setBusy(false);
  };
  const max = Math.max(1, ...rows.flatMap(r => [r.dfs, r.warshall]));
  const ms = (x: number) => `${x < 10 ? x.toFixed(1) : Math.round(x)} ms`;
  return (
    <div>
      <div className="edge-form">
        <label>
          Edge density
          <select value={density} onChange={e => setDensity(Number(e.target.value))}>
            <option value={0.02}>Sparse (2% of pairs)</option>
            <option value={0.1}>Medium (10%)</option>
            <option value={0.5}>Dense (50%)</option>
          </select>
        </label>
        <label>
          Repeated DFS on
          <select value={rep} onChange={e => setRep(e.target.value as 'lists' | 'matrix')}>
            <option value="lists">adjacency lists</option>
            <option value="matrix">adjacency matrix</option>
          </select>
        </label>
        <button type="button" onClick={() => void run()} disabled={busy}>{busy ? 'Timing…' : 'Run the timing lab'}</button>
      </div>
      <p className="small muted">Runs in your browser for V = 100, 200 and 400. Times vary between machines: look at how they grow as V doubles.</p>
      {rows.length > 0 && (
        <>
          <table className="cost-table">
            <caption className="sr-only">Timing results</caption>
            <thead><tr><th scope="col">V</th><th scope="col">Repeated DFS ({rep})</th><th scope="col">Warshall</th><th scope="col">Same R⁺?</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.v}>
                  <th scope="row">{r.v}</th>
                  <td><span className="bar-inline"><span style={{ width: `${(r.dfs / max) * 100}%` }} className="bar-dfs" /></span>{ms(r.dfs)}</td>
                  <td><span className="bar-inline"><span style={{ width: `${(r.warshall / max) * 100}%` }} className="bar-w" /></span>{ms(r.warshall)}</td>
                  <td>{r.same ? '✓ yes' : '✗ no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 3 && (
            <p className="callout small" role="status">
              From V = 200 to 400, Warshall grew ×{(rows[2].warshall / Math.max(rows[1].warshall, 0.01)).toFixed(1)} (Θ(V³) predicts ×8) and repeated DFS grew ×{(rows[2].dfs / Math.max(rows[1].dfs, 0.01)).toFixed(1)}
              {rep === 'lists' ? ' (Θ(V(V + E)) predicts about ×4 when E grows like V).' : ' (on a matrix each DFS scans whole rows, so it is Θ(V³) too).'}
            </p>
          )}
        </>
      )}
      <table className="cost-table compare-table">
        <caption>Cost summary (Drozdek §8.3.1)</caption>
        <thead><tr><th scope="col">Method</th><th scope="col">Time</th><th scope="col">Best when</th></tr></thead>
        <tbody>
          <tr><th scope="row">DFS from every vertex, lists</th><td>Θ(V(V + E))</td><td>sparse graphs</td></tr>
          <tr><th scope="row">DFS from every vertex, matrix</th><td>Θ(V³)</td><td>rarely</td></tr>
          <tr><th scope="row">Warshall’s algorithm</th><td>Θ(V³), Θ(V²) space, in place</td><td>dense graphs, or a matrix you already have</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- U8
const MODULES = ['COS110', 'COS132', 'COS212', 'COS216', 'COS226', 'COS301'];
const LINKS: [number, number][] = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [3, 5]];
export function U8Widget() {
  const empty = useMemo(() => {
    let g: Graph = { ...build({ directed: true }, {}, ''), allowLoops: false, allowMulti: false };
    const pos = [[90, 190], [210, 100], [330, 190], [450, 100], [450, 290], [540, 190]];
    for (const [x, y] of pos) g = addVertex(g, x, y).graph;
    return g;
  }, []);
  const [g, setG] = useState<Graph>(empty);
  const [need, setNeed] = useState<string[]>([]);
  const [cycleAns, setCycleAns] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const announce = useAnnounce();
  const helper = useHelper();
  const { setContext } = helper;
  useEffect(() => {
    setContext(c => ({ ...c, graph: g }));
    return () => setContext(c => ({ ...c, graph: null }));
  }, [g, setContext]);
  const L = ids(g);
  const name = (v: string) => MODULES[L.indexOf(v)] ?? v;
  const want = new Set(LINKS.map(([a, b]) => `${L[a]}>${L[b]}`));
  const have = new Set(g.edges.map(e => `${e.from}>${e.to}`));
  const reversed = LINKS.filter(([a, b]) => have.has(`${L[b]}>${L[a]}`)).length;
  const correctEdges = [...want].filter(x => have.has(x)).length;
  const extra = [...have].filter(x => !want.has(x)).length;
  const R = warshall(booleanMatrix(g));
  const truth = MODULES.filter((_, i) => i !== 5 && R[i][5]);
  const rubric = [
    { label: 'Every module is a vertex (6 vertices)', met: L.length === 6 },
    { label: 'Edges point from the prerequisite to the module that needs it', met: reversed === 0 && correctEdges > 0 },
    { label: 'All 6 prerequisite links, and no extra ones', met: correctEdges === 6 && extra === 0 },
    { label: 'Used R⁺ to list everything needed before COS301', met: submitted && correctEdges === 6 && extra === 0 && need.slice().sort().join() === truth.slice().sort().join() },
    { label: 'Explained what a 1 on the diagonal of R⁺ would mean', met: submitted && /cycle|itself|impossible|circular/i.test(cycleAns) },
  ];
  const score = rubric.filter(r => r.met).length;
  return (
    <div>
      <div className="callout">
        <p><strong>Task.</strong> Model these prerequisite rules as a digraph, then use its transitive closure.</p>
        <ul className="small">
          <li>COS110 is needed for COS132. COS132 is needed for COS212.</li>
          <li>COS212 is needed for COS216 and for COS226.</li>
          <li>COS226 and COS216 are both needed for COS301.</li>
        </ul>
        <p className="small">Vertices: {L.map(v => `${v} = ${name(v)}`).join(', ')}. Drag from a vertex’s knob to add an arrow.</p>
      </div>
      <div className="two-col">
        <div>
          <GraphCanvas graph={g} editable onChange={(ng, t) => { setG(ng); announce(t.replace(/\b([a-f])\b/g, m => `${m} (${name(m)})`)); setSubmitted(false); }} title="Prerequisite digraph" highlight={submitted ? { closure: closureAddedPairs(g) } : {}} />
          <button type="button" className="link-button" onClick={() => { setG(empty); setSubmitted(false); }}>Start again</button>
        </div>
        <div>
          <fieldset className="checks">
            <legend>Which modules must be passed (directly or indirectly) before COS301?</legend>
            {MODULES.slice(0, 5).map(m => (
              <label key={m} className="toggle">
                <input type="checkbox" checked={need.includes(m)} onChange={e => setNeed(n => (e.target.checked ? [...n, m] : n.filter(x => x !== m)))} /> {m}
              </label>
            ))}
          </fieldset>
          <label>
            If R⁺ had a 1 on its diagonal at COS212, what would that mean?
            <textarea rows={2} value={cycleAns} onChange={e => setCycleAns(e.target.value)} />
          </label>
          <button type="button" onClick={() => setSubmitted(true)}>Check against the rubric</button>
          <ul className="rubric" aria-label="Rubric">
            {rubric.map(r => (
              <li key={r.label} className={r.met ? 'met' : ''}>
                <span aria-hidden>{r.met ? '✓' : '○'}</span> {r.label}
                <span className="sr-only">{r.met ? ': met' : ': not yet'}</span>
              </li>
            ))}
          </ul>
          {submitted && (
            <p className={`callout ${score === 5 ? 'callout-good' : ''}`} role="status">
              {score}/5 rubric points.{' '}
              {reversed > 0 && 'Some arrows point the wrong way: an arrow u → v should mean “u is needed for v”. '}
              {score === 5 ? 'The dashed edges are the indirect requirements the closure found.' : 'The dashed edges show what your current graph’s closure adds.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
