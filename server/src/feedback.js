// Turns a learner's submission into specific feedback: which known mistake it shows, and the hint ladder for it.
// Everything here is rules over the learner's actual answer. No outside AI service is used.

export const MISCONCEPTIONS = {
  'k-not-outer': {
    title: 'The intermediate vertex k is not the outermost loop',
    hint1: 'Your closure finds pairs one stop apart but misses longer chains. Which loop should choose the intermediate vertex?',
    pointsTo: { unit: 'U6', label: "U6 Warshall's trace", drozdek: '§8.3.1, p. 390' },
    worked: 'Take the chain a → b → c → d. With k as the outer loop: k = a adds nothing; k = b adds a → c; k = c adds a → d and b → d. If k is the inner loop instead, the pair (a, d) is checked before (a, c) and (b, d) exist, so it is never found.',
  },
  'one-direction': {
    title: 'Edge added in one direction only',
    hint1: "In an undirected graph, adding edge(u, v) must update both u's and v's entries.",
    pointsTo: { unit: 'U3', label: 'U3 Graph ADT operations', drozdek: '§8.1, p. 378' },
    worked: 'Undirected graph, addEdge(0, 2): set adj[0][2] = true and adj[2][0] = true. hasEdge(2, 0) must now be true as well.',
  },
  'diagonal': {
    title: 'Diagonal entries wrong',
    hint1: 'A vertex reaches itself only if it lies on a cycle.',
    pointsTo: { unit: 'U5', label: 'U5 Transitive closure as a relation', drozdek: '§8.3.1, p. 391' },
    worked: 'Graph a → b → a, c → a. The closure has r[a][a] = 1 and r[b][b] = 1 (each lies on the cycle), but r[c][c] = 0: no path leads from c back to c.',
  },
  'no-visited': {
    title: 'Depth-first search without visited marks',
    hint1: 'Your search revisits vertices on a cycle. Mark each vertex the first time you visit it.',
    pointsTo: { unit: 'U4', label: 'U4 Reachability', drozdek: '§8.2, p. 379' },
    worked: 'visit(v): mark v as seen, then for each neighbour w, call visit(w) only if w is not seen yet. On the cycle a → b → a, visit(a) marks a, visits b, and b does not go back to a.',
  },
  'index-from-1': {
    title: 'Vertices numbered from 1',
    hint1: 'Vertices in the test input are numbered from 0.',
    pointsTo: { unit: 'TEST', label: 'Input and output format', drozdek: null },
    worked: 'With n = 4 the vertices are 0, 1, 2 and 3, so a loop over vertices is for (int v = 0; v < n; v++).',
  },
  'complete-by-count': {
    title: 'Counting edges instead of checking every pair',
    hint1: 'Kₙ needs one edge between every pair of distinct vertices. An edge count can be fooled by loops and repeated edges.',
    pointsTo: { unit: 'U1', label: 'U1 Graphs and their types', drozdek: 'Ch. 8 intro, p. 377' },
    worked: 'K₃ plus a loop at a has 4 edges, more than 3 × 2 / 2 = 3, yet it is not complete because Kₙ has no loops. Check c[i][j] == 1 for every pair i ≠ j, and that c[i][i] == 0.',
  },
  'java-util': {
    title: 'Built-in data structure used',
    hint1: 'The study guide forbids built-in data structures. Use your own node class.',
    pointsTo: { unit: 'P2', label: 'P2 adjacency lists with your own nodes', drozdek: '§8.1, p. 377' },
    worked: 'class Node { int vertex; Node next; }. Each vertex keeps a head Node; adding a neighbour puts a new Node at the front of its list.',
  },
  'format': {
    title: 'Output format',
    hint1: 'Your answer is right. Check the spaces and line breaks against the sample.',
    pointsTo: { unit: 'TEST', label: 'Input and output format', drozdek: null },
    worked: 'Matrix rows are 0s and 1s separated by single spaces, one row per line, with no extra blank lines.',
  },
  'loop-degree': {
    title: 'Loop counted once in the degree',
    hint1: 'A loop adds 2 to its vertex’s degree, so the sum of all degrees is still twice the number of edges.',
    pointsTo: { unit: 'U1', label: 'U1 Graphs and their types', drozdek: 'Ch. 8 intro, p. 377; §8.14 ex. 2' },
    worked: 'Vertex a with one loop and one edge to b: degree(a) = 2 + 1 = 3.',
  },
  'reach-excludes-start': {
    title: 'Start vertex left out',
    hint1: 'The start vertex counts as reachable from itself in this problem.',
    pointsTo: { unit: 'U4', label: 'U4 Reachability', drozdek: '§8.2' },
    worked: 'reachable(adj, 2) on a graph where 2 has no edges returns a set containing only 2.',
  },
  'graph-not-grown': {
    title: 'addVertex does not grow the structure',
    hint1: 'After addVertex, the new vertex needs its own row and column (or its own list).',
    pointsTo: { unit: 'U3', label: 'U3 Graph ADT operations', drozdek: '§8.1' },
    worked: 'Make a new (n+1) × (n+1) matrix, copy the old cells across, and keep the new one.',
  },
  'used-matrix': {
    title: 'A 2D array was used for the edges',
    hint1: 'P2 is about adjacency lists: store each vertex’s neighbours in a linked list of your own Node objects.',
    pointsTo: { unit: 'U2', label: 'U2 Representing graphs', drozdek: '§8.1, p. 377' },
    worked: 'heads[u] points at the first Node of u’s list; hasEdge(u, v) walks the list looking for v.',
  },
  'closure-zero-edges': {
    title: 'Paths of zero edges counted',
    hint1: 'The closure counts paths of one or more edges, so do not set the whole diagonal to true at the start.',
    pointsTo: { unit: 'U5', label: 'U5 Transitive closure as a relation', drozdek: '§8.3.1' },
    worked: 'Start from a copy of adj, not from adj plus the identity matrix.',
  },
  'too-slow': {
    title: 'Too slow on large graphs',
    hint1: 'Your code is right on small graphs but too slow on the large one. Check the number of nested loops.',
    pointsTo: { unit: 'U7', label: 'U7 Comparing approaches', drozdek: '§8.3.1, p. 391' },
    worked: "Warshall's needs exactly three nested loops over n: Θ(n³). A fourth loop, or restarting the whole computation, makes it much slower.",
  },
  'wrong-answer': {
    title: 'Some answers are wrong',
    hint1: 'Run the failing case type by hand on a small graph and compare each step with your code.',
    pointsTo: { unit: null, label: 'Build a graph page', drozdek: null },
    worked: null,
  },
};

