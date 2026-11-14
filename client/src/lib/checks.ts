// Multiple-choice question generators from the earlier units (graph types,
// representations, operations, traversals and transitive closure). The quiz bank
// (quizBank.ts) reuses them alongside its own fill-in and drag-and-drop questions.
// Every attempt draws fresh questions from a new seed. Each wrong option can
// name a misconception id, which the lecturer dashboard counts.
import {
  addEdge, bfsTrace, booleanMatrix, dfsTrace, ids, properties,
  reachableFrom, rng, warshall, warshallTrace, type Graph,
} from '../../../shared/graph-core.mjs';

import { fromPairs, graphWith, opts, pick, set, shuffle, type Option, type Question, type Rand } from './checkKit';

export type { Option, Question };

// ---------------------------------------------------------------------------
const U1 = (r: Rand): Question[] => {
  const g = graphWith(r, { n: 5, directed: false, density: 0.45, min: 4 });
  // Give one vertex a loop for the degree question.
  const L = ids(g);
  const lv = pick(r, L);
  const gl = addEdge({ ...g, allowLoops: true }, lv, lv).graph;
  const p = properties(gl);
  const loopsAt = 1;
  const n = pick(r, [5, 6, 7, 8]);
  const kn = (n * (n - 1)) / 2;
  const kinds: { g: Graph; kind: string }[] = [
    { g: fromPairs(4, [[0, 1], [1, 2], [2, 3]], false), kind: 'simple graph' },
    { g: fromPairs(4, [[0, 1], [0, 1], [1, 2], [2, 3]], false), kind: 'multigraph' },
    { g: fromPairs(4, [[0, 1], [1, 1], [1, 2], [2, 3]], false), kind: 'pseudograph' },
  ];
  const k = pick(r, kinds);
  const tree = fromPairs(5, [[0, 1], [0, 2], [2, 3], [2, 4]], false);
  const notTree = fromPairs(5, [[0, 1], [1, 2], [2, 0], [3, 4]], false);
  const t = pick(r, [tree, notTree]);
  const isTree = t === tree;
  return [
    {
      id: 'u1-deg',
      prompt: `In this undirected graph, what is the degree of ${lv}? (It has a loop.)`,
      graph: gl,
      options: opts(r, [
        { text: String(p.deg[lv]), correct: true },
        { text: String(p.deg[lv] - loopsAt), misconception: 'loop-degree', why: 'That counts the loop once.' },
        { text: String(p.deg[lv] - 2 * loopsAt), why: 'That ignores the loop.' },
        { text: String(p.deg[lv] + 1) },
      ]),
      explain: `A loop has both ends at ${lv}, so it adds 2 to the degree. deg(${lv}) = ${p.deg[lv]}.`,
    },
    {
      id: 'u1-kn',
      prompt: `How many edges does the complete graph K${'₀₁₂₃₄₅₆₇₈₉'[n]} have?`,
      options: opts(r, [
        { text: String(kn), correct: true },
        { text: String(n * (n - 1)), misconception: 'kn-edges', why: 'That counts every edge twice, once from each end.' },
        { text: String(n * n) },
        { text: String(n - 1) },
      ]),
      explain: `Each of the ${n} vertices joins ${n - 1} others, but that counts every edge from both ends: ${n} × ${n - 1} / 2 = ${kn}.`,
    },
    {
      id: 'u1-kind',
      prompt: 'What kind of graph is this?',
      graph: k.g,
      options: opts(r, [
        { text: k.kind, correct: true },
        ...['simple graph', 'multigraph', 'pseudograph', 'complete graph'].filter(x => x !== k.kind).map(text => ({ text })),
      ]),
      explain: 'A simple graph has no loops and no parallel edges. A multigraph allows parallel edges. A pseudograph also allows loops (Drozdek p. 377).',
    },
    {
      id: 'u1-sum',
      prompt: `An undirected graph has ${p.edges} edges. What is the sum of all its degrees?`,
      options: opts(r, [{ text: String(2 * p.edges), correct: true }, { text: String(p.edges), misconception: 'kn-edges' }, { text: String(p.edges + p.vertices) }, { text: String(p.edges * p.vertices) }]),
      explain: 'Every edge has two ends and each end adds 1 to a degree, so the sum is 2E.',
    },
    {
      id: 'u1-tree',
      prompt: 'Is this graph a tree?',
      graph: t,
      options: opts(r, [
        { text: isTree ? 'Yes: connected with no cycles' : 'No: it has a cycle and is not connected', correct: true },
        { text: isTree ? 'No: it has a cycle' : 'Yes: it has 5 vertices and 4 edges' },
        { text: isTree ? 'No: a tree needs a root vertex' : 'Yes: every vertex has degree at least 1' },
      ]),
      explain: 'A tree is a connected graph with no cycles. A tree with n vertices has n − 1 edges, but n − 1 edges alone does not make a tree.',
    },
  ];
};

