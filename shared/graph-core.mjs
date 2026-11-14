// Graph engine for the COS212 Graphs & Transitive Closure app.
// Shared by the Node.js back end (hidden-test answers, Graph Helper's exact
// answers) and the React front end (Build a graph page, traces), so both always
// agree. Terminology and conventions follow Drozdek (2010), Chapter 8.
//
// A graph: { directed, weighted, allowLoops, allowMulti, vertices: [{id,x,y}],
//            edges: [{id, from, to, weight}], nextEdge }
// Vertices are labelled a, b, c, … as in Drozdek.

const LABELS = 'abcdefghijklmnopqrstuvwxyz';
export const MAX_VERTICES = 12;
export const CANVAS = { width: 600, height: 380, radius: 22 };

export function emptyGraph(opts = {}) {
  return { directed: true, weighted: false, allowLoops: false, allowMulti: false, ...opts, vertices: [], edges: [], nextEdge: 1 };
}

export const ids = g => g.vertices.map(v => v.id);
const indexOf = g => new Map(g.vertices.map((v, i) => [v.id, i]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function nextLabel(g) {
  for (const l of LABELS) if (!g.vertices.some(v => v.id === l)) return l;
  return null;
}

// ---------- ADT operations (each returns a new graph) ----------

export function addVertex(g, x = CANVAS.width / 2, y = CANVAS.height / 2) {
  if (g.vertices.length >= MAX_VERTICES) return { graph: g, id: null, reason: `At most ${MAX_VERTICES} vertices.` };
  const id = nextLabel(g);
  const r = CANVAS.radius;
  const v = { id, x: clamp(x, r, CANVAS.width - r), y: clamp(y, r, CANVAS.height - r) };
  return { graph: { ...g, vertices: [...g.vertices, v] }, id };
}

export function moveVertex(g, id, x, y) {
  const r = CANVAS.radius;
  return { ...g, vertices: g.vertices.map(v => (v.id === id ? { ...v, x: clamp(x, r, CANVAS.width - r), y: clamp(y, r, CANVAS.height - r) } : v)) };
}

export function removeVertex(g, id) {
  return { ...g, vertices: g.vertices.filter(v => v.id !== id), edges: g.edges.filter(e => e.from !== id && e.to !== id) };
}

const samePair = (g, e, u, v) => (e.from === u && e.to === v) || (!g.directed && e.from === v && e.to === u);

/** Adds an edge, respecting the Loops and Multi-edges settings. */
export function addEdge(g, from, to, weight = 1) {
  if (!g.vertices.some(v => v.id === from) || !g.vertices.some(v => v.id === to)) return { graph: g, ok: false, reason: 'Both vertices must exist.' };
  if (from === to && !g.allowLoops) return { graph: g, ok: false, reason: 'Loops are off. Turn on Loops to add an edge from a vertex to itself.' };
  const existing = g.edges.find(e => samePair(g, e, from, to));
  if (existing && !g.allowMulti) {
    if (g.weighted && existing.weight !== weight) {
      return { graph: { ...g, edges: g.edges.map(e => (e === existing ? { ...e, weight } : e)) }, ok: true, updated: true, edge: { ...existing, weight } };
    }
    return { graph: g, ok: false, reason: 'That edge already exists. Turn on Multi-edges to add a parallel edge.' };
  }
  const edge = { id: `e${g.nextEdge}`, from, to, weight };
  return { graph: { ...g, edges: [...g.edges, edge], nextEdge: g.nextEdge + 1 }, ok: true, edge };
}

export function removeEdge(g, edgeId) {
  return { ...g, edges: g.edges.filter(e => e.id !== edgeId) };
}

export function setWeight(g, edgeId, weight) {
  return { ...g, edges: g.edges.map(e => (e.id === edgeId ? { ...e, weight } : e)) };
}

export function hasEdge(g, u, v) {
  return g.edges.some(e => samePair(g, e, u, v));
}

/** Out-neighbours (directed) or neighbours (undirected), in label order, no repeats. */
export function neighbours(g, u) {
  const out = new Set();
  for (const e of g.edges) {
    if (e.from === u) out.add(e.to);
    if (!g.directed && e.to === u) out.add(e.from);
  }
  return [...out].sort();
}

/** Degree. Undirected: a loop counts twice (Drozdek). Directed: in and out. */
export function degrees(g) {
  const deg = {}, indeg = {}, outdeg = {};
  for (const v of g.vertices) { deg[v.id] = 0; indeg[v.id] = 0; outdeg[v.id] = 0; }
  for (const e of g.edges) {
    outdeg[e.from] += 1;
    indeg[e.to] += 1;
    deg[e.from] += 1;
    deg[e.to] += 1; // a loop adds 2
  }
  return { deg, indeg, outdeg };
}

// ---------- Representations (Drozdek §8.1) ----------

/** Adjacency matrix. Entry = number of edges (multigraph form), or weight in weighted mode. */
export function adjacencyMatrix(g, mode = 'count') {
  const n = g.vertices.length;
  const idx = indexOf(g);
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of g.edges) {
    const i = idx.get(e.from), j = idx.get(e.to);
    if (mode === 'weight') {
      m[i][j] = e.weight;
      if (!g.directed) m[j][i] = e.weight;
    } else {
      m[i][j] += 1;
      if (!g.directed && i !== j) m[j][i] += 1;
    }
  }
  return m;
}

export function booleanMatrix(g) {
  return adjacencyMatrix(g).map(row => row.map(x => (x > 0 ? 1 : 0)));
}

/** Adjacency list: for each vertex, the edges leaving it (both ends for undirected). */
export function adjacencyList(g) {
  return g.vertices.map(v => ({
    id: v.id,
    list: g.edges
      .filter(e => e.from === v.id || (!g.directed && e.to === v.id))
      .map(e => ({ to: e.from === v.id ? e.to : e.from, weight: e.weight, edgeId: e.id }))
      .sort((a, b) => a.to.localeCompare(b.to)),
  }));
}

/**
 * Star representation, forward table (Drozdek §8.1): one array lists every
 * vertex's neighbours back to back; start[i] is where vertex i's run begins
 * (start has n + 1 entries so start[i + 1] marks the end).
 */
export function starForward(g) {
  const list = adjacencyList(g);
  const start = [];
  const nbrs = [];
  for (const row of list) {
    start.push(nbrs.length);
    for (const x of row.list) nbrs.push(x.to);
  }
  start.push(nbrs.length);
  return { start, neighbours: nbrs };
}

/**
 * Incidence matrix, |V| × |E| (Drozdek §8.1). Undirected: 1 where the vertex
 * touches the edge; a loop's column has a single 1. Directed: 1 at the tail,
 * −1 at the head; a loop shows a single 1.
 */
export function incidenceMatrix(g) {
  const idx = indexOf(g);
  const m = g.vertices.map(() => g.edges.map(() => 0));
  g.edges.forEach((e, c) => {
    const i = idx.get(e.from), j = idx.get(e.to);
    m[i][c] = 1;
    if (i !== j) m[j][c] = g.directed ? -1 : 1;
  });
  return { rows: ids(g), cols: g.edges.map(e => e.id), cells: m };
}

/** Plain-text edge list: the screen-reader view of the graph. */
export function edgeListText(g) {
  if (!g.vertices.length) return 'The graph is empty.';
  const arrow = g.directed ? '→' : '—';
  const edges = g.edges.map(e => `${e.from} ${arrow} ${e.to}${g.weighted ? ` (weight ${e.weight})` : ''}`);
  return `${g.vertices.length} vertices: ${ids(g).join(', ')}. ${g.edges.length} edge${g.edges.length === 1 ? '' : 's'}${edges.length ? `: ${edges.join('; ')}` : ''}.`;
}

// ---------- Properties (Drozdek Ch. 8 intro, §8.6) ----------

function undirectedComponents(g) {
  const parent = new Map(ids(g).map(v => [v, v]));
  const find = v => (parent.get(v) === v ? v : (parent.set(v, find(parent.get(v))), parent.get(v)));
  for (const e of g.edges) parent.set(find(e.from), find(e.to));
  return new Set(ids(g).map(find)).size;
}

export function reachableFrom(g, s) {
  const seen = new Set([s]);
  const stack = [s];
  while (stack.length) {
    const u = stack.pop();
    for (const w of neighbours(g, u)) if (!seen.has(w)) { seen.add(w); stack.push(w); }
  }
  return seen;
}

function hasCycle(g) {
  if (g.edges.some(e => e.from === e.to)) return true;
  if (!g.directed) {
    // parallel edges form a 2-cycle; otherwise a cycle exists iff E > V − components
    const pairs = new Set();
    for (const e of g.edges) {
      const k = [e.from, e.to].sort().join('|');
      if (pairs.has(k)) return true;
      pairs.add(k);
    }
    return g.edges.length > g.vertices.length - undirectedComponents(g);
  }
  const state = new Map();
  const visit = u => {
    state.set(u, 1);
    for (const w of neighbours(g, u)) {
      if (state.get(w) === 1) return true;
      if (!state.get(w) && visit(w)) return true;
    }
    state.set(u, 2);
    return false;
  };
  return ids(g).some(v => !state.get(v) && visit(v));
}

export function properties(g) {
  const n = g.vertices.length;
  const { deg, indeg, outdeg } = degrees(g);
  const loops = g.edges.some(e => e.from === e.to);
  const pairCounts = new Map();
  for (const e of g.edges) {
    const k = g.directed ? `${e.from}>${e.to}` : [e.from, e.to].sort().join('|');
    pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1);
  }
  const parallel = [...pairCounts.values()].some(c => c > 1);
  const kind = loops ? 'pseudograph' : parallel ? 'multigraph' : 'simple graph';
  const isolated = ids(g).filter(v => deg[v] === 0);
  let complete = n > 0;
  for (const u of ids(g)) for (const v of ids(g)) if (u !== v && !hasEdge(g, u, v)) complete = false;
  let connectivity;
  if (n <= 1) connectivity = n === 0 ? 'empty' : g.directed ? 'strongly connected' : 'connected';
  else if (!g.directed) connectivity = undirectedComponents(g) === 1 ? 'connected' : 'unconnected';
  else {
    const strong = ids(g).every(v => reachableFrom(g, v).size === n);
    connectivity = strong ? 'strongly connected' : undirectedComponents(g) === 1 ? 'weakly connected' : 'unconnected';
  }
  const cyclic = hasCycle(g);
  const isTree = !g.directed && n > 0 && connectivity === 'connected' && !cyclic;
  const knEdges = (n * (n - 1)) / (g.directed ? 1 : 2);
  return {
    vertices: n, edges: g.edges.length, directed: g.directed, weighted: g.weighted,
    kind, loops, parallel, complete, connectivity, cyclic, isTree, isolated,
    deg, indeg, outdeg, degreeSum: Object.values(deg).reduce((a, b) => a + b, 0), knEdges,
  };
}

