// Question banks for every lesson. Four kinds: multiple choice, fill in the
// blank, put in order (drag and drop) and sort into boxes (drag and drop).
// Each question has a tier (1 warm-up, 2 core, 3 challenge); the quiz draws
// harder tiers as the learner's level goes up (TIERS_BY_LEVEL).
import { bfsTrace, dfsTrace, emptyGraph, addVertex, addEdge, ids, neighbours, properties, rng, type Graph } from '../../../shared/graph-core.mjs';
import { TIERS_BY_LEVEL } from '../../../shared/units.mjs';
import { fromPairs, graphWith, opts, pick, shuffle, type Option, type Rand } from './checkKit';
import { GENERATORS } from './checks';

export type Tier = 1 | 2 | 3;
type Base = {
  key: string; // stable per question template: points are awarded once per key
  tier: Tier;
  prompt: string;
  explain: string;
  graph?: Graph;
  tags?: Record<string, string>; // names shown beside vertices
  matrix?: { labels: string[]; cells: number[][]; caption: string; kRow?: number };
  code?: string;
  misconception?: string; // counted on the lecturer dashboard when answered wrongly
};
export type MCQ = Base & { kind: 'mc'; options: Option[] };
export type BlankQ = Base & { kind: 'blank'; answers: string[]; before?: string; after?: string };
export type OrderQ = Base & { kind: 'order'; items: string[]; start?: string[] };
export type SortQ = Base & { kind: 'sort'; buckets: string[]; items: { text: string; bucket: number }[] };
export type QuizQ = MCQ | BlankQ | OrderQ | SortQ;

const mc = (key: string, tier: Tier, prompt: string, options: Option[], explain: string, extra: Partial<Base> = {}): MCQ => ({ kind: 'mc', key, tier, prompt, options, explain, ...extra });
const blank = (key: string, tier: Tier, prompt: string, answers: (string | number)[], explain: string, extra: Partial<BlankQ> = {}): BlankQ => ({ kind: 'blank', key, tier, prompt, answers: answers.map(String), explain, ...extra });
const order = (key: string, tier: Tier, prompt: string, items: string[], explain: string, extra: Partial<OrderQ> = {}): OrderQ => ({ kind: 'order', key, tier, prompt, items, explain, ...extra });
const sort = (key: string, tier: Tier, prompt: string, buckets: string[], items: [string, number][], explain: string, extra: Partial<SortQ> = {}): SortQ => ({ kind: 'sort', key, tier, prompt, buckets, items: items.map(([text, bucket]) => ({ text, bucket })), explain, ...extra });