const U2 = (r: Rand): Question[] => {
  const g = graphWith(r, { n: 5, directed: false, density: 0.4, min: 4 });
  const L = ids(g);
  const e = pick(r, g.edges);
  const dg = graphWith(r, { n: 5, directed: true, density: 0.3, min: 4 });
  const row = pick(r, ids(dg).filter(v => dg.edges.some(x => x.from === v)));
  const rowSet = dg.edges.filter(x => x.from === row).map(x => x.to).sort();
  const colSet = dg.edges.filter(x => x.to === row).map(x => x.from).sort();
  const V = pick(r, [1000, 5000, 10000]);
  const E = V * pick(r, [2, 3, 4]);
  return [
    {
      id: 'u2-cells',
      prompt: `Undirected graph. Which cells of the adjacency matrix record the edge ${e.from} – ${e.to}?`,
      graph: g,
      options: opts(r, [
        { text: `[${e.from}][${e.to}] and [${e.to}][${e.from}]`, correct: true },
        { text: `Only [${e.from}][${e.to}]`, misconception: 'undirected-one-cell', why: 'An undirected edge goes both ways, so the matrix is symmetric.' },
        { text: `Only [${e.to}][${e.from}]`, misconception: 'undirected-one-cell' },
        { text: `[${e.from}][${e.from}] and [${e.to}][${e.to}]`, misconception: 'diagonal' },
      ]),
      explain: 'For an undirected graph the matrix is symmetric: an edge u – v sets both [u][v] and [v][u].',
    },
    {
      id: 'u2-row',
      prompt: `Directed graph. Row ${row} of the adjacency matrix has a 1 in which columns?`,
      graph: dg,
      options: opts(r, [
        { text: set(rowSet), correct: true },
        { text: set(colSet), misconception: 'direction-ignored', why: 'Those are the arrows coming in to ' + row + ', which is the column.' },
        { text: set([...new Set([...rowSet, ...colSet])].sort()), misconception: 'direction-ignored' },
        { text: set(ids(dg).filter(v => v !== row && !rowSet.includes(v))) },
      ]),
      explain: `Row ${row} lists where ${row}'s arrows go: the out-neighbours of ${row}. Column ${row} lists the arrows coming in.`,
    },
    {
      id: 'u2-sparse',
      prompt: `A road network has V = ${V.toLocaleString('en-ZA')} junctions and E = ${E.toLocaleString('en-ZA')} roads. Which representation uses far less memory?`,
      options: opts(r, [
        { text: 'Adjacency list: Θ(V + E) space', correct: true },
        { text: 'Adjacency matrix: Θ(V²) space', misconception: 'list-matrix-cost', why: `V² is ${(V * V).toLocaleString('en-ZA')} cells, almost all 0.` },
        { text: 'They use the same space', misconception: 'list-matrix-cost' },
        { text: 'Incidence matrix: Θ(E) space' },
      ]),
      explain: `The graph is sparse (E is about ${E / V}V). A list stores only the ${E.toLocaleString('en-ZA')} edges; a matrix stores ${(V * V).toLocaleString('en-ZA')} cells.`,
    },
    {
      id: 'u2-inc',
      prompt: `This undirected graph has ${g.vertices.length} vertices and ${g.edges.length} edges. What size is its incidence matrix?`,
      graph: g,
      options: opts(r, [
        { text: `${g.vertices.length} rows × ${g.edges.length} columns`, correct: true },
        { text: `${g.vertices.length} rows × ${g.vertices.length} columns` },
        { text: `${g.edges.length} rows × ${g.edges.length} columns` },
        { text: `${g.vertices.length} rows × ${2 * g.edges.length} columns` },
      ]),
      explain: 'An incidence matrix has a row per vertex and a column per edge. Each column has a 1 at the edge’s two ends.',
    },
    {
      id: 'u2-check',
      prompt: 'Which question does an adjacency matrix answer in constant time, Θ(1)?',
      options: opts(r, [
        { text: `Is there an edge from ${L[0]} to ${L[1]}?`, correct: true },
        { text: `List all neighbours of ${L[0]}`, misconception: 'list-matrix-cost', why: 'That scans a whole row: Θ(V).' },
        { text: 'How many edges does the graph have?' },
        { text: `Is ${L[1]} reachable from ${L[0]}?`, misconception: 'one-stop-only', why: 'Reachability needs a search, not one cell.' },
      ]),
      explain: 'One cell lookup tells you whether an edge exists. Listing neighbours needs the whole row.',
    },
  ];
};