/** One sentence describing the graph's type, used by the live label and read-aloud. */
export function typeSentence(p) {
  if (!p.vertices) return 'Empty graph.';
  const parts = [p.directed ? 'Directed' : 'Undirected', p.weighted ? 'weighted' : 'unweighted', p.kind, p.cyclic ? 'cyclic' : 'acyclic', p.connectivity];
  if (p.complete) parts.push(`complete (K${p.vertices}${p.directed ? ', both directions' : ''})`);
  if (p.isTree) parts.push('a tree');
  return parts.join(', ') + '.';
}

// ---------- Traversals (Drozdek §8.2) ----------

/** Recursive depth-first search from s, neighbours in label order; one step per action. */
export function dfsTrace(g, s) {
  const visited = [];
  const seen = new Set();
  const stack = [];
  const steps = [];
  const snap = (note, current, edge = null, tone = 'tree') =>
    steps.push({ note, current, edge, tone, reached: [...visited], frontier: [...stack] });
  const visit = (u, from) => {
    seen.add(u);
    visited.push(u);
    stack.push(u);
    snap(from ? `Go from ${from} to ${u}. Mark ${u} as visited.` : `Start at ${u}. Mark it as visited.`, u, from ? [from, u] : null);
    for (const w of neighbours(g, u)) {
      if (seen.has(w)) snap(`${u} → ${w}: ${w} is already visited, so skip it. Without this mark, a cycle would loop forever.`, u, [u, w], 'skip');
      else visit(w, u);
    }
    stack.pop();
    snap(`${u} has no unvisited neighbours left. Return${stack.length ? ` to ${stack[stack.length - 1]}` : ''}.`, stack[stack.length - 1] ?? null);
  };
  visit(s, null);
  snap(`Done. ${s} reaches ${visited.length - 1} other vertex${visited.length === 2 ? '' : 'es'}: {${visited.join(', ')}}.`, null);
  return { steps, order: visited };
}

