// Graph Helper: the app's chatbot (design doc, "Graph Helper chatbot").
// Three layers, tried in order, no outside AI service:
//   1. Graph engine: exact answers about the learner's own graph.
//   2. Knowledge base: reviewed answer cards with a Drozdek source.
//   3. Fallback: the three closest topics, logged so the team can add a card.
// Used by the server (/api/chat) and by the app when offline.
// Scope: lists and arrays, graphs, BFS and DFS, transitive closure, and the app.
import * as G from './graph-core.mjs';
import { cite } from './units.mjs';

const DROZDEK = { intro: cite('intro'), rep: cite('rep'), trav: cite('trav'), conn: cite('conn'), wfi: cite('wfi'), wfiCost: 'Drozdek (2010), Section 8.3.1, page 391', lists: cite('lists') };

export const QUERIES_EMAIL = 'cos212queries@cs.up.ac.za';

// ---------- knowledge base ----------
// Each card: several phrasings, an answer of three sentences or fewer, a source,
// and the unit to open. Tutors review every card before it goes live.
export const CARDS = [
  // ---- recap: lists and arrays (L1) ----
  { id: 'array-vs-list', group: 'Lists and arrays', q: ['array vs linked list', 'difference between an array and a linked list', 'why use a linked list', 'when should i use an array'], a: 'An array stores its items side by side, so a[i] is found in one step (O(1)), but its size is fixed. A linked list chains nodes with next references: it grows one node at a time, but finding the i-th item means walking from the head (O(n)).', src: DROZDEK.lists, unit: 'L1' },
  { id: 'array-2d', group: 'Lists and arrays', q: ['what is a 2d array', 'two dimensional array', 'how do i index a matrix', 'row and column'], a: 'A 2D array is an array of rows: m[r][c] is row r, column c, and both start at 0. An n × n boolean 2D array is exactly an adjacency matrix: m[u][v] is true when there is an edge u → v.', src: DROZDEK.lists, unit: 'L1' },
  { id: 'linked-list', group: 'Lists and arrays', q: ['what is a linked list', 'how does a linked list work', 'what is a node', 'head and next'], a: 'A linked list is a chain of nodes. Each node holds a value and a reference to the next node; the list keeps a reference to the first node, the head. To add at the end, walk to the last node (or keep a tail reference) and link a new node after it.', src: DROZDEK.lists, unit: 'L1' },
  // ---- applications (L4) ----
  { id: 'applications', group: 'Applications', q: ['where are graphs used', 'applications of graphs', 'real life graph examples', 'why learn graphs'], a: 'Graphs model anything with connections: roads and taxi routes (vertices are places), social networks (people and friendships), the web (pages and links), module prerequisites (modules and “needs” arrows) and computer networks. Lesson L4 shows each one.', src: DROZDEK.intro, unit: 'L4' },
  { id: 'modelling', group: 'Applications', q: ['how do i model a problem as a graph', 'what should be the vertices', 'turn a problem into a graph'], a: 'Ask what the things are (they become vertices) and what links them (edges). Then decide: does the link have a direction (directed), a cost (weighted), and can things link to themselves (loops)?', src: DROZDEK.intro, unit: 'L4' },
  // ---- BFS and DFS (L6–L8) ----
  { id: 'queue-stack', group: 'Traversals', q: ['queue vs stack', 'what is a queue', 'what is a stack', 'fifo lifo', 'why does bfs use a queue'], a: 'A queue is first in, first out (FIFO), like a taxi rank: BFS uses one, so vertices found first are visited first, level by level. A stack is last in, first out (LIFO), like a pile of plates: DFS uses one (or recursion), so it dives deep first.', src: DROZDEK.trav, unit: 'L6' },
  { id: 'bfs-how', group: 'Traversals', q: ['how does bfs work', 'bfs step by step', 'breadth first search algorithm', 'bfs levels'], a: 'Mark the start and put it in a queue. Repeatedly take the vertex at the front, visit it, and add each unmarked neighbour to the back (marking it). Vertices come out in order of distance: first the start, then its neighbours, then theirs.', src: DROZDEK.trav, unit: 'L6' },
  { id: 'dfs-how', group: 'Traversals', q: ['how does dfs work', 'dfs step by step', 'depth first search algorithm', 'backtracking'], a: 'Visit the start and mark it. Then, for each unmarked neighbour in turn, run DFS from that neighbour before moving on to the next. When a vertex has no unmarked neighbours left, back up to the vertex you came from.', src: DROZDEK.trav, unit: 'L7' },
  { id: 'bfs-shortest', group: 'Traversals', q: ['does bfs find the shortest path', 'fewest edges', 'shortest path unweighted'], a: 'Yes, when every edge counts the same: BFS reaches vertices in order of the number of edges from the start, so the first time it reaches a vertex is along a path with the fewest edges. DFS does not promise this.', src: DROZDEK.trav, unit: 'L6' },
  { id: 'remove-vertex', group: 'Representations', q: ['how do i remove a node', 'how does remove vertex work', 'remove vertex from adjacency list', 'remove vertex from matrix'], a: 'Removing a vertex must also remove every edge touching it. On a matrix, copy everything except row v and column v into a smaller matrix. On lists, drop v’s own list and unlink v from every other list; vertices numbered above v move down by one.', src: DROZDEK.rep, unit: 'L5' },
  // ---- using the app ----
  { id: 'app-hints', group: 'Using the app', q: ['how do hints work', 'hint ladder', 'how do i get a hint', 'can you give me the code', 'show me the solution'], a: 'On a coding problem you can open hints one at a time: a guiding question, then a pointer to the lesson, then a worked example. If a submission is wrong, the full model solution appears under your results so you can compare it with your code.', src: 'Coding section', unit: null },
  { id: 'app-levels', group: 'Using the app', q: ['how do i level up', 'how do points work', 'what are the levels', 'how do i become a legend', 'badges'], a: 'You earn points for every correct answer (harder questions earn more), for finishing a lesson and for passing a coding problem. There are four levels: Beginner, Rookie (200 points), Master (500) and Legend (900). Your badges and level are on Home and on the Roadmap.', src: 'Rewards', unit: null },
  { id: 'app-locked', group: 'Using the app', q: ['why is the coding section locked', 'when can i do the coding questions', 'is anything locked', 'when does transitive closure open'], a: 'Every lesson is open from the start. The coding section opens once you have finished the eight core lessons (L1–L8). Transitive closure (U5–U8) is recommended once you reach Rookie, but you can open it any time.', src: 'Roadmap', unit: null },
  { id: 'app-language', group: 'Using the app', q: ['change the language', 'can i use isizulu', 'afrikaans', 'sepedi', 'language settings'], a: 'Open Settings and choose a language. Menus, buttons, feedback, chatbot messages and lesson text switch to that language. Quiz questions and code stay in English, as in the module.', src: 'Settings', unit: null },
  // Terminology
  { id: 'circuit-cycle', group: 'Terminology', q: ['difference between a circuit and a cycle', 'what is a circuit', 'what is a cycle', 'circuit vs cycle'], a: 'A circuit is a path that starts and ends at the same vertex and repeats no edge. A cycle is a circuit that also repeats no vertex (apart from the start). So every cycle is a circuit, but a circuit may pass through a vertex twice.', src: DROZDEK.intro, unit: 'L2' },
  { id: 'multi-pseudo', group: 'Terminology', q: ['what is a multigraph', 'what is a pseudograph', 'multigraph vs pseudograph', 'parallel edges', 'loop edge'], a: 'A multigraph allows more than one edge between the same two vertices. A pseudograph also allows loops: edges from a vertex to itself. A simple graph allows neither.', src: DROZDEK.intro, unit: 'L3' },
  { id: 'complete', group: 'Terminology', q: ['what is a complete graph', 'how many edges does kn have', 'edges in a complete graph', 'k4 edges'], a: 'In the complete graph Kₙ every pair of distinct vertices is joined by an edge. It has n(n − 1)/2 edges, so K₄ has 4 × 3 / 2 = 6 and |E| = O(|V|²).', src: DROZDEK.intro, unit: 'L3' },
  { id: 'degree', group: 'Terminology', q: ['what is the degree of a vertex', 'what is an isolated vertex', 'adjacent vs incident', 'what does incident mean', 'what does adjacent mean'], a: 'Two vertices are adjacent if an edge joins them; that edge is incident with both. A vertex’s degree is the number of edges incident with it (a loop counts twice). A vertex of degree 0 is isolated.', src: DROZDEK.intro, unit: 'L2' },
  { id: 'degree-sum', group: 'Terminology', q: ['sum of degrees', 'degree sum', 'handshake', 'why is the sum of degrees twice the edges'], a: 'Each edge has two ends, and each end adds 1 to some vertex’s degree. So the sum of all degrees is 2|E|, which is why it is always even.', src: 'Drozdek (2010), Section 8.14, exercise 2', unit: 'L2' },
  { id: 'tree', group: 'Terminology', q: ['is a tree a graph', 'tree special case', 'how many edges does a tree have', 'why does a tree have n minus 1 edges'], a: 'A tree is a connected graph with no cycles. A tree with n vertices has exactly n − 1 edges: each vertex except the root joins by one edge to its parent.', src: 'Drozdek (2010), Section 8.14, exercise 5', unit: 'L3' },
  { id: 'directed', group: 'Terminology', q: ['directed vs undirected', 'what is a digraph', 'what is a directed graph'], a: 'In a digraph each edge has a direction, u → v, and can be followed only that way. In an undirected graph an edge u—v works both ways.', src: DROZDEK.intro, unit: 'L3' },
  { id: 'weighted', group: 'Terminology', q: ['what is a weighted graph', 'edge weights'], a: 'A weighted graph gives every edge a number, such as a distance or a cost. Transitive closure ignores weights: it only asks whether a path exists.', src: DROZDEK.intro, unit: 'L3' },
  // Representations
  { id: 'list-vs-matrix', group: 'Representations', q: ['when is an adjacency list better than a matrix', 'list or matrix', 'matrix or list for a sparse graph', 'which representation is better', 'adjacency list vs adjacency matrix'], a: 'A matrix uses Θ(V²) space and answers “is there an edge u→v?” in O(1); visiting a vertex’s neighbours takes |V| steps. A list uses Θ(V + E) space and visits neighbours in deg(v) steps. So lists suit sparse graphs and matrices suit dense ones.', src: DROZDEK.rep, unit: 'L5' },
  { id: 'matrix-orderings', group: 'Representations', q: ['why are there n factorial matrices', 'different matrices for the same graph', 'vertex ordering'], a: 'The matrix depends on the order you give the vertices. With n vertices there are n factorial (n!) orderings, so up to that many different matrices for the same graph.', src: DROZDEK.rep, unit: 'L5' },
  // Operations
  { id: 'adt-ops', group: 'Representations', q: ['what operations does a graph adt have', 'graph adt operations', 'add edge remove edge', 'how does add vertex change the matrix', 'how do i add a node'], a: 'The Graph ADT has addVertex, removeVertex, addEdge, removeEdge, hasEdge (adjacency test) and neighbours. On a matrix, adding a vertex copies everything into a matrix one row and one column bigger; on a list it adds one empty list at the end. Lesson L5 animates each one on both forms.', src: DROZDEK.rep, unit: 'L5' },
  // Traversals
  { id: 'visited', group: 'Traversals', q: ['why does dfs need a visited mark', 'visited mark on graphs but not trees', 'why does my dfs loop forever'], a: 'A tree has no cycles, so a search can never come back to a node it has seen. A graph can, so without a visited mark a search on a cycle goes round forever. Mark each vertex the first time you reach it.', src: DROZDEK.trav, unit: 'L7' },
  { id: 'dfs-bfs', group: 'Traversals', q: ['dfs vs bfs', 'difference between depth first and breadth first', 'what is bfs', 'what is dfs'], a: 'Depth-first search follows one path as deep as it can, then backs up (a stack or recursion). Breadth-first search visits all neighbours first, level by level (a queue). Both find exactly the vertices reachable from the start.', src: DROZDEK.trav, unit: 'L8' },
  { id: 'bfs-cost', group: 'Traversals', q: ['complexity of bfs', 'complexity of dfs', 'how fast is breadth first search', 'big o of traversal'], a: 'With adjacency lists, DFS and BFS take O(V + E): each vertex is visited once and each edge looked at once or twice. With a matrix, finding neighbours costs |V| per vertex, so O(V²).', src: 'Drozdek (2010), Section 8.14, exercise 3', unit: 'L6' },
  { id: 'reachable', group: 'Traversals', q: ['what does reachable mean', 'what is reachability', 'v is reachable from u'], a: 'v is reachable from u if there is a path of edges from u to v, following directions in a digraph. One DFS or BFS from u finds every vertex reachable from u.', src: DROZDEK.trav, unit: 'L6' },
  // Connectivity
  { id: 'weak-strong', group: 'Connectivity', q: ['difference between weakly and strongly connected', 'weakly vs strongly connected', 'what is strongly connected', 'what is weakly connected'], a: 'A digraph is strongly connected if every vertex can reach every other vertex following the arrows. It is weakly connected if it is connected only when you ignore the directions. In the closure, strongly connected means every off-diagonal entry is 1.', src: DROZDEK.conn, unit: 'U5' },
  // Transitive closure
  { id: 'closure-what', group: 'Transitive closure', q: ['what does the closure add', 'what is the transitive closure', 'what is r plus', 'reachability matrix'], a: 'The transitive closure R⁺ adds a pair (u, v) whenever v is reachable from u by a path of one or more edges. Its matrix is the reachability matrix. Turn on Closure in Build a graph to see the added pairs as dashed edges.', src: DROZDEK.wfi, unit: 'U5' },
  { id: 'transitive', group: 'Transitive closure', q: ['why is the closure transitive', 'what is a transitive relation', 'relation r'], a: 'A relation is transitive if a R b and b R c always give a R c. If u reaches v and v reaches w, joining the two paths gives a path from u to w, so R⁺ is transitive. It is the smallest transitive relation that contains R.', src: 'Drozdek (2010), Section 8.3.1', unit: 'U5' },
  { id: 'diagonal', group: 'Transitive closure', q: ['what does the diagonal mean', 'why is the diagonal 1', 'does a vertex reach itself', 'circular prerequisite'], a: 'r[v][v] is 1 only when v lies on a cycle, because only then is there a path of one or more edges from v back to v. So a 1 on the diagonal detects a cycle, for example a circular prerequisite.', src: DROZDEK.wfi, unit: 'U5' },
  { id: 'k-outer', group: 'Transitive closure', q: ['why must k be the outer loop', 'why is k the outermost loop', 'order of the loops in warshall', 'k loop innermost'], a: 'R(k) may use only vertices up to k as stops, and it is built from the complete R(k−1). The k loop moves from one R to the next, so it must be outermost. With k innermost, r[i][j] is decided before the paths it needs are known, and long chains are missed.', src: DROZDEK.wfi, unit: 'U6' },
  { id: 'warshall-how', group: 'Transitive closure', q: ['how does warshalls algorithm work', 'what is warshall', 'warshall recurrence', 'r k from r k minus 1'], a: 'Warshall’s starts with the adjacency matrix R(0). For each k it sets r[i][j] to 1 if it already was, or if i reaches k and k reaches j: r(k)[i][j] = r(k−1)[i][j] OR (r(k−1)[i][k] AND r(k−1)[k][j]). After the last k the matrix is R⁺.', src: DROZDEK.wfi, unit: 'U6' },
  { id: 'dynamic-programming', group: 'Transitive closure', q: ['is warshall dynamic programming', 'what paradigm does warshall use', 'dynamic programming'], a: 'Yes: R(k) is built from the stored answers in R(k−1), so each subproblem is solved once and reused. That is dynamic programming, the same idea Floyd–Warshall uses for shortest paths.', src: DROZDEK.wfi, unit: 'U6' },
  { id: 'in-place', group: 'Transitive closure', q: ['can warshall update in place', 'in place update', 'why can i use one matrix'], a: 'Yes. During step k, row k and column k never change (r[i][k] OR (r[i][k] AND r[k][k]) is still r[i][k]), so updating the one matrix in place gives the same result. That keeps the space at Θ(V²).', src: DROZDEK.wfi, unit: 'U6' },
  // Complexity
  { id: 'theta-v3', group: 'Complexity', q: ['why is warshall theta v cubed', 'why is warshall theta v3', 'complexity of warshall', 'big o of warshall', 'how fast is warshall'], a: 'Three nested loops of |V| each give Θ(V³) time, whatever the number of edges. It needs one V × V matrix, so Θ(V²) space.', src: DROZDEK.wfiCost, unit: 'U6' },
  { id: 'dfs-faster', group: 'Complexity', q: ['when is repeated dfs faster', 'repeated dfs vs warshall', 'which is faster for a sparse graph', 'closure by dfs complexity'], a: 'One DFS per vertex with adjacency lists costs O(V(V + E)), close to V² when the graph is sparse, so it beats Warshall’s Θ(V³). On a dense graph E is near V², so both are about V³ and Warshall’s short loop usually wins in practice.', src: DROZDEK.wfiCost, unit: 'U7' },
  { id: 'recursive-iterative', group: 'Complexity', q: ['recursive vs iterative', 'is dfs recursive', 'is warshall iterative'], a: 'DFS reachability is naturally recursive: it calls itself on each unvisited neighbour, using the call stack. Warshall’s is iterative: three plain loops and no recursion, so no risk of a StackOverflowError on long paths.', src: 'COS212 slides: Graph traversals', unit: 'L7' },
  // Java
  { id: 'java-no-util', group: 'Java', q: ['how do i store a graph without java util', 'can i use arraylist', 'no built in data structures', 'my own linked list'], a: 'The study guide forbids built-in collections, so use a 2D boolean array for a matrix, or an array of head nodes with your own Node class for adjacency lists. Scanner is allowed for reading input.', src: 'COS212 study guide', unit: 'L5' },
  { id: 'java-format', group: 'Java', q: ['how do i read the test input format', 'input format', 'what is the input format', 'output format'], a: 'Line 1 is “n m d”: n vertices, m edges, d = 1 for directed. Then m lines “u v”, with vertices numbered from 0. A closure prints as n rows of 0s and 1s separated by spaces.', src: 'Test section', unit: 'L5' },
  // App
  { id: 'app-read', group: 'Using the app', q: ['read aloud', 'can it read to me', 'speech', 'voice'], a: 'Every explanation, hint, trace step and answer has a Read aloud button, and changes on Build a graph are announced. You can set the speed in Settings.', src: 'App design', unit: null },
];