const U3 = (r: Rand): Question[] => {
  const n = pick(r, [5, 6, 7]);
  const g = graphWith(r, { n: 5, directed: false, density: 0.4, min: 3 });
  const v = pick(r, ids(g));
  const deg = properties(g).deg[v];
  return [
    {
      id: 'u3-add-edge',
      prompt: 'You add one undirected edge u – v to an adjacency matrix. How many cells change?',
      options: opts(r, [{ text: '2', correct: true }, { text: '1', misconception: 'undirected-one-cell' }, { text: '4' }, { text: 'A whole row and column' }]),
      explain: 'Both [u][v] and [v][u] change, because the edge goes both ways.',
    },
    {
      id: 'u3-add-vertex',
      prompt: `A graph stored as an ${n} × ${n} adjacency matrix gets a new vertex. What has to happen to the matrix?`,
      options: opts(r, [
        { text: `Make a new ${n + 1} × ${n + 1} array and copy the old cells: Θ(V²)`, correct: true },
        { text: 'Set one cell to 1: Θ(1)' },
        { text: 'Append to one list: Θ(1)', misconception: 'list-matrix-cost' },
        { text: 'Nothing: a matrix grows by itself' },
      ]),
      explain: 'Java arrays have a fixed size, so adding a row and column means allocating a bigger array and copying: Θ(V²). An adjacency list just adds an empty list.',
    },
    {
      id: 'u3-remove-vertex',
      prompt: `Remove vertex ${v} from this undirected graph. How many edges disappear?`,
      graph: g,
      options: opts(r, [{ text: String(deg), correct: true }, { text: '1' }, { text: String(Math.max(0, deg - 1)) }, { text: String(g.edges.length) }]),
      explain: `Removing a vertex removes every edge that touches it: deg(${v}) = ${deg}.`,
    },
    {
      id: 'u3-remove-list',
      prompt: 'Removing edge u – v from an undirected adjacency list means…',
      options: opts(r, [
        { text: 'deleting v from u’s list and u from v’s list', correct: true },
        { text: 'deleting v from u’s list only', misconception: 'undirected-one-cell' },
        { text: 'deleting both lists' },
        { text: 'setting one cell to 0' },
      ]),
      explain: 'An undirected edge appears in both lists, so both must change.',
    },
    {
      id: 'u3-neigh',
      prompt: `Listing all neighbours of a vertex with degree d costs what in each form?`,
      options: opts(r, [
        { text: 'List: Θ(d). Matrix: Θ(V).', correct: true },
        { text: 'List: Θ(V). Matrix: Θ(d).', misconception: 'list-matrix-cost' },
        { text: 'Both Θ(1)' },
        { text: 'Both Θ(V²)' },
      ]),
      explain: 'The list holds exactly the d neighbours. The matrix row has V cells to scan, most of them 0 in a sparse graph.',
    },
  ];
};