/** Breadth-first search from s with a queue. */
export function bfsTrace(g, s) {
  const order = [];
  const seen = new Set([s]);
  const queue = [s];
  const steps = [];
  const snap = (note, current, edge = null, tone = 'tree') =>
    steps.push({ note, current, edge, tone, reached: [...seen], frontier: [...queue] });
  snap(`Start at ${s}. Put it in the queue.`, null);
  while (queue.length) {
    const u = queue.shift();
    order.push(u);
    snap(`Take ${u} from the front of the queue.`, u);
    for (const w of neighbours(g, u)) {
      if (seen.has(w)) snap(`${u} → ${w}: ${w} is already reached, skip.`, u, [u, w], 'skip');
      else {
        seen.add(w);
        queue.push(w);
        snap(`${u} → ${w}: ${w} is new. Add it to the back of the queue.`, u, [u, w]);
      }
    }
  }
  snap(`Done. Reached {${order.join(', ')}}.`, null);
  return { steps, order };
}

// ---------- Transitive closure ----------
// r[i][j] = 1 when there is a path of one or more edges from i to j. So a
// diagonal entry is 1 only when the vertex lies on a cycle (Drozdek §8.3.1).
// In an undirected graph every edge is a two-step round trip, so any vertex
// with an edge reaches itself.