const CATEGORY_HELP = {
  'long-chain': 'long chains of edges', 'short': 'paths of at most two edges', cycle: 'graphs with cycles', 'self-loop': 'graphs with loops',
  complete: 'complete graphs', 'no-edges': 'graphs with no edges', random: 'random graphs', undirected: 'undirected graphs', large: 'a large graph (120 vertices)',
  directed: 'directed graphs', loops: 'graphs with loops', 'remove-missing': 'removing edges that do not exist', 'add-vertex': 'adding a vertex',
  ordinary: 'ordinary graphs', isolated: 'graphs with isolated vertices', 'complete-with-loop': 'Kₙ plus a loop', 'complete-with-repeated-edge': 'Kₙ with one edge doubled',
  'single-vertex': 'a single vertex', chain: 'chains', disconnected: 'disconnected graphs', 'isolated-start': 'starting from an isolated vertex',
  indirect: 'indirect prerequisites', 'no-circular': 'graphs without circular prerequisites', circular: 'circular prerequisites', 'strongly-connected': 'strongly connected graphs',
  timing: 'the timing run', sample: 'the sample',
};
export const categoryLabel = c => CATEGORY_HELP[c] || c;

function diffMatrices(a, b) {
  const ra = (a || '').trim().split('\n').map(l => l.trim().split(/\s+/));
  const rb = (b || '').trim().split('\n').map(l => l.trim().split(/\s+/));
  const cells = [];
  for (let i = 0; i < Math.max(ra.length, rb.length); i++)
    for (let j = 0; j < Math.max(ra[i]?.length || 0, rb[i]?.length || 0); j++)
      if ((ra[i]?.[j]) !== (rb[i]?.[j])) cells.push([i, j, ra[i]?.[j], rb[i]?.[j]]);
  return cells;
}

