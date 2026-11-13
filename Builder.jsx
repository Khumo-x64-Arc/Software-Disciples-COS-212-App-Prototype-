import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  indexToLabel, countMatrix, boolMatrix, weightMatrix, adjacencyList, incidenceMatrix, closure, warshallTrace,
  reachableFrom, bfsOrder, properties, toTestInput, fromTestInput,
} from '@shared/graph.js';
import { useApp, Matrix, store } from '../lib.jsx';

const W = 760, H = 470, R = 20;
const PRESETS = {
  'Path a → d': '4 3 1\n0 1\n1 2\n2 3\n',
  'Cycle of 4': '4 4 1\n0 1\n1 2\n2 3\n3 0\n',
  'K₄ (undirected)': '4 6 0\n0 1\n0 2\n0 3\n1 2\n1 3\n2 3\n',
  'Two pieces': '6 4 1\n0 1\n1 2\n3 4\n4 5\n',
  'Prerequisites': '6 6 1\n0 1\n1 2\n2 3\n4 3\n1 5\n4 5\n',
};
let uid = 0;
const nid = p => `${p}${Date.now().toString(36)}${(uid++).toString(36)}`;
const nextLabel = g => { const used = new Set(g.vertices.map(v => v.label)); for (let i = 0; ; i++) if (!used.has(indexToLabel(i))) return indexToLabel(i); };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

