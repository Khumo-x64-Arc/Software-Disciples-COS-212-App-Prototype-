// Graph Helper: answers graph questions with no outside AI service and no API keys.
// Layer 1: graph engine (exact answers about the learner's current Build a graph graph).
// Layer 2: knowledge base of reviewed answer cards, matched with MiniSearch plus a synonym list.
// Layer 3: fallback (closest topics, question logged, email option).
import MiniSearch from 'minisearch';
import { properties, boolMatrix, closure, findPath, adjacencyList } from '../../shared/graph.js';
import { MISCONCEPTIONS, hintStep } from './feedback.js';

export const CARDS = [
  { id: 'graph-def', group: 'Terminology', title: 'What is a graph?', q: ['what is a graph', 'define graph', 'graph definition', 'what are vertices and edges'], a: 'A simple graph G = (V, E) is a non-empty set of vertices V and a set of edges E, where each edge joins two different vertices. In a digraph each edge has a direction.', src: 'Drozdek Ch. 8 intro, p. 376', unit: 'U1' },
  { id: 'multi-pseudo', group: 'Terminology', title: 'Multigraph vs pseudograph', q: ['difference between multigraph and pseudograph', 'what is a multigraph', 'what is a pseudograph', 'parallel edges loops'], a: 'A multigraph allows more than one edge between the same two vertices. A pseudograph also allows loops, edges from a vertex to itself.', src: 'Drozdek Ch. 8 intro, p. 376', unit: 'U1' },
  { id: 'circuit-cycle', group: 'Terminology', title: 'Circuit vs cycle', q: ['difference between a circuit and a cycle', 'what is a circuit', 'what is a cycle', 'circuit cycle'], a: 'A circuit is a path that ends where it started and repeats no edge. A cycle is a circuit in which all the vertices are also different.', src: 'Drozdek Ch. 8 intro, pp. 376–377', unit: 'U1' },
  { id: 'path', group: 'Terminology', title: 'Path', q: ['what is a path', 'path in a graph', 'define path'], a: 'A path from v1 to vn is a sequence of edges v1–v2, v2–v3, …, vn−1–vn, each starting where the previous one ended.', src: 'Drozdek Ch. 8 intro, p. 376', unit: 'U1' },
  { id: 'complete', group: 'Terminology', title: 'Complete graph Kₙ', q: ['what is a complete graph', 'how many edges does kn have', 'complete graph edges', 'kn edge count'], a: 'In Kₙ every pair of distinct vertices is joined by exactly one edge, and there are no loops. It has n(n − 1)/2 edges, which is O(|V|²).', src: 'Drozdek Ch. 8 intro, p. 377', unit: 'U1' },
  { id: 'subgraph', group: 'Terminology', title: 'Subgraph and induced subgraph', q: ['what is an induced subgraph', 'what is a subgraph', 'subgraph vs induced subgraph'], a: 'A subgraph uses some of G’s vertices and some of its edges. An induced subgraph keeps every edge of G between the vertices it chose.', src: 'Drozdek Ch. 8 intro, p. 377', unit: 'U1' },
  { id: 'degree', group: 'Terminology', title: 'Degree, adjacent, incident, isolated', q: ['what is degree', 'what does incident mean', 'what does adjacent mean', 'isolated vertex', 'degree of a vertex', 'sum of degrees'], a: 'Two vertices joined by an edge are adjacent, and the edge is incident with both. deg(v) counts the edges incident with v; a loop counts 2. A vertex of degree 0 is isolated, and the degrees always add up to twice the number of edges.', src: 'Drozdek Ch. 8 intro, p. 377; §8.14 ex. 2', unit: 'U1' },
  { id: 'tree-graph', group: 'Terminology', title: 'Trees as graphs', q: ['is a tree a graph', 'tree vs graph', 'how many edges does a tree have'], a: 'A tree is a connected graph with no cycles. A tree with n vertices has exactly n − 1 edges.', src: 'Drozdek §8.14 ex. 5', unit: 'U1' },
  { id: 'adj-matrix', group: 'Representations', title: 'Adjacency matrix', q: ['what is an adjacency matrix', 'how does an adjacency matrix work', 'adjacency matrix undirected symmetric'], a: 'A |V| × |V| table with a 1 in row i, column j when there is an edge from vi to vj. For an undirected graph the matrix is symmetric. The vertex order is a free choice, so one graph has up to n! matrices.', src: 'Drozdek §8.1, pp. 378–379', unit: 'U2' },
  { id: 'adj-list', group: 'Representations', title: 'Adjacency list', q: ['what is an adjacency list', 'star representation', 'forward star', 'linked list representation of a graph'], a: 'For each vertex, a list of its neighbours. Drozdek shows it as a star table (forward or reverse) or as linked lists of nodes.', src: 'Drozdek §8.1, p. 377', unit: 'U2' },
  { id: 'incidence', group: 'Representations', title: 'Incidence matrix', q: ['how do i read an incidence matrix', 'what is an incidence matrix', 'incidence matrix column with one 1'], a: 'A |V| × |E| table: column j has a 1 in the rows of the two vertices edge j joins. A column with a single 1 is a loop, and in a multigraph repeated edges give identical columns.', src: 'Drozdek §8.1, p. 379', unit: 'U2' },
  { id: 'which-rep', group: 'Representations', title: 'Matrix or list?', q: ['when is an adjacency list better than a matrix', 'matrix or list for a sparse graph', 'which representation is best', 'matrix vs list', 'dense or sparse representation'], a: 'It depends on the problem. Listing v’s neighbours takes deg(v) steps with a list but |V| steps with a matrix, and lists need Θ(V + E) space against Θ(V²). A matrix answers “is (u, v) an edge?” in one step, so dense graphs suit a matrix and sparse graphs suit lists.', src: 'Drozdek §8.1, p. 379', unit: 'U2' },
  { id: 'add-edge-undirected', group: 'Representations', title: 'Adding an undirected edge', q: ['why do i update two cells', 'undirected edge both directions', 'addedge undirected'], a: 'An undirected edge goes both ways, so addEdge(u, v) sets both [u][v] and [v][u] in a matrix, or adds v to u’s list and u to v’s list.', src: 'Drozdek §8.1', unit: 'U3' },
  { id: 'dfs', group: 'Traversals', title: 'Depth-first search', q: ['how does depth first search work', 'what is dfs', 'dfs graph'], a: 'Visit a vertex and mark it, then visit each unvisited neighbour in turn, going as deep as possible before backing up. It is naturally recursive.', src: 'Drozdek §8.2, p. 379', unit: 'U4' },
  { id: 'visited', group: 'Traversals', title: 'Why visited marks?', q: ['why does dfs need a visited mark on graphs but not on trees', 'why mark visited', 'dfs infinite loop', 'stack overflow dfs'], a: 'Graphs can have cycles. Without visited marks a search goes round a cycle forever, which in recursive code ends in a StackOverflowError. Trees have no cycles, so tree traversals need no marks.', src: 'Drozdek §8.2, p. 379', unit: 'U4' },
  { id: 'bfs', group: 'Traversals', title: 'Breadth-first search', q: ['what is bfs', 'breadth first search', 'bfs queue', 'bfs complexity'], a: 'Visit the start, then all its neighbours, then theirs, level by level, using a queue. With adjacency lists it costs O(V + E); with a matrix O(V²).', src: 'Drozdek §8.2; §8.14 ex. 3', unit: 'U4' },
  { id: 'connected', group: 'Connectivity', title: 'Connected graphs', q: ['what is a connected graph', 'connected undirected graph'], a: 'An undirected graph is connected when there is a path between every two vertices. A single DFS from any vertex reaches every vertex exactly when the graph is connected.', src: 'Drozdek §8.6.1, p. 399', unit: 'U4' },
  { id: 'weak-strong', group: 'Connectivity', title: 'Weakly vs strongly connected', q: ['what is the difference between weakly and strongly connected', 'weakly connected', 'strongly connected digraph', 'strongly connected components'], a: 'A digraph is weakly connected if it is connected once you ignore the edge directions. It is strongly connected if every vertex has a path to every other vertex in both directions, which is the same as its closure having 1s everywhere off the diagonal.', src: 'Drozdek §8.6.2, p. 402', unit: 'U5' },
  { id: 'closure-def', group: 'Transitive closure', title: 'What the closure is', q: ['what is transitive closure', 'what does the closure add', 'reachability matrix', 'what is r plus'], a: 'The transitive closure R⁺ has a 1 in row u, column v when a path of one or more edges leads from u to v. It adds an edge for every pair that is connected by a longer path but not directly.', src: 'Drozdek §8.3.1 (with OR/AND)', unit: 'U5' },
  { id: 'closure-diagonal', group: 'Transitive closure', title: 'The diagonal of the closure', q: ['why is the diagonal 1', 'closure diagonal', 'does a vertex reach itself', 'diagonal of the closure'], a: 'R⁺[v][v] is 1 only when a path leads from v back to v: v lies on a cycle or has a loop. Do not start Warshall’s with 1s on the diagonal.', src: 'Drozdek §8.3.1, p. 391', unit: 'U5' },
  { id: 'warshall', group: 'Transitive closure', title: "Warshall's algorithm", q: ['how does warshall algorithm work', 'what is warshall', 'warshall algorithm', 'warshall recurrence'], a: 'Warshall’s builds R(k) from R(k−1): i reaches j using the first k vertices if it already did, or if i reaches k and k reaches j. After all n values of k, the matrix is the closure.', src: 'Drozdek §8.3.1, pp. 390–391; Warshall (1962)', unit: 'U6' },
  { id: 'k-outer', group: 'Transitive closure', title: 'Why k must be the outer loop', q: ['why must k be the outer loop', 'loop order warshall', 'k loop inside', 'warshall loop order'], a: 'k is the intermediate vertex. Every pair must be checked against k only after all paths through earlier vertices are known. With k as an inner loop, some longer chains are checked too early and missed.', src: 'Drozdek §8.3.1, p. 390', unit: 'U6' },
  { id: 'wfi', group: 'Transitive closure', title: 'Warshall vs Floyd–Warshall', q: ['difference between warshall and floyd warshall', 'floyd warshall', 'wfi algorithm', 'all pairs shortest path'], a: 'Drozdek’s WFIalgorithm finds all-pairs shortest path lengths with min and +. Warshall’s closure uses the same three loops on a true/false matrix with OR and AND instead. An entry Drozdek leaves at ∞ is a pair that cannot be reached.', src: 'Drozdek §8.3.1, pp. 390–391', unit: 'U6' },
  { id: 'warshall-dp', group: 'Transitive closure', title: "Warshall's paradigm", q: ['is warshall dynamic programming', 'what paradigm is warshall', 'warshall greedy'], a: 'Dynamic programming: each R(k) is computed from the stored R(k−1) instead of searching paths again.', src: 'CS2023 AL-Strategies', unit: 'U6' },
  { id: 'warshall-time', group: 'Complexity', title: "Why Warshall's is Θ(V³)", q: ['why is warshall v cubed', 'warshall complexity', 'warshall running time', 'time complexity of warshall', 'why is warshall n 3 cubic', 'warshall v 3 n cubed big o'], a: 'Three nested loops, each over all V vertices, give V × V × V steps: Θ(V³). It needs only Θ(V²) space because it can update one matrix in place.', src: 'Drozdek §8.3.1, p. 391', unit: 'U6' },
  { id: 'dfs-vs-warshall', group: 'Complexity', title: 'When is repeated DFS faster?', q: ['when is repeated dfs faster', 'repeated dfs vs warshall', 'closure sparse graph', 'which closure algorithm'], a: 'With adjacency lists, a DFS from every vertex costs O(V(V + E)), which beats Θ(V³) on sparse graphs. On dense graphs, or with a matrix (where each DFS is O(V²)), both are cubic, and Warshall’s short loops win on simplicity.', src: 'Drozdek §8.3.1, p. 391', unit: 'U7' },
  { id: 'java-no-util', group: 'Java', title: 'Storing a graph without java.util', q: ['how do i store a graph without java util', 'can i use arraylist', 'can i use hashmap', 'no built in data structures'], a: 'The study guide forbids java.util collections unless a task allows them. Use a boolean[][] for a matrix, or your own Node class with an int vertex and a Node next for lists.', src: 'COS212 study guide §3.3', unit: 'U3' },
  { id: 'test-format', group: 'Java', title: 'Test input format', q: ['how do i read the test input format', 'input format', 'what is the test format', 'output format'], a: 'The first line is n m d (vertices, edges, 1 = directed); then m lines each give an edge u v, with vertices numbered from 0. Matrices print as rows of 0s and 1s separated by single spaces.', src: 'App test section', unit: null },
  { id: 'aioobe', group: 'Java', title: 'ArrayIndexOutOfBoundsException', q: ['array index out of bounds', 'arrayindexoutofboundsexception', 'index out of range'], a: 'Usually a loop runs one step too far, or vertices are counted from 1. Vertices are 0 to n − 1, so loops run while v < n.', src: 'App test section', unit: null },
  { id: 'prereq', group: 'Applications', title: 'Prerequisites as a graph', q: ['how is a prerequisite graph modelled', 'module prerequisites closure', 'circular prerequisite'], a: 'Make each module a vertex and draw x → y when x must come before y. The closure says whether x is needed, directly or indirectly, for y, and a 1 on its diagonal reveals a circular prerequisite.', src: 'Drozdek §8.3.1, §8.6.2', unit: 'U8' },
];