/** Decide which known mistakes a run shows. Returns misconception ids, most likely first. */
export function detectMisconceptions(problem, run, staticFindings = []) {
  const found = new Set();
  for (const f of staticFindings) {
    if (f.id === 'java-util') found.add('java-util');
    if (f.id === 'used-matrix') found.add('used-matrix');
  }
  if (run.phase !== 'run') return [...found];
  const cases = run.cases.filter(c => !c.timing);
  const failed = cases.filter(c => !c.passed);
  const passedCats = new Set(cases.filter(c => c.passed).map(c => c.category));
  const failedCats = new Set(failed.map(c => c.category));
  if (!failed.length && !run.cases.some(c => c.timing && !c.passed)) return [...found];

  if (failed.length && failed.every(c => c.formatOnly)) found.add('format');
  if (failed.some(c => c.exception === 'ArrayIndexOutOfBoundsException')) found.add('index-from-1');
  if (failed.some(c => c.exception === 'StackOverflowError') || (failed.some(c => c.status === 'timeout') && ['P5', 'P6', 'P11'].includes(problem.id) && failed.some(c => ['cycle', 'random', 'self-loop', 'undirected'].includes(c.category)))) found.add('no-visited');
  if (failed.length === 1 && failed[0].category === 'large' && failed[0].status === 'timeout') found.add('too-slow');

  const closureLike = ['P6', 'P7', 'P10', 'P8', 'P11'].includes(problem.id);
  if (closureLike) {
    const staticK = staticFindings.find(f => f.id === 'k-not-outer-static');
    if (staticK || (failedCats.has('long-chain') && passedCats.has('short'))) found.add('k-not-outer');
    const done = failed.filter(c => c.status === 'done' && !c.formatOnly);
    if (done.length) {
      const diffs = done.flatMap(c => diffMatrices(c.output, c.expected));
      if (diffs.length && diffs.every(([i, j]) => i === j)) {
        found.add(diffs.every(([, , got]) => got === '1') ? 'closure-zero-edges' : 'diagonal');
      }
    }
  }
  if (['P1', 'P2'].includes(problem.id)) {
    if (failedCats.has('undirected') && passedCats.has('directed')) found.add('one-direction');
    if (failedCats.size === 1 && failedCats.has('loops')) found.add('loop-degree');
    if (failedCats.has('add-vertex') && failed.some(c => c.category === 'add-vertex' && c.status === 'exception')) found.add('graph-not-grown');
  }
  if (problem.id === 'P4') {
    if ((failedCats.has('complete-with-loop') || failedCats.has('complete-with-repeated-edge')) && passedCats.has('complete')) found.add('complete-by-count');
  }
  if (problem.id === 'P5') {
    const done = failed.filter(c => c.status === 'done');
    if (done.length && done.every(c => {
      const start = +c.input.trim().split(/\s+/).at(-1);
      const got = c.output.trim().split(/\s+/), exp = c.expected.trim().split(/\s+/);
      return got.every((x, i) => (i === start ? true : x === exp[i])) && got[start] !== exp[start];
    })) found.add('reach-excludes-start');
  }
  if (!found.size) found.add('wrong-answer');
  return [...found];
}

/** Hint ladder step (1, 2 or 3) for a misconception and the failing case type. Never contains solution code. */
export function hintStep(misconceptionId, level, failingCategory) {
  const m = MISCONCEPTIONS[misconceptionId] || MISCONCEPTIONS['wrong-answer'];
  if (level <= 1) return { level: 1, text: m.hint1 };
  if (level === 2) {
    const src = m.pointsTo.drozdek ? ` (Drozdek ${m.pointsTo.drozdek})` : '';
    return {
      level: 2,
      text: `Revisit ${m.pointsTo.label}${src}. Then open the Build a graph demo, which is loaded with a small example of ${categoryLabel(failingCategory)}, and step through it.`,
      demo: demoFor(failingCategory),
      unit: m.pointsTo.unit,
    };
  }
  return { level: 3, text: m.worked || 'Work through the failing case type by hand on the Build a graph page, one step at a time.' };
}

/** A small demo graph (test format) of a given case type. Never the hidden test itself. */
export function demoFor(category) {
  const demos = {
    'long-chain': '4 3 1\n0 1\n1 2\n2 3\n', cycle: '3 3 1\n0 1\n1 2\n2 0\n', 'self-loop': '3 2 1\n0 0\n0 1\n',
    'no-edges': '3 0 1\n', complete: '3 6 1\n0 1\n0 2\n1 0\n1 2\n2 0\n2 1\n', undirected: '4 3 0\n0 1\n1 2\n2 3\n',
    loops: '3 2 0\n0 0\n0 1\n', directed: '3 2 1\n0 1\n1 2\n', disconnected: '4 2 1\n0 1\n2 3\n', 'isolated-start': '3 1 1\n0 1\n',
    'complete-with-loop': '3 4 0\n0 1\n0 2\n1 2\n0 0\n', circular: '3 3 1\n0 1\n1 2\n2 0\n', 'strongly-connected': '3 3 1\n0 1\n1 2\n2 0\n',
  };
  return demos[category] || '4 4 1\n0 1\n1 2\n2 3\n3 1\n';
}

/** Short rubric checklist for written justifications (P11 report, unit scenario questions). */
export function rubricCheck(text, rubric) {
  const t = (text || '').toLowerCase();
  const results = rubric.map(r => ({ idea: r.idea, met: r.any.some(k => t.includes(k)) }));
  return { results, score: results.filter(r => r.met).length / Math.max(results.length, 1) };
}

export const P11_RUBRIC = [
  { idea: "Warshall's is cubic in the number of vertices", any: ['v^3', 'v³', 'n^3', 'n³', 'cubic', 'v3', 'n3'] },
  { idea: 'Repeated DFS depends on the number of edges', any: ['v+e', 'v + e', 'edges', 'e)', 'o(v(v'] },
  { idea: 'Graph density changes which method is faster', any: ['dense', 'sparse', 'density'] },
  { idea: 'Measured times are compared with the theory', any: ['measur', 'ms', 'time', 'faster', 'slower', 'grow'] },
];
