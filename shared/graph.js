// Shared graph logic used by the React client, the Node.js server and the test generator.
// A graph is { directed, vertices: [{ id, label, x, y }], edges: [{ id, from, to, weight }] }.
// Vertex ids are stable strings; matrices are indexed by vertex position in g.vertices.

export function indexToLabel(i) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return i < 26 ? letters[i] : letters[i % 26] + Math.floor(i / 26);
}

export function emptyGraph(directed = true) {
  return { directed, vertices: [], edges: [] };
}

export function indexOf(g) {
  const m = new Map();
  g.vertices.forEach((v, i) => m.set(v.id, i));
  return m;
}

/** n x n matrix of edge counts. Undirected edges are counted in both cells; a loop counts once on the diagonal. */
export function countMatrix(g) {
  const n = g.vertices.length;
  const idx = indexOf(g);
  const a = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of g.edges) {
    const i = idx.get(e.from), j = idx.get(e.to);
    if (i === undefined || j === undefined) continue;
    a[i][j] += 1;
    if (!g.directed && i !== j) a[j][i] += 1;
  }
  return a;
}

export function boolMatrix(g) {
  return countMatrix(g).map(r => r.map(c => c > 0));
}

export function weightMatrix(g) {
  const n = g.vertices.length;
  const idx = indexOf(g);
  const a = Array.from({ length: n }, () => Array(n).fill(null));
  for (const e of g.edges) {
    const i = idx.get(e.from), j = idx.get(e.to);
    const w = e.weight ?? 1;
    if (a[i][j] === null || w < a[i][j]) a[i][j] = w;
    if (!g.directed && (a[j][i] === null || w < a[j][i])) a[j][i] = w;
  }
  return a;
}

/** Adjacency list: for each vertex index, sorted neighbour indices (repeats kept for multigraphs). */
export function adjacencyList(g) {
  const n = g.vertices.length;
  const idx = indexOf(g);
  const list = Array.from({ length: n }, () => []);
  for (const e of g.edges) {
    const i = idx.get(e.from), j = idx.get(e.to);
    list[i].push(j);
    if (!g.directed && i !== j) list[j].push(i);
  }
  list.forEach(l => l.sort((x, y) => x - y));
  return list;
}

/** Incidence matrix |V| x |E| (Drozdek §8.1): 1 if edge j is incident with vertex i. */
export function incidenceMatrix(g) {
  const idx = indexOf(g);
  const n = g.vertices.length;
  const m = Array.from({ length: n }, () => Array(g.edges.length).fill(0));
  g.edges.forEach((e, j) => {
    m[idx.get(e.from)][j] = 1;
    m[idx.get(e.to)][j] = 1;
  });
  return m;
}

/** Warshall's algorithm. R[i][j] is true when j can be reached from i by a path of one or more edges. */
export function closure(adj) {
  const n = adj.length;
  const r = adj.map(row => row.map(Boolean));
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      if (r[i][k])
        for (let j = 0; j < n; j++)
          if (r[k][j]) r[i][j] = true;
  return r;
}

/** Warshall's algorithm step by step: R(0) is the adjacency matrix, then one entry per k with the cells that changed. */
export function warshallTrace(adj) {
  const n = adj.length;
  let r = adj.map(row => row.map(Boolean));
  const steps = [{ k: -1, matrix: r.map(x => [...x]), changed: [] }];
  for (let k = 0; k < n; k++) {
    const next = r.map(x => [...x]);
    const changed = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (!r[i][j] && r[i][k] && r[k][j]) { next[i][j] = true; changed.push([i, j]); }
    r = next;
    steps.push({ k, matrix: r.map(x => [...x]), changed });
  }
  return steps;
}

/** Vertices reachable from s by a path of zero or more edges (DFS). Includes s. */
export function reachableFrom(adj, s) {
  const n = adj.length;
  const seen = Array(n).fill(false);
  const order = [];
  const visit = v => {
    seen[v] = true; order.push(v);
    for (let w = 0; w < n; w++) if (adj[v][w] && !seen[w]) visit(w);
  };
  if (s >= 0 && s < n) visit(s);
  return { seen, order };
}

export function bfsOrder(adj, s) {
  const n = adj.length;
  const seen = Array(n).fill(false);
  const order = [];
  const q = [s]; seen[s] = true;
  while (q.length) {
    const v = q.shift(); order.push(v);
    for (let w = 0; w < n; w++) if (adj[v][w] && !seen[w]) { seen[w] = true; q.push(w); }
  }
  return order;
}

/** Shortest path by number of edges (BFS), as a list of vertex indices, or null. Uses one or more edges. */
export function findPath(adj, s, t) {
  const n = adj.length;
  const prev = Array(n).fill(-1);
  const seen = Array(n).fill(false);
  const q = [];
  for (let w = 0; w < n; w++) if (adj[s][w] && !seen[w]) { seen[w] = true; prev[w] = s; q.push(w); }
  while (q.length) {
    const v = q.shift();
    if (v === t) break;
    for (let w = 0; w < n; w++) if (adj[v][w] && !seen[w]) { seen[w] = true; prev[w] = v; q.push(w); }
  }
  if (!seen[t]) return null;
  const path = [t];
  let cur = t;
  do { cur = prev[cur]; path.unshift(cur); } while (cur !== s);
  return path;
}

