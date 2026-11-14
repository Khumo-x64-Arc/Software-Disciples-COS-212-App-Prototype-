import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CANVAS, addEdge, addVertex, moveVertex, type Graph } from '../../../shared/graph-core.mjs';

export type CanvasHighlight = {
  vertices?: string[]; // e.g. the reached set
  frontier?: string[]; // waiting on the stack or queue
  current?: string | null; // the vertex being processed
  source?: string | null;
  edges?: [string, string][]; // tree edges or a path
  activeEdge?: [string, string] | null;
  closure?: [string, string][]; // dashed edges the closure adds
  newClosure?: [string, string][]; // closure edges added at this step (drawn thicker)
  marked?: string[]; // e.g. articulation points: drawn with a square outline
  tags?: Record<string, string>; // small labels beside vertices, like the slides' (num, low) or (path, dist)
};

export type Selection = { kind: 'vertex'; id: string } | { kind: 'edge'; id: string } | null;

type Props = {
  graph: Graph;
  editable?: boolean;
  connectMode?: boolean; // touch-friendly: dragging a vertex draws an edge instead of moving it
  onChange?: (g: Graph, announce: string, opts?: { transient?: boolean }) => void;
  selected?: Selection;
  onSelect?: (s: Selection) => void;
  onEditWeight?: (edgeId: string) => void;
  highlight?: CanvasHighlight;
  title: string;
};

const R = CANVAS.radius;
const key = (a: string, b: string) => `${a}>${b}`;

export function describeGraph(g: Graph): string {
  if (g.vertices.length === 0) return 'Empty graph.';
  const link = g.directed ? 'to' : 'and';
  const edges = g.edges.map(e => (e.from === e.to ? `loop at ${e.from}` : `${e.from} ${link} ${e.to}`) + (g.weighted ? `, weight ${e.weight}` : ''));
  return `${g.directed ? 'Directed' : 'Undirected'} graph with ${g.vertices.length} vertices (${g.vertices.map(v => v.id).join(', ')}) and ${g.edges.length} edges${edges.length ? ': ' + edges.join('; ') : ''}.`;
}

/**
 * The SVG graph canvas (design doc, "Build a graph"). Click empty canvas to add
 * a vertex; drag a vertex to move it; drag from its connector knob (or, in
 * Connect mode, from the vertex itself) to another vertex to add an edge; drag
 * back onto the same vertex for a loop; double-click an edge to set its weight.
 * Everything also works from the keyboard, and a text description is always present.
 */