const U4 = (r: Rand): Question[] => {
  // Find a graph where DFS and BFS orders differ, so the question discriminates.
  let g = graphWith(r, { n: 6, directed: true, density: 0.32, min: 6 });
  let s = 'a', dfs: string[] = [], bfs: string[] = [];
  for (let t = 0; t < 60; t++) {
    const L0 = ids(g);
    s = [...L0].sort((a, b) => reachableFrom(g, b).size - reachableFrom(g, a).size)[0];
    dfs = dfsTrace(g, s).order;
    bfs = bfsTrace(g, s).order;
    if (dfs.join() !== bfs.join() && dfs.length >= 4) break;
    g = graphWith(r, { n: 6, directed: true, density: 0.32, min: 6 });
  }
  const L = ids(g);
  const reach = [...reachableFrom(g, s)].filter(x => x !== s).sort();
  const t = pick(r, L.filter(x => x !== s));
  const back = [...reachableFrom(g, t)].includes(s);
  const rev = L.filter(x => x !== s && reachableFrom(g, x).has(s)).sort();
  const fake = shuffle(r, dfs.slice(1));
  return [
    {
      id: 'u4-dfs',
      prompt: `Run DFS from ${s}, taking neighbours in alphabetical order. In what order are vertices visited?`,
      graph: g,
      options: opts(r, [
        { text: dfs.join(', '), correct: true },
        { text: bfs.join(', '), misconception: 'dfs-bfs-order', why: 'That is the BFS order (level by level).' },
        { text: [s, ...fake].join(', ') },
        { text: [s, ...[...dfs.slice(1)].sort()].join(', ') },
      ]),
      explain: `DFS goes as deep as possible first: ${dfs.join(' → ')}.`,
    },
    {
      id: 'u4-bfs',
      prompt: `Run BFS from ${s}, taking neighbours in alphabetical order. In what order are vertices visited?`,
      graph: g,
      options: opts(r, [
        { text: bfs.join(', '), correct: true },
        { text: dfs.join(', '), misconception: 'dfs-bfs-order', why: 'That is the DFS order (deep first).' },
        { text: [s, ...[...bfs.slice(1)].reverse()].join(', ') },
        { text: L.join(', ') },
      ]),
      explain: `BFS uses a queue and visits all of ${s}'s neighbours before their neighbours: ${bfs.join(' → ')}.`,
    },
    {
      id: 'u4-reach',
      prompt: `Which other vertices can ${s} reach by following the arrows?`,
      graph: g,
      options: opts(r, [
        { text: set(reach), correct: true },
        { text: set(g.edges.filter(e => e.from === s).map(e => e.to).sort()), misconception: 'one-stop-only', why: 'Those are only the direct neighbours, one edge away.' },
        { text: set(rev), misconception: 'direction-ignored', why: `Those are the vertices that reach ${s}.` },
        { text: set(L.filter(x => x !== s)) },
        { text: set(reach.slice(0, -1)) },
      ]),
      explain: `Follow arrows from ${s} as far as they go: ${set(reach)}.`,
    },
    {
      id: 'u4-back',
      prompt: `Can ${t} reach ${s}?`,
      graph: g,
      options: opts(r, [
        { text: back ? 'Yes' : 'No', correct: true },
        { text: back ? 'No' : 'Yes', misconception: back ? undefined : 'direction-ignored' },
      ]),
      explain: back ? `Yes: there is a directed path from ${t} to ${s}.` : `No: following the arrows from ${t} never arrives at ${s}. A path the other way does not count in a digraph.`,
    },
    {
      id: 'u4-ds',
      prompt: 'Which data structure does BFS use to decide which vertex to visit next?',
      options: opts(r, [{ text: 'A queue (first in, first out)', correct: true }, { text: 'A stack (last in, first out)', misconception: 'dfs-bfs-order' }, { text: 'A priority queue' }, { text: 'A hash table' }]),
      explain: 'BFS uses a queue so the vertices found first are visited first, level by level. DFS uses a stack or recursion.',
    },
  ];
};