/** Normalises a typed answer: case, spaces, punctuation and the words "a"/"the". */
export const normalise = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[.,!?;:]/g, ' ').replace(/\b(a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
export const blankCorrect = (q: BlankQ, typed: string) => q.answers.some(a => normalise(a) === normalise(typed));

/** Turns one of the older multiple-choice generators into tiered quiz questions. */
function fromGenerator(unit: string, r: Rand, tiers: Tier[], only?: string[]): MCQ[] {
  return GENERATORS[unit](r)
    .filter(q => !only || only.includes(q.id))
    .map((q, i) => ({ kind: 'mc' as const, key: `${unit}:${q.id}`, tier: tiers[i % tiers.length], prompt: q.prompt, options: q.options, explain: q.explain, graph: q.graph, matrix: q.matrix, code: q.code }));
}

// ---------------------------------------------------------------- the campus scenario (L8)
export const CAMPUS_NAMES: Record<string, string> = { a: 'Library', b: 'IT Building', c: 'Student Centre', d: 'Engineering', e: 'Aula', f: 'Sports Centre', g: 'Res' };
export const CAMPUS: Graph = (() => {
  let g = emptyGraph({ directed: false });
  const pos: [number, number][] = [[280, 190], [150, 80], [400, 80], [70, 260], [430, 290], [260, 335], [510, 175]];
  for (const [x, y] of pos) g = addVertex(g, x, y).graph;
  for (const [u, v] of ['ab', 'ac', 'bd', 'ce', 'cg', 'ef', 'df'].map(p => [p[0], p[1]])) g = addEdge(g, u, v).graph;
  return g;
})();
const nameOf = (v: string) => CAMPUS_NAMES[v] ?? v;

/** A small graph where the BFS and DFS orders from `s` differ. */
function traversalGraph(r: Rand, n: number, directed: boolean) {
  for (let t = 0; t < 80; t++) {
    const g = graphWith(r, { n, directed, density: directed ? 0.3 : 0.4, min: n });
    const s = ids(g)[0];
    const b = bfsTrace(g, s).order, d = dfsTrace(g, s).order;
    if (b.length >= n - 1 && b.join() !== d.join()) return { g, s, bfs: b, dfs: d };
  }
  const g = fromPairs(5, [[0, 1], [0, 2], [1, 3], [2, 4]], false);
  return { g, s: 'a', bfs: bfsTrace(g, 'a').order, dfs: dfsTrace(g, 'a').order };
}

// ---------------------------------------------------------------- banks

const BANKS: Record<string, (r: Rand) => QuizQ[]> = {
  L1: r => {
    const vals = shuffle(r, [3, 7, 9, 12, 15, 21, 4]).slice(0, 5);
    const removeAt = 1 + Math.floor(r() * 3);
    const after = vals.filter((_, i) => i !== removeAt);
    const k = 3 + Math.floor(r() * 5);
    return [
      mc('L1-array-step', 1, 'An array a holds 6 numbers. How many steps does it take to read a[4]?', opts(r, [
        { text: 'One step: arrays jump straight to an index', correct: true },
        { text: 'Five steps: walk from a[0] to a[4]', misconception: 'list-index', why: 'That is how a linked list works, not an array.' },
        { text: 'Six steps: one per item' },
      ]), 'Array items sit side by side in memory, so a[i] is found directly: O(1).'),
      blank('L1-first-index', 1, 'Fill in the blank: in Java, the first item of an array a is a[ ___ ].', [0, 'zero'], 'Java arrays (and the vertices in our tests) are numbered from 0.'),
      sort('L1-sort', 1, 'Sort each description into the structure it describes.', ['Array', 'Linked list'], [
        ['Size is fixed when it is created', 0], ['Jumps straight to item i', 0], ['Grows one node at a time', 1], ['Each item points to the next one', 1],
      ], 'Arrays: fixed size, direct indexing. Linked lists: nodes linked by next references, easy to grow.', { misconception: 'list-index' }),
      mc('L1-2d', 2, 'int[][] m = new int[3][4]; What are m.length and m[0].length?', opts(r, [
        { text: '3 and 4', correct: true }, { text: '4 and 3' }, { text: '12 and 12' }, { text: '3 and 3' },
      ]), 'm is 3 rows of 4 columns: m.length counts rows (3), m[0].length counts the columns in row 0 (4).', { code: 'int[][] m = new int[3][4];' }),
      order('L1-append', 2, 'Put the steps for adding a node to the END of a singly linked list (no tail reference) in order.', [
        'Create the new node', 'Start at the head', 'Walk until node.next is null', 'Set that last node’s next to the new node',
      ], 'You must reach the last node before you can link after it. A tail reference skips the walk.'),
      blank('L1-walk', 2, `To reach item number ${k} (counting from 1) of a singly linked list, starting at the head, you follow ___ next references.`, [k - 1], `The head is item 1; each next moves one item on, so item ${k} needs ${k - 1} moves.`, { misconception: 'list-index' }),
      mc('L1-remove', 3, `The list is ${vals.join(' → ')}. You unlink the node holding ${vals[removeAt]}. What is the list now?`, opts(r, [
        { text: after.join(' → '), correct: true },
        { text: vals.filter((_, i) => i !== removeAt + 1).join(' → ') },
        { text: vals.slice(0, removeAt).join(' → '), why: 'Unlinking one node keeps the rest of the chain.' },
        { text: [...after].reverse().join(' → ') },
      ]), `Set the previous node’s next to the node after ${vals[removeAt]}; the rest of the chain stays.`),
      blank('L1-cells', 3, 'An adjacency matrix for 6 vertices is a 6 × 6 2D array. How many cells does it have?', [36], 'n × n = 6 × 6 = 36 cells, whatever the number of edges. That is why a matrix needs Θ(V²) memory.'),
      mc('L1-cost', 3, 'Which operation is O(n) on a singly linked list of n nodes but O(1) on an array?', opts(r, [
        { text: 'Reading the item at position i', correct: true },
        { text: 'Adding a node at the front of the list', why: 'Adding at the front is O(1) on a linked list.' },
        { text: 'Reading the first item' },
      ]), 'An array computes where item i is; a list has to walk to it.', { misconception: 'list-index' }),
    ];
  },

  L2: r => {
    const g = graphWith(r, { n: 5, directed: false, density: 0.45, min: 5 });
    const p = properties(g);
    const L = ids(g);
    const v = pick(r, L.filter(x => p.deg[x] > 0));
    const nb = neighbours(g, v);
    const degSum = L.reduce((a, x) => a + p.deg[x], 0);
    const degs = shuffle(r, [[3, 2, 2, 1], [2, 2, 2, 2], [4, 3, 2, 1], [3, 3, 2, 2]])[0];
    return [
      mc('L2-names', 1, 'In graph language, what do we call the dots, and the lines that join them?', opts(r, [
        { text: 'Vertices (nodes) and edges', correct: true }, { text: 'Edges and vertices' }, { text: 'Rows and columns' }, { text: 'Heads and tails' },
      ]), 'A graph is a set of vertices (nodes) joined by edges.'),
      sort('L2-sort', 1, 'In a social network graph, is each item a vertex or an edge?', ['Vertex', 'Edge'], [
        ['A person', 0], ['A friendship', 1], ['A city', 0], ['A road between two cities', 1], ['A web page', 0], ['A link between pages', 1],
      ], 'Things are vertices; connections between two things are edges.'),
      blank('L2-degree', 1, `What is the degree of vertex ${v} in this graph?`, [p.deg[v]], `${v} touches ${p.deg[v]} edge end${p.deg[v] === 1 ? '' : 's'}.`, { graph: g, misconception: 'loop-degree' }),
      mc('L2-neigh', 2, `Which vertices are neighbours of ${v}?`, opts(r, [
        { text: `{${nb.join(', ')}}`, correct: true },
        { text: `{${L.filter(x => x !== v && !nb.includes(x)).join(', ') || 'none'}}` },
        { text: `{${[v, ...nb].join(', ')}}`, why: 'A vertex is not its own neighbour unless it has a loop.' },
      ]), `Neighbours are the vertices joined to ${v} by an edge: ${nb.join(', ')}.`, { graph: g }),
      blank('L2-sum', 2, 'Add up the degrees of every vertex in this graph. What do you get?', [degSum], `Each of the ${g.edges.length} edges has two ends, so the degrees add up to 2 × ${g.edges.length} = ${degSum}.`, { graph: g }),
      mc('L2-loop', 2, 'A loop is an edge from a vertex to itself. How much does one loop add to that vertex’s degree?', opts(r, [
        { text: '2', correct: true }, { text: '1', misconception: 'loop-degree', why: 'Both ends of the loop touch the vertex.' }, { text: '0' },
      ]), 'Degree counts edge ends, and both ends of a loop are at the same vertex.'),
      blank('L2-handshake', 3, `Four vertices have degrees ${degs.join(', ')}. How many edges does the graph have?`, [degs.reduce((a, b) => a + b, 0) / 2], `Degrees add up to twice the edges: ${degs.join(' + ')} = ${degs.reduce((a, b) => a + b, 0)}, so |E| = ${degs.reduce((a, b) => a + b, 0) / 2}.`),
      mc('L2-odd', 3, 'Can a graph have degrees 3, 2, 2, 2?', opts(r, [
        { text: 'No: the degrees add up to 9, which is odd', correct: true },
        { text: 'Yes: any list of degrees is possible' },
        { text: 'Only if the graph is directed' },
      ]), 'The degrees always add up to 2|E|, an even number.'),
    ];
  },

  L3: r => [
    mc('L3-oneway', 1, 'A city map has one-way streets. Which kind of graph models it best?', opts(r, [
      { text: 'Directed', correct: true }, { text: 'Undirected', misconception: 'direction-ignored' }, { text: 'A tree' },
    ]), 'A one-way street can only be followed in one direction: an arrow.'),
    sort('L3-dir', 1, 'Directed or undirected?', ['Directed', 'Undirected'], [
      ['Instagram “follows”', 0], ['Facebook friendship', 1], ['Module prerequisites', 0], ['A two-way road', 1],
    ], 'If the link only works one way (A follows B, A comes before B) it is directed.', { misconception: 'direction-ignored' }),
    sort('L3-weight', 2, 'Weighted or unweighted?', ['Weighted', 'Unweighted'], [
      ['Roads with distances in km', 0], ['Taxi routes with fares', 0], ['Who knows whom', 1], ['Pages that link to each other', 1],
    ], 'If each edge carries a number that matters (distance, cost, time) the graph is weighted.'),
    blank('L3-kn', 2, 'The complete graph Kₙ has n(n − 1)/2 edges. How many edges does K₅ have?', [10], '5 × 4 / 2 = 10.', { misconception: 'kn-edges' }),
    mc('L3-tree', 2, 'What do we call a connected graph with no cycles?', opts(r, [
      { text: 'A tree', correct: true }, { text: 'A complete graph' }, { text: 'A multigraph' }, { text: 'A digraph' },
    ]), 'Connected + acyclic = tree.'),
    blank('L3-tree-edges', 3, 'A tree has 8 vertices. How many edges does it have?', [7], 'A tree with n vertices has exactly n − 1 edges.'),
    ...fromGenerator('U1', r, [2, 3, 3, 2, 3]),
  ],

  L4: r => [
    mc('L4-map', 1, 'In a graph of a road map, what are the vertices?', opts(r, [
      { text: 'Places such as towns or intersections', correct: true }, { text: 'The roads' }, { text: 'The distances' },
    ]), 'Places are vertices; the roads between them are the edges (weighted by distance).'),
    sort('L4-parts', 1, 'For a module-prerequisite graph, sort each item.', ['Vertex', 'Edge'], [
      ['COS212', 0], ['“COS110 is needed before COS212”', 1], ['COS226', 0], ['“COS212 is needed before COS226”', 1],
    ], 'Modules are vertices; each “needed before” is a directed edge.'),
    mc('L4-web', 2, 'Web pages and the links between them form which kind of graph?', opts(r, [
      { text: 'Directed: a link goes from one page to another', correct: true },
      { text: 'Undirected: links work both ways', misconception: 'direction-ignored' },
      { text: 'Weighted: every link has a length' },
    ]), 'Page A linking to page B does not mean B links back.'),
    blank('L4-fof', 2, 'In a social network, a “friend of a friend” is how many edges away from you?', [2, 'two'], 'You → friend → their friend: a path of 2 edges.'),
    order('L4-model', 2, 'Put the steps for modelling a problem as a graph in order.', [
      'Decide what the vertices are', 'Decide what the edges are', 'Decide on direction and weights', 'Choose how to store it and which algorithm to run',
    ], 'Things first, then links, then the details of the links, then code.'),
    mc('L4-reach', 3, 'You want every module that needs COS110, directly or through a chain. What do you do?', opts(r, [
      { text: 'Follow the arrows from COS110 as far as they go (BFS or DFS)', correct: true },
      { text: 'List only COS110’s direct neighbours', misconception: 'one-stop-only', why: 'That misses modules further down the chain.' },
      { text: 'Follow the arrows into COS110', misconception: 'direction-ignored', why: 'Those are the modules COS110 needs.' },
    ]), 'Everything reachable from COS110 depends on it: a traversal finds them all.'),
    mc('L4-fares', 3, 'A taxi app must find the cheapest route between two ranks. Which graph property matters most?', opts(r, [
      { text: 'Edge weights (the fares)', correct: true }, { text: 'Whether the graph is a tree' }, { text: 'The number of vertices' },
    ]), 'Cheapest depends on the cost of each edge, so the graph must be weighted.'),
  ],

  L5: r => {
    const n = 4 + Math.floor(r() * 3);
    const rem = 1 + Math.floor(r() * (n - 2));
    const old = n - 1;
    return [
      mc('L5-cells', 1, 'You add the undirected edge 1 – 3 to an adjacency matrix. Which cells change?', opts(r, [
        { text: 'adj[1][3] and adj[3][1]', correct: true },
        { text: 'Only adj[1][3]', misconception: 'undirected-one-cell', why: 'An undirected edge works both ways, so both cells change.' },
        { text: 'Row 1 and column 3, every cell' },
      ]), 'Undirected: set both adj[u][v] and adj[v][u].'),
      blank('L5-list', 1, 'Fill in the blank: an adjacency list is an array of linked ___, one per vertex.', ['lists', 'list'], 'Each vertex keeps a linked list of its neighbours.'),
      blank('L5-grow', 2, `A graph has ${n} vertices in an adjacency matrix. After addVertex(), the matrix is k × k. What is k?`, [n + 1], `One new row and one new column: ${n + 1} × ${n + 1}. The old cells are copied across.`),
      order('L5-remove-steps', 2, 'Put the steps of removeVertex(v) on an adjacency matrix in order.', [
        'Make a new (n − 1) × (n − 1) matrix', 'Copy every cell except row v and column v', 'Vertices after v now sit one place lower', 'Replace the old matrix with the new one',
      ], 'Copying without row v and column v removes v and every edge that touched it.', { misconception: 'remove-vertex-edges' }),
      mc('L5-renumber', 3, `Vertices are numbered 0 to ${n - 1}. You remove vertex ${rem}. What number does the old vertex ${old} have now?`, opts(r, [
        { text: String(old - 1), correct: true }, { text: String(old), why: 'Every vertex after the removed one moves down by one.' }, { text: String(rem) },
      ]), `Vertices after ${rem} move down one place, so ${old} becomes ${old - 1}.`),
      sort('L5-mvsl', 3, 'Matrix or list?', ['Adjacency matrix', 'Adjacency list'], [
        ['Checks “is there an edge u → v?” in one step', 0], ['Always uses V × V memory', 0], ['Better for sparse graphs (few edges)', 1], ['Lists v’s neighbours in deg(v) steps', 1],
      ], 'Matrix: fast edge checks, V² memory. List: memory grows with the edges, fast neighbour loops.', { misconception: 'list-matrix-cost' }),
      blank('L5-unlink', 3, 'Removing vertex v from adjacency lists: drop v’s own list, then remove v from every other vertex’s ___.', ['list', 'lists', 'linked list', 'neighbour list'], 'Edges into v live in other vertices’ lists, so they must be unlinked too.', { misconception: 'remove-vertex-edges' }),
      ...fromGenerator('U3', r, [2, 2, 3, 3, 2]),
    ];
  },

  L6: r => {
    const a = traversalGraph(r, 6, true);
    const b = traversalGraph(r, 7, false);
    const dist = (() => {
      const t = pick(r, a.bfs.slice(2));
      const prev = new Map<string, string | null>([[a.s, null]]);
      const q = [a.s];
      while (q.length) { const u = q.shift()!; for (const w of neighbours(a.g, u)) if (!prev.has(w)) { prev.set(w, u); q.push(w); } }
      let k = 0, c: string | null | undefined = t;
      while (c && c !== a.s) { c = prev.get(c); k++; }
      return { t, k };
    })();
    return [
      mc('L6-ds', 1, 'Which data structure does BFS use to decide which vertex to visit next?', opts(r, [
        { text: 'A queue (first in, first out)', correct: true }, { text: 'A stack (last in, first out)', misconception: 'queue-stack' }, { text: 'A sorted array' },
      ]), 'BFS uses a queue so the vertices found first are visited first, level by level.'),
      blank('L6-front', 1, 'Fill in the blank: BFS takes the next vertex from the ___ of the queue.', ['front', 'head', 'start'], 'Queues are first in, first out: take from the front, add at the back.', { misconception: 'queue-stack' }),
      order('L6-order', 2, `Drag the vertices into the order BFS visits them, starting at ${a.s}. Take neighbours in alphabetical order.`, a.bfs, `BFS: ${a.bfs.join(' → ')}. Each level is finished before the next one starts.`, { graph: a.g, misconception: 'dfs-bfs-order' }),
      mc('L6-mark', 2, 'When should BFS mark a vertex as visited?', opts(r, [
        { text: 'When it is added to the queue', correct: true },
        { text: 'Only when it leaves the queue', why: 'Then the same vertex could be added to the queue more than once.' },
        { text: 'Never: BFS does not need marks', misconception: 'no-visited-mark' },
      ]), 'Marking on the way in means no vertex is ever queued twice.'),
      blank('L6-dist', 3, `Using BFS from ${a.s}, what is the smallest number of edges on a path from ${a.s} to ${dist.t}?`, [dist.k], `BFS reaches vertices in order of distance: ${dist.t} is ${dist.k} edge${dist.k === 1 ? '' : 's'} away.`, { graph: a.g }),
      order('L6-order-big', 3, `Drag the vertices into BFS order from ${b.s} (neighbours in alphabetical order).`, b.bfs, `BFS: ${b.bfs.join(' → ')}.`, { graph: b.g, misconception: 'dfs-bfs-order' }),
      mc('L6-cost', 3, 'With adjacency lists, how long does BFS take on a graph with V vertices and E edges?', opts(r, [
        { text: 'O(V + E)', correct: true }, { text: 'O(V²) always', misconception: 'list-matrix-cost' }, { text: 'O(V × E)' }, { text: 'O(E²)' },
      ]), 'Each vertex enters the queue once and each list is scanned once: O(V + E).'),
      ...fromGenerator('U4', r, [2, 2, 3, 3, 1], ['u4-bfs', 'u4-reach']),
    ];
  },

  L7: r => {
    const a = traversalGraph(r, 6, true);
    const b = traversalGraph(r, 7, false);
    return [
      mc('L7-ds', 1, 'A recursive DFS keeps track of where to return to using…', opts(r, [
        { text: 'The call stack (last in, first out)', correct: true }, { text: 'A queue (first in, first out)', misconception: 'queue-stack' }, { text: 'Nothing: it never goes back' },
      ]), 'Each recursive call sits on the call stack until it finishes, then DFS returns to the caller.'),
      mc('L7-why-mark', 1, 'Why does DFS on a graph need visited marks, when DFS on a tree does not?', opts(r, [
        { text: 'A graph can have cycles, so the search could loop forever', correct: true },
        { text: 'Graphs have more vertices than trees' },
        { text: 'To make the search faster on trees' },
      ]), 'A cycle leads back to a vertex already seen. The mark stops the search going round again.', { misconception: 'no-visited-mark' }),
      order('L7-order', 2, `Drag the vertices into the order DFS visits them, starting at ${a.s}. Take neighbours in alphabetical order.`, a.dfs, `DFS: ${a.dfs.join(' → ')}. It follows one branch to the end before backing up.`, { graph: a.g, misconception: 'dfs-bfs-order' }),
      blank('L7-backtrack', 2, 'When DFS reaches a vertex with no unvisited neighbours, it ___ to the vertex it came from.', ['backtracks', 'backtrack', 'returns', 'goes back', 'backs up', 'return'], 'That is backtracking: the recursive call returns.'),
      order('L7-order-big', 3, `Drag the vertices into DFS order from ${b.s} (neighbours in alphabetical order).`, b.dfs, `DFS: ${b.dfs.join(' → ')}.`, { graph: b.g, misconception: 'dfs-bfs-order' }),
      sort('L7-vs', 3, 'BFS or DFS?', ['BFS', 'DFS'], [
        ['Uses a queue', 0], ['Uses recursion or a stack', 1], ['Visits level by level', 0], ['Goes deep first, then backtracks', 1], ['Finds fewest-edge paths', 0], ['Is the basis of closure by repeated search', 1],
      ], 'Same loop, different container: queue → BFS, stack or recursion → DFS.', { misconception: 'dfs-bfs-order' }),
      ...fromGenerator('U4', r, [2, 3, 3, 2, 1], ['u4-dfs', 'u4-back']),
    ];
  },

  L8: r => {
    const bfsC = bfsTrace(CAMPUS, 'a').order;
    const dfsC = dfsTrace(CAMPUS, 'a').order;
    const t = traversalGraph(r, 6, false);
    const which = r() < 0.5 ? 'BFS' : 'DFS';
    const shown = which === 'BFS' ? t.bfs : t.dfs;
    return [
      mc('L8-same', 1, 'Naledi runs BFS and then DFS from the Library. Which is true?', opts(r, [
        { text: 'Both reach exactly the same buildings, in a different order', correct: true },
        { text: 'BFS reaches more buildings than DFS' },
        { text: 'DFS reaches more buildings than BFS' },
      ]), 'Both find everything reachable from the start; only the visiting order differs.'),
      blank('L8-next', 1, 'BFS starts at the Library. Its neighbours are the IT Building and the Student Centre. Which one does BFS visit first (alphabetical by map letter: b before c)?', ['IT Building', 'IT', 'b'], 'Neighbours are taken in order, so the IT Building (b) comes before the Student Centre (c).', { graph: CAMPUS, tags: CAMPUS_NAMES }),
      order('L8-bfs', 2, 'Drag the buildings into the order BFS visits them from the Library.', bfsC.map(nameOf), `BFS: ${bfsC.map(nameOf).join(' → ')}.`, { graph: CAMPUS, tags: CAMPUS_NAMES, misconception: 'dfs-bfs-order' }),
      order('L8-dfs', 2, 'Drag the buildings into the order DFS visits them from the Library.', dfsC.map(nameOf), `DFS: ${dfsC.map(nameOf).join(' → ')}.`, { graph: CAMPUS, tags: CAMPUS_NAMES, misconception: 'dfs-bfs-order' }),
      mc('L8-which', 3, `A traversal from ${t.s} (neighbours in alphabetical order) visited ${shown.join(', ')}. Which traversal was it?`, opts(r, [
        { text: which, correct: true }, { text: which === 'BFS' ? 'DFS' : 'BFS', misconception: 'dfs-bfs-order' },
      ]), which === 'BFS' ? `Level by level: all of ${t.s}’s neighbours come before anything further away.` : 'It follows one branch to the end before backing up.', { graph: t.g }),
      blank('L8-far', 3, 'On the campus map, what is the smallest number of walks (edges) from the Library to the Sports Centre?', [3, 'three'], 'Library → IT Building → Engineering → Sports Centre, or via the Student Centre and Aula: 3 edges. BFS finds it.', { graph: CAMPUS, tags: CAMPUS_NAMES }),
    ];
  },

  U5: r => fromGenerator('U5', r, [1, 2, 2, 3, 3]),
  U6: r => fromGenerator('U6', r, [1, 2, 2, 3, 3]),
  U7: r => fromGenerator('U7', r, [1, 2, 2, 3, 3]),
  U8: r => fromGenerator('U8', r, [1, 2, 2, 3, 3]),
};

/**
 * Five questions for a lesson. The tiers come from the learner's level (Beginner
 * gets mostly warm-ups, a Legend mostly challenges), ordered easy → hard.
 */
export function makeQuiz(lesson: string, level: number, seed = Date.now()): QuizQ[] {
  const r = rng(seed >>> 0);
  const bank = shuffle(r, BANKS[lesson](r));
  const want = TIERS_BY_LEVEL[level] ?? TIERS_BY_LEVEL[1];
  const used = new Set<QuizQ>();
  const out: QuizQ[] = [];
  for (const tier of want) {
    const q = bank.find(x => !used.has(x) && x.tier === tier) ?? bank.find(x => !used.has(x) && Math.abs(x.tier - tier) === 1) ?? bank.find(x => !used.has(x));
    if (q) {
      used.add(q);
      out.push(q);
    }
  }
  return out.sort((a, b) => a.tier - b.tier);
}

/** Every question in a lesson's bank (used by the tests). */
export const bankFor = (lesson: string, seed: number) => BANKS[lesson](rng(seed >>> 0));
export const BANK_LESSONS = Object.keys(BANKS);