/** Closure by running a search from every vertex (the "repeated DFS" method). */
export function closureByDFS(g) {
  const n = g.vertices.length;
  const idx = indexOf(g);
  const r = Array.from({ length: n }, () => Array(n).fill(0));
  ids(g).forEach((s, i) => {
    const seen = new Set();
    const stack = [...neighbours(g, s)];
    while (stack.length) {
      const u = stack.pop();
      if (seen.has(u)) continue;
      seen.add(u);
      r[i][idx.get(u)] = 1;
      for (const w of neighbours(g, u)) if (!seen.has(w)) stack.push(w);
    }
  });
  return r;
}

/** Warshall's algorithm on a 0/1 matrix, in place, k outermost. */
export function warshall(adj) {
  const n = adj.length;
  const r = adj.map(row => row.map(x => (x ? 1 : 0)));
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      if (r[i][k]) for (let j = 0; j < n; j++) if (r[k][j]) r[i][j] = 1;
  return r;
}

/** The classic mistake: k as the innermost loop. Misses longer chains. */
export function warshallKInnermost(adj) {
  const n = adj.length;
  const r = adj.map(row => row.map(x => (x ? 1 : 0)));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) if (r[i][k] && r[k][j]) r[i][j] = 1;
  return r;
}

/**
 * Warshall's trace: R(0) is the adjacency relation; R(k) also allows the first
 * k vertices as stops. Each step records the cells that changed and why.
 */
export function warshallTrace(g) {
  const labels = ids(g);
  const n = labels.length;
  const r = booleanMatrix(g);
  const steps = [{ k: null, matrix: r.map(row => [...row]), changed: [], note: `R(0) is the adjacency matrix: a 1 means there is an edge. No intermediate stops are allowed yet.` }];
  for (let k = 0; k < n; k++) {
    const changed = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (!r[i][j] && r[i][k] && r[k][j]) changed.push({ i, j });
    for (const { i, j } of changed) r[i][j] = 1;
    const kl = labels[k];
    const reasons = changed.map(({ i, j }) => `${labels[i]} now reaches ${labels[j]} (${labels[i]} reaches ${kl}, ${kl} reaches ${labels[j]})`);
    steps.push({
      k,
      matrix: r.map(row => [...row]),
      changed,
      note: changed.length
        ? `k = ${kl}: ${reasons.join('; ')}.`
        : `k = ${kl}: going through ${kl} adds nothing new.`,
    });
  }
  const added = steps.reduce((s, x) => s + x.changed.length, 0);
  steps.push({ k: 'done', matrix: r.map(row => [...row]), changed: [], note: `Done after ${n} values of k. The closure added ${added} pair${added === 1 ? '' : 's'}.` });
  return steps;
}

/** Pairs (u, v) in the closure that are not already edges: drawn dashed. */
export function closureAddedPairs(g) {
  const labels = ids(g);
  const adj = booleanMatrix(g);
  const r = warshall(adj);
  const out = [];
  for (let i = 0; i < labels.length; i++)
    for (let j = 0; j < labels.length; j++)
      if (r[i][j] && !adj[i][j]) out.push([labels[i], labels[j]]);
  return out;
}