const U5 = (r: Rand): Question[] => {
  const g = graphWith(r, { n: 5, directed: true, density: 0.3, min: 5 });
  const L = ids(g);
  const R = warshall(booleanMatrix(g));
  const adj = booleanMatrix(g);
  const pairs: [number, number][] = [];
  for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) if (i !== j && R[i][j] && !adj[i][j]) pairs.push([i, j]);
  const [pi, pj] = pairs.length ? pick(r, pairs) : [0, 1];
  const inR = Boolean(R[pi][pj]);
  // Diagonal question: one vertex on a cycle, one not.
  const cyc = fromPairs(4, [[0, 1], [1, 2], [2, 0], [2, 3]], true);
  const dv = pick(r, [0, 3]);
  const dl = 'abcd'[dv];
  const weak = fromPairs(4, [[0, 1], [1, 2], [3, 2]], true);
  const strong = fromPairs(4, [[0, 1], [1, 2], [2, 3], [3, 0]], true);
  const cg = pick(r, [weak, strong]);
  const ones = R.flat().reduce((a, b) => a + b, 0);
  return [
    {
      id: 'u5-pair',
      prompt: `Is (${L[pi]}, ${L[pj]}) in the transitive closure R⁺ of this digraph?`,
      graph: g,
      options: opts(r, [
        { text: inR ? 'Yes: there is a path of one or more edges' : 'No', correct: true },
        { text: inR ? 'No: there is no edge from ' + L[pi] + ' to ' + L[pj] : 'Yes', misconception: inR ? 'one-stop-only' : undefined, why: 'R⁺ counts paths of any length, not just single edges.' },
      ]),
      explain: `(u, v) is in R⁺ when a path leads from u to v. Here ${L[pi]} reaches ${L[pj]} through other vertices.`,
    },
    {
      id: 'u5-diag',
      prompt: `In R⁺ for this digraph, is the diagonal cell [${dl}][${dl}] a 1?`,
      graph: cyc,
      options: opts(r, [
        { text: dv === 0 ? `Yes: ${dl} is on a cycle, so it reaches itself` : `No: ${dl} is not on a cycle`, correct: true },
        { text: 'Yes: the diagonal of R⁺ is always 1', misconception: 'diagonal' },
        { text: 'No: the diagonal of R⁺ is always 0', misconception: 'diagonal' },
      ]),
      explain: 'R⁺ uses paths of one or more edges. [v][v] is 1 only when v lies on a cycle (or has a loop). The reflexive-transitive closure R* sets the whole diagonal.',
    },
    {
      id: 'u5-conn',
      prompt: 'This digraph is…',
      graph: cg,
      options: opts(r, [
        { text: cg === strong ? 'strongly connected' : 'weakly connected', correct: true },
        { text: cg === strong ? 'weakly connected' : 'strongly connected', misconception: 'weak-strong', why: 'Strong needs every vertex to reach every other following the arrows.' },
        { text: 'not connected' },
      ]),
      explain: cg === strong
        ? 'Following the arrows, every vertex reaches every other: R⁺ is all 1s, so it is strongly connected.'
        : 'Ignoring direction it is connected, but some vertices cannot reach others along the arrows (d reaches c, but nothing reaches d). So it is weakly connected.',
    },
    {
      id: 'u5-count',
      prompt: 'How many 1s are in the reachability matrix (R⁺) of this digraph?',
      graph: g,
      options: opts(r, [
        { text: String(ones), correct: true },
        { text: String(g.edges.length), misconception: 'one-stop-only', why: 'That counts only the edges, not longer paths.' },
        { text: String(ones + L.length - R.reduce((a, row, i) => a + row[i], 0)), misconception: 'diagonal' },
        { text: String(L.length * L.length) },
      ]),
      explain: `Count every pair (u, v) where u reaches v: ${ones}.`,
    },
    {
      id: 'u5-strong-test',
      prompt: 'Using R⁺, how can you tell a digraph is strongly connected?',
      options: opts(r, [
        { text: 'Every cell of R⁺ is 1', correct: true },
        { text: 'R⁺ is symmetric', misconception: 'weak-strong' },
        { text: 'Every row of R⁺ has at least one 1', misconception: 'weak-strong' },
        { text: 'The diagonal of R⁺ is 1' },
      ]),
      explain: 'Strongly connected means every vertex reaches every vertex (itself too, by going round a cycle), so R⁺ is all 1s.',
    },
  ];
};