const SYNONYMS = [
  [/\bnodes\b/g, 'vertices'], [/\bnode\b/g, 'vertex'], [/\barcs?\b/g, 'edge'], [/\blinks?\b/g, 'edge'],
  [/reachability matrix/g, 'transitive closure'], [/\bwfi\b/g, 'floyd warshall'], [/\bdigraph\b/g, 'directed graph'],
  [/\bfloyd-warshall\b/g, 'floyd warshall'], [/\bwarshall'?s\b/g, 'warshall'], [/\bk-loop\b/g, 'k loop'],
];
const normalise = t => SYNONYMS.reduce((s, [re, rep]) => s.replace(re, rep), t.toLowerCase());

const index = new MiniSearch({
  fields: ['title', 'questions', 'answer'],
  storeFields: ['id'],
  searchOptions: { boost: { questions: 3, title: 2 }, fuzzy: 0.2, prefix: true, combineWith: 'OR' },
});
index.addAll(CARDS.map(c => ({ id: c.id, title: normalise(c.title), questions: normalise(c.q.join(' | ')), answer: normalise(c.a) })));
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'what', 'why', 'how', 'do', 'does', 'i', 'my', 'of', 'in', 'to', 'and', 'or', 'it', 'be', 'can', 'on', 'for', 'with', 'this', 'that', 'when', 'which', 'you', 'me']);