const SYN = [
  [/\bnodes?\b/g, 'vertex'], [/\bvertices\b/g, 'vertex'], [/\barcs?\b/g, 'edge'], [/\bedges\b/g, 'edge'],
  [/\breachability matri(x|ces)\b/g, 'transitive closure'], [/\bwfi\b/g, 'floyd warshall'], [/\bclosures\b/g, 'closure'],
  [/\bwarshall'?s\b/g, 'warshall'], [/\bdigraphs?\b/g, 'directed graph'], [/\bbreadth[\s-]first( search)?\b/g, 'bfs'],
  [/\bdepth[\s-]first( search)?\b/g, 'dfs'], [/\bmatrices\b/g, 'matrix'], [/\bcomplexity\b/g, 'complexity'],
  [/\blinked lists?\b/g, 'linked list'], [/\barrays\b/g, 'array'], [/\b2d\b|\btwo[\s-]dimensional\b/g, '2d'], [/\bremove (a |the )?node\b/g, 'remove vertex'], [/\badd (a |the )?node\b/g, 'add vertex'],
];
const STOP = new Set('a an the is are of to in on for and or do does i my me it what how why when which who can you this that be with by from there their than then first last'.split(' '));

export function tokens(text) {
  let t = ` ${String(text).toLowerCase().replace(/θ/g, ' theta ').replace(/³/g, '3').replace(/²/g, '2').replace(/[’']/g, "'").replace(/r\s*\+|r⁺/g, ' r plus ').replace(/[^a-zθ0-9'\s]+/g, ' ')} `;
  for (const [re, rep] of SYN) t = t.replace(re, rep);
  return t.split(/\s+/).map(w => w.replace(/'s$/, '').replace(/(?<=\w{3})s$/, '')).filter(w => w && !STOP.has(w));
}

// A small BM25-style index over every phrasing of every card.
const DOCS = CARDS.flatMap(c => [...c.q, c.a.split('.')[0]].map(text => ({ card: c, toks: tokens(text) })));
const DF = new Map();
for (const d of DOCS) for (const w of new Set(d.toks)) DF.set(w, (DF.get(w) ?? 0) + 1);
const AVG = DOCS.reduce((s, d) => s + d.toks.length, 0) / DOCS.length;

export function searchCards(message, limit = 3) {
  const q = tokens(message);
  const scores = new Map();
  for (const d of DOCS) {
    let s = 0;
    for (const w of new Set(q)) {
      const tf = d.toks.filter(x => x === w).length;
      if (!tf) continue;
      const idf = Math.log(1 + (DOCS.length - DF.get(w) + 0.5) / (DF.get(w) + 0.5));
      s += idf * ((tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * d.toks.length) / AVG)));
    }
    if (s > (scores.get(d.card.id)?.score ?? 0)) scores.set(d.card.id, { card: d.card, score: s });
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---------- layer 1: the graph engine ----------

const V = '([a-z])';
function graphAnswer(message, g) {
  if (!g || !g.vertices?.length) return null;
  const m = ` ${message.toLowerCase().replace(/[?.!,]/g, ' ')} `;
  const has = id => g.vertices.some(v => v.id === id);
  const p = G.properties(g);
  const src = 'Computed from your graph';
  let r;

  if ((r = new RegExp(`(?:can|does|is there a path from) ${V} (?:reach|get to|to) ${V}\\b`).exec(m)) || (r = new RegExp(`is ${V} reachable from ${V}`).exec(m))) {
    let [, u, v] = r;
    if (/reachable from/.test(m)) [u, v] = [v, u];
    if (!has(u) || !has(v)) return null;
    const path = findPath(g, u, v);
    return {
      reply: path
        ? `Yes: ${u} reaches ${v} along ${path.join(' → ')}${u === v ? ', a cycle through ' + u : ''}.`
        : `No: there is no path from ${u} to ${v}${g.directed ? ' following the arrows' : ''}, so [${u}][${v}] is 0 in the closure.`,
      src, highlight: { vertices: path ?? [u, v], path: path ?? [] },
    };
  }
  if ((r = new RegExp(`(?:degree|deg) (?:of )?${V}\\b`).exec(m))) {
    const v = r[1];
    if (!has(v)) return null;
    const reply = g.directed
      ? `${v} has out-degree ${p.outdeg[v]} and in-degree ${p.indeg[v]}${p.outdeg[v] + p.indeg[v] === 0 ? ', so it is isolated' : ''}.`
      : `${v} has degree ${p.deg[v]}${g.edges.some(e => e.from === v && e.to === v) ? ' (its loop counts twice)' : ''}${p.deg[v] === 0 ? ', so it is isolated' : ''}.`;
    return { reply, src, highlight: { vertices: [v], path: [] } };
  }
  if ((r = new RegExp(`(?:neighbou?rs|adjacent) (?:of |to )?${V}\\b`).exec(m))) {
    const v = r[1];
    if (!has(v)) return null;
    const n = G.neighbours(g, v);
    return { reply: n.length ? `${g.directed ? 'Out-neighbours' : 'Neighbours'} of ${v}: ${n.join(', ')}.` : `${v} has no ${g.directed ? 'out-' : ''}neighbours.`, src, highlight: { vertices: [v, ...n], path: [] } };
  }
  if ((r = new RegExp(`row ${V}\\b`).exec(m)) && /closure|all 1|ones/.test(m)) {
    const v = r[1];
    if (!has(v)) return null;
    const reach = [...G.reachableFrom(g, v)].filter(x => x !== v).sort();
    const self = G.closureByDFS(g)[g.vertices.findIndex(x => x.id === v)][g.vertices.findIndex(x => x.id === v)];
    const all = reach.length === g.vertices.length - 1 && self;
    return {
      reply: `Row ${v} of the closure lists everything ${v} reaches: ${reach.length ? reach.join(', ') : 'nothing'}${self ? `, and ${v} itself because it is on a cycle` : ''}. ${all ? 'That is every vertex, so the row is all 1s.' : ''}`.trim(),
      src, highlight: { vertices: [v, ...reach], path: [] },
    };
  }
  if (/strongly connected|weakly connected|is (my|the) graph connected|is it connected|connected\?/.test(m) && !/component|\bscc/.test(m)) {
    return { reply: `Your graph is ${p.connectivity}.${g.directed && p.connectivity === 'weakly connected' ? ' It is connected if you ignore directions, but not every vertex can reach every other along the arrows.' : ''}`, src };
  }
  if (/\b(cycle|cyclic|acyclic)\b/.test(m) && /my|graph|it|have|has/.test(m)) {
    const onCycle = g.vertices.filter((v, i) => G.closureByDFS(g)[i][i]).map(v => v.id);
    return { reply: p.cyclic ? `Yes, your graph has a cycle${onCycle.length && g.directed ? `; ${onCycle.join(', ')} ${onCycle.length === 1 ? 'is' : 'are'} on one (their diagonal entries in the closure are 1)` : ''}.` : 'No, your graph is acyclic.', src, highlight: { vertices: g.directed ? onCycle : [], path: [] } };
  }
  if (/what (type|kind) of graph|classify my graph|what is my graph|is (my graph|it) (a )?(complete|tree|simple|multigraph|pseudograph)/.test(m)) {
    return { reply: G.typeSentence(p), src };
  }
  if (/how many (vertices|vertex|nodes|edges)|\|v\||\|e\|/.test(m)) {
    return { reply: `Your graph has |V| = ${p.vertices} and |E| = ${p.edges}.`, src };
  }
  if (/isolated/.test(m) && /my|graph|which|any/.test(m)) {
    return { reply: p.isolated.length ? `Isolated vertices: ${p.isolated.join(', ')}.` : 'Your graph has no isolated vertices.', src, highlight: { vertices: p.isolated, path: [] } };
  }
  if ((r = new RegExp(`\\b(bfs|dfs) (?:from|starting at|start at) ${V}\\b`).exec(m))) {
    const [, kind, v] = r;
    if (!has(v)) return null;
    const order = (kind === 'bfs' ? G.bfsTrace(g, v) : G.dfsTrace(g, v)).order;
    return { reply: `${kind.toUpperCase()} from ${v}, taking neighbours in alphabetical order, visits: ${order.join(' → ')}.`, src, highlight: { vertices: order, path: [] } };
  }
  if ((r = new RegExp(`(?:shortest|fewest edges?) (?:path|route)? ?(?:from )?${V} to ${V}\\b`).exec(m))) {
    const [, u, v] = r;
    if (!has(u) || !has(v)) return null;
    const path = u === v ? [u] : findPath(g, u, v);
    if (!path) return { reply: `${v} cannot be reached from ${u}.`, src, highlight: { vertices: [u, v], path: [] } };
    return { reply: `Fewest edges from ${u} to ${v}: ${path.join(' → ')} (${path.length - 1} edge${path.length === 2 ? '' : 's'}, found with BFS).`, src, highlight: { vertices: path, path } };
  }
  if (/closure|what does the closure add|new pairs/.test(m) && /my|graph|add/.test(m)) {
    const pairs = G.closureAddedPairs(g);
    return { reply: pairs.length ? `The closure adds ${pairs.length} pair${pairs.length === 1 ? '' : 's'}: ${pairs.map(([a, b]) => `${a}→${b}`).join(', ')}.` : 'The closure adds nothing: every reachable pair is already an edge.', src };
  }
  return null;
}

function findPath(g, u, v) {
  // BFS for a shortest path of one or more edges from u to v
  const prev = new Map();
  const queue = [];
  for (const w of G.neighbours(g, u)) if (!prev.has(w)) { prev.set(w, u); queue.push(w); }
  while (queue.length) {
    const x = queue.shift();
    if (x === v) break;
    for (const w of G.neighbours(g, x)) if (!prev.has(w)) { prev.set(w, x); queue.push(w); }
  }
  if (!prev.has(v)) return null;
  const path = [v];
  let cur = v;
  let guard = 0;
  do {
    cur = prev.get(cur);
    path.unshift(cur);
  } while (cur !== u && guard++ < 50);
  return path;
}

// ---------- coding problems: hints first, the model answer after a try ----------

const SOLUTION_ASK = /\b(code|solution|answer|solve|write it|implement|give me|show me how)\b/;

function problemGuard(message, ctx) {
  const m = message.toLowerCase();
  const named = /\bp([1-9])\b/.exec(m)?.[0].toUpperCase();
  const pid = named ?? ctx.problem?.id;
  if (!pid || !SOLUTION_ASK.test(m)) return null;
  const hints = ctx.problemHints?.[pid];
  const level = Math.min(3, (ctx.problem?.id === pid ? ctx.problem.hintLevel ?? 0 : 0) + 1);
  const next = hints?.[level - 1];
  return {
    reply: `Have a go at ${pid} first: submit your attempt, and if it is wrong the full model solution appears under your results.${next ? ` Here is a nudge (hint ${level} of 3): ${next}` : ''}`,
    src: 'Coding section',
    intent: 'problem-hint',
    hintLevel: next ? level : level - 1, // no hint given: the ladder does not move
    problem: pid,
  };
}

// ---------- the answer pipeline ----------

const ON_TOPIC = /graph|vertex|node|edge|path|cycle|matrix|list|array|queue|stack|closure|warshall|dfs|bfs|reach|degree|tree|connected|relation|transitive|loop|k\b|java|complexity|theta|big o|lesson|unit|hint|test|code|p\d|point|level|badge|shortest|weight|neighbou?r/;

export function answer(message, ctx = {}) {
  const text = String(message ?? '').trim();
  if (!text) return { reply: 'Type a question, or tap a suggestion.', layer: 'empty', src: null, suggestions: suggestions(ctx) };
  if (text.length > 400) return { reply: 'Please ask one short question at a time.', layer: 'empty', src: null, suggestions: suggestions(ctx) };

  const guard = problemGuard(text, ctx);
  if (guard) return { ...guard, layer: 'guard', suggestions: ['How does BFS work?', 'How do I read the test input format?'] };

  const ga = graphAnswer(text, ctx.graph);
  if (ga) return { ...ga, layer: 'graph', intent: 'graph-engine', suggestions: suggestions(ctx) };

  // Feedback context: "ask about this feedback" pre-fills the misconception
  if (ctx.feedback?.misconception && /this feedback|why did|what does this mean|explain/.test(text.toLowerCase())) {
    const f = ctx.feedback;
    return {
      reply: `On ${f.problem}${f.failedCaseTypes?.length ? `, the failing case type${f.failedCaseTypes.length > 1 ? 's are' : ' is'} ${f.failedCaseTypes.join(', ')}` : ''}. This usually means: ${f.misconception.label.toLowerCase()}. ${f.misconception.hint}`,
      src: f.misconception.pointsTo, layer: 'feedback', intent: 'feedback', suggestions: ['Why must k be the outer loop?', 'Why does DFS need a visited mark?'],
    };
  }

  const hits = searchCards(text, 3);
  const top = hits[0];
  if (top && top.score >= 2.2 && (!hits[1] || top.score >= hits[1].score * 1.05 || top.score >= 4)) {
    const c = top.card;
    return { reply: c.a, src: c.src, unit: c.unit, cardId: c.id, layer: 'kb', intent: c.id, suggestions: related(c, ctx) };
  }

  const offTopic = !ON_TOPIC.test(text.toLowerCase());
  return {
    reply: offTopic
      ? 'I can only help with lists and arrays, graphs, BFS and DFS, transitive closure and this app. Try one of these topics:'
      : 'I’m not sure about that one yet, so I’ve logged it for the tutors. These topics are the closest:',
    src: null,
    layer: 'fallback',
    intent: 'fallback',
    closest: hits.filter(h => h.score > 0).map(h => ({ id: h.card.id, label: h.card.q[0] })),
    email: offTopic ? null : `mailto:${QUERIES_EMAIL}?subject=${encodeURIComponent('COS212 graphs question')}&body=${encodeURIComponent(text)}`,
    suggestions: suggestions(ctx),
  };
}

function related(card, ctx) {
  const same = CARDS.filter(c => c.group === card.group && c.id !== card.id).slice(0, 2).map(c => cap(c.q[0]));
  return [...same, ...suggestions(ctx)].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
}
const cap = s => s[0].toUpperCase() + s.slice(1) + '?';

export function suggestions(ctx = {}) {
  const out = [];
  if (ctx.graph?.vertices?.length >= 2) {
    const [a, b] = [ctx.graph.vertices[0].id, ctx.graph.vertices[ctx.graph.vertices.length - 1].id];
    out.push(`Can ${a} reach ${b}?`, 'Is my graph strongly connected?');
  }
  const byUnit = {
    L1: ['What is the difference between an array and a linked list?'],
    L2: ['What is the degree of a vertex?'],
    L3: ['What is the difference between directed and undirected?'],
    L4: ['Where are graphs used?'],
    L5: ['How do I remove a node?'],
    L6: ['Why does BFS use a queue?'],
    L7: ['Why does DFS need a visited mark?'],
    L8: ['DFS vs BFS?'],
    U5: ['What does the closure add?'],
    U6: ['Why must k be the outer loop?'],
    U7: ['When is repeated DFS faster?'],
    U8: ['What does the diagonal mean?'],
  };
  out.push(...(byUnit[ctx.unit] ?? ['How does BFS work?', 'How do I level up?']));
  return out.filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
}