const U6 = (r: Rand): Question[] => {
  // A chain-like digraph so that a step k adds something.
  let g: Graph | null = null;
  let steps: ReturnType<typeof warshallTrace> = [];
  let kStep = 1;
  for (let t = 0; t < 40; t++) {
    const cand = graphWith(r, { n: 4, directed: true, density: 0.35, min: 3 });
    const tr = warshallTrace(cand);
    const zeros = (m: number[][]) => m.flat().filter(x => !x).length;
    const useful = tr.map((s, i) => (i > 0 && s.changed.length && zeros(tr[i - 1].matrix) - s.changed.length >= 3 ? i : -1)).filter(i => i > 0);
    if (useful.length) {
      g = cand;
      steps = tr;
      kStep = pick(r, useful);
      break;
    }
  }
  if (!g) {
    g = fromPairs(4, [[0, 1], [1, 2], [2, 3]], true);
    steps = warshallTrace(g);
    kStep = 2;
  }
  const L = ids(g);
  const before = steps[kStep - 1].matrix;
  const k = kStep - 1;
  const ch = steps[kStep].changed[0];
  const wrongCells: string[] = [];
  for (let i = 0; i < L.length; i++) for (let j = 0; j < L.length; j++) if (!before[i][j] && !steps[kStep].changed.some(c => c.i === i && c.j === j)) wrongCells.push(`[${L[i]}][${L[j]}]`);
  return [
    {
      id: 'u6-step',
      prompt: `This is R(${k}), before allowing ${L[k]} as a stop. Which cell becomes 1 in R(${k + 1}) when k = ${L[k]}?`,
      matrix: { labels: L, cells: before, caption: `R(${k})`, kRow: k },
      options: opts(r, [
        { text: `[${L[ch.i]}][${L[ch.j]}]`, correct: true },
        ...shuffle(r, wrongCells).slice(0, 3).map(text => ({ text, why: `Check: is row ${L[k]}'s pattern copied in? A cell [i][j] turns on only if [i][${L[k]}] and [${L[k]}][j] are both 1.` })),
      ]),
      explain: `[${L[ch.i]}][${L[ch.j]}] turns on because ${L[ch.i]} reaches ${L[k]} and ${L[k]} reaches ${L[ch.j]}.`,
    },
    {
      id: 'u6-rule',
      prompt: 'Which rule does Warshall’s algorithm apply at step k?',
      options: opts(r, [
        { text: 'R[i][j] = R[i][j] OR (R[i][k] AND R[k][j])', correct: true },
        { text: 'R[i][j] = R[i][k] AND R[k][j]', why: 'That throws away pairs already known.' },
        { text: 'R[i][j] = R[i][j] AND R[j][i]', misconception: 'direction-ignored' },
        { text: 'R[i][j] = R[i][j] OR R[j][i]', misconception: 'direction-ignored' },
      ]),
      explain: 'A pair stays reachable, or becomes reachable when going through k joins two known paths.',
    },
    {
      id: 'u6-loops',
      prompt: 'Which loop must be the outermost in Warshall’s algorithm?',
      code: 'for (…)\n  for (…)\n    for (…)\n      r[i][j] = r[i][j] || (r[i][k] && r[k][j]);',
      options: opts(r, [
        { text: 'k, the intermediate vertex', correct: true },
        { text: 'i, the row', misconception: 'k-not-outer', why: 'With k inside, a path through two stops can be missed.' },
        { text: 'j, the column', misconception: 'k-not-outer' },
        { text: 'Any order works', misconception: 'k-not-outer' },
      ]),
      explain: 'R(k) is built from the whole of R(k − 1). k must be outermost so that every cell has seen stops 1..k−1 before stop k is tried.',
    },
    {
      id: 'u6-cost',
      prompt: 'What is the running time of Warshall’s algorithm on a graph with V vertices?',
      options: opts(r, [
        { text: 'Θ(V³), whatever the number of edges', correct: true },
        { text: 'Θ(V + E)', misconception: 'list-matrix-cost' },
        { text: 'Θ(V²)' },
        { text: 'Θ(E log V)' },
      ]),
      explain: 'Three nested loops over V vertices: V³ cell updates, even for a graph with no edges (Drozdek p. 391).',
    },
    {
      id: 'u6-dp',
      prompt: 'Why is Warshall’s algorithm called dynamic programming?',
      options: opts(r, [
        { text: 'Each R(k) is built from the stored table R(k − 1) instead of searching paths again', correct: true },
        { text: 'It changes the graph while it runs' },
        { text: 'It uses recursion with a visited mark', misconception: 'no-visited-mark' },
        { text: 'It only works on dynamic (changing) graphs' },
      ]),
      explain: 'R(k) means "reachable using only stops from the first k vertices". Each table reuses the last, so the work is shared.',
    },
  ];
};