function components(n, edgesIdx) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  let cycle = false;
  for (const [i, j] of edgesIdx) {
    const a = find(i), b = find(j);
    if (a === b) cycle = true; else parent[a] = b;
  }
  const roots = new Set();
  for (let i = 0; i < n; i++) roots.add(find(i));
  return { count: roots.size, cycle };
}

/** Everything the properties tab, the chatbot and the checks need to know about a graph. */
export function properties(g) {
  const n = g.vertices.length;
  const counts = countMatrix(g);
  const adj = counts.map(r => r.map(c => c > 0));
  const idx = indexOf(g);
  const edgesIdx = g.edges.map(e => [idx.get(e.from), idx.get(e.to)]);
  const hasLoop = edgesIdx.some(([i, j]) => i === j);
  let parallel = false;
  const seen = new Set();
  for (const [i, j] of edgesIdx) {
    const key = g.directed ? `${i}>${j}` : `${Math.min(i, j)}-${Math.max(i, j)}`;
    if (seen.has(key)) parallel = true;
    seen.add(key);
  }
  const type = hasLoop ? 'pseudograph' : parallel ? 'multigraph' : 'simple graph';
  const degree = Array(n).fill(0), inDeg = Array(n).fill(0), outDeg = Array(n).fill(0);
  for (const [i, j] of edgesIdx) {
    outDeg[i]++; inDeg[j]++;
    degree[i]++; degree[j]++; // a loop adds 2 to its vertex's degree
  }
  const isolated = [];
  for (let i = 0; i < n; i++) if (degree[i] === 0) isolated.push(i);
  let complete = n > 0 && !hasLoop && !parallel;
  for (let i = 0; i < n && complete; i++)
    for (let j = 0; j < n && complete; j++)
      if (i !== j && !adj[i][j]) complete = false;
  const r = closure(adj);
  const undirectedComp = components(n, edgesIdx);
  let connectivity;
  if (n === 0) connectivity = 'empty';
  else if (!g.directed) connectivity = undirectedComp.count === 1 ? 'connected' : 'not connected';
  else {
    let strong = true;
    for (let i = 0; i < n && strong; i++)
      for (let j = 0; j < n && strong; j++)
        if (i !== j && !r[i][j]) strong = false;
    connectivity = strong ? 'strongly connected' : undirectedComp.count === 1 ? 'weakly connected' : 'not connected';
  }
  let hasCycle;
  if (g.directed) hasCycle = r.some((row, i) => row[i]);
  else hasCycle = undirectedComp.cycle;
  return {
    V: n, E: g.edges.length, directed: g.directed, type, hasLoop, parallel,
    degree, inDeg, outDeg, isolated, complete, connectivity, hasCycle,
    components: undirectedComp.count,
  };
}

/** The plain-text test format: "n m d" then one "u v" line per edge, vertices numbered from 0. */
export function toTestInput(g) {
  const idx = indexOf(g);
  const lines = [`${g.vertices.length} ${g.edges.length} ${g.directed ? 1 : 0}`];
  for (const e of g.edges) lines.push(`${idx.get(e.from)} ${idx.get(e.to)}`);
  return lines.join('\n') + '\n';
}

export function fromTestInput(text) {
  const tok = text.trim().split(/\s+/).map(Number);
  const [n, m, d] = tok;
  const g = emptyGraph(d === 1);
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / Math.max(n, 1);
    g.vertices.push({ id: `v${i}`, label: indexToLabel(i), x: 300 + 180 * Math.cos(ang), y: 220 + 160 * Math.sin(ang) });
  }
  for (let e = 0; e < m; e++) {
    const u = tok[3 + 2 * e], v = tok[4 + 2 * e];
    g.edges.push({ id: `e${e}`, from: `v${u}`, to: `v${v}`, weight: 1 });
  }
  return g;
}

/** Deterministic pseudo-random numbers so each learner gets their own but repeatable test graphs. */
export function seededRandom(seedText) {
  let h = 1779033703 ^ String(seedText).length;
  for (let i = 0; i < String(seedText).length; i++) {
    h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let s = h >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random graph as a boolean matrix. */
export function randomMatrix(rand, n, density, { directed = true, loops = false } = {}) {
  const a = Array.from({ length: n }, () => Array(n).fill(false));
  for (let i = 0; i < n; i++)
    for (let j = directed ? 0 : i; j < n; j++) {
      if (i === j && !loops) continue;
      if (rand() < density) { a[i][j] = true; if (!directed) a[j][i] = true; }
    }
  return a;
}

export function matrixToEdges(a, directed = true) {
  const edges = [];
  for (let i = 0; i < a.length; i++)
    for (let j = directed ? 0 : i; j < a.length; j++)
      if (a[i][j]) edges.push([i, j]);
  return edges;
}

export function graphFromMatrix(a, directed = true) {
  const g = emptyGraph(directed);
  const n = a.length;
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2;
    g.vertices.push({ id: `v${i}`, label: indexToLabel(i), x: 260 + 150 * Math.cos(ang), y: 200 + 140 * Math.sin(ang) });
  }
  matrixToEdges(a, directed).forEach(([i, j], k) => g.edges.push({ id: `e${k}`, from: `v${i}`, to: `v${j}`, weight: 1 }));
  return g;
}

export const matrixText = m => m.map(r => r.map(x => (x === true ? 1 : x === false ? 0 : x)).join(' ')).join('\n');