const GRAPH_WORDS = /\b(graph|vertex|vertices|edge|edges|matrix|closure|warshall|dfs|bfs|path|cycle|degree|reach|adjacen|incidence|connected|loop|tree|kn|complete|digraph|directed|floyd|transitive|java|algorithm|search|prerequisite|neighbou?r)/;
const SOLUTION_REQUEST = /(give|show|write|send|paste|post|need)\b.{0,25}\b(code|solution|answer)|solution (for|to)|\bp(1[01]|[1-9])\b.{0,20}\b(code|solution|answer)|full code|complete code|do my|write it for me/;
const PROBLEM_TYPICAL = { P1: 'one-direction', P2: 'used-matrix', P3: 'format', P4: 'complete-by-count', P5: 'no-visited', P6: 'diagonal', P7: 'k-not-outer', P8: 'k-not-outer', P9: 'diagonal', P10: 'k-not-outer', P11: 'too-slow' };

function labelIndex(g, label) {
  return g.vertices.findIndex(v => v.label.toLowerCase() === label.toLowerCase());
}

/** Layer 1: exact answers about the learner's own graph. */
function graphEngine(text, g) {
  if (!g || !g.vertices?.length) return null;
  const t = text.toLowerCase();
  const labels = g.vertices.map(v => v.label);
  const lab = '([a-z][0-9]?)';
  const adj = boolMatrix(g);
  const P = properties(g);
  const say = (answer, highlight = {}) => ({ kind: 'graph', answer, source: 'Computed from your graph', highlight });
  let m;
  if ((m = t.match(new RegExp(`(?:can|does)\\s+${lab}\\s+reach\\s+${lab}`))) || (m = t.match(new RegExp(`path\\s+from\\s+${lab}\\s+to\\s+${lab}`))) || (m = t.match(new RegExp(`is\\s+${lab}\\s+reachable\\s+from\\s+${lab}`)))) {
    let [u, v] = [m[1], m[2]];
    if (/reachable\s+from/.test(m[0])) [u, v] = [m[2], m[1]];
    const i = labelIndex(g, u), j = labelIndex(g, v);
    if (i < 0 || j < 0) return say(`I can't find vertex ${i < 0 ? u : v} in your graph. Its vertices are ${labels.join(', ')}.`);
    const p = findPath(adj, i, j);
    if (!p) return say(`No: no path of one or more edges leads from ${labels[i]} to ${labels[j]}${g.directed ? ' (remember the edges are one-way)' : ''}.`, { vertices: [i, j] });
    return say(`Yes: ${p.map(x => labels[x]).join(' → ')}. That is ${p.length - 1} edge${p.length === 2 ? '' : 's'}.`, { vertices: p, path: p });
  }
  if ((m = t.match(new RegExp(`degree\\s+(?:of\\s+)?(?:vertex\\s+)?${lab}\\b`)))) {
    const i = labelIndex(g, m[1]);
    if (i < 0) return say(`I can't find vertex ${m[1]}. Your vertices are ${labels.join(', ')}.`);
    const extra = g.directed ? ` In-degree ${P.inDeg[i]}, out-degree ${P.outDeg[i]}.` : '';
    return say(`deg(${labels[i]}) = ${P.degree[i]}.${extra}${g.edges.some(e => e.from === e.to && e.from === g.vertices[i].id) ? ' Its loop counts 2.' : ''}`, { vertices: [i] });
  }
  if ((m = t.match(new RegExp(`neighbou?rs?\\s+of\\s+${lab}\\b`)))) {
    const i = labelIndex(g, m[1]);
    if (i < 0) return null;
    const nb = [...new Set(adjacencyList(g)[i])].map(x => labels[x]);
    return say(nb.length ? `${labels[i]}'s neighbours are ${nb.join(', ')}.` : `${labels[i]} has no neighbours: it is isolated${g.directed ? ' or only has incoming edges' : ''}.`, { vertices: [i] });
  }
  if ((m = t.match(new RegExp(`row\\s+${lab}\\b.*closure|closure.*row\\s+${lab}\\b`)))) {
    const i = labelIndex(g, m[1] || m[2]);
    if (i < 0) return null;
    const r = closure(adj)[i];
    const reach = r.map((x, j) => (x ? labels[j] : null)).filter(Boolean);
    return say(`Row ${labels[i]} of the closure lists every vertex ${labels[i]} can reach by one or more edges: ${reach.join(', ') || 'none'}.${reach.length === labels.length ? ` It is all 1s because ${labels[i]} reaches every vertex, itself included (it lies on a cycle).` : ''}`, { vertices: [i] });
  }
  if (/(my|this|the) graph/.test(t) || /\b(is it|is my)\b/.test(t)) {
    if (/strongly connected|weakly connected|connected/.test(t)) return say(`Your graph is ${P.connectivity}.${g.directed && P.connectivity !== 'strongly connected' ? ' Strongly connected needs a path both ways between every pair.' : ''}`);
    if (/cycle|cyclic|acyclic/.test(t)) return say(P.hasCycle ? 'Yes, your graph has a cycle.' : 'No, your graph is acyclic.');
    if (/complete/.test(t)) return say(P.complete ? `Yes: it is K${P.V}.` : `No. K${P.V} would need ${P.V * (P.V - 1) / 2} edges joining every pair once, with no loops or repeated edges.`);
    if (/closure|transitive/.test(t)) {
      const r = closure(adj);
      const added = [];
      for (let i = 0; i < r.length; i++) for (let j = 0; j < r.length; j++) if (r[i][j] && !adj[i][j]) added.push(`${labels[i]} → ${labels[j]}`);
      return say(added.length ? `The closure adds ${added.length} pair${added.length > 1 ? 's' : ''}: ${added.join(', ')}.` : 'The closure adds nothing: every reachable pair is already joined directly.');
    }
    if (/how many|count|number of/.test(t) && /edge/.test(t)) return say(`Your graph has ${P.E} edge${P.E === 1 ? '' : 's'} and ${P.V} vert${P.V === 1 ? 'ex' : 'ices'}.`);
    if (/how many|count|number of/.test(t) && /vert/.test(t)) return say(`Your graph has ${P.V} vertices.`);
    if (/isolated/.test(t)) return say(P.isolated.length ? `Isolated: ${P.isolated.map(i => labels[i]).join(', ')}.` : 'There are no isolated vertices.');
    if (/type|simple|multigraph|pseudograph/.test(t)) return say(`It is a ${P.directed ? 'directed ' : ''}${P.type}.`);
  }
  return null;
}