const U7 = (r: Rand): Question[] => {
  const V = pick(r, [1000, 2000, 4000]);
  const E = V * pick(r, [2, 3]);
  return [
    {
      id: 'u7-sparse',
      prompt: `V = ${V.toLocaleString('en-ZA')}, E = ${E.toLocaleString('en-ZA')} (sparse), stored as adjacency lists. Which closure method is faster?`,
      options: opts(r, [
        { text: 'DFS from every vertex: Θ(V(V + E))', correct: true },
        { text: 'Warshall: Θ(V³)', misconception: 'list-matrix-cost', why: `V³ is about ${(V ** 3 / 1e9).toFixed(0)} × 10⁹; V(V + E) is about ${((V * (V + E)) / 1e6).toFixed(0)} × 10⁶.` },
        { text: 'They are always the same' },
      ]),
      explain: 'On a sparse graph, V(V + E) is close to V², which is far less than V³.',
    },
    {
      id: 'u7-dense',
      prompt: 'On a dense graph (E close to V²), repeated DFS costs Θ(V(V + E)). How does that compare with Warshall’s Θ(V³)?',
      options: opts(r, [
        { text: 'Both are Θ(V³); Warshall’s simple loops often win in practice', correct: true },
        { text: 'Repeated DFS is still much faster' },
        { text: 'Warshall is Θ(V²) on dense graphs', misconception: 'list-matrix-cost' },
      ]),
      explain: 'With E ≈ V², V(V + E) ≈ V³. Same growth, and Warshall has no recursion or list overhead.',
    },
    {
      id: 'u7-matrix-dfs',
      prompt: 'If repeated DFS uses an adjacency matrix instead of lists, what does it cost?',
      options: opts(r, [
        { text: 'Θ(V³): each DFS scans whole rows, Θ(V²)', correct: true },
        { text: 'Θ(V(V + E)), the same as with lists', misconception: 'list-matrix-cost' },
        { text: 'Θ(V²)' },
      ]),
      explain: 'Finding neighbours in a matrix scans a row of V cells, so one DFS is Θ(V²) and V of them are Θ(V³).',
    },
    {
      id: 'u7-double',
      prompt: 'In the timing lab, Warshall takes 50 ms for V = 400. About how long for V = 800?',
      options: opts(r, [{ text: 'About 400 ms', correct: true }, { text: 'About 100 ms' }, { text: 'About 200 ms' }, { text: 'About 50 ms' }]),
      explain: 'Θ(V³): doubling V multiplies the time by 2³ = 8. 50 × 8 = 400 ms.',
    },
    {
      id: 'u7-choose',
      prompt: 'You need the closure once for a small, dense graph (V = 50) held in a 2D array. Which is the sensible choice?',
      options: opts(r, [
        { text: 'Warshall’s algorithm: short, in place, and Θ(V³) is tiny here', correct: true },
        { text: 'Convert to adjacency lists first, then DFS from every vertex' },
        { text: 'BFS once from vertex a', misconception: 'one-stop-only' },
      ]),
      explain: '50³ = 125 000 steps is instant, and Warshall works straight on the matrix you already have.',
    },
  ];
};

