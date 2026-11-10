// Units U0–U8: lesson content (in our own words, with Drozdek references) and unit checks.
// Checks are generated from a seed (learner + unit + attempt), so answers never travel to the browser
// and each retry gets fresh graphs. Grading returns specific feedback on the learner's own answer.
import {
  seededRandom, randomMatrix, closure, warshallTrace, reachableFrom, findPath, indexToLabel, matrixToEdges,
} from '../../shared/graph.js';
import { rubricCheck } from './feedback.js';

const L = indexToLabel;
const ri = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const gText = (a, directed = true) => { const e = matrixToEdges(a, directed); return `${a.length} ${e.length} ${directed ? 1 : 0}\n` + e.map(([u, v]) => `${u} ${v}`).join('\n') + '\n'; };
const edgeWords = (a, directed = true) => matrixToEdges(a, directed).map(([u, v]) => (directed ? `${L(u)} → ${L(v)}` : `${L(u)}–${L(v)}`)).join(', ') || 'no edges';
const shuffle = (rand, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function mcq(id, prompt, correct, distractors, explain, rand, extra = {}) {
  const opts = shuffle(rand, [{ text: correct, correct: true }, ...distractors.map(d => ({ text: d.text, why: d.why }))]).map((o, i) => ({ ...o, id: String.fromCharCode(97 + i) }));
  return { id, type: 'mcq', prompt, options: opts, explain, ...extra };
}
function nonTrivialDigraph(rand, n, density = 0.3) {
  for (let t = 0; t < 50; t++) {
    const a = randomMatrix(rand, n, density);
    const r = closure(a);
    const added = r.flat().filter(Boolean).length - a.flat().filter(Boolean).length;
    if (added >= 2) return a;
  }
  const a = randomMatrix(rand, n, 0);
  for (let i = 0; i + 1 < n; i++) a[i][i + 1] = true;
  return a;
}

// ---------------- lesson content ----------------
// Block types: h (heading), p (paragraph), list, def (term + meaning), note, demo (graph to open on Build a graph), table
export const UNITS = [
  {
    id: 'U0', track: 'graphs', title: 'Readiness check', minutes: 10, advisory: true,
    summary: 'A short check of the ideas this topic builds on: relations, 2D arrays, Big-O and recursion.',
    outcomes: [],
    content: [
      { type: 'p', text: 'This check is advisory: it does not lock anything. If a question feels shaky, the feedback points you to what to revise first.' },
      { type: 'list', items: ['A relation R on a set links some pairs of elements. R is transitive when a R b and b R c always give a R c.', 'A 2D array a[i][j]: i picks the row, j the column.', 'Three nested loops over n items do about n × n × n steps: O(n³).', 'A recursive method needs a base case, or it never stops.'] },
    ],
  },
  {
    id: 'U1', track: 'graphs', title: 'Graphs and their types', minutes: 45,
    summary: 'What a graph is, the four pairs of graph types, and the vocabulary Drozdek uses.',
    outcomes: ['AL-Foundational CS 1a', 'MSF-Discrete 7a', 'MSF-Discrete 7c'],
    content: [
      { type: 'h', text: 'What is a graph?' },
      { type: 'p', text: 'A simple graph G = (V, E) has a non-empty set V of vertices and a set E of edges, where each edge joins two different vertices. Drozdek writes an edge between vi and vj as edge(vivj). (Drozdek, Ch. 8 intro, p. 376)' },
      { type: 'def', items: [
        ['Directed graph (digraph)', 'Each edge has a direction: (vi, vj) is not the same edge as (vj, vi).'],
        ['Multigraph', 'Two vertices may be joined by more than one edge.'],
        ['Pseudograph', 'A multigraph that also allows loops: an edge from a vertex to itself.'],
        ['Path', 'A sequence of edges v1–v2, v2–v3, …, ending where the next one starts.'],
        ['Circuit', 'A path that starts and ends at the same vertex and repeats no edge.'],
        ['Cycle', 'A circuit in which all the vertices are different.'],
        ['Weighted graph', 'Every edge carries a number: a weight, cost or distance.'],
        ['Complete graph Kₙ', 'Every pair of distinct vertices is joined by exactly one edge, so |E| = n(n − 1)/2.'],
        ['Subgraph', 'Some of the vertices and some of the edges of G. An induced subgraph keeps every edge of G between the chosen vertices.'],
        ['Adjacent, incident, degree', 'Two vertices joined by an edge are adjacent; the edge is incident with both. deg(v) counts the edges incident with v. A vertex with degree 0 is isolated.'],
      ] },
      { type: 'h', text: 'Four pairs of types' },
      { type: 'table', head: ['Pair', 'Question to ask'], rows: [
        ['Directed or undirected', 'Do the edges have a direction?'],
        ['Cyclic or acyclic', 'Is there a cycle anywhere?'],
        ['Connected or unconnected', 'Is there a path between every pair of vertices?'],
        ['Weighted or unweighted', 'Do the edges carry numbers?'],
      ] },
      { type: 'note', text: 'A tree is a special case: a connected, acyclic graph. A tree with n vertices always has n − 1 edges (Drozdek §8.14, exercise 5).' },
      { type: 'note', text: 'Handshake idea: every edge adds 1 to the degree of each of its two ends, so the degrees add up to twice the number of edges. A loop adds 2 to its vertex (Drozdek §8.14, exercise 2).' },
      { type: 'demo', label: 'Open K₄ on Build a graph', graph: '4 6 0\n0 1\n0 2\n0 3\n1 2\n1 3\n2 3\n' },
    ],
  },
  {
    id: 'U2', track: 'graphs', title: 'Representing graphs', minutes: 45,
    summary: 'Adjacency matrix, adjacency list (star or linked) and incidence matrix, and what each costs.',
    outcomes: ['AL-Foundational CS 1a', 'AL-Complexity CS 8'],
    content: [
      { type: 'h', text: 'Three representations (Drozdek §8.1, pp. 377–379)' },
      { type: 'def', items: [
        ['Adjacency matrix', 'A |V| × |V| table with a 1 in row i, column j when edge(vivj) exists. Undirected graphs give a symmetric matrix. For a multigraph, the cell can hold the number of edges.'],
        ['Adjacency list', 'For each vertex, the list of its neighbours. Drozdek shows two forms: a star table (rows of neighbours) and linked lists of nodes.'],
        ['Incidence matrix', 'A |V| × |E| table with a 1 when edge j is incident with vertex i. A column with a single 1 is a loop.'],
      ] },
      { type: 'note', text: 'The order of the vertices is a free choice, so one graph with n vertices has up to n! different adjacency matrices.' },
      { type: 'h', text: 'Which is best?' },
      { type: 'table', head: ['Task', 'Adjacency matrix', 'Adjacency list'], rows: [
        ['Space', 'Θ(V²)', 'Θ(V + E)'],
        ['Is (u, v) an edge?', 'O(1): one cell', 'O(deg(u)): walk u’s list'],
        ['Visit all neighbours of v', '|V| steps: the whole row', 'deg(v) steps'],
        ['Add or delete an edge', 'Flip one cell', 'Update a linked list'],
      ] },
      { type: 'p', text: 'Drozdek’s answer is “it depends on the problem”. Dense graphs, with close to V² edges, suit a matrix. Sparse graphs, with far fewer edges, suit lists.' },
      { type: 'demo', label: 'Open a sparse graph to compare the panels', graph: '6 5 0\n0 1\n1 2\n2 3\n3 4\n4 5\n' },
    ],
  },
  {
    id: 'U3', track: 'graphs', title: 'Graph ADT operations', minutes: 40,
    summary: 'Adding and removing vertices and edges, and what each operation changes in each representation.',
    outcomes: ['AL-Foundational CS 1a', 'AL-Foundational CS 1b'],
    content: [
      { type: 'h', text: 'The Graph ADT' },
      { type: 'list', items: ['addVertex(): a new vertex with no edges.', 'addEdge(u, v) and removeEdge(u, v).', 'hasEdge(u, v): is there an edge from u to v?', 'neighbours(v) and degree(v).'] },
      { type: 'h', text: 'What changes' },
      { type: 'table', head: ['Operation', 'Adjacency matrix', 'Adjacency list'], rows: [
        ['addEdge(u, v), directed', 'cell [u][v] becomes 1', 'v joins u’s list'],
        ['addEdge(u, v), undirected', 'cells [u][v] and [v][u] become 1', 'v joins u’s list and u joins v’s'],
        ['removeEdge', 'the same cells become 0', 'the nodes are unlinked'],
        ['addVertex', 'a new row and column of 0s', 'a new, empty list'],
      ] },
      { type: 'note', text: 'The most common slip: forgetting that an undirected edge goes both ways.' },
      { type: 'demo', label: 'Practise on Build a graph', graph: '4 2 0\n0 1\n2 3\n' },
    ],
  },
  {
    id: 'U4', track: 'graphs', title: 'Reachability', minutes: 40,
    summary: 'What it means for one vertex to reach another, found with depth-first and breadth-first search.',
    outcomes: ['AL-Foundational CS 2', 'MSF-Discrete 7b'],
    content: [
      { type: 'p', text: 'Vertex v is reachable from u when a path leads from u to v. A search from u finds every vertex it can reach.' },
      { type: 'h', text: 'Depth-first search (Drozdek §8.2, p. 379)' },
      { type: 'p', text: 'Visit a vertex, mark it as visited, then visit each unvisited neighbour in turn, going as deep as possible before backing up. Trees need no marks, but graphs can have cycles: without marks the search would go round a cycle forever.' },
      { type: 'h', text: 'Breadth-first search' },
      { type: 'p', text: 'Visit the start, then all its neighbours, then their neighbours, level by level. It uses a queue where DFS uses recursion (or a stack).' },
      { type: 'note', text: 'Both visit each vertex once. With an adjacency list a search costs O(V + E); with a matrix, O(V²), because each visit scans a whole row. (Drozdek §8.14, exercise 3 asks for BFS’s complexity.)' },
      { type: 'demo', label: 'Trace a search on a graph with a cycle', graph: '5 5 1\n0 1\n1 2\n2 0\n2 3\n4 3\n' },
    ],
  },
  {
    id: 'U5', track: 'closure', title: 'Transitive closure as a relation', minutes: 40,
    summary: 'A graph as a relation R, its transitive closure R⁺, and the reachability matrix.',
    outcomes: ['MSF-Discrete 1b', 'MSF-Discrete 1c', 'AL-Foundational KA 8a'],
    content: [
      { type: 'p', text: 'A digraph is a relation on its vertices: u R v when there is an edge u → v. The transitive closure R⁺ is the smallest transitive relation that contains R: u R⁺ v exactly when a path of one or more edges leads from u to v.' },
      { type: 'p', text: 'Written as a matrix, R⁺ is the reachability matrix: a 1 in row u, column v means “u reaches v”.' },
      { type: 'h', text: 'Reading the diagonal' },
      { type: 'p', text: 'R⁺[v][v] = 1 only when a path leads from v back to itself: v lies on a cycle or has a loop. Drozdek uses the same idea in §8.3.1: a changed diagonal signals a cycle.' },
      { type: 'h', text: 'Connectivity in digraphs (Drozdek §8.6.2, p. 402)' },
      { type: 'def', items: [
        ['Strongly connected', 'Every vertex reaches every other vertex: R⁺ has a 1 in every off-diagonal cell.'],
        ['Weakly connected', 'Connected once edge directions are ignored.'],
      ] },
      { type: 'note', text: 'Drozdek exercise 31 (§8.14): a tournament has exactly one edge between every two vertices. Can a transitive tournament have a cycle? Think about what transitivity forces along the cycle.' },
      { type: 'demo', label: 'Turn on Closure for this graph', graph: '4 3 1\n0 1\n1 2\n2 3\n' },
    ],
  },
  {
    id: 'U6', track: 'closure', title: "Warshall's algorithm", minutes: 50,
    summary: "Build the closure one intermediate vertex at a time: dynamic programming in three nested loops.",
    outcomes: ['AL-Foundational KA 8a', 'AL-Foundational KA 8b', 'AL-Strategies CS 2', 'AL-Complexity CS 4'],
    content: [
      { type: 'p', text: 'R(k) records the pairs connected by a path whose in-between vertices all come from the first k vertices. R(0) is the adjacency matrix and R(n) is the closure.' },
      { type: 'formula', text: 'r(k)[i][j] = r(k−1)[i][j] OR ( r(k−1)[i][k] AND r(k−1)[k][j] )' },
      { type: 'p', text: 'In words: i reaches j through the first k vertices if it already did, or if i reaches k and k reaches j.' },
      { type: 'h', text: 'From Drozdek’s WFIalgorithm (§8.3.1, pp. 390–391)' },
      { type: 'p', text: 'Drozdek’s all-pairs shortest-path algorithm by Warshall, Floyd and Ingerman has the same three loops with the intermediate vertex in the outer loop. Replace min with OR and + with AND on a true/false matrix and you get Warshall’s closure algorithm, from his 1962 paper “A Theorem on Boolean Matrices”.' },
      { type: 'list', items: ['The outer loop must choose k, the intermediate vertex. Put it inside and some longer chains are never found.', 'Each R(k) is built from R(k−1): that is dynamic programming.', 'Three loops over n: Θ(V³) time. Updating in place needs only Θ(V²) space.'] },
      { type: 'demo', label: "Step through Warshall's on Build a graph", graph: '4 4 1\n0 1\n1 2\n2 3\n3 1\n' },
    ],
  },
  {
    id: 'U7', track: 'closure', title: 'Comparing approaches', minutes: 45,
    summary: "Repeated DFS or Warshall's? Matrix or lists? Recursive or iterative? Speed is not the only reason.",
    outcomes: ['AL-Foundational CS 4', 'AL-Foundational CS 6', 'AL-Strategies CS 5', 'AL-Complexity CS 7', 'AL-Complexity CS 8'],
    content: [
      { type: 'table', head: ['', 'Repeated DFS', "Warshall's"], rows: [
        ['Idea', 'Search from every vertex', 'Add one intermediate vertex at a time'],
        ['Time with adjacency lists', 'O(V(V + E))', 'Θ(V³) (needs a matrix)'],
        ['Time with a matrix', 'O(V³)', 'Θ(V³)'],
        ['Style', 'Recursive', 'Iterative'],
        ['Code', 'A helper method and visited marks', 'Three short nested loops'],
      ] },
      { type: 'p', text: 'Drozdek (§8.3.1, p. 391) notes that the all-pairs method suits dense, nearly complete graphs, while for sparse graphs it can pay to run a one-source method from each vertex.' },
      { type: 'h', text: 'Beyond speed (AL-Foundational CS 6)' },
      { type: 'list', items: ['Programming time: Warshall’s is a few lines and hard to get subtly wrong once the loop order is right.', 'Maintainability: a reader can check three loops at a glance.', 'Input patterns: if the graph is already a matrix and dense, Warshall’s is natural; if it is a huge sparse list, repeated DFS avoids building a V² matrix of edges.'] },
      { type: 'p', text: 'Try problem P11 in the test section to time both on your own computer’s JVM.' },
    ],
  },
  {
    id: 'U8', track: 'closure', title: 'Apply it', minutes: 40,
    summary: 'Model a real problem as a graph, compute its closure and read off the answers.',
    outcomes: ['AL-Foundational CS 3', 'MSF-Discrete 7c'],
    content: [
      { type: 'p', text: 'Many questions are really reachability questions. Model the problem as a digraph, compute R⁺, and each question becomes a lookup.' },
      { type: 'table', head: ['Problem', 'Vertices', 'Edge u → v means', 'Closure answers'], rows: [
        ['Module prerequisites', 'Modules', 'u must be passed before v', 'Is u needed, directly or not, for v? Is any module its own prerequisite?'],
        ['Network reachability', 'Routers', 'u can send to v', 'Can a packet get from u to v?'],
        ['Social links', 'People', 'u follows v', 'Is there a chain of follows from u to v?'],
        ['Program call graph', 'Methods', 'u calls v', 'Can u end up calling v? Is there recursion?'],
      ] },
      { type: 'demo', label: 'Open a sample prerequisite graph', graph: '6 6 1\n0 1\n1 2\n2 3\n4 3\n1 5\n4 5\n' },
      { type: 'p', text: 'Problem P9 in the test section asks you to code these questions.' },
    ],
  },
];

// ---------------- check generators ----------------
const MODULES = ['Programming 1', 'Programming 2', 'Data Structures', 'Algorithms', 'Discrete Maths', 'Databases'];

function genU0(rand) {
  return [
    mcq('q1', 'R = {(1, 2), (2, 3)} on the set {1, 2, 3}. Which pair must be added to make R transitive?', '(1, 3)', [{ text: '(3, 1)', why: 'Transitivity follows the direction: 1 → 2 and 2 → 3 give 1 → 3, not 3 → 1.' }, { text: '(2, 1)', why: 'That would make R symmetric, not transitive.' }, { text: 'Nothing; it is already transitive', why: '1 R 2 and 2 R 3, but 1 R 3 is missing.' }], 'Transitive means a R b and b R c give a R c, so 1 R 3 is needed.', rand),
    mcq('q2', 'In Java, int[][] a = new int[3][5]. How many rows does a have?', '3', [{ text: '5', why: 'The first size is the number of rows; the second is the number of columns.' }, { text: '15', why: 'That is the total number of cells.' }, { text: '8', why: 'The sizes multiply, they do not add.' }], 'a.length is 3 rows; a[0].length is 5 columns.', rand),
    mcq('q3', 'Three nested loops, each running from 0 to n − 1, do how much work?', 'O(n³)', [{ text: 'O(3n)', why: 'Nested loops multiply: the inner body runs n × n × n times.' }, { text: 'O(n²)', why: 'That would be two nested loops.' }, { text: 'O(n log n)', why: 'Nothing halves the work here.' }], 'n × n × n iterations: O(n³).', rand),
    mcq('q4', 'What does every recursive method need so that it stops?', 'A base case', [{ text: 'A loop', why: 'Recursion replaces a loop; it still needs a case that does not recurse.' }, { text: 'A return type of void', why: 'Return type has nothing to do with stopping.' }, { text: 'A static variable', why: 'It needs a case that returns without calling itself.' }], 'Without a base case the calls never end, giving a StackOverflowError.', rand),
    mcq('q5', 'a is a square boolean matrix. Which expression is true when a is symmetric?', 'a[i][j] == a[j][i] for every i and j', [{ text: 'a[i][i] is true for every i', why: 'That describes the diagonal (reflexive), not symmetry.' }, { text: 'a[i][j] is true for every i and j', why: 'That is a matrix of all 1s.' }, { text: 'a[0][j] == a[j][0] for every j', why: 'Symmetry must hold for every row, not just row 0.' }], 'Symmetric means mirrored across the diagonal.', rand),
  ];
}

function genU1(rand) {
  const n = ri(rand, 4, 6);
  const qs = [
    mcq('q1', `How many edges does the complete graph K${n} have?`, String(n * (n - 1) / 2), [
      { text: String(n), why: `That counts each vertex once. K${n} has n(n − 1)/2 = ${n} × ${n - 1} / 2 edges.` },
      { text: String(n * (n - 1)), why: 'That counts every edge twice, once from each end. Divide by 2.' },
      { text: String(n * n), why: 'Kₙ has no loops, so a vertex is not joined to itself.' },
    ], `Each of the ${n} vertices joins ${n - 1} others, and each edge is counted from both ends: ${n} × ${n - 1} / 2.`, rand),
    mcq('q2', 'A graph has 7 edges. What is the sum of all its vertex degrees?', '14', [
      { text: '7', why: 'Each edge adds 1 to the degree of each of its two ends.' },
      { text: '49', why: 'Degrees add up to twice the number of edges, not its square.' },
      { text: 'It depends on the number of vertices', why: 'It does not: every edge always contributes exactly 2 to the total.' },
    ], 'Sum of degrees = 2 × |E| (Drozdek §8.14, exercise 2).', rand),
    mcq('q3', 'Two vertices are joined by two separate edges, and one vertex has an edge to itself. What type of graph is this?', 'Pseudograph', [
      { text: 'Multigraph', why: 'A multigraph allows repeated edges but not loops. The loop makes it a pseudograph.' },
      { text: 'Simple graph', why: 'Simple graphs allow neither repeated edges nor loops.' },
      { text: 'Complete graph', why: 'Completeness is about every pair being joined, not about loops.' },
    ], 'Loops are allowed only in pseudographs (Drozdek Ch. 8 intro, p. 376).', rand),
    mcq('q4', 'What is the difference between a circuit and a cycle?', 'A cycle is a circuit in which all the vertices are different', [
      { text: 'A circuit has a direction and a cycle does not', why: 'Both can occur in directed and undirected graphs.' },
      { text: 'They are the same thing', why: 'A circuit may revisit a vertex; a cycle may not.' },
      { text: 'A cycle may repeat edges', why: 'Neither repeats an edge; a cycle additionally repeats no vertex.' },
    ], 'Circuit: closed path with no repeated edge. Cycle: also no repeated vertex (Drozdek p. 377).', rand),
    mcq('q5', 'A tree has 10 vertices. How many edges does it have?', '9', [
      { text: '10', why: 'One more edge than n − 1 always closes a cycle, and trees are acyclic.' },
      { text: '45', why: 'That is K₁₀, the complete graph.' },
      { text: 'It depends on its shape', why: 'Every tree with n vertices has exactly n − 1 edges (Drozdek §8.14, exercise 5).' },
    ], 'A tree with n vertices has n − 1 edges.', rand),
    mcq('q6', 'In a graph, vertex d has no edges at all. What is d called?', 'An isolated vertex', [
      { text: 'A leaf', why: 'A leaf has degree 1.' },
      { text: 'A loop', why: 'A loop is an edge from a vertex to itself.' },
      { text: 'A sink', why: 'A sink has incoming but no outgoing edges.' },
    ], 'deg(d) = 0 makes d isolated (Drozdek p. 377).', rand),
  ];
  return qs;
}

function genU2(rand) {
  const n = 4;
  const a = randomMatrix(rand, n, 0.45, { directed: false });
  if (!matrixToEdges(a, false).length) a[0][1] = a[1][0] = true;
  return [
    { id: 'q1', type: 'matrix', prompt: `Fill in the adjacency matrix of this undirected graph. Edges: ${edgeWords(a, false)}.`, n, labels: [...Array(n)].map((_, i) => L(i)), mode: 'adjacency', directed: false, graph: gText(a, false) },
    mcq('q2', 'A graph has 10,000 vertices and about 20,000 edges. Which representation saves the most space?', 'Adjacency list', [
      { text: 'Adjacency matrix', why: 'A matrix needs V² = 100 million cells, almost all of them 0, for a sparse graph like this.' },
      { text: 'Incidence matrix', why: 'That needs V × E = 200 million cells.' },
      { text: 'They all use the same space', why: 'Space is Θ(V²) for the matrix and Θ(V + E) for lists.' },
    ], 'Sparse graph: lists need about V + E = 30,000 entries.', rand),
    mcq('q3', 'In an incidence matrix, one column has a single 1. What does that column stand for?', 'A loop', [
      { text: 'An isolated vertex', why: 'Columns are edges, not vertices. An isolated vertex is a row of 0s.' },
      { text: 'A directed edge', why: 'A normal edge has two 1s, one for each end.' },
      { text: 'A missing edge', why: 'Every column is an edge that exists.' },
    ], 'A loop has the same vertex at both ends, so only one row is marked (Drozdek p. 379).', rand),
    mcq('q4', 'You must list all the neighbours of vertex v many times. Which representation makes that fastest?', 'Adjacency list: deg(v) steps', [
      { text: 'Adjacency matrix: |V| steps', why: 'The matrix scans the whole row, even the 0s.' },
      { text: 'Both take O(1)', why: 'Listing neighbours takes at least one step per neighbour.' },
      { text: 'Incidence matrix', why: 'You would scan every column to find v’s edges.' },
    ], 'Drozdek §8.1: processing the neighbours of v takes deg(v) steps with a list and |V| with a matrix.', rand),
    { id: 'q5', type: 'text', prompt: 'A social network has 2 million users, each following about 150 others. Which representation would you choose, and why? Two or three sentences.',
      rubric: [{ idea: 'Chooses adjacency lists', any: ['list'] }, { idea: 'Says the graph is sparse', any: ['sparse', 'few edges', 'far fewer'] }, { idea: 'Gives the space cost', any: ['v²', 'v^2', 'n²', 'n^2', 'v+e', 'v + e', 'space', 'memory'] }],
      model: 'Adjacency lists. The graph is sparse: about 300 million edges against 4 × 10¹² possible pairs, so a matrix would waste almost all its Θ(V²) cells, while lists need Θ(V + E).' },
  ];
}

function genU3(rand) {
  const n = 4;
  const u = ri(rand, 0, n - 1);
  let v = ri(rand, 0, n - 2); if (v >= u) v++;
  const d = ri(rand, 0, n - 1);
  return [
    { id: 'q1', type: 'cells', prompt: `An undirected graph on a, b, c, d is stored in an adjacency matrix. Select every cell that changes when you call addEdge(${L(u)}, ${L(v)}).`, n, labels: [...Array(n)].map((_, i) => L(i)), answer: [[u, v], [v, u]], directed: false },
    { id: 'q2', type: 'cells', prompt: `Now the graph is directed. Select every cell that changes when you call addEdge(${L(v)}, ${L(u)}).`, n, labels: [...Array(n)].map((_, i) => L(i)), answer: [[v, u]], directed: true },
    mcq('q3', 'You call addVertex() on a graph stored in a 4 × 4 adjacency matrix. What must happen?', 'A new 5 × 5 matrix: copy the old cells, with a new row and column of 0s', [
      { text: 'Nothing; vertex 4 is used straight away', why: 'Index 4 is outside a 4 × 4 array: ArrayIndexOutOfBoundsException.' },
      { text: 'Add one new row', why: 'The new vertex also needs a column, for edges into it.' },
      { text: 'Set the diagonal cell [4][4] to 1', why: 'A new vertex has no edges, and a 1 there would be a loop.' },
    ], 'A matrix has fixed size, so it must be rebuilt one row and one column larger.', rand),
    mcq('q4', `Undirected graph with edges a–b, a–c and a loop at ${L(d)}. What is deg(${L(d)})?`, d === 0 ? '4' : '2', [
      { text: d === 0 ? '3' : '1', why: 'A loop adds 2 to its vertex’s degree: both of its ends are at that vertex.' },
      { text: d === 0 ? '2' : '0', why: 'The loop is an edge incident with the vertex, so it counts.' },
      { text: d === 0 ? '5' : '3', why: 'Count each incident edge once, and a loop twice.' },
    ], 'deg counts incident edges, with a loop counting 2.', rand),
  ];
}

function genU4(rand) {
  const n = 6;
  let a, s, reach;
  for (let t = 0; t < 40; t++) {
    a = randomMatrix(rand, n, 0.25); s = ri(rand, 0, n - 1);
    reach = reachableFrom(a, s).seen;
    const cnt = reach.filter(Boolean).length;
    if (cnt >= 3 && cnt <= 5) break;
  }
  const dfs = reachableFrom(a, s).order.map(L).join(', ');
  return [
    { id: 'q1', type: 'set', prompt: `Directed graph with edges ${edgeWords(a)}. Tick every vertex reachable from ${L(s)} (count ${L(s)} itself).`, labels: [...Array(n)].map((_, i) => L(i)), graph: gText(a), start: s },
    mcq('q2', `Depth-first search from ${L(s)} on the same graph, visiting neighbours in alphabetical order. In what order are vertices visited?`, dfs, [
      ...shuffle(rand, [
        { text: reachableFrom(a, s).order.slice().reverse().map(L).join(', '), why: 'DFS starts at the start vertex and goes deep before backing up.' },
        { text: [...Array(n)].map((_, i) => L(i)).filter((_, i) => reach[i]).join(', '), why: 'That is alphabetical order, not the order DFS reaches the vertices.' },
        { text: dfs.split(', ').slice(0, 1).concat(dfs.split(', ').slice(1).reverse()).join(', '), why: 'DFS follows the first neighbour as far as it can before trying the next one.' },
      ]).filter(d => d.text !== dfs).slice(0, 3),
    ], 'Visit, mark, then recurse into each unvisited neighbour in order.', rand),
    mcq('q3', 'Why does DFS on a graph need visited marks when DFS on a tree does not?', 'Graphs can have cycles, so without marks the search can loop forever', [
      { text: 'Graphs have more vertices than trees', why: 'Size is not the problem; cycles are.' },
      { text: 'Marks make DFS faster but are optional', why: 'Without them DFS may never stop on a cycle.' },
      { text: 'Trees are always directed', why: 'The difference is that trees have no cycles.' },
    ], 'Drozdek §8.2: tree traversals would loop forever on a graph with a cycle.', rand),
    mcq('q4', 'What does breadth-first search use to decide which vertex to visit next?', 'A queue', [
      { text: 'A stack', why: 'A stack gives depth-first order.' },
      { text: 'A priority queue', why: 'That is Dijkstra’s algorithm, which orders vertices by distance.' },
      { text: 'Recursion', why: 'Recursion gives depth-first order.' },
    ], 'BFS visits level by level, first in, first out.', rand),
  ];
}

function genU5(rand) {
  const n = 4;
  const a = nonTrivialDigraph(rand, n, 0.3);
  return [
    { id: 'q1', type: 'matrix', prompt: `Fill in the transitive closure R⁺ of the digraph with edges ${edgeWords(a)}. A 1 means a path of one or more edges.`, n, labels: [...Array(n)].map((_, i) => L(i)), mode: 'closure', graph: gText(a) },
    mcq('q2', 'In the closure matrix, R⁺[c][c] = 1. What does that tell you?', 'c lies on a cycle (or has a loop)', [
      { text: 'Every vertex reaches itself, so the whole diagonal is 1', why: 'The closure counts paths of one or more edges. A vertex reaches itself only if a path leads back to it.' },
      { text: 'c is isolated', why: 'An isolated vertex has a 0 on the diagonal.' },
      { text: 'c reaches every other vertex', why: 'That would be a row of 1s, not one diagonal cell.' },
    ], 'A diagonal 1 means a path from c back to c.', rand),
    mcq('q3', 'A digraph is strongly connected exactly when its closure matrix…', 'has a 1 in every cell off the diagonal', [
      { text: 'is symmetric', why: 'Symmetric closures can still have unreachable pairs, for example two separate cycles.' },
      { text: 'has a 1 in every diagonal cell', why: 'Every vertex lying on a cycle does not mean they reach each other.' },
      { text: 'equals the adjacency matrix', why: 'That only means the edge relation is already transitive.' },
    ], 'Strongly connected: every vertex reaches every other (Drozdek §8.6.2).', rand),
    mcq('q4', 'A transitive tournament has exactly one edge between every two vertices and is transitive. Can it have a cycle?', 'No', [
      { text: 'Yes, any tournament can', why: 'Suppose a → b → c → a. Transitivity forces a → c, but there is already c → a, giving two edges between a and c.' },
      { text: 'Only if it has 3 vertices', why: 'The same contradiction appears for a cycle of any length.' },
      { text: 'Only if it has a loop', why: 'Tournaments have no loops; they join distinct vertices.' },
    ], 'Drozdek §8.14 exercise 31: transitivity along a cycle would need edges in both directions.', rand),
  ];
}

function genU6(rand) {
  const n = 4;
  const a = nonTrivialDigraph(rand, n, 0.35);
  const steps = warshallTrace(a);
  let k = 1;
  for (let t = 0; t < n; t++) if (steps[t + 1].changed.length) { k = t; break; }
  const before = steps[k].matrix;
  // faulty trace: flip one cell of R(k) that is not on the diagonal
  const after = steps[k + 1].matrix;
  let bad = [0, 1];
  for (let t = 0; t < 30; t++) { const i = ri(rand, 0, n - 1), j = ri(rand, 0, n - 1); if (i !== j) { bad = [i, j]; break; } }
  const cellName = ([i, j]) => `[${L(i)}][${L(j)}]`;
  const others = shuffle(rand, [[0, 1], [1, 2], [2, 3], [3, 0], [1, 3], [2, 0]].filter(c => c[0] !== bad[0] || c[1] !== bad[1])).slice(0, 3);
  return [
    { id: 'q1', type: 'matrix', prompt: `Digraph with edges ${edgeWords(a)}. Here is the matrix before step k = ${L(k)} (vertices before ${L(k)} already used as intermediates). Fill in the matrix after step k = ${L(k)}.`, n, labels: [...Array(n)].map((_, i) => L(i)), mode: 'warshall-step', graph: gText(a), k, given: before.map(r => r.map(x => (x ? 1 : 0))) },
    mcq('q2', `In a trace of the same graph, the matrix after step k = ${L(k)} shows ${cellName(bad)} = ${after[bad[0]][bad[1]] ? 0 : 1}. Which cell is wrong?`, cellName(bad), others.map(c => ({ text: cellName(c), why: `Check ${cellName(c)}: it matches r(k−1) OR (r[i][k] AND r[k][j]).` })), `Recompute ${cellName(bad)} with the rule r(k−1)[i][j] OR (r(k−1)[i][k] AND r(k−1)[k][j]).`, rand),
    mcq('q3', "Which algorithmic paradigm is Warshall's algorithm an example of?", 'Dynamic programming', [
      { text: 'Greedy', why: 'Nothing is chosen greedily; every R(k) is built fully from R(k−1).' },
      { text: 'Divide and conquer', why: 'The problem is not split into independent halves.' },
      { text: 'Brute force', why: 'Brute force would try every possible path; Warshall’s reuses earlier results instead.' },
    ], 'Each R(k) is computed from the stored R(k−1): dynamic programming (CS2023 AL-Strategies).', rand),
    mcq('q4', "What is the running time of Warshall's algorithm on a graph with V vertices?", 'Θ(V³)', [
      { text: 'Θ(V²)', why: 'There are three nested loops over the vertices, not two.' },
      { text: 'Θ(V + E)', why: 'That is one graph search with adjacency lists.' },
      { text: 'Θ(E log V)', why: 'That is Dijkstra’s with a heap.' },
    ], 'Three loops, each V times: V³ (Drozdek p. 391).', rand),
    mcq('q5', 'Why must the loop over k be the outermost loop?', 'Every pair must be checked against intermediate k only after all paths through earlier vertices are known', [
      { text: 'It runs faster that way', why: 'The running time is Θ(V³) in any order; with k inside, the answer is wrong.' },
      { text: 'Java requires the loop variables in that order', why: 'Java does not care; the algorithm does.' },
      { text: 'It does not matter which loop is outermost', why: 'With k inside, some longer chains are never found: see problem P10.' },
    ], 'R(k) depends on the whole of R(k−1).', rand),
  ];
}

function genU7(rand) {
  return [
    mcq('q1', 'You need the closure of a sparse graph with 50,000 vertices stored as adjacency lists. Which method is the better fit?', 'Repeated DFS: O(V(V + E))', [
      { text: "Warshall's: Θ(V³)", why: 'V³ is about 1.25 × 10¹⁴ steps, and it needs a V × V matrix first.' },
      { text: 'They take the same time', why: 'With lists and few edges, V(V + E) is far smaller than V³.' },
      { text: 'Neither can compute a closure', why: 'Both can; the question is cost.' },
    ], 'Sparse graph in lists: search from each vertex (Drozdek p. 391).', rand),
    mcq('q2', 'The graph is small (40 vertices), dense and already in an adjacency matrix. Which is the more sensible choice?', "Warshall's: short, iterative and easy to check", [
      { text: 'Repeated DFS, because recursion is always faster', why: 'Recursion is not faster, and on a dense matrix both are Θ(V³).' },
      { text: 'Convert to lists first, then repeated DFS', why: 'Conversion adds work and code for no gain on a small dense graph.' },
      { text: 'Write a new algorithm', why: 'Warshall’s already does this in a few lines.' },
    ], 'Factors beyond speed: programming time and maintainability (CS2023 AL-Foundational CS 6).', rand),
    mcq('q3', 'Which statement about recursive DFS and iterative Warshall’s is true?', 'Both give the same closure; DFS can overflow the call stack on very deep graphs', [
      { text: 'Only the recursive one is correct', why: 'Both are correct when written properly.' },
      { text: 'Iterative code is always slower', why: 'Iteration avoids call overhead; it is often faster.' },
      { text: 'Recursive DFS cannot handle cycles', why: 'It can, with visited marks.' },
    ], 'Recursion depth can reach V, which is a real limit for large graphs (CS2023 AL-Strategies CS 5).', rand),
    { id: 'q4', type: 'text', prompt: 'A tutor says: "Warshall\'s is always better because it is only three loops." Do you agree? Give two reasons in two or three sentences.',
      rubric: [{ idea: 'Mentions graph density or size', any: ['dense', 'sparse', 'density', 'size', 'large'] }, { idea: 'Uses complexity', any: ['v^3', 'v³', 'n^3', 'n³', 'cubic', 'v+e', 'v + e', 'o('] }, { idea: 'Names a factor beyond speed', any: ['maintain', 'readab', 'simple', 'short', 'programming time', 'easy', 'stack'] }],
      model: 'Not always. On sparse graphs stored as lists, repeated DFS costs O(V(V + E)), far less than Θ(V³). But for small or dense graphs Warshall’s short loops are quicker to write and easier to check, which also matters.' },
  ];
}

function genU8(rand) {
  const n = 6;
  const a = Array.from({ length: n }, () => Array(n).fill(false));
  // Programming 1 -> Programming 2 -> Data Structures -> Algorithms; Discrete Maths -> Algorithms; Programming 2 -> Databases
  a[0][1] = a[1][2] = a[2][3] = a[4][3] = a[1][5] = true;
  if (rand() < 0.5) a[4][5] = true;
  const r = closure(a);
  const target = 3;
  const names = MODULES;
  return [
    { id: 'q1', type: 'set', prompt: `Prerequisites: ${matrixToEdges(a).map(([u, v]) => `${names[u]} → ${names[v]}`).join('; ')}. Tick every module that must be passed (directly or indirectly) before ${names[target]}.`, labels: names, mode: 'prereq-of', graph: gText(a), target },
    mcq('q2', `Is ${names[0]} needed, directly or indirectly, for ${names[5]}?`, r[0][5] ? 'Yes' : 'No', [{ text: r[0][5] ? 'No' : 'Yes', why: r[0][5] ? `${names[0]} → ${names[1]} → ${names[5]} is a chain of prerequisites.` : 'No chain of prerequisites leads there.' }], 'Look up R⁺[Programming 1][Databases].', rand),
    mcq('q3', 'Someone adds the rule Algorithms → Programming 1. What does the closure now show?', 'A diagonal 1: a circular prerequisite, so nobody could ever start', [
      { text: 'Nothing changes', why: 'Algorithms already needs Programming 1, so this closes a cycle.' },
      { text: 'Algorithms becomes optional', why: 'Prerequisites do not become optional; the plan becomes impossible.' },
      { text: 'Only Programming 1 is affected', why: 'Every module on the cycle now has a 1 on the diagonal.' },
    ], 'A cycle shows up as 1s on the closure’s diagonal.', rand),
    { id: 'q4', type: 'text', prompt: 'Pick a real problem you know (not module prerequisites). Say what the vertices and edges are, and one question the closure would answer.',
      rubric: [{ idea: 'Names the vertices', any: ['vert', 'node', 'each', 'are the', 'represent'] }, { idea: 'Names the edges with a direction', any: ['edge', 'arrow', '→', '->', 'link', 'from', 'to'] }, { idea: 'States a reachability question', any: ['reach', 'can ', 'path', 'chain', 'indirect', 'get from'] }],
      model: 'Example: vertices are bus stops and an edge u → v means a bus goes directly from u to v. The closure answers: can I get from Hatfield to Rosebank by bus at all, possibly changing buses?' },
  ];
}

const GENERATORS = { U0: genU0, U1: genU1, U2: genU2, U3: genU3, U4: genU4, U5: genU5, U6: genU6, U7: genU7, U8: genU8 };

export function generateCheck(unitId, seed) {
  const rand = seededRandom(`${unitId}|${seed}`);
  return GENERATORS[unitId](rand);
}

/** Strip answers before sending a check to the browser. */
export function publicCheck(questions) {
  return questions.map(q => {
    const { rubric, model, answer, ...rest } = q;
    if (q.type === 'mcq') return { ...rest, options: q.options.map(o => ({ id: o.id, text: o.text })), explain: undefined };
    return rest;
  });
}

function graphFromText(t) {
  const tok = t.trim().split(/\s+/).map(Number);
  const [n, m, d] = tok;
  const a = Array.from({ length: n }, () => Array(n).fill(false));
  for (let e = 0; e < m; e++) { const u = tok[3 + 2 * e], v = tok[4 + 2 * e]; a[u][v] = true; if (!d) a[v][u] = true; }
  return a;
}
const pathWords = (p, labels) => p.map(i => labels[i]).join(' → ');

/** Grade one question. Returns { correct, feedback, misconception? }. */
export function gradeQuestion(q, response) {
  const labels = q.labels;
  if (q.type === 'mcq') {
    const chosen = q.options.find(o => o.id === response);
    if (!chosen) return { correct: false, feedback: 'No option was chosen.' };
    if (chosen.correct) return { correct: true, feedback: q.explain };
    return { correct: false, feedback: `${chosen.why} ${q.explain}`, misconception: chosen.why };
  }
  if (q.type === 'matrix') {
    const a = graphFromText(q.graph);
    let target;
    if (q.mode === 'adjacency') target = a;
    else if (q.mode === 'closure') target = closure(a);
    else if (q.mode === 'warshall-step') target = warshallTrace(a)[q.k + 1].matrix;
    const resp = response || [];
    for (let i = 0; i < q.n; i++) for (let j = 0; j < q.n; j++) {
      const got = !!(resp[i] && resp[i][j]);
      if (got !== target[i][j]) {
        const cell = `[${labels[i]}][${labels[j]}]`;
        let why;
        if (q.mode === 'adjacency') {
          why = target[i][j] ? `${labels[i]}–${labels[j]} is an edge, so ${cell} is 1.` : `There is no edge between ${labels[i]} and ${labels[j]}, so ${cell} is 0.`;
          if (!q.directed && !!(resp[j] && resp[j][i]) !== got) why += ' The graph is undirected, so the matrix must be symmetric: check the mirror cell too.';
        } else if (q.mode === 'closure') {
          const p = findPath(a, i, j);
          why = p ? `${cell} should be 1: ${pathWords(p, labels)}.` : i === j ? `${cell} should be 0: ${labels[i]} is not on a cycle, so no path leads back to it.` : `${cell} should be 0: no path leads from ${labels[i]} to ${labels[j]}.`;
        } else {
          const before = q.given;
          const k = q.k;
          why = target[i][j]
            ? (before[i][j] ? `${cell} was already 1 before this step and stays 1.` : `${cell} should be 1 at k = ${labels[k]}: ${labels[i]} reaches ${labels[k]}, and ${labels[k]} reaches ${labels[j]}.`)
            : `${cell} should be 0: before this step ${labels[i]} ${before[i][k] ? 'reaches' : 'does not reach'} ${labels[k]}, and ${labels[k]} ${before[k][j] ? 'reaches' : 'does not reach'} ${labels[j]}, so going through ${labels[k]} does not help.`;
        }
        return { correct: false, feedback: `The first wrong cell is ${cell}. ${why}` };
      }
    }
    return { correct: true, feedback: 'Every cell is right.' };
  }
  if (q.type === 'cells') {
    const want = new Set(q.answer.map(([i, j]) => `${i},${j}`));
    const got = new Set((response || []).map(([i, j]) => `${i},${j}`));
    const missing = [...want].filter(x => !got.has(x));
    const extra = [...got].filter(x => !want.has(x));
    if (!missing.length && !extra.length) return { correct: true, feedback: 'Exactly those cells change.' };
    const nm = s => { const [i, j] = s.split(',').map(Number); return `[${labels[i]}][${labels[j]}]`; };
    if (!q.directed && missing.length === 1 && !extra.length) {
      const [i, j] = missing[0].split(',').map(Number);
      return { correct: false, feedback: `You changed ${nm(`${j},${i}`)} but not ${nm(missing[0])}. The graph is undirected, so both change.`, misconception: 'one-direction' };
    }
    if (q.directed && extra.length === 1 && !missing.length) return { correct: false, feedback: `${nm(extra[0])} does not change: in a directed graph only the cell for the new direction changes.` };
    return { correct: false, feedback: `${missing.length ? `Missing: ${missing.map(nm).join(', ')}. ` : ''}${extra.length ? `These do not change: ${extra.map(nm).join(', ')}.` : ''}` };
  }
  if (q.type === 'set') {
    const a = graphFromText(q.graph);
    let want;
    if (q.mode === 'prereq-of') { const r = closure(a); want = a.map((_, i) => r[i][q.target]); }
    else want = reachableFrom(a, q.start).seen;
    const got = labels.map((_, i) => !!(response || []).includes(i));
    const missing = want.map((w, i) => (w && !got[i] ? i : -1)).filter(i => i >= 0);
    const extra = want.map((w, i) => (!w && got[i] ? i : -1)).filter(i => i >= 0);
    if (!missing.length && !extra.length) return { correct: true, feedback: 'That is the full set.' };
    const parts = [];
    if (missing.length) {
      const i = missing[0];
      if (q.mode === 'prereq-of') { const p = findPath(a, i, q.target); parts.push(`${labels[i]} is needed: ${pathWords(p, labels)}.`); }
      else if (i === q.start) parts.push(`${labels[i]} is the start, and it counts as reachable here.`);
      else { const p = findPath(a, q.start, i); parts.push(`${labels[i]} is reachable: ${pathWords(p, labels)}.`); }
    }
    if (extra.length) {
      const i = extra[0];
      parts.push(q.mode === 'prereq-of' ? `${labels[i]} is not needed: no chain of prerequisites leads from it to ${labels[q.target]}.` : `${labels[i]} is not reachable: no path leads to it from ${labels[q.start]}. Remember the edges are one-way.`);
    }
    return { correct: false, feedback: parts.join(' ') };
  }
  if (q.type === 'text') {
    const { results, score } = rubricCheck(response, q.rubric);
    const missing = results.filter(r => !r.met).map(r => r.idea.toLowerCase());
    return {
      correct: score >= 2 / 3,
      feedback: (missing.length ? `Your answer does not yet cover: ${missing.join('; ')}. ` : 'Your answer covers the key ideas. ') + `Model answer: ${q.model}`,
      rubric: results,
    };
  }
  return { correct: false, feedback: 'Unknown question type.' };
}
