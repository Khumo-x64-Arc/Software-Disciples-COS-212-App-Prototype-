import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as RKeyboardEvent } from 'react';
import {
  bfsTrace, dfsTrace,
  CANVAS, MAX_VERTICES, addEdge, addVertex, adjacencyList, adjacencyMatrix, booleanMatrix, closureAddedPairs, edgeListText, emptyGraph,
  exportText, ids, incidenceMatrix, parseText, properties, removeEdge, removeVertex, setWeight, starForward, typeSentence, warshall,
  warshallTrace, type Graph,
} from '../../../shared/graph-core.mjs';
import { GraphCanvas, type Selection } from '../components/GraphCanvas';
import { AnnouncementBar, MatrixTable, Stepper, Term, useAnnounce } from '../components/ui';
import { useHelper } from '../components/HelperChat';
import { useApp } from '../state/AppContext';
import { EXAMPLES } from '../lib/examples';

export const TABS = ['Matrix', 'List', 'Incidence', 'Edge list', 'Closure', 'Props'] as const;
export type Tab = (typeof TABS)[number];

/** Undo/redo history around the graph. Moves while dragging don't create history entries. */
function useHistory(initial: Graph) {
  const [state, setState] = useState({ past: [] as Graph[], present: initial, future: [] as Graph[] });
  const set = useCallback((g: Graph, transient = false) => {
    setState(s => (transient ? { ...s, present: g } : { past: [...s.past, s.present].slice(-100), present: g, future: [] }));
  }, []);
  const undo = useCallback(() => setState(s => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s)), []);
  const redo = useCallback(() => setState(s => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)), []);
  // Before a drag starts we snapshot, so one drag is one undo step.
  const checkpoint = useCallback(() => setState(s => ({ ...s, past: [...s.past, s.present].slice(-100), future: [] })), []);
  return { graph: state.present, set, undo, redo, checkpoint, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

export default function BuildGraph() {
  const { progress, updateProgress } = useApp();
  const announceSr = useAnnounce();
  const helper = useHelper();
  const h = useHistory(progress.graph ?? EXAMPLES[0].graph);
  const { graph } = h;
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>('Matrix');
  const [showClosure, setShowClosure] = useState(false);
  const [stepK, setStepK] = useState<number | null>(null);
  const [connect, setConnect] = useState(false);
  const [weightEdit, setWeightEdit] = useState<{ id: string; value: string } | null>(null);
  const [edgeForm, setEdgeForm] = useState({ from: '', to: '', weight: '1' });
  const [io, setIo] = useState<'export' | 'import' | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const dragging = useRef(false);
  const edgeFromRef = useRef<HTMLSelectElement>(null);

  const announce = useCallback(
    (t: string) => {
      if (!t) return;
      setMessage(t);
      announceSr(t);
    },
    [announceSr],
  );

  // Save the graph with the learner's progress and share it with Graph Helper.
  useEffect(() => {
    updateProgress(p => ({ ...p, graph }));
    helper.setContext(c => ({ ...c, graph, unit: null }));
  }, [graph, updateProgress, helper.setContext]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => helper.setContext(c => ({ ...c, graph: null })), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setStepK(null), [graph.edges.length, graph.vertices.length, graph.directed]);

  const change = (g: Graph, text: string, opts?: { transient?: boolean }) => {
    if (opts?.transient) {
      if (!dragging.current) {
        h.checkpoint();
        dragging.current = true;
      }
      h.set(g, true);
      return;
    }
    if (dragging.current) {
      dragging.current = false;
      announce(text);
      return; // the checkpoint already holds the "before" state
    }
    if (g !== graph) h.set(g);
    announce(text);
  };

  const L = ids(graph);
  // Undo, redo or a removal can leave the selection pointing at nothing.
  useEffect(() => {
    if (selected?.kind === 'vertex' && !graph.vertices.some(v => v.id === selected.id)) setSelected(null);
    if (selected?.kind === 'edge' && !graph.edges.some(e => e.id === selected.id)) setSelected(null);
  }, [graph, selected]);
  const props = useMemo(() => properties(graph), [graph]);
  const added = useMemo(() => closureAddedPairs(graph), [graph]);
  const trace = useMemo(() => (stepK !== null ? warshallTrace(graph) : []), [graph, stepK]);

  // ---------- actions ----------
  const freeSpot = () => {
    for (let t = 0; t < 200; t++) {
      const x = 50 + ((t * 137) % (CANVAS.width - 100)), y = 50 + ((t * 89) % (CANVAS.height - 100));
      if (graph.vertices.every(v => Math.hypot(v.x - x, v.y - y) > 70)) return { x, y };
    }
    return { x: CANVAS.width / 2, y: CANVAS.height / 2 };
  };
  const addV = () => {
    const p = freeSpot();
    const r = addVertex(graph, p.x, p.y);
    if (r.id) {
      change(r.graph, `Vertex ${r.id} added. ${r.graph.vertices.length} vertices.`);
      setSelected({ kind: 'vertex', id: r.id });
    } else announce(r.reason ?? `At most ${MAX_VERTICES} vertices.`);
  };
  const addE = (e: FormEvent) => {
    e.preventDefault();
    const { from, to } = edgeForm;
    if (!from || !to) return announce('Choose both ends of the edge.');
    const w = Number(edgeForm.weight);
    const r = addEdge(graph, from, to, graph.weighted && Number.isFinite(w) ? w : 1);
    if (r.ok) change(r.graph, from === to ? `Loop at ${from} added.` : `Edge ${from} ${graph.directed ? '→' : '–'} ${to} added${graph.weighted ? `, weight ${w}` : ''}.`);
    else announce(r.reason ?? 'No edge added.');
  };
  const deleteSelected = () => {
    if (!selected) return announce('Select a vertex or an edge first.');
    if (selected.kind === 'vertex') {
      const lost = graph.edges.filter(e => e.from === selected.id || e.to === selected.id).length;
      change(removeVertex(graph, selected.id), `Vertex ${selected.id} removed with its ${lost} edge${lost === 1 ? '' : 's'}. Later vertices keep their labels.`);
    } else {
      const e = graph.edges.find(x => x.id === selected.id);
      if (e) change(removeEdge(graph, e.id), `Edge ${e.from} ${graph.directed ? '→' : '–'} ${e.to} removed.`);
    }
    setSelected(null);
  };
  const toggle = (k: 'directed' | 'weighted' | 'allowLoops' | 'allowMulti') => {
    const on = !graph[k];
    if (k === 'allowLoops' && !on && graph.edges.some(e => e.from === e.to)) return announce('Remove the loops first, then turn Loops off.');
    if (k === 'allowMulti' && !on && props.parallel) return announce('Remove the parallel edges first, then turn Multi-edges off.');
    if (k === 'directed' && !on) {
      // Going undirected: a → b and b → a become the same edge.
      const seen = new Set<string>();
      const dup = graph.edges.some(e => {
        const key = [e.from, e.to].sort().join('|');
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
      if (dup && !graph.allowMulti) return announce('Some pairs have arrows both ways. Turn on Multi-edges or remove one arrow first.');
    }
    const names = { directed: 'Directed', weighted: 'Weighted', allowLoops: 'Loops', allowMulti: 'Multi-edges' };
    change({ ...graph, [k]: on }, `${names[k]} ${on ? 'on' : 'off'}.${k === 'directed' ? (on ? ' Each edge now points from its first end to its second.' : ' Edges no longer have a direction.') : ''}`);
  };
  const setW = (e: FormEvent) => {
    e.preventDefault();
    if (!weightEdit) return;
    const w = Number(weightEdit.value);
    if (!Number.isFinite(w)) return announce('The weight must be a number.');
    const ed = graph.edges.find(x => x.id === weightEdit.id)!;
    change(setWeight({ ...graph, weighted: true }, weightEdit.id, w), `Weight of ${ed.from} ${graph.directed ? '→' : '–'} ${ed.to} set to ${w}.`);
    setWeightEdit(null);
  };
  const editWeight = (id: string) => {
    const e = graph.edges.find(x => x.id === id);
    if (e) setWeightEdit({ id, value: String(e.weight) });
  };
  const doImport = () => {
    try {
      const g = parseText(importText, { weighted: false });
      change(g, `Imported a graph with ${g.vertices.length} vertices and ${g.edges.length} edges.`);
      setIo(null);
      setImportError('');
    } catch (err) {
      setImportError((err as Error).message);
    }
  };
  const download = () => {
    const blob = new Blob([exportText(graph)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'graph.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    announce('graph.txt downloaded.');
  };

  // ---------- keyboard shortcuts (not while typing in a field) ----------
  const onKey = (e: RKeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (h.canUndo) { h.undo(); announce('Undone.'); }
    } else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (h.canRedo) { h.redo(); announce('Redone.'); }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    } else if (!ctrl && !e.altKey && e.key.toLowerCase() === 'v') addV();
    else if (!ctrl && !e.altKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      edgeFromRef.current?.focus();
    } else if (!ctrl && !e.altKey && e.key.toLowerCase() === 'c') {
      setShowClosure(s => !s);
      announce(showClosure ? 'Closure hidden.' : `Closure shown: ${added.length} new pair${added.length === 1 ? '' : 's'} drawn as dashed edges.`);
    } else if (!ctrl && !e.altKey && e.key.toLowerCase() === 'w' && selected?.kind === 'edge') editWeight(selected.id);
  };

  // ---------- canvas highlights ----------
  let highlight: Parameters<typeof GraphCanvas>[0]['highlight'] = {};
  let stepNote = '';
  if (stepK !== null && trace.length) {
    const s = trace[stepK];
    const adj = booleanMatrix(graph);
    const closure: [string, string][] = [];
    s.matrix.forEach((row, i) => row.forEach((v, j) => v && !adj[i][j] && closure.push([L[i], L[j]])));
    highlight = { closure, newClosure: s.changed.map(c => [L[c.i], L[c.j]] as [string, string]), current: typeof s.k === 'number' ? L[s.k] : null };
    stepNote = s.note;
  } else if (showClosure) highlight = { closure: added };
  if (helper.highlight && stepK === null) highlight = { ...highlight, vertices: helper.highlight.vertices, edges: pathEdges(helper.highlight.path) };

  const selEdge = selected?.kind === 'edge' ? graph.edges.find(e => e.id === selected.id) : null;

  return (
    <div className="build" onKeyDown={onKey}>
      <div className="page-head">
        <h1>Build a graph</h1>
        <p className="muted">Click the canvas to add a vertex. Drag a vertex to move it, or drag its small knob to another vertex to add an edge. Everything has a keyboard equivalent below.</p>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Graph tools">
        <button type="button" onClick={addV} disabled={graph.vertices.length >= MAX_VERTICES} aria-keyshortcuts="V">＋ Vertex</button>
        <button type="button" className={connect ? 'on' : 'secondary'} aria-pressed={connect} onClick={() => setConnect(c => !c)} title="Drag from a vertex to draw an edge (handy on touch screens)">
          ⤳ Connect mode
        </button>
        <span className="tool-sep" aria-hidden />
        {(
          [
            ['directed', 'Directed'],
            ['weighted', 'Weighted'],
            ['allowLoops', 'Loops'],
            ['allowMulti', 'Multi-edges'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={`tool-toggle ${graph[k] ? 'on' : ''}`} aria-pressed={graph[k]} onClick={() => toggle(k)}>
            <span aria-hidden>{graph[k] ? '☑' : '☐'}</span> {label}
          </button>
        ))}
        <span className="tool-sep" aria-hidden />
        <button type="button" className={`tool-toggle ${showClosure ? 'on' : ''}`} aria-pressed={showClosure} aria-keyshortcuts="C" onClick={() => { setShowClosure(s => !s); setStepK(null); announce(showClosure ? 'Closure hidden.' : `Closure shown: ${added.length} new pair${added.length === 1 ? '' : 's'} drawn as dashed edges.`); }}>
          <span aria-hidden>⇢</span> Closure
        </button>
        <button type="button" className={`tool-toggle ${stepK !== null ? 'on' : ''}`} aria-pressed={stepK !== null} disabled={graph.vertices.length === 0} onClick={() => { setStepK(k => (k === null ? 0 : null)); setShowClosure(false); setTab('Closure'); }}>
          <span aria-hidden>k</span> Step k
        </button>
        <span className="tool-sep" aria-hidden />
        <button type="button" className="secondary" onClick={() => { h.undo(); announce('Undone.'); }} disabled={!h.canUndo} aria-keyshortcuts="Control+Z">↶ Undo</button>
        <button type="button" className="secondary" onClick={() => { h.redo(); announce('Redone.'); }} disabled={!h.canRedo} aria-keyshortcuts="Control+Y">↷ Redo</button>
        <button type="button" className="secondary" onClick={() => setIo(io === 'export' ? null : 'export')} aria-expanded={io === 'export'}>⇩ Export</button>
        <button type="button" className="secondary" onClick={() => setIo(io === 'import' ? null : 'import')} aria-expanded={io === 'import'}>⇧ Import</button>
      </div>

      <AnnouncementBar text={message} />

      {io === 'export' && (
        <section className="card io-card" aria-label="Export">
          <h2>Export (Fitchfork text format)</h2>
          <p className="small muted">First line: n m d (d = 1 for directed). Then one line "u v" per edge, vertices numbered from 0 (a = 0, b = 1, …). Use it as input for the test problems.</p>
          <textarea readOnly rows={Math.min(12, graph.edges.length + 2)} value={exportText(graph)} aria-label="Graph as text" className="mono" />
          <div className="button-row">
            <button type="button" onClick={() => void navigator.clipboard?.writeText(exportText(graph)).then(() => announce('Copied to the clipboard.'))}>Copy</button>
            <button type="button" className="secondary" onClick={download}>Download graph.txt</button>
          </div>
        </section>
      )}
      {io === 'import' && (
        <section className="card io-card" aria-label="Import">
          <h2>Import</h2>
          <label>
            Paste a graph in the text format
            <textarea rows={6} value={importText} onChange={e => setImportText(e.target.value)} className="mono" placeholder={'4 3 1\n0 1\n1 2\n2 3'} />
          </label>
          {importError && <p className="error">{importError}</p>}
          <div className="button-row">
            <button type="button" onClick={doImport}>Load graph</button>
            {EXAMPLES.map(x => (
              <button key={x.name} type="button" className="secondary" onClick={() => { change(x.graph, `Loaded example: ${x.name}.`); setIo(null); }}>
                {x.name}
              </button>
            ))}
            <button type="button" className="secondary" onClick={() => { change(emptyGraph({ directed: graph.directed }), 'Canvas cleared.'); setIo(null); }}>Clear canvas</button>
          </div>
        </section>
      )}

      <div className="build-grid">
        <div className="build-canvas card">
          <GraphCanvas
            graph={graph}
            editable={stepK === null}
            connectMode={connect}
            onChange={change}
            selected={selected}
            onSelect={setSelected}
            onEditWeight={editWeight}
            highlight={highlight}
            title="Your graph"
          />
          <div className="legend small" aria-hidden>
            <span><span className="sw sw-edge" /> edge</span>
            <span><span className="sw sw-closure" /> + closure pair (dashed)</span>
            {stepK !== null && <span><span className="sw sw-new" /> added at this k (thick dashes)</span>}
          </div>
          {stepK !== null && trace.length > 0 && (
            <Stepper index={stepK} count={trace.length} onIndex={i => setStepK(Math.max(0, Math.min(trace.length - 1, i)))} note={stepNote} label="k step" />
          )}

          <div className="edit-panel">
            <form className="edge-form" onSubmit={addE} aria-label="Add an edge">
              <strong>Add edge</strong>
              <label>
                From
                <select ref={edgeFromRef} value={edgeForm.from} onChange={e => setEdgeForm(f => ({ ...f, from: e.target.value }))} aria-keyshortcuts="E">
                  <option value="">–</option>
                  {L.map(v => <option key={v}>{v}</option>)}
                </select>
              </label>
              <label>
                To
                <select value={edgeForm.to} onChange={e => setEdgeForm(f => ({ ...f, to: e.target.value }))}>
                  <option value="">–</option>
                  {L.map(v => <option key={v}>{v}</option>)}
                </select>
              </label>
              {graph.weighted && (
                <label>
                  Weight
                  <input type="number" value={edgeForm.weight} onChange={e => setEdgeForm(f => ({ ...f, weight: e.target.value }))} />
                </label>
              )}
              <button type="submit" disabled={stepK !== null}>Add</button>
            </form>
            <div className="selection-row">
              <span>
                Selected:{' '}
                <strong>
                  {!selected ? 'nothing' : selected.kind === 'vertex' ? `vertex ${selected.id}` : selEdge ? `edge ${selEdge.from} ${graph.directed ? '→' : '–'} ${selEdge.to}${graph.weighted ? ` (weight ${selEdge.weight})` : ''}` : 'nothing'}
                </strong>
              </span>
              <button type="button" className="secondary" onClick={deleteSelected} disabled={!selected || stepK !== null} aria-keyshortcuts="Delete">Delete</button>
              {selEdge && (
                <button type="button" className="secondary" onClick={() => editWeight(selEdge.id)} aria-keyshortcuts="W">Set weight</button>
              )}
              {selected?.kind === 'edge' || L.length === 0 ? null : (
                <label className="inline">
                  Select edge
                  <select value="" onChange={e => e.target.value && setSelected({ kind: 'edge', id: e.target.value })}>
                    <option value="">–</option>
                    {graph.edges.map(e => (
                      <option key={e.id} value={e.id}>{e.from === e.to ? `loop at ${e.from}` : `${e.from} ${graph.directed ? '→' : '–'} ${e.to}`}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {weightEdit && (
              <form className="edge-form" onSubmit={setW}>
                <label>
                  New weight
                  <input type="number" value={weightEdit.value} autoFocus onChange={e => setWeightEdit({ ...weightEdit, value: e.target.value })} />
                </label>
                <button type="submit">Set</button>
                <button type="button" className="secondary" onClick={() => setWeightEdit(null)}>Cancel</button>
              </form>
            )}
            <details className="shortcuts">
              <summary>Keyboard shortcuts</summary>
              <ul className="small">
                <li><kbd>V</kbd> add a vertex · <kbd>E</kbd> go to Add edge · <kbd>Delete</kbd> remove the selection · <kbd>W</kbd> set the weight of the selected edge</li>
                <li><kbd>Tab</kbd> to a vertex, <kbd>Enter</kbd> to select it, <kbd>Alt</kbd> + arrows to move it (add <kbd>Shift</kbd> for bigger steps)</li>
                <li><kbd>C</kbd> show or hide the closure · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Y</kbd> redo · <kbd>Alt</kbd>+<kbd>H</kbd> Graph Helper</li>
              </ul>
            </details>
          </div>
        </div>

        <LivePanel graph={graph} tab={tab} setTab={setTab} stepK={stepK} trace={trace} />
      </div>
    </div>
  );
}

function pathEdges(path: string[] | undefined): [string, string][] {
  if (!path || path.length < 2) return [];
  return path.slice(1).map((v, i) => [path[i], v] as [string, string]);
}

export function LivePanel({ graph, tab, setTab, stepK, trace }: { graph: Graph; tab: Tab; setTab: (t: Tab) => void; stepK: number | null; trace: ReturnType<typeof warshallTrace> }) {
  const L = ids(graph);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: RKeyboardEvent, i: number) => {
    const n = TABS.length;
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation();
    setTab(TABS[j]);
    refs.current[j]?.focus();
  };
  return (
    <section className="card live-panel" aria-label="Live representations">
      <div role="tablist" aria-label="Representation" className="tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={el => (refs.current[i] = el)}
            role="tab"
            id={`tab-${i}`}
            aria-selected={tab === t}
            aria-controls={`panel-${i}`}
            tabIndex={tab === t ? 0 : -1}
            className={`tab ${tab === t ? 'on' : ''}`}
            onClick={() => setTab(t)}
            onKeyDown={e => onTabKey(e, i)}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${TABS.indexOf(tab)}`} aria-labelledby={`tab-${TABS.indexOf(tab)}`} tabIndex={0} className="tab-panel">
        {L.length === 0 ? <p className="muted">Add a vertex to see this view.</p> : <PanelBody graph={graph} tab={tab} stepK={stepK} trace={trace} />}
      </div>
    </section>
  );
}

function PanelBody({ graph, tab, stepK, trace }: { graph: Graph; tab: Tab; stepK: number | null; trace: ReturnType<typeof warshallTrace> }) {
  const L = ids(graph);
  if (tab === 'Matrix') {
    const m = adjacencyMatrix(graph, graph.weighted ? 'weight' : 'count');
    return (
      <>
        <MatrixTable labels={L} matrix={m} caption={`Adjacency matrix (${graph.weighted ? 'weights' : 'number of edges'}), row = from, column = to`} format={v => (v === 0 ? '0' : v < 0 ? `−${-v}` : String(v))} />
        <p className="small muted">{graph.directed ? 'Directed: row u, column v counts arrows u → v.' : 'Undirected: the matrix is symmetric. A loop is recorded once on the diagonal.'} Memory: V² = {L.length * L.length} cells.</p>
      </>
    );
  }
  if (tab === 'List') {
    const lists = adjacencyList(graph);
    const star = starForward(graph);
    return (
      <>
        <h3 className="small-heading">Linked form</h3>
        <ul className="linked-lists" aria-label="Adjacency lists, linked form">
          {lists.map(row => (
            <li key={row.id}>
              <span className="ll-head">{row.id}</span>
              {row.list.map((n, i) => (
                <span key={n.edgeId + i} className="ll-node">
                  <span aria-hidden>→</span> {n.to}{graph.weighted ? ` (${n.weight})` : ''}
                </span>
              ))}
              <span className="ll-null"><span aria-hidden>→</span> null</span>
            </li>
          ))}
        </ul>
        <h3 className="small-heading">Star form (one array)</h3>
        <p className="small muted">start[v] is where v’s neighbours begin in the neighbours array; they end where the next vertex’s begin.</p>
        <div className="table-wrap">
          <table className="matrix star">
            <caption>start</caption>
            <tbody>
              <tr><th scope="row">vertex</th>{L.map(v => <td key={v}>{v}</td>)}<td className="muted">end</td></tr>
              <tr><th scope="row">start</th>{star.start.map((s, i) => <td key={i}>{s}</td>)}</tr>
            </tbody>
          </table>
          <table className="matrix star">
            <caption>neighbours</caption>
            <tbody>
              <tr><th scope="row">index</th>{star.neighbours.map((_, i) => <td key={i}>{i}</td>)}</tr>
              <tr><th scope="row">vertex</th>{star.neighbours.map((v, i) => <td key={i}>{v}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">Memory: Θ(V + E). {graph.directed ? `${graph.edges.length} entries for ${graph.edges.length} arrows.` : `Each undirected edge appears twice.`}</p>
      </>
    );
  }
  if (tab === 'Incidence') {
    const inc = incidenceMatrix(graph);
    if (!inc.cols.length) return <p className="muted">No edges yet.</p>;
    return (
      <>
        <MatrixTable labels={inc.rows} cols={inc.cols} matrix={inc.cells} caption="Incidence matrix: rows are vertices, columns are edges" rowHeader="vertex" colHeader="edge" format={v => (v < 0 ? `−${-v}` : String(v))} />
        <p className="small muted">{graph.directed ? '1 marks the tail (where the arrow starts), −1 the head.' : 'Each column has a 1 at the edge’s two ends.'} A loop has a single entry. Size V × E = {inc.rows.length} × {inc.cols.length}.</p>
      </>
    );
  }
  if (tab === 'Edge list') {
    return (
      <>
        <pre className="code-block" aria-label="Edge list">{edgeListText(graph) || '(no edges)'}</pre>
        <h3 className="small-heading">Test-problem input (vertices numbered from 0)</h3>
        <pre className="code-block">{exportText(graph)}</pre>
      </>
    );
  }
  if (tab === 'Closure') {
    if (stepK !== null && trace.length) {
      const s = trace[stepK];
      return (
        <>
          <MatrixTable labels={L} matrix={s.matrix} caption={typeof s.k === 'number' ? `R(${s.k + 1}): stops allowed through ${L.slice(0, s.k + 1).join(', ')}` : s.k === 'done' ? 'R⁺ (final)' : 'R(0): the adjacency matrix'} changed={s.changed} kRow={typeof s.k === 'number' ? s.k : null} />
          <p className="small muted">Row and column k are shaded. ★ marks cells that turned on at this step: R[i][j] = R[i][j] OR (R[i][k] AND R[k][j]).</p>
        </>
      );
    }
    const R = warshall(booleanMatrix(graph));
    const added = closureAddedPairs(graph);
    return (
      <>
        <MatrixTable labels={L} matrix={R} caption="Transitive closure R⁺ (reachability matrix)" changed={added.map(([a, b]) => ({ i: L.indexOf(a), j: L.indexOf(b) }))} />
        <p className="small">
          {added.length ? `★ ${added.length} pair${added.length === 1 ? '' : 's'} added by the closure: ${added.map(([a, b]) => `(${a}, ${b})`).join(', ')}.` : 'The closure adds no new pairs: the edges are already transitive.'}
        </p>
        <p className="small muted">A 1 on the diagonal means that vertex is on a cycle. Press <strong>Step k</strong> to build R⁺ one intermediate vertex at a time.</p>
      </>
    );
  }
  const p = properties(graph);
  const rows: [string, string][] = [
    ['Type', typeSentence(p)],
    ['Vertices, edges', `V = ${p.vertices}, E = ${p.edges}`],
    ['Connectivity', p.connectivity],
    ['Has a cycle', p.cyclic ? 'yes' : 'no'],
    ['Tree', p.isTree ? 'yes' : 'no'],
    ['Complete', p.complete ? `yes (Kₙ has ${p.knEdges} edges)` : `no (Kₙ would have ${p.knEdges})`],
    ['Isolated vertices', p.isolated.join(', ') || 'none'],
    graph.directed
      ? ['In / out degree', L.map(v => `${v}: ${p.indeg[v]}/${p.outdeg[v]}`).join(' · ')]
      : ['Degrees', L.map(v => `${v}: ${p.deg[v]}`).join(' · ') + ` (sum ${p.degreeSum} = 2E)`],
    // BFS and DFS from the first vertex (neighbours in alphabetical order).
    ...(L.length
      ? ([
          [`BFS from ${L[0]}`, bfsTrace(graph, L[0]).order.join(' → ')],
          [`DFS from ${L[0]}`, dfsTrace(graph, L[0]).order.join(' → ')],
        ] as [string, string][])
      : []),
  ];
  return (
    <table className="props-table">
      <caption className="sr-only">Graph properties</caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k === 'Connectivity' ? <Term t={graph.directed ? 'strongly connected' : 'connected'}>{k}</Term> : k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