const U8 = (r: Rand): Question[] => {
  const courses = ['COS110', 'COS132', 'COS212', 'COS216', 'COS226', 'COS301'];
  // Edge u → v means "u is a prerequisite of v".
  const pre: [number, number][] = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5]];
  const g = fromPairs(6, pre, true);
  const L = ids(g);
  const legend = courses.map((c, i) => `${L[i]} = ${c}`).join(', ');
  const target = pick(r, [3, 4, 5]);
  const R = warshall(booleanMatrix(g));
  const needs = L.filter((_, i) => R[i][target]).map(x => courses[L.indexOf(x)]);
  const direct = pre.filter(([, b]) => b === target).map(([a]) => courses[a]);
  return [
    {
      id: 'u8-model',
      prompt: 'You model course prerequisites as a digraph. What should an edge u → v mean so that R⁺ answers "what must I pass before v"?',
      options: opts(r, [
        { text: 'u must be passed before v', correct: true },
        { text: 'u and v are taken in the same year', misconception: 'direction-ignored' },
        { text: 'v must be passed before u', misconception: 'direction-ignored' },
      ]),
      explain: 'Then column v of R⁺ lists every course that leads to v, directly or indirectly.',
    },
    {
      id: 'u8-read',
      prompt: `Prerequisites (${legend}). Using R⁺, which courses must be passed before ${courses[target]}?`,
      graph: g,
      options: opts(r, [
        { text: needs.join(', '), correct: true },
        { text: direct.join(', '), misconception: 'one-stop-only', why: 'Those are only the direct prerequisites.' },
        { text: courses.filter((_, i) => R[target][i]).join(', ') || 'None', misconception: 'direction-ignored', why: 'That is the row: courses that need ' + courses[target] + '.' },
      ]),
      explain: `Read column ${L[target]} of R⁺: every course with a path to ${courses[target]}.`,
    },
    {
      id: 'u8-cycle',
      prompt: 'After adding a new rule, R⁺ has a 1 on its diagonal at COS212. What does that mean?',
      options: opts(r, [
        { text: 'There is a cycle: COS212 (indirectly) requires itself, so the rules are impossible', correct: true },
        { text: 'COS212 has no prerequisites', misconception: 'diagonal' },
        { text: 'Nothing: the diagonal of R⁺ is always 1', misconception: 'diagonal' },
      ]),
      explain: '[v][v] = 1 means v reaches itself: a cycle of requirements that nobody can satisfy.',
    },
    {
      id: 'u8-method',
      prompt: 'The faculty has 400 modules and about 600 prerequisite links. Which closure method fits best?',
      options: opts(r, [
        { text: 'DFS from every module on adjacency lists: Θ(V(V + E))', correct: true },
        { text: 'Warshall on a 400 × 400 matrix is the only correct option' },
        { text: 'A single BFS from the first module', misconception: 'one-stop-only' },
      ]),
      explain: 'The graph is sparse (E ≈ 1.5V), so repeated DFS does about 400 × 1000 steps against Warshall’s 64 million. Both give the same, correct answer.',
    },
    {
      id: 'u8-interpret',
      prompt: 'In a "who-can-message-whom" network, R⁺[u][v] = 1. What can you conclude?',
      options: opts(r, [
        { text: 'A message from u can reach v, possibly through others', correct: true },
        { text: 'u and v message each other directly', misconception: 'one-stop-only' },
        { text: 'v can reach u', misconception: 'direction-ignored' },
      ]),
      explain: 'R⁺ records reachability along directed paths of any length, in one direction only.',
    },
  ];
};

export const GENERATORS: Record<string, (r: Rand) => Question[]> = { U1, U2, U3, U4, U5, U6, U7, U8 };

export function makeCheck(unit: string, seed = Date.now()): Question[] {
  const r = rng(seed >>> 0);
  return GENERATORS[unit](r);
}