// ---------- Fitchfork-style text format ----------
// Line 1: n m d (d = 1 directed). Then m lines "u v", vertices numbered from 0.

export function exportText(g) {
  const idx = indexOf(g);
  const lines = [`${g.vertices.length} ${g.edges.length} ${g.directed ? 1 : 0}`];
  for (const e of g.edges) lines.push(`${idx.get(e.from)} ${idx.get(e.to)}`);
  return lines.join('\n') + '\n';
}

export function parseText(text, opts = {}) {
  const nums = String(text).trim().split(/\s+/).map(Number);
  const [n, m, d] = nums;
  if (!Number.isInteger(n) || !Number.isInteger(m) || n < 0 || n > MAX_VERTICES) throw new Error(`First line must be "n m d" with n ≤ ${MAX_VERTICES}.`);
  let g = emptyGraph({ directed: d === 1, allowLoops: true, allowMulti: true, ...opts });
  const pos = circleLayout(n);
  for (let i = 0; i < n; i++) g = addVertex(g, pos[i].x, pos[i].y).graph;
  for (let k = 0; k < m; k++) {
    const u = nums[3 + 2 * k], v = nums[4 + 2 * k];
    if (!(u >= 0 && u < n && v >= 0 && v < n)) throw new Error(`Edge ${k + 1} uses a vertex outside 0..${n - 1}.`);
    g = addEdge(g, LABELS[u], LABELS[v]).graph;
  }
  return g;
}

export function matrixText(r) {
  return r.map(row => row.join(' ')).join('\n') + '\n';
}

// ---------- Generators ----------

/** Small seeded random generator (mulberry32), so fresh questions are repeatable. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function circleLayout(n) {
  const cx = CANVAS.width / 2, cy = CANVAS.height / 2;
  const rad = Math.min(cx, cy) - 50;
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(cx + rad * Math.cos((2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2)),
    y: Math.round(cy + rad * Math.sin((2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2)),
  }));
}

export function randomGraph({ n, density = 0.3, directed = true, loops = false, seed = 1 }) {
  const rand = rng(seed);
  let g = emptyGraph({ directed, allowLoops: loops });
  const pos = circleLayout(n);
  for (let i = 0; i < n; i++) g = addVertex(g, pos[i].x, pos[i].y).graph;
  const labels = ids(g);
  for (let i = 0; i < n; i++)
    for (let j = directed ? 0 : i + 1; j < n; j++) {
      if (i === j && !loops) continue;
      if (rand() < density) g = addEdge(g, labels[i], labels[j]).graph;
    }
  return g;
}

/** Plain adjacency-matrix and adjacency-list forms of a random graph, for the timing lab. */
export function randomAdjacency(n, density, seed = 1) {
  const rand = rng(seed);
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  const lists = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j && rand() < density) {
        m[i][j] = 1;
        lists[i].push(j);
      }
  return { matrix: m, lists };
}

/** Repeated DFS closure on adjacency lists (timing lab version, numbers not labels). */
export function closureFromLists(lists) {
  const n = lists.length;
  const r = Array.from({ length: n }, () => new Uint8Array(n));
  const stack = new Int32Array(n * n + n);
  for (let s = 0; s < n; s++) {
    const seen = r[s];
    let top = 0;
    for (const w of lists[s]) stack[top++] = w;
    while (top) {
      const u = stack[--top];
      if (seen[u]) continue;
      seen[u] = 1;
      for (const w of lists[u]) if (!seen[w]) stack[top++] = w;
    }
  }
  return r;
}

/** Repeated DFS closure using the matrix to find neighbours: O(V³). */
export function closureFromMatrixDFS(m) {
  const n = m.length;
  const r = Array.from({ length: n }, () => new Uint8Array(n));
  const stack = new Int32Array(n * n + n);
  for (let s = 0; s < n; s++) {
    const seen = r[s];
    let top = 0;
    for (let w = 0; w < n; w++) if (m[s][w]) stack[top++] = w;
    while (top) {
      const u = stack[--top];
      if (seen[u]) continue;
      seen[u] = 1;
      for (let w = 0; w < n; w++) if (m[u][w] && !seen[w]) stack[top++] = w;
    }
  }
  return r;
}

export { LABELS };
