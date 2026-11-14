// The coding section: Java problems on graph creation (P1–P2), BFS and DFS (P3–P4)
// and transitive closure (P5–P9). It opens once every core lesson is done.
// Each problem has starter code, a Java harness (Main) that does the I/O, a
// generator for visible and per-learner hidden tests, and expected output
// computed by the shared graph engine, so the answers can never be wrong.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng, warshall, warshallKInnermost } from '../../shared/graph-core.mjs';

import { HARNESS_HEAD, SAMPLE_CYCLE, SAMPLE_PATH, boolOf, caseGraphs, countMatrix, graphText, matText } from './problemKit.js';

const opsHarness = cls => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int n = sc.nextInt(); boolean d = sc.nextInt() == 1; int q = sc.nextInt();
    ${cls} g = new ${cls}(n, d);
    for (int i = 0; i < q; i++) {
      String op = sc.next();
      if (op.equals("addVertex")) g.addVertex();
      else if (op.equals("removeVertex")) g.removeVertex(sc.nextInt());
      else if (op.equals("addEdge")) g.addEdge(sc.nextInt(), sc.nextInt());
      else if (op.equals("removeEdge")) g.removeEdge(sc.nextInt(), sc.nextInt());
      else if (op.equals("hasEdge")) out.println(g.hasEdge(sc.nextInt(), sc.nextInt()));
      else if (op.equals("degree")) out.println(g.degree(sc.nextInt()));
      else if (op.equals("size")) out.println(g.vertexCount());
      ${cls === 'ListGraph' ? 'else if (op.equals("neighbours")) out.println(join(g.neighbours(sc.nextInt())));' : ''}
    }
  }
}
`;

/**
 * Random operation scripts for P1/P2 (add and remove nodes and edges), with
 * expected output from a simple reference model. removeVertex(v) renumbers the
 * vertices above v down by one, as in the lessons.
 */
export function opsTests(rand, withNeighbours) {
  const tests = [];
  const make = (caseType, n, directed, ops) => {
    let adj = Array.from({ length: n }, () => []); // insertion-ordered neighbour lists
    const has = (u, v) => adj[u].includes(v);
    const out = [];
    for (const op of ops) {
      const [name, a, b] = op;
      if (name === 'addVertex') adj.push([]);
      else if (name === 'removeVertex') {
        adj.splice(a, 1);
        adj = adj.map(list => list.filter(x => x !== a).map(x => (x > a ? x - 1 : x)));
      } else if (name === 'addEdge') {
        if (!has(a, b)) {
          adj[a].push(b);
          if (!directed && a !== b) adj[b].push(a);
        }
      } else if (name === 'removeEdge') {
        if (has(a, b)) {
          adj[a].splice(adj[a].indexOf(b), 1);
          if (!directed && a !== b) adj[b].splice(adj[b].indexOf(a), 1);
        }
      } else if (name === 'hasEdge') out.push(String(has(a, b)));
      else if (name === 'degree') out.push(String(directed ? adj[a].length : adj[a].length + (has(a, a) ? 1 : 0)));
      else if (name === 'size') out.push(String(adj.length));
      else if (name === 'neighbours') out.push(adj[a].length ? adj[a].join(' ') : 'none');
    }
    const input = `${n} ${directed ? 1 : 0} ${ops.length}\n` + ops.map(o => o.filter(x => x !== undefined).join(' ')).join('\n') + '\n';
    tests.push({ caseType, input, expected: out.join('\n') + (out.length ? '\n' : '') });
  };
  const randomOps = (n0, k, { loops = false, vertices = false } = {}) => {
    const ops = [];
    let n = n0;
    const v = () => Math.floor(rand() * n);
    for (let i = 0; i < k; i++) {
      const r = rand();
      let a = v(), b = v();
      if (!loops && a === b && n > 1) b = (a + 1) % n;
      if (vertices && r < 0.06) { ops.push(['addVertex']); n += 1; }
      else if (vertices && r < 0.12 && n > 3) { ops.push(['removeVertex', a]); n -= 1; }
      else if (r < 0.45) ops.push(['addEdge', a, b]);
      else if (r < 0.58) ops.push(['removeEdge', a, b]);
      else if (r < 0.76) ops.push(['hasEdge', a, b]);
      else if (r < 0.84) ops.push(['size']);
      else if (r < 0.93 || !withNeighbours) ops.push(['degree', a]);
      else ops.push(['neighbours', a]);
    }
    return ops;
  };
  make('sample', 3, true, [['addEdge', 0, 1], ['addEdge', 1, 2], ['hasEdge', 0, 1], ['hasEdge', 1, 0], ['degree', 1], ...(withNeighbours ? [['neighbours', 0]] : [])]);
  make('sample', 4, false, [['addEdge', 0, 1], ['addEdge', 1, 3], ['addVertex'], ['size'], ['removeVertex', 0], ['size'], ['hasEdge', 0, 2], ['degree', 0]]);
  make('directed graph', 5, true, randomOps(5, 25));
  make('undirected graph', 5, false, randomOps(5, 25));
  make('loops', 4, false, [['addEdge', 2, 2], ['hasEdge', 2, 2], ['degree', 2], ['addEdge', 2, 3], ['degree', 2], ...(withNeighbours ? [['neighbours', 2]] : [])]);
  make('removing an edge that does not exist', 4, true, [['removeEdge', 0, 3], ['addEdge', 0, 1], ['removeEdge', 1, 0], ['hasEdge', 0, 1], ['degree', 0]]);
  make('adding a vertex', 2, true, [['addVertex'], ['size'], ['addEdge', 2, 0], ['hasEdge', 2, 0], ['degree', 2]]);
  make('removing a vertex', 5, true, [['addEdge', 0, 4], ['addEdge', 4, 1], ['addEdge', 2, 4], ['addEdge', 3, 0], ['removeVertex', 2], ['size'], ['hasEdge', 0, 3], ['hasEdge', 3, 1], ['degree', 0], ['degree', 2], ['hasEdge', 2, 0]]);
  make('removing the last vertex', 3, false, [['addEdge', 0, 2], ['addEdge', 1, 2], ['removeVertex', 2], ['size'], ['degree', 0], ['degree', 1], ['hasEdge', 0, 1]]);
  make('adding and removing vertices', 5, false, randomOps(5, 40, { vertices: true }));
  make('adding and removing vertices (directed)', 6, true, randomOps(6, 40, { vertices: true }));
  if (withNeighbours) make('neighbour order', 5, false, [['addEdge', 0, 3], ['addEdge', 0, 1], ['addEdge', 4, 0], ['removeEdge', 1, 0], ['addEdge', 0, 2], ['removeVertex', 1], ['neighbours', 0]]);
  return tests;
}

/** BFS or DFS visiting order from a start vertex, neighbours in increasing number. */
export function traversalOrder(a, s, kind) {
  const n = a.length;
  const seen = Array(n).fill(false);
  const out = [];
  if (kind === 'bfs') {
    const q = [s];
    seen[s] = true;
    while (q.length) {
      const u = q.shift();
      out.push(u);
      for (let v = 0; v < n; v++) if (a[u][v] && !seen[v]) { seen[v] = true; q.push(v); }
    }
  } else {
    const visit = u => {
      seen[u] = true;
      out.push(u);
      for (let v = 0; v < n; v++) if (a[u][v] && !seen[v]) visit(v);
    };
    visit(s);
  }
  return out;
}

/** Traversal tests. Each knows the other traversal's output, so a mix-up is named. */
function traversalTests(rand, kind) {
  const other = kind === 'bfs' ? 'dfs' : 'bfs';
  const graphs = [
    { caseType: 'sample', n: 4, edges: [[0, 1], [0, 2], [1, 3], [2, 3]], directed: true, s: 0 },
    { caseType: 'sample', n: 5, edges: [[0, 1], [0, 2], [1, 3], [2, 4]], directed: false, s: 0 },
    ...caseGraphs(rand, { directed: true }).map(c => ({ ...c, s: 0 })),
    ...caseGraphs(rand, { directed: false, includeLoops: false }).filter(c => ['cycles', 'disconnected graph', 'large random graph'].includes(c.caseType)).map(c => ({ ...c, caseType: `${c.caseType} (undirected)`, s: 0 })),
    { caseType: 'start in the middle', n: 6, edges: [[3, 1], [3, 5], [1, 0], [5, 4], [0, 2], [4, 2]], directed: true, s: 3 },
    { caseType: 'start on an isolated vertex', n: 5, edges: [[0, 1], [1, 2]], directed: true, s: 4 },
    { caseType: 'neighbours listed out of order', n: 6, edges: [[0, 5], [0, 3], [0, 1], [1, 4], [3, 2], [5, 2]], directed: true, s: 0 },
  ];
  return graphs.map(c => {
    const a = countMatrix(c.n, c.edges, c.directed);
    const order = traversalOrder(a, c.s, kind).join(' ') + '\n';
    const alt = traversalOrder(a, c.s, other).join(' ') + '\n';
    return { caseType: c.caseType, input: graphText(c.n, c.edges, c.directed) + `${c.s}\n`, expected: order, meta: { alts: [{ id: 'dfs-bfs-order', output: alt }] } };
  });
}

const closureTests = (rand, { withSamples = true } = {}) => {
  const graphs = [...(withSamples ? [SAMPLE_PATH, SAMPLE_CYCLE] : []), ...caseGraphs(rand, { directed: true }), ...caseGraphs(rand, { directed: false, includeLoops: false }).filter(c => c.caseType === 'cycles' || c.caseType === 'disconnected graph').map(c => ({ ...c, caseType: `${c.caseType} (undirected)` }))];
  return graphs.map(c => ({ caseType: c.caseType, input: graphText(c.n, c.edges, c.directed), expected: matText(warshall(boolOf(countMatrix(c.n, c.edges, c.directed)))), meta: c }));
};

// ---------- the nine problems ----------

const CLOSURE_SIG = 'public static boolean[][] closure(boolean[][] adj)';

export const PROBLEMS = [
  {
    id: 'P1',
    title: 'Graph on an adjacency matrix',
    level: 'Warm-up',
    unit: 'L5',
    outcomes: ['CS-REP', 'CS-ARR', 'CS-ADT'],
    className: 'MatrixGraph',
    task: 'Write a MatrixGraph class that stores a simple graph (loops allowed, no parallel edges) in an n × n boolean adjacency matrix.',
    api: [
      'MatrixGraph(int n, boolean directed): n vertices numbered 0..n−1, no edges',
      'void addVertex(): adds a new vertex, numbered n (the matrix grows by one row and one column)',
      'void removeVertex(int v): removes v and every edge touching it; vertices above v move down one number (the matrix shrinks)',
      'int vertexCount(): the number of vertices now',
      'void addEdge(int u, int v): adds u→v (and v→u if undirected); adding an existing edge changes nothing',
      'void removeEdge(int u, int v): removes it; removing a missing edge changes nothing',
      'boolean hasEdge(int u, int v)',
      'int degree(int v): out-degree if directed; if undirected, the number of edge ends at v (a loop counts 2)',
    ],
    starter: `public class MatrixGraph {
    private boolean[][] adj;
    private boolean directed;

    public MatrixGraph(int n, boolean directed) {
        // TODO
    }

    public void addVertex() {
        // TODO: copy into a bigger matrix
    }

    public void removeVertex(int v) {
        // TODO: copy into a smaller matrix, skipping row v and column v
    }

    public int vertexCount() {
        return 0; // TODO
    }

    public void addEdge(int u, int v) {
        // TODO
    }

    public void removeEdge(int u, int v) {
        // TODO
    }

    public boolean hasEdge(int u, int v) {
        return false; // TODO
    }

    public int degree(int v) {
        return 0; // TODO
    }
}
`,
    harness: () => opsHarness('MatrixGraph'),
    tests: rand => opsTests(rand, false),
    hints: [
      'Which cells must change when you add an edge to an undirected graph?',
      'Lesson L5 (Building a graph in code) shows each operation on the matrix step by step. Read more: Drozdek (2010), Section 8.1, pages 378–379.',
      'Worked example on another graph: an undirected 3-vertex graph, addEdge(0, 2) sets adj[0][2] and adj[2][0]; addEdge(1, 1) sets only adj[1][1], and degree(1) is then 2. removeVertex(0) copies rows and columns 1 and 2 into a new 2 × 2 matrix, so the old vertex 2 becomes vertex 1.',
    ],
  },
  {
    id: 'P2',
    title: 'Graph on adjacency lists',
    level: 'Core',
    unit: 'L5',
    outcomes: ['CS-REP', 'CS-ADT'],
    className: 'ListGraph',
    task: 'Write a ListGraph class with the same operations as P1, storing each vertex’s neighbours in a linked list made from your own node class (no java.util).',
    api: [
      'Same constructor and methods as P1, including addVertex, removeVertex and vertexCount',
      'int[] neighbours(int v): v’s neighbours in the order their edges were added (undirected: from either end)',
    ],
    starter: `public class ListGraph {
    private static class Node {
        int vertex;
        Node next;
        Node(int vertex, Node next) { this.vertex = vertex; this.next = next; }
    }

    private Node[] heads;
    private boolean directed;

    public ListGraph(int n, boolean directed) {
        // TODO
    }

    public void addVertex() {
        // TODO: a new, empty list at the end
    }

    public void removeVertex(int v) {
        // TODO: drop list v, unlink v from every other list, and renumber vertices above v
    }

    public int vertexCount() {
        return 0; // TODO
    }

    public void addEdge(int u, int v) {
        // TODO: append to the END of the list to keep insertion order
    }

    public void removeEdge(int u, int v) {
        // TODO
    }

    public boolean hasEdge(int u, int v) {
        return false; // TODO
    }

    public int degree(int v) {
        return 0; // TODO
    }

    public int[] neighbours(int v) {
        return new int[0]; // TODO
    }
}
`,
    harness: () => opsHarness('ListGraph'),
    tests: rand => opsTests(rand, true),
    hints: [
      'When you add u—v to an undirected graph, which two lists change? Where in each list does the new node go?',
      'Lesson L1 recaps linked lists and L5 shows the adjacency list. Keep a tail pointer or walk to the end. Read more: Drozdek (2010), Section 8.1, page 377.',
      'Worked example: undirected, addEdge(0, 3) then addEdge(0, 1) gives list 0: 3 → 1, list 3: 0, list 1: 0. removeEdge(1, 0) unlinks 1 from list 0 and 0 from list 1. removeVertex(1) then drops list 1 and every node holding 1, and each number above 1 goes down by one.',
    ],
  },
  {
    id: 'P3',
    title: 'Breadth-first search order',
    level: 'Warm-up',
    unit: 'L6',
    outcomes: ['CS-BFS'],
    className: 'Bfs',
    task: 'Write a breadth-first search that returns the vertices reachable from start in the order BFS visits them. Take neighbours in increasing number. Use an int array as your queue (no java.util).',
    api: ['static int[] order(int[][] adj, int start): adj[u][v] > 0 means an edge u→v'],
    starter: `public class Bfs {
    public static int[] order(int[][] adj, int start) {
        int n = adj.length;
        int[] queue = new int[n];
        int head = 0, tail = 0;
        boolean[] visited = new boolean[n];
        // TODO: mark start, put it in the queue, then take vertices out
        //       first in, first out, adding each unvisited neighbour
        int[] out = new int[tail];
        for (int i = 0; i < tail; i++) out[i] = queue[i];
        return out;
    }
}
`,
    harness: () => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int[][] a = readGraph(sc);
    int s = sc.nextInt();
    out.println(join(Bfs.order(a, s)));
  }
}
`,
    tests: rand => traversalTests(rand, 'bfs'),
    hints: [
      'Which vertex comes out of the queue next: the one that went in first, or the last one? And when do you mark a vertex as visited?',
      'Lesson L6 (Introduction to BFS) runs the queue one step at a time, and L8 shows BFS on the campus map. Read more: Drozdek (2010), Section 8.2, pages 379–382.',
      'Worked example: edges 0→1, 0→2, 1→3, 2→3 from 0. Queue [0] → take 0, add 1 and 2 → take 1, add 3 → take 2 (3 is already marked) → take 3. Order: 0 1 2 3.',
    ],
  },
  {
    id: 'P4',
    title: 'Depth-first search order',
    level: 'Core',
    unit: 'L7',
    outcomes: ['CS-DFS'],
    className: 'Dfs',
    task: 'Write a recursive depth-first search that returns the vertices reachable from start in the order DFS first visits them. Take neighbours in increasing number.',
    api: ['static int[] order(int[][] adj, int start): adj[u][v] > 0 means an edge u→v'],
    starter: `public class Dfs {
    private static int[] result;
    private static int count;

    public static int[] order(int[][] adj, int start) {
        result = new int[adj.length];
        count = 0;
        boolean[] visited = new boolean[adj.length];
        visit(adj, start, visited);
        int[] out = new int[count];
        for (int i = 0; i < count; i++) out[i] = result[i];
        return out;
    }

    private static void visit(int[][] adj, int u, boolean[] visited) {
        // TODO: mark u, record it, then visit each unvisited neighbour
    }
}
`,
    harness: () => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int[][] a = readGraph(sc);
    int s = sc.nextInt();
    out.println(join(Dfs.order(a, s)));
  }
}
`,
    tests: rand => traversalTests(rand, 'dfs'),
    hints: [
      'What stops your search from going round a cycle forever? And do you finish one neighbour’s whole branch before trying the next neighbour?',
      'Lesson L7 (Introduction to DFS) traces the recursion step by step, with visited marks. Read more: Drozdek (2010), Section 8.2, pages 379–382.',
      'Worked example: edges 0→1, 0→2, 1→3, 2→3 from 0. Visit 0 → go deep into 1 → go deep into 3 → back up to 0 → visit 2 (3 is marked). Order: 0 1 3 2.',
    ],
  },
  {
    id: 'P5',
    title: 'Closure by repeated DFS',
    level: 'Core',
    unit: 'U7',
    outcomes: ['CS-DFS', 'KA-TC', 'KA-CMP'],
    className: 'ClosureDFS',
    task: 'Compute the transitive closure by running a depth-first search from every vertex. r[i][j] is true when there is a path of one or more edges from i to j, so r[i][i] is true only when i lies on a cycle.',
    api: [CLOSURE_SIG],
    starter: `public class ClosureDFS {
    ${CLOSURE_SIG} {
        int n = adj.length;
        boolean[][] r = new boolean[n][n];
        // TODO: for each start s, search from s's neighbours and mark r[s][v]
        return r;
    }
}
`,
    harness: () => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int[][] a = readGraph(sc);
    printMatrix(out, ClosureDFS.closure(bool(a)), a.length);
  }
}
`,
    tests: rand => closureTests(rand),
    hints: [
      'Where does each search start, so that s only reaches itself through a real path?',
      'Lesson U7 compares repeated DFS with Warshall’s, and U5 explains the diagonal. Read more: Drozdek (2010), Section 8.3.1, page 391.',
      'Worked example: 0→1, 1→0. Search from 0 starts at its neighbour 1, then reaches 0: r[0][1] = r[0][0] = true. Same from 1. A vertex with no cycle never reaches itself.',
    ],
  },
  {
    id: 'P6',
    title: 'Warshall’s algorithm',
    level: 'Core',
    unit: 'U6',
    outcomes: ['KA-TC'],
    className: 'Warshall',
    task: 'Implement Warshall’s algorithm: r(k)[i][j] = r(k−1)[i][j] OR (r(k−1)[i][k] AND r(k−1)[k][j]). It may update the matrix in place.',
    api: [CLOSURE_SIG],
    starter: `public class Warshall {
    ${CLOSURE_SIG} {
        int n = adj.length;
        boolean[][] r = new boolean[n][n];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                r[i][j] = adj[i][j];
        // TODO: three nested loops
        return r;
    }
}
`,
    harness: () => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int[][] a = readGraph(sc);
    printMatrix(out, Warshall.closure(bool(a)), a.length);
  }
}
`,
    tests: rand => closureTests(rand),
    hints: [
      'Your closure finds pairs one stop apart but misses longer chains. Which loop should choose the intermediate vertex?',
      'Lesson U6 steps through R(k) one value of k at a time. Read more: Drozdek (2010), Section 8.3.1, pages 390–392.',
      'Worked example on the chain 0→1→2→3: with k outermost, k = 1 adds 0→2, k = 2 adds 0→3 and 1→3. With k innermost, 0→3 is checked before 1→3 exists, so it is missed.',
    ],
  },
  {
    id: 'P7',
    title: 'Warshall’s trace',
    level: 'Core',
    unit: 'U6',
    outcomes: ['KA-TC'],
    className: 'WarshallTrace',
    task: 'Run Warshall’s algorithm and print R(k) after each k, in this format: a line "k = 0", then n rows of 0s and 1s separated by spaces; then "k = 1" and so on up to k = n − 1.',
    api: ['static void trace(boolean[][] adj): prints with System.out.println'],
    starter: `public class WarshallTrace {
    public static void trace(boolean[][] adj) {
        // TODO: after each value of k, print "k = " + k and the matrix
    }
}
`,
    harness: () => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int[][] a = readGraph(sc);
    WarshallTrace.trace(bool(a));
  }
}
`,
    tests: rand =>
      closureTests(rand).map(t => {
        const c = t.meta;
        const r = boolOf(countMatrix(c.n, c.edges, c.directed));
        let text = '';
        for (let k = 0; k < c.n; k++) {
          for (let i = 0; i < c.n; i++) if (r[i][k]) for (let j = 0; j < c.n; j++) if (r[k][j]) r[i][j] = 1;
          text += `k = ${k}\n` + matText(r);
        }
        return { caseType: t.caseType, input: t.input, expected: text };
      }),
    hints: [
      'Print the matrix after the whole of each k, not after each cell. Is your k loop the outermost one?',
      'Lesson U6’s trace shows exactly these matrices, with the changed cells highlighted. Read more: Drozdek (2010), Section 8.3.1, pages 390–392.',
      'Worked example, path 0→1→2: "k = 0" then 0 1 0 / 0 0 1 / 0 0 0; "k = 1" then 0 1 1 / 0 0 1 / 0 0 0; "k = 2" unchanged.',
    ],
  },
  {
    id: 'P8',
    title: 'Apply the closure: module prerequisites',
    level: 'Challenge',
    unit: 'U8',
    outcomes: ['KA-TC'],
    className: 'Prerequisites',
    task: 'An edge u→v means module u is a prerequisite of module v. Answer questions using the transitive closure.',
    api: [
      'static boolean isIndirectPrerequisite(boolean[][] adj, int x, int y): is x a prerequisite of y, directly or through a chain?',
      'static boolean hasCircularPrerequisite(boolean[][] adj): does any module (indirectly) require itself? (look at the diagonal)',
      'static boolean isStronglyConnected(boolean[][] adj): can every module reach every other module?',
    ],
    starter: `public class Prerequisites {
    public static boolean isIndirectPrerequisite(boolean[][] adj, int x, int y) { return false; }
    public static boolean hasCircularPrerequisite(boolean[][] adj) { return false; }
    public static boolean isStronglyConnected(boolean[][] adj) { return false; }
}
`,
    harness: () => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int[][] a = readGraph(sc);
    boolean[][] b = bool(a);
    int q = sc.nextInt();
    for (int i = 0; i < q; i++) {
      String op = sc.next();
      boolean r;
      if (op.equals("indirect")) r = Prerequisites.isIndirectPrerequisite(b, sc.nextInt(), sc.nextInt());
      else if (op.equals("circular")) r = Prerequisites.hasCircularPrerequisite(b);
      else r = Prerequisites.isStronglyConnected(b);
      out.println(r ? "yes" : "no");
    }
  }
}
`,
    tests: rand => {
      const graphs = [
        { caseType: 'sample', n: 4, edges: [[0, 1], [1, 2], [2, 3]], directed: true },
        ...caseGraphs(rand, { directed: true }).filter(c => c.n > 1),
      ];
      return graphs.map(c => {
        const r = warshall(boolOf(countMatrix(c.n, c.edges, c.directed)));
        const qs = [];
        const ans = [];
        for (let t = 0; t < 4; t++) {
          const x = Math.floor(rand() * c.n), y = Math.floor(rand() * c.n);
          qs.push(`indirect ${x} ${y}`);
          ans.push(r[x][y] ? 'yes' : 'no');
        }
        qs.push('circular');
        ans.push(r.some((row, i) => row[i]) ? 'yes' : 'no');
        qs.push('strong');
        ans.push(r.every((row, i) => row.every((x, j) => i === j || x)) ? 'yes' : 'no');
        return { caseType: c.caseType, input: graphText(c.n, c.edges, true) + `${qs.length}\n${qs.join('\n')}\n`, expected: ans.join('\n') + '\n' };
      });
    },
    hints: [
      'All three questions can be answered from one matrix. Which one?',
      'Lesson U8 models module prerequisites as a graph and reads answers off the closure; U5 explains strong connectivity. Read more: Drozdek (2010), Section 8.6, pages 399–402.',
      'Worked example: 0→1, 1→2, 2→0. The closure is all 1s, so 0 is an indirect prerequisite of 2, there is a circular prerequisite (the diagonal is 1), and the graph is strongly connected.',
    ],
  },
  {
    id: 'P9',
    title: 'Find the bug',
    level: 'Challenge',
    unit: 'U6',
    outcomes: ['KA-TC'],
    className: 'BuggyWarshall',
    task: 'This Warshall’s method passes small tests but fails on longer chains. Find and fix the bug.',
    api: [CLOSURE_SIG],
    starter: `public class BuggyWarshall {
    ${CLOSURE_SIG} {
        int n = adj.length;
        boolean[][] r = new boolean[n][n];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                r[i][j] = adj[i][j];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                for (int k = 0; k < n; k++)
                    if (r[i][k] && r[k][j])
                        r[i][j] = true;
        return r;
    }
}
`,
    harness: () => `${HARNESS_HEAD}
  static void solve(Scanner sc, PrintStream out) {
    int[][] a = readGraph(sc);
    printMatrix(out, BuggyWarshall.closure(bool(a)), a.length);
  }
}
`,
    tests: rand => closureTests(rand),
    hints: [
      'Warshall’s is dynamic programming: R(k) is built from R(k−1). Which loop moves from one R to the next?',
      'Lesson U6 explains why k must be the outer loop. Watch the trace on a chain listed backwards. Read more: Drozdek (2010), Section 8.3.1, pages 390–392.',
      'Worked example: on 3→2, 2→1, 1→0 the buggy code checks r[3][0] before r[2][0] is known, so it never finds 3 reaches 0.',
    ],
  },
];

export const problemById = id => PROBLEMS.find(p => p.id === id);

/** A stable per-learner seed, so each learner gets their own hidden graphs. */
export function learnerSeed(userId, problemId) {
  let h = 2166136261;
  for (const ch of `${userId}:${problemId}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function testsFor(problem, userId) {
  const rand = rng(learnerSeed(userId ?? 'guest', problem.id));
  const all = problem.tests(rand);
  // The first two are the visible samples (or the first one if only one sample exists).
  const visibleCount = Math.min(2, all.filter(t => t.caseType === 'sample').length || 1);
  return all.map((t, i) => ({ ...t, visible: i < visibleCount, name: i < visibleCount ? `Sample ${i + 1}` : `Hidden: ${t.caseType}` }));
}

/** The full model answer, shown to a learner after a wrong submission. */
const SOLUTIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'solutions');
const solutionCache = new Map();
export function solutionFor(problem) {
  if (!solutionCache.has(problem.id)) {
    let code = null;
    try {
      code = fs.readFileSync(path.join(SOLUTIONS_DIR, `${problem.className}.java`), 'utf8');
    } catch {
      code = null;
    }
    solutionCache.set(problem.id, code);
  }
  return solutionCache.get(problem.id);
}

export { warshall, warshallKInnermost };