export function GraphCanvas({ graph, editable = false, connectMode = false, onChange, selected, onSelect, onEditWeight, highlight = {}, title }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, '');
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);
  const byId = new Map(graph.vertices.map(v => [v.id, v]));

  const toSvg = (clientX: number, clientY: number) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const vertexAt = (x: number, y: number) => graph.vertices.find(v => Math.hypot(v.x - x, v.y - y) <= R + 6);

  const onBackgroundDown = (e: PointerEvent<SVGRectElement>) => {
    onSelect?.(null);
    if (!editable || !onChange) return;
    e.preventDefault();
    const p = toSvg(e.clientX, e.clientY);
    const r = addVertex(graph, p.x, p.y);
    if (r.id) {
      onChange(r.graph, `Vertex ${r.id} added.`);
      onSelect?.({ kind: 'vertex', id: r.id });
    } else onChange(graph, r.reason ?? 'No vertex added.');
  };

  const onVertexDown = (e: PointerEvent<Element>, id: string, fromKnob = false) => {
    e.stopPropagation();
    if (!editable) {
      onSelect?.({ kind: 'vertex', id });
      return;
    }
    e.preventDefault();
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    if (fromKnob || connectMode) setWire({ from: id, x: p.x, y: p.y });
    else {
      const v = byId.get(id)!;
      setDrag({ id, dx: v.x - p.x, dy: v.y - p.y, moved: false });
    }
  };

  const onMove = (e: PointerEvent<SVGElement>) => {
    if (!drag && !wire) return;
    const p = toSvg(e.clientX, e.clientY);
    if (wire) setWire({ ...wire, x: p.x, y: p.y });
    else if (drag && onChange) {
      const v = byId.get(drag.id)!;
      if (drag.moved || Math.hypot(v.x - (p.x + drag.dx), v.y - (p.y + drag.dy)) > 4) {
        if (!drag.moved) setDrag({ ...drag, moved: true });
        onChange(moveVertex(graph, drag.id, p.x + drag.dx, p.y + drag.dy), '', { transient: true });
      }
    }
  };

  const onUp = (e: PointerEvent<SVGElement>) => {
    if (wire && onChange) {
      const p = toSvg(e.clientX, e.clientY);
      const target = vertexAt(p.x, p.y);
      // A press and release on the same vertex without moving away just selects it.
      const moved = Math.hypot(byId.get(wire.from)!.x - p.x, byId.get(wire.from)!.y - p.y) > R;
      if (target && (target.id !== wire.from || moved)) {
        const r = addEdge(graph, wire.from, target.id);
        const arrow = graph.directed ? '→' : '–';
        if (r.ok) onChange(r.graph, wire.from === target.id ? `Loop at ${target.id} added.` : `Edge ${wire.from} ${arrow} ${target.id} added.`);
        else onChange(graph, r.reason ?? 'No edge added.');
      } else if (target) onSelect?.({ kind: 'vertex', id: target.id });
      setWire(null);
    } else if (drag) {
      if (drag.moved) onChange?.(graph, `Vertex ${drag.id} moved.`);
      else onSelect?.({ kind: 'vertex', id: drag.id });
      setDrag(null);
    }
  };

  const onVertexKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.({ kind: 'vertex', id });
      return;
    }
    if (!editable || !onChange) return;
    const step = e.shiftKey ? 40 : 12;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key] && e.altKey) {
      e.preventDefault();
      const v = byId.get(id)!;
      onChange(moveVertex(graph, id, v.x + moves[e.key][0], v.y + moves[e.key][1]), `Vertex ${id} moved.`);
    }
  };

  // ---- drawing ----
  const reached = new Set(highlight.vertices ?? []);
  const frontier = new Set(highlight.frontier ?? []);
  const both = (list: [string, string][] | undefined | null) => new Set((list ?? []).flatMap(([a, b]) => (graph.directed ? [key(a, b)] : [key(a, b), key(b, a)])));
  const hiEdges = both(highlight.edges);
  const active = both(highlight.activeEdge ? [highlight.activeEdge] : []);
  const fresh = both(highlight.newClosure);

  // Group parallel edges (and the two directions of a pair) so each gets its own curve.
  const pairCount = new Map<string, number>();
  for (const e of graph.edges) {
    const k = [e.from, e.to].sort().join('|');
    pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
  }
  const pairIndex = new Map<string, number>();

  const edgePath = (u: string, v: string, idx: number, count: number) => {
    const a = byId.get(u)!, b = byId.get(v)!;
    if (u === v) {
      const s = 1 + idx * 0.35;
      return { d: `M${a.x - 9} ${a.y - R + 3} C ${a.x - 34 * s} ${a.y - 62 * s}, ${a.x + 34 * s} ${a.y - 62 * s}, ${a.x + 9} ${a.y - R + 3}`, lx: a.x, ly: a.y - 50 * s };
    }
    // Measure the bend in a fixed direction (smaller label first) so the two
    // directions of a pair curve to opposite sides.
    const [p, q] = u < v ? [a, b] : [b, a];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nxu = -dy / len, nyu = dx / len;
    const bend = count > 1 ? (idx - (count - 1) / 2) * 38 : 0;
    const mx = (a.x + b.x) / 2 + nxu * bend, my = (a.y + b.y) / 2 + nyu * bend;
    // Trim the ends to the circle edges, aiming at the control point.
    const trim = (from: { x: number; y: number }, toX: number, toY: number, r: number) => {
      const ddx = toX - from.x, ddy = toY - from.y;
      const l = Math.hypot(ddx, ddy) || 1;
      return { x: from.x + (ddx / l) * r, y: from.y + (ddy / l) * r };
    };
    const s = trim(a, bend ? mx : b.x, bend ? my : b.y, R);
    const t = trim(b, bend ? mx : a.x, bend ? my : a.y, graph.directed ? R + 3 : R);
    const lx = (a.x + b.x) / 2 + nxu * (bend * 0.55 + (bend >= 0 ? 13 : -13));
    const ly = (a.y + b.y) / 2 + nyu * (bend * 0.55 + (bend >= 0 ? 13 : -13));
    return { d: bend ? `M${s.x} ${s.y} Q ${mx} ${my} ${t.x} ${t.y}` : `M${s.x} ${s.y} L${t.x} ${t.y}`, lx, ly };
  };

  const description = describeGraph(graph);
  const closure = (highlight.closure ?? []).filter(([a, b]) => byId.has(a) && byId.has(b));

  return (
    <figure className="gc">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
        className={`gc-svg ${editable ? 'editable' : ''} ${connectMode ? 'connect' : ''}`}
        role="group"
        aria-label={title}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        <title>{title}</title>
        <desc>{description}</desc>
        <defs>
          {['ink', 'hi', 'closure', 'active'].map(t => (
            <marker key={t} id={`${uid}-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className={`gc-head gc-head-${t}`} />
            </marker>
          ))}
        </defs>
        <rect x="0" y="0" width={CANVAS.width} height={CANVAS.height} className="gc-bg" onPointerDown={onBackgroundDown} />

        {closure.map(([a, b]) => {
          const pk = [a, b].sort().join('|');
          const existing = pairCount.get(pk) ?? 0;
          const { d, lx, ly } = edgePath(a, b, existing + (a < b ? 0 : 1), existing + 2);
          const isNew = fresh.has(key(a, b));
          return (
            <g key={`c-${a}-${b}`} className={`gc-closure ${isNew ? 'new' : ''}`} aria-hidden>
              <path d={d} fill="none" markerEnd={graph.directed ? `url(#${uid}-closure)` : undefined} />
              {a !== b && <text x={lx} y={ly + 5} textAnchor="middle" className="gc-closure-label">+</text>}
            </g>
          );
        })}

        {graph.edges.map(e => {
          if (!byId.has(e.from) || !byId.has(e.to)) return null;
          const pk = [e.from, e.to].sort().join('|');
          const idx = pairIndex.get(pk) ?? 0;
          pairIndex.set(pk, idx + 1);
          const count = pairCount.get(pk) ?? 1;
          const { d, lx, ly } = edgePath(e.from, e.to, idx, count);
          const isSel = selected?.kind === 'edge' && selected.id === e.id;
          const tone = active.has(key(e.from, e.to)) ? 'active' : hiEdges.has(key(e.from, e.to)) ? 'hi' : 'ink';
          return (
            <g
              key={e.id}
              className={`gc-edge tone-${tone} ${isSel ? 'selected' : ''}`}
              onPointerDown={ev => {
                ev.stopPropagation();
                onSelect?.({ kind: 'edge', id: e.id });
              }}
              onDoubleClick={() => editable && onEditWeight?.(e.id)}
            >
              <path d={d} className="gc-edge-hit" fill="none" />
              <path d={d} className="gc-edge-line" fill="none" markerEnd={graph.directed ? `url(#${uid}-${tone})` : undefined} />
              {graph.weighted && (
                <g className="gc-weight">
                  <rect x={lx - 16} y={ly - 11} width="32" height="22" rx="6" />
                  <text x={lx} y={ly + 5} textAnchor="middle">{e.weight < 0 ? `−${-e.weight}` : e.weight}</text>
                </g>
              )}
            </g>
          );
        })}

        {wire && byId.has(wire.from) && <line className="gc-wire" x1={byId.get(wire.from)!.x} y1={byId.get(wire.from)!.y} x2={wire.x} y2={wire.y} />}

        {graph.vertices.map(v => {
          const isSel = selected?.kind === 'vertex' && selected.id === v.id;
          const isCurrent = highlight.current === v.id;
          const states = [isCurrent && 'current', reached.has(v.id) && 'reached', frontier.has(v.id) && 'waiting', highlight.source === v.id && 'start', highlight.marked?.includes(v.id) && 'marked', highlight.tags?.[v.id]].filter(Boolean);
          const cls = ['gc-v', isSel && 'selected', isCurrent && 'current', reached.has(v.id) && 'reached', frontier.has(v.id) && 'frontier', highlight.source === v.id && 'source'].filter(Boolean).join(' ');
          return (
            <g
              key={v.id}
              className={cls}
              transform={`translate(${v.x} ${v.y})`}
              tabIndex={0}
              role="button"
              aria-label={`Vertex ${v.id}${states.length ? ', ' + states.join(', ') : ''}`}
              aria-pressed={isSel}
              onPointerDown={e => onVertexDown(e, v.id)}
              onKeyDown={e => onVertexKey(e, v.id)}
            >
              <circle r={R} />
              {/* Shape cues as well as colour: a ring for reached, a dashed ring for waiting. */}
              {highlight.marked?.includes(v.id) && <rect x={-R - 8} y={-R - 8} width={2 * R + 16} height={2 * R + 16} rx="4" className="gc-mark" />}
              {reached.has(v.id) && <circle r={R + 5} className="gc-ring" />}
              {frontier.has(v.id) && !reached.has(v.id) && <circle r={R + 5} className="gc-ring dashed" />}
              <text y="6" textAnchor="middle" className="gc-label">{v.id}</text>
              {isCurrent && <text y={R + 18} textAnchor="middle" className="gc-tag">current</text>}
              {highlight.tags?.[v.id] && <text x={R + 4} y={-R + 2} className="gc-vtag">{highlight.tags[v.id]}</text>}
              {editable && (
                <circle className="gc-knob" cx={R * 0.75} cy={R * 0.75} r="7" onPointerDown={e => onVertexDown(e, v.id, true)}>
                  <title>Drag to another vertex to add an edge</title>
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}