function edgeGeometry(g) {
  // group parallel / opposite edges so each gets its own curve
  const groups = new Map();
  g.edges.forEach(e => { const k = [e.from, e.to].sort().join('|'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
  const pos = new Map(g.vertices.map(v => [v.id, v]));
  const geo = {};
  for (const [, list] of groups) {
    list.forEach((e, k) => {
      const a = pos.get(e.from), b = pos.get(e.to);
      if (!a || !b) return;
      if (e.from === e.to) {
        const s = 1 + k * 0.45;
        geo[e.id] = { d: `M ${a.x - 9} ${a.y - R + 3} C ${a.x - 38 * s} ${a.y - 78 * s}, ${a.x + 38 * s} ${a.y - 78 * s}, ${a.x + 9} ${a.y - R + 3}`, lx: a.x, ly: a.y - 52 * s, loop: true };
        return;
      }
      const [p, q] = e.from < e.to ? [a, b] : [b, a];
      const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const off = list.length === 1 ? 0 : (k - (list.length - 1) / 2) * 34;
      const mx = (a.x + b.x) / 2 + nx * off, my = (a.y + b.y) / 2 + ny * off;
      const cx = 2 * mx - (a.x + b.x) / 2, cy = 2 * my - (a.y + b.y) / 2; // control point so the curve passes through (mx, my)
      const tx = b.x - cx, ty = b.y - cy, tl = Math.hypot(tx, ty) || 1;
      const sx = a.x - cx, sy = a.y - cy, sl = Math.hypot(sx, sy) || 1;
      const end = g.directed ? R + 4 : R;
      const x1 = a.x - (sx / sl) * R, y1 = a.y - (sy / sl) * R;
      const x2 = b.x - (tx / tl) * end, y2 = b.y - (ty / tl) * end;
      geo[e.id] = { d: off === 0 ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, lx: mx + nx * 12, ly: my + ny * 12 };
    });
  }
  return geo;
}

export default function Builder() {
  const { announce, setGraph, highlight, setHighlight } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [g, setG] = useState(() => {
    const q = params.get('g');
    if (q) { try { return fromTestInput(q); } catch { /* fall through */ } }
    return store.get('builderGraph') || fromTestInput('4 4 1\n0 1\n1 2\n0 3\n3 2\n');
  });
  const [opts, setOpts] = useState({ weighted: false, loops: false, multi: false });
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [tool, setTool] = useState('connect');
  const [sel, setSel] = useState(null);
  const [showClosure, setShowClosure] = useState(false);
  const [traceK, setTraceK] = useState(null); // null = off; -1 = R(0); k = after step k
  const [search, setSearch] = useState(null); // { kind, start, order, step }
  const [tab, setTab] = useState('matrix');
  const [drag, setDrag] = useState(null);
  const [popped, setPopped] = useState(null);
  const [form, setForm] = useState({ from: '', to: '', weight: 1 });
  const [weightEdit, setWeightEdit] = useState(null);
  const svgRef = useRef(null);
  const suppressClick = useRef(false);

  // derived
  const labels = g.vertices.map(v => v.label);
  const adj = useMemo(() => boolMatrix(g), [g]);
  const R_ = useMemo(() => closure(adj), [adj]);
  const P = useMemo(() => properties(g), [g]);
  const trace = useMemo(() => (traceK === null ? null : warshallTrace(adj)), [adj, traceK]);
  const geo = useMemo(() => edgeGeometry(g), [g]);
  const idx = useMemo(() => new Map(g.vertices.map((v, i) => [v.id, i])), [g]);

  useEffect(() => { setGraph(g); store.set('builderGraph', g); }, [g, setGraph]);
  useEffect(() => { if (params.get('g')) announce(`Loaded a graph with ${g.vertices.length} vertices and ${g.edges.length} edges.`); /* eslint-disable-next-line */ }, []);

  const commit = useCallback((next, msg) => {
    setPast(p => [...p.slice(-60), g]); setFuture([]); setG(next);
    setTraceK(null); setSearch(null); setHighlight(null);
    if (msg) announce(msg);
  }, [g, announce, setHighlight]);

  const addVertexAt = (x, y) => {
    const v = { id: nid('v'), label: nextLabel(g), x: clamp(x, R + 4, W - R - 4), y: clamp(y, R + 4, H - R - 4) };
    commit({ ...g, vertices: [...g.vertices, v] }, `Vertex ${v.label} added.`);
    setPopped(v.id); setTimeout(() => setPopped(null), 400);
    return v;
  };
  const freeSpot = () => {
    for (let r = 0; r < 12; r++) for (let a = 0; a < 12; a++) {
      const x = W / 2 + Math.cos(a * 0.52 + r) * 40 * r, y = H / 2 + Math.sin(a * 0.52 + r) * 32 * r;
      if (x > 30 && x < W - 30 && y > 30 && y < H - 30 && g.vertices.every(v => Math.hypot(v.x - x, v.y - y) > 60)) return [x, y];
    }
    return [W / 2, H / 2];
  };
  const addEdge = (fromId, toId, weight = 1) => {
    const a = g.vertices.find(v => v.id === fromId), b = g.vertices.find(v => v.id === toId);
    if (!a || !b) return;
    if (fromId === toId && !opts.loops) { announce('Loops are off. Switch on Loops to make a pseudograph.'); return; }
    const exists = g.edges.some(e => (e.from === fromId && e.to === toId) || (!g.directed && e.from === toId && e.to === fromId));
    if (exists && !opts.multi) { announce(`Edge ${a.label}${g.directed ? ' → ' : '–'}${b.label} already exists. Switch on Multi-edges to add another.`); return; }
    const e = { id: nid('e'), from: fromId, to: toId, weight: opts.weighted ? Number(weight) || 1 : 1 };
    const kind = fromId === toId ? `Loop at ${a.label}` : `Edge ${a.label}${g.directed ? ' → ' : '–'}${b.label}`;
    commit({ ...g, edges: [...g.edges, e] }, `${kind} added.${fromId === toId ? ' The graph is now a pseudograph.' : exists ? ' The graph is now a multigraph.' : ''}`);
  };
  const removeVertex = id => {
    const v = g.vertices.find(x => x.id === id);
    commit({ ...g, vertices: g.vertices.filter(x => x.id !== id), edges: g.edges.filter(e => e.from !== id && e.to !== id) }, `Vertex ${v.label} and its edges removed.`);
    setSel(null);
  };
  const removeEdge = id => {
    const e = g.edges.find(x => x.id === id);
    const a = g.vertices.find(v => v.id === e.from), b = g.vertices.find(v => v.id === e.to);
    commit({ ...g, edges: g.edges.filter(x => x.id !== id) }, `Edge ${a.label}${g.directed ? ' → ' : '–'}${b.label} removed.`);
    setSel(null);
  };
  const undo = () => { if (!past.length) return; setFuture(f => [g, ...f]); setG(past[past.length - 1]); setPast(p => p.slice(0, -1)); setTraceK(null); setSearch(null); announce('Undone.'); };
  const redo = () => { if (!future.length) return; setPast(p => [...p, g]); setG(future[0]); setFuture(f => f.slice(1)); announce('Redone.'); };

  useEffect(() => {
    const onKey = e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); sel.type === 'vertex' ? removeVertex(sel.id) : removeEdge(sel.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------- pointer handling ----------
  const toSvg = evt => {
    const svg = svgRef.current; const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  };
  const onVertexDown = (evt, v) => {
    evt.stopPropagation();
    evt.currentTarget.setPointerCapture?.(evt.pointerId);
    const p = toSvg(evt);
    setDrag({ kind: tool === 'move' || evt.altKey ? 'move' : 'edge', vid: v.id, start: p, cur: p, moved: false, origin: { x: v.x, y: v.y }, before: g });
  };
  const onMove = evt => {
    if (!drag) return;
    const p = toSvg(evt);
    const moved = drag.moved || Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 5;
    if (drag.kind === 'move' && moved) {
      setG(cur => ({ ...cur, vertices: cur.vertices.map(v => (v.id === drag.vid ? { ...v, x: clamp(drag.origin.x + p.x - drag.start.x, R, W - R), y: clamp(drag.origin.y + p.y - drag.start.y, R, H - R) } : v)) }));
    }
    setDrag(d => ({ ...d, cur: p, moved }));
  };
  const onUp = evt => {
    if (!drag) return;
    const p = toSvg(evt);
    const target = g.vertices.find(v => Math.hypot(v.x - p.x, v.y - p.y) <= R + 6);
    if (!drag.moved) {
      setSel({ type: 'vertex', id: drag.vid });
      const v = g.vertices.find(x => x.id === drag.vid);
      announce(`Vertex ${v.label} selected. Press Delete to remove it.`);
    } else if (drag.kind === 'move') {
      setPast(ps => [...ps.slice(-60), drag.before]); setFuture([]);
    } else if (target) {
      addEdge(drag.vid, target.id);
    }
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    setDrag(null);
  };
  const onCanvasClick = evt => {
    if (suppressClick.current || drag) return;
    if (sel) { setSel(null); return; }
    const p = toSvg(evt);
    addVertexAt(p.x, p.y);
  };
  const onVertexKey = (evt, v) => {
    const step = evt.shiftKey ? 30 : 10;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[evt.key];
    if (mv) {
      evt.preventDefault();
      commit({ ...g, vertices: g.vertices.map(x => (x.id === v.id ? { ...x, x: clamp(x.x + mv[0], R, W - R), y: clamp(x.y + mv[1], R, H - R) } : x)) });
    } else if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); setSel({ type: 'vertex', id: v.id }); announce(`Vertex ${v.label} selected, degree ${P.degree[idx.get(v.id)]}.`); }
    else if (evt.key === 'Delete' || evt.key === 'Backspace') { evt.preventDefault(); removeVertex(v.id); }
  };

  // ---------- toggles ----------
  const setDirected = d => {
    if (d === g.directed) return;
    commit({ ...g, directed: d }, d ? 'Directed is on: every edge now has a direction. The matrix need not be symmetric.' : 'Directed is off: edges go both ways, so the adjacency matrix is symmetric.');
  };
  const toggleOpt = k => {
    const v = !opts[k]; setOpts(o => ({ ...o, [k]: v }));
    const words = { weighted: v ? 'Weighted is on: double-click an edge to set its weight.' : 'Weighted is off.', loops: v ? 'Loops are on: drag from a vertex back onto itself to add a loop.' : 'Loops are off for new edges.', multi: v ? 'Multi-edges are on: you can add a second edge between the same pair.' : 'Multi-edges are off for new edges.' };
    announce(words[k]);
  };
  const toggleClosure = () => {
    const v = !showClosure; setShowClosure(v); setTraceK(null);
    if (v) {
      const added = [];
      for (let i = 0; i < adj.length; i++) for (let j = 0; j < adj.length; j++) if (i !== j && R_[i][j] && !adj[i][j] && (g.directed || i < j)) added.push(`${labels[i]} reaches ${labels[j]}`);
      announce(`Closure on. ${added.length ? `${added.length} new pair${added.length > 1 ? 's' : ''}: ${added.join(', ')}.` : 'No new pairs: every reachable pair is already joined directly.'}`);
      setTab('closure');
    } else announce('Closure off.');
  };
  const stepK = () => {
    const n = g.vertices.length;
    if (!n) return;
    setShowClosure(false); setTab('closure'); setSearch(null);
    const next = traceK === null ? -1 : traceK + 1;
    if (next >= n) { setTraceK(null); announce("Warshall's trace finished: the last matrix is the transitive closure."); return; }
    setTraceK(next);
    if (next === -1) { announce("Warshall's trace: R(0) is the adjacency matrix. Press Step k to use the first vertex as an intermediate."); return; }
    const s = warshallTrace(adj)[next + 1];
    const k = labels[next];
    announce(s.changed.length ? `k = ${k}: ${s.changed.map(([i, j]) => `${labels[i]} now reaches ${labels[j]}`).join(', ')}.` : `k = ${k}: nothing new.`);
  };
  const startSearch = kind => {
    const s = sel?.type === 'vertex' ? idx.get(sel.id) : 0;
    if (!g.vertices.length) return;
    const order = kind === 'dfs' ? reachableFrom(adj, s).order : bfsOrder(adj, s);
    setSearch({ kind, start: s, order, step: 0 }); setTraceK(null);
    announce(`${kind === 'dfs' ? 'Depth' : 'Breadth'}-first search from ${labels[s]}. Visit ${labels[s]} (1 of ${order.length}). Press Next visit to continue.`);
  };
  const nextVisit = () => {
    if (!search) return;
    const step = search.step + 1;
    if (step >= search.order.length) { announce(`Search finished. Reached from ${labels[search.start]}: ${search.order.map(i => labels[i]).join(', ')}.`); setSearch({ ...search, step: search.order.length - 1, done: true }); return; }
    setSearch({ ...search, step });
    announce(`Visit ${labels[search.order[step]]} (${step + 1} of ${search.order.length}).`);
  };

  const exportTxt = () => {
    const blob = new Blob([toTestInput(g)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'my-graph.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce('Graph exported in the test input format.');
  };
  const loadPreset = name => { if (!name) return; commit(fromTestInput(PRESETS[name]), `Loaded ${name}.`); };

  // ---------- render helpers ----------
  const reached = search ? new Set(search.order.slice(0, search.step + 1)) : new Set();
  const kIndex = traceK !== null && traceK >= 0 ? traceK : -1;
  const pathEdges = new Set();
  if (highlight?.path) for (let t = 0; t + 1 < highlight.path.length; t++) {
    const a = g.vertices[highlight.path[t]]?.id, b = g.vertices[highlight.path[t + 1]]?.id;
    const e = g.edges.find(x => (x.from === a && x.to === b) || (!g.directed && x.from === b && x.to === a));
    if (e) pathEdges.add(e.id);
  }
  const closurePairs = [];
  const curR = trace ? trace[traceK + 1].matrix : showClosure ? R_ : null;
  if (curR) for (let i = 0; i < adj.length; i++) for (let j = 0; j < adj.length; j++)
    if (i !== j && curR[i][j] && !adj[i][j] && (g.directed || i < j)) closurePairs.push([i, j]);
  const newest = trace && traceK >= 0 ? trace[traceK + 1].changed : [];

  const linePath = (i, j) => {
    const a = g.vertices[i], b = g.vertices[j];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, off = 16;
    const cx = (a.x + b.x) / 2 + nx * off * 2, cy = (a.y + b.y) / 2 + ny * off * 2;
    const tx = b.x - cx, ty = b.y - cy, tl = Math.hypot(tx, ty) || 1;
    const sx = a.x - cx, sy = a.y - cy, sl = Math.hypot(sx, sy) || 1;
    const end = g.directed ? R + 4 : R;
    return `M ${a.x - (sx / sl) * R} ${a.y - (sy / sl) * R} Q ${cx} ${cy} ${b.x - (tx / tl) * end} ${b.y - (ty / tl) * end}`;
  };

  const selectedEdge = sel?.type === 'edge' ? g.edges.find(e => e.id === sel.id) : null;
  const list = adjacencyList(g);
  const inc = incidenceMatrix(g);
  const edgeName = e => `${g.vertices[idx.get(e.from)]?.label}${g.directed ? '→' : '–'}${g.vertices[idx.get(e.to)]?.label}`;

  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Build a graph</h1>
        <label className="small">Load an example{' '}
          <select onChange={e => { loadPreset(e.target.value); e.target.value = ''; }} defaultValue=""><option value="">Choose…</option>{Object.keys(PRESETS).map(k => <option key={k}>{k}</option>)}</select>
        </label>
      </div>
      <div className="toolbar" role="toolbar" aria-label="Graph tools">
        <button className="btn small" onClick={() => { const [x, y] = freeSpot(); addVertexAt(x, y); }}>＋ Add vertex</button>
        <span className="chip" role="group" aria-label="Dragging a vertex">
          Drag to:
          <button className="btn small ghost" aria-pressed={tool === 'connect'} onClick={() => { setTool('connect'); announce('Dragging from a vertex now draws an edge.'); }}>Connect</button>
          <button className="btn small ghost" aria-pressed={tool === 'move'} onClick={() => { setTool('move'); announce('Dragging a vertex now moves it.'); }}>Move</button>
        </span>
        <button className="btn small" aria-pressed={g.directed} onClick={() => setDirected(!g.directed)}>Directed</button>
        <button className="btn small" aria-pressed={opts.weighted} onClick={() => toggleOpt('weighted')}>Weighted</button>
        <button className="btn small" aria-pressed={opts.loops} onClick={() => toggleOpt('loops')}>Loops</button>
        <button className="btn small" aria-pressed={opts.multi} onClick={() => toggleOpt('multi')}>Multi-edges</button>
        <button className="btn small" aria-pressed={showClosure} onClick={toggleClosure}>Closure</button>
        <button className="btn small" onClick={stepK} aria-label={traceK === null ? "Start Warshall's trace" : 'Step k'}>{traceK === null ? 'Step k ▶' : `Step k ▶ (${traceK < 0 ? 'R(0)' : `k = ${labels[traceK]}`})`}</button>
        <button className="btn small" onClick={undo} disabled={!past.length}>↶ Undo</button>
        <button className="btn small" onClick={redo} disabled={!future.length}>↷ Redo</button>
        <button className="btn small" onClick={exportTxt}>⤓ Export</button>
        <button className="btn small" onClick={() => navigate(`/tests/P7?input=${encodeURIComponent(toTestInput(g))}`)}>Open in P7</button>
        <button className="btn small" onClick={() => commit({ ...g, vertices: [], edges: [] }, 'Canvas cleared.')}>Clear</button>
      </div>

      <div className="builder">
        <div>
          <div className="canvas-wrap">
            <span className="canvas-hint">{tool === 'connect' ? 'Click empty space to add a vertex · drag between vertices to connect' : 'Drag vertices to move them'}</span>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerUp={onUp} onClick={onCanvasClick} role="application" aria-label={`Graph canvas: ${P.V} vertices, ${P.E} edges. Use the edge list tab for a text view.`}>
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1B1B2F" /></marker>
                <marker id="arr-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#0072B2" /></marker>
                <marker id="arr-sel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#E69F00" /></marker>
              </defs>
              {closurePairs.map(([i, j]) => {
                const isNew = newest.some(([a, b]) => a === i && b === j);
                return <path key={`c${i}-${j}`} d={linePath(i, j)} className="closure-edge" strokeWidth={isNew ? 4 : 2.5} markerEnd={g.directed ? 'url(#arr-blue)' : undefined} />;
              })}
              {g.edges.map(e => {
                const gg = geo[e.id]; if (!gg) return null;
                const cls = `edge ${sel?.id === e.id ? 'selected' : ''} ${pathEdges.has(e.id) ? 'path' : ''}`;
                return (
                  <g key={e.id}>
                    <path d={gg.d} className={cls} markerEnd={g.directed ? (sel?.id === e.id ? 'url(#arr-sel)' : 'url(#arr)') : undefined} />
                    <path d={gg.d} className="edge-hit" onClick={ev => { ev.stopPropagation(); setSel({ type: 'edge', id: e.id }); announce(`Edge ${edgeName(e)} selected. Press Delete to remove it.`); }}
                      onDoubleClick={ev => { ev.stopPropagation(); if (opts.weighted) setWeightEdit({ id: e.id, value: e.weight }); }} />
                    {opts.weighted && <text x={gg.lx} y={gg.ly} className="weight" textAnchor="middle">{e.weight}</text>}
                  </g>
                );
              })}
              {drag?.kind === 'edge' && drag.moved && (() => { const v = g.vertices.find(x => x.id === drag.vid); return <line x1={v.x} y1={v.y} x2={drag.cur.x} y2={drag.cur.y} stroke="#E69F00" strokeWidth="3" strokeDasharray="4 4" />; })()}
              {g.vertices.map((v, i) => (
                <g key={v.id} className={`vertex ${sel?.id === v.id ? 'selected' : ''} ${kIndex === i ? 'kvertex' : ''} ${reached.has(i) ? 'reached' : ''} ${popped === v.id ? 'pop' : ''}`}
                  tabIndex={0} role="button" aria-label={`Vertex ${v.label}, degree ${P.degree[i]}${sel?.id === v.id ? ', selected' : ''}. Arrow keys move it; Delete removes it.`}
                  onPointerDown={ev => onVertexDown(ev, v)} onKeyDown={ev => onVertexKey(ev, v)} onClick={ev => ev.stopPropagation()} style={{ cursor: tool === 'move' ? 'grab' : 'crosshair' }}>
                  {kIndex === i && <circle className="ring" cx={v.x} cy={v.y} r={R + 7} />}
                  {reached.has(i) && <circle className="ring2" cx={v.x} cy={v.y} r={R + 6} />}
                  {highlight?.vertices?.includes(i) && <circle cx={v.x} cy={v.y} r={R + 9} fill="none" stroke="#0072B2" strokeWidth="3" />}
                  <circle className="body" cx={v.x} cy={v.y} r={R} />
                  <text x={v.x} y={v.y + 6} textAnchor="middle">{v.label}</text>
                  {kIndex === i && <text x={v.x + R + 6} y={v.y - R} style={{ fontSize: 13 }}>k</text>}
                </g>
              ))}
            </svg>
          </div>
          <div className="row small" style={{ marginTop: 8 }}>
            <span className="legend"><span>━ edge</span><span style={{ color: '#0072B2' }}>╍ closure pair</span><span>◯ orange: selected</span><span>◎ purple ring: current k</span><span>◌ blue dotted ring: reached by search</span></span>
          </div>
          {weightEdit && (
            <form className="card row" style={{ marginTop: 8 }} onSubmit={ev => { ev.preventDefault(); commit({ ...g, edges: g.edges.map(e => (e.id === weightEdit.id ? { ...e, weight: Number(weightEdit.value) || 0 } : e)) }, `Weight set to ${weightEdit.value}.`); setWeightEdit(null); }}>
              <label className="field">Weight<input type="number" value={weightEdit.value} autoFocus onChange={e => setWeightEdit(w => ({ ...w, value: e.target.value }))} /></label>
              <button className="btn primary small">Set weight</button><button type="button" className="btn small" onClick={() => setWeightEdit(null)}>Cancel</button>
            </form>
          )}
          <form className="card row" style={{ marginTop: 12, alignItems: 'flex-end' }} onSubmit={ev => { ev.preventDefault(); if (form.from && form.to) addEdge(form.from, form.to, form.weight); }} aria-label="Add an edge with the keyboard">
            <label className="field">From<select value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))}><option value="">–</option>{g.vertices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
            <label className="field">To<select value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}><option value="">–</option>{g.vertices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
            {opts.weighted && <label className="field">Weight<input type="number" value={form.weight} style={{ width: 90 }} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} /></label>}
            <button className="btn small primary">Add edge</button>
            {selectedEdge && <button type="button" className="btn small" onClick={() => removeEdge(selectedEdge.id)}>Delete edge {edgeName(selectedEdge)}</button>}
            {sel?.type === 'vertex' && <button type="button" className="btn small" onClick={() => removeVertex(sel.id)}>Delete vertex {g.vertices[idx.get(sel.id)]?.label}</button>}
          </form>
          <div className="card row" style={{ marginTop: 12, alignItems: 'center' }}>
            <b>Search</b>
            <span className="small muted">from {sel?.type === 'vertex' ? g.vertices[idx.get(sel.id)]?.label : labels[0] || '–'} (select a vertex to change)</span>
            <button className="btn small" onClick={() => startSearch('dfs')}>DFS</button>
            <button className="btn small" onClick={() => startSearch('bfs')}>BFS</button>
            {search && <button className="btn small primary" onClick={nextVisit} disabled={search.done}>Next visit ▶</button>}
            {search && <span className="small">Order so far: <b>{search.order.slice(0, search.step + 1).map(i => labels[i]).join(', ')}</b></span>}
          </div>
        </div>

        <div>
          <div className="tabs" role="tablist" aria-label="Live views">
            {[['matrix', 'Matrix'], ['list', 'List'], ['incidence', 'Incidence'], ['edges', 'Edge list'], ['closure', 'Closure'], ['props', 'Properties']].map(([k, t]) => (
              <button key={k} role="tab" aria-selected={tab === k} aria-controls={`panel-${k}`} id={`tab-${k}`} onClick={() => setTab(k)}>{t}</button>
            ))}
          </div>
          <div className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {!g.vertices.length && <p className="muted">Click the canvas to add your first vertex.</p>}
            {g.vertices.length > 0 && tab === 'matrix' && (
              <>
                <p className="small muted">Adjacency matrix{opts.weighted ? ' (weights)' : P.parallel || P.hasLoop ? ' (number of edges)' : ''}. {g.directed ? 'Row = from, column = to.' : 'Undirected, so it is symmetric.'}</p>
                <Matrix m={opts.weighted ? weightMatrix(g) : countMatrix(g)} labels={labels} caption="Adjacency matrix" />
              </>
            )}
            {g.vertices.length > 0 && tab === 'list' && (
              <>
                <p className="small muted">Star table (Drozdek §8.1): each row lists the neighbours of one vertex.</p>
                <table className="plain"><tbody>{list.map((nb, i) => <tr key={i}><th scope="row" style={{ width: 50 }}>{labels[i]}</th><td>{nb.length ? nb.map(j => labels[j]).join(', ') : '–'}</td></tr>)}</tbody></table>
                <p className="small muted">Linked view: each vertex points at a chain of nodes.</p>
                <div className="stack small mono">{list.map((nb, i) => <div key={i}><b>{labels[i]}</b> → {nb.map(j => `[${labels[j]}|•]`).join(' → ')}{nb.length ? ' → ' : ''}∅</div>)}</div>
              </>
            )}
            {g.vertices.length > 0 && tab === 'incidence' && (
              <>
                <p className="small muted">Incidence matrix: one column per edge. A column with a single 1 is a loop.</p>
                {g.edges.length ? <Matrix m={inc} labels={labels} colLabels={g.edges.map((e, k) => <span key={k} title={edgeName(e)}>e{k + 1}</span>)} caption="Incidence matrix" /> : <p>No edges yet.</p>}
                {g.edges.length > 0 && <p className="small">{g.edges.map((e, k) => `e${k + 1} = ${edgeName(e)}`).join(' · ')}</p>}
              </>
            )}
            {tab === 'edges' && (
              <>
                <p className="small muted">Text view of the graph for screen readers and keyboard users.</p>
                <table className="plain"><thead><tr><th>Edge</th><th>From</th><th>To</th>{opts.weighted && <th>Weight</th>}<th /></tr></thead>
                  <tbody>{g.edges.map((e, k) => <tr key={e.id}><td>e{k + 1}</td><td>{g.vertices[idx.get(e.from)]?.label}</td><td>{g.vertices[idx.get(e.to)]?.label}</td>{opts.weighted && <td>{e.weight}</td>}<td><button className="btn small" onClick={() => removeEdge(e.id)} aria-label={`Delete edge ${edgeName(e)}`}>Delete</button></td></tr>)}</tbody></table>
                {!g.edges.length && <p>No edges yet.</p>}
              </>
            )}
            {g.vertices.length > 0 && tab === 'closure' && (
              trace ? (
                <>
                  <p className="small muted">{traceK < 0 ? 'R(0): the adjacency matrix. Press Step k.' : `After k = ${labels[traceK]}: yellow cells are new at this step.`} r(k)[i][j] = r(k−1)[i][j] OR (r(k−1)[i][k] AND r(k−1)[k][j])</p>
                  <Matrix m={trace[traceK + 1].matrix} labels={labels} changed={newest} kIndex={kIndex} caption="Warshall trace matrix" />
                  <p className="small">Step {traceK + 2} of {labels.length + 1}. {traceK === labels.length - 1 ? 'This is the closure.' : ''}</p>
                </>
              ) : (
                <>
                  <p className="small muted">Transitive closure R⁺: a 1 means a path of one or more edges. Dashed cells are pairs the closure adds.</p>
                  <Matrix m={R_} labels={labels} added={R_.flatMap((r, i) => r.map((x, j) => (x && !adj[i][j] ? [i, j] : null)).filter(Boolean))} caption="Closure matrix" />
                  <p className="small">Use <b>Step k</b> to build it one intermediate vertex at a time.</p>
                </>
              )
            )}
            {g.vertices.length > 0 && tab === 'props' && (
              <table className="plain"><tbody>
                <tr><th>|V|, |E|</th><td>{P.V} vertices, {P.E} edges</td></tr>
                <tr><th>Type</th><td>{P.directed ? 'Directed ' : 'Undirected '}{P.type}</td></tr>
                <tr><th>Degrees</th><td>{labels.map((l, i) => `${l}: ${P.degree[i]}${g.directed ? ` (in ${P.inDeg[i]}, out ${P.outDeg[i]})` : ''}`).join(' · ')}</td></tr>
                <tr><th>Sum of degrees</th><td>{P.degree.reduce((s, d) => s + d, 0)} = 2 × {P.E}</td></tr>
                <tr><th>Isolated</th><td>{P.isolated.length ? P.isolated.map(i => labels[i]).join(', ') : 'none'}</td></tr>
                <tr><th>Complete</th><td>{P.complete ? `yes, K${P.V}` : `no (K${P.V} needs ${P.directed ? `an edge each way between every pair: ${P.V * (P.V - 1)}` : P.V * (P.V - 1) / 2} edges, no loops or repeats)`}</td></tr>
                <tr><th>Connectivity</th><td>{P.connectivity}</td></tr>
                <tr><th>Cycle</th><td>{P.hasCycle ? 'yes' : 'no (acyclic)'}</td></tr>
              </tbody></table>
            )}
          </div>
          <div className="announce" aria-hidden="true"><b>🔊 Read aloud:</b><AnnounceText /></div>
          <p className="small muted" style={{ marginTop: 8 }}>Shortcuts: Ctrl+Z undo · Ctrl+Y redo · Delete removes the selection · Tab to a vertex, then arrow keys move it. Ask Graph Helper about your graph, e.g. “can a reach d?”.</p>
        </div>
      </div>
    </div>
  );
}

function AnnounceText() {
  const { message } = useApp();
  return <span>{message || 'Changes are described here and read aloud when Read aloud is on.'}</span>;
}