/** Main entry point. context = { problemId, category, misconception } from "Ask about this feedback". */
export function answer(text, { graph, context } = {}) {
  const raw = (text || '').trim();
  const t = normalise(raw);
  if (!raw) return { kind: 'empty', answer: 'Ask me anything about graphs or transitive closure.' };

  // No test solutions: give the next hint instead.
  const pm = t.match(/\bp(1[01]|[1-9])\b/);
  if (SOLUTION_REQUEST.test(t)) {
    const pid = context?.problemId || (pm ? `P${pm[1]}` : null);
    const mis = context?.misconception || (pid ? PROBLEM_TYPICAL[pid] : null);
    const hint = mis ? hintStep(mis, 1, context?.category).text : 'Tell me which problem you are on (P1–P11) and I will give you its first hint.';
    return { kind: 'guard', answer: `I can't give code for the test problems, but here is a hint${pid ? ` for ${pid}` : ''}: ${hint}`, source: 'Hint ladder' };
  }

  // Context from "Ask about this feedback"
  if (context?.misconception && /^(why|what|how|explain|i don|help|ask about)/.test(t)) {
    const m = MISCONCEPTIONS[context.misconception];
    if (m) return { kind: 'feedback', answer: `About your ${context.problemId || 'answer'}: ${m.title}. ${m.hint1}${m.pointsTo?.drozdek ? ` See Drozdek ${m.pointsTo.drozdek}.` : ''}`, source: m.pointsTo?.label, unit: m.pointsTo?.unit };
  }

  const g = graphEngine(raw, graph);
  if (g) return g;

  const terms = t.replace(/[^a-z0-9⁺ ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
  const results = terms.length ? index.search(terms.join(' ')) : [];
  const top = results[0];
  const second = results[1];
  const confident = top && top.score >= 6 && top.queryTerms.length >= Math.min(2, terms.length) && (!second || top.score >= second.score * 1.05 || top.queryTerms.length > second.queryTerms.length);
  if (confident) {
    const c = CARDS.find(x => x.id === top.id);
    return { kind: 'kb', cardId: c.id, title: c.title, answer: c.a, source: c.src, unit: c.unit };
  }
  if (!GRAPH_WORDS.test(t) && !results.length) {
    return { kind: 'offtopic', answer: 'I only answer questions about graphs and transitive closure for COS212. Try one of these topics.', suggestions: ['What is transitive closure?', 'Matrix or list for a sparse graph?', 'Why must k be the outer loop?'] };
  }
  const near = results.slice(0, 3).map(r => CARDS.find(c => c.id === r.id).title);
  return {
    kind: 'fallback',
    answer: "I'm not sure I understood that. Here are the closest topics I know about. I've also logged your question so the team can add an answer.",
    suggestions: near.length ? near : ['What is a graph?', 'What is transitive closure?', "How does Warshall's algorithm work?"],
    email: `mailto:cos212queries@cs.up.ac.za?subject=${encodeURIComponent('COS212 graphs question')}&body=${encodeURIComponent(raw)}`,
  };
}

/** Topic titles map to a canned question, so suggestion buttons resolve to a card. */
export function cardByTitle(title) { return CARDS.find(c => c.title === title); }
