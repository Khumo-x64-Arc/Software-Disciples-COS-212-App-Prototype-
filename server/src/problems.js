// The Java problem bank (P1–P11). Each problem defines:
//  - what the learner writes (class name, starter code, statement),
//  - a Java driver (Main.java) that reads every test case from stdin and calls the learner's code,
//  - test generators (visible samples + per-learner hidden tests grouped by case type),
//  - a JavaScript reference that produces the expected output for each case.
import {
  closure, warshallTrace, reachableFrom, randomMatrix, matrixToEdges, seededRandom,
} from '../../shared/graph.js';

// ---------- helpers shared by generators and references ----------
const mat01 = r => r.map(row => row.map(x => (x ? 1 : 0)).join(' ')).join('\n') + '\n';
const boolArr = a => a.map(x => (x ? 1 : 0)).join(' ') + '\n';
const graphText = (a, directed = true) => {
  const edges = matrixToEdges(a, directed);
  return `${a.length} ${edges.length} ${directed ? 1 : 0}\n` + edges.map(([u, v]) => `${u} ${v}`).join('\n') + (edges.length ? '\n' : '');
};
const parseGraph = (tok, pos) => {
  const n = +tok[pos], m = +tok[pos + 1], d = +tok[pos + 2];
  const a = Array.from({ length: n }, () => Array(n).fill(false));
  let p = pos + 3;
  for (let e = 0; e < m; e++) { const u = +tok[p++], v = +tok[p++]; a[u][v] = true; if (d === 0) a[v][u] = true; }
  return { a, next: p, directed: d === 1 };
};
const ri = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const shuffle = (rand, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const emptyM = n => Array.from({ length: n }, () => Array(n).fill(false));

function chainMatrix(rand, n) {
  const order = shuffle(rand, [...Array(n).keys()]);
  const a = emptyM(n);
  for (let i = 0; i + 1 < n; i++) a[order[i]][order[i + 1]] = true;
  return a;
}
function cycleMatrix(rand, n) {
  const a = chainMatrix(rand, n);
  // close the chain into a cycle by linking the last vertex back to the first
  const indeg = Array(n).fill(0), outdeg = Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (a[i][j]) { outdeg[i]++; indeg[j]++; }
  const first = indeg.findIndex((d, i) => d === 0 && outdeg[i] > 0);
  const last = outdeg.findIndex((d, i) => d === 0 && indeg[i] > 0);
  if (first >= 0 && last >= 0) a[last][first] = true;
  return a;
}
function shortMatrix(rand, n) {
  // every reachable pair is at most two edges apart: edges only go from "low" to "mid" to "high" layers
  const a = emptyM(n);
  const layer = Array.from({ length: n }, (_, i) => i % 3);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    if (layer[j] === layer[i] + 1 && rand() < 0.6) a[i][j] = true;
  return a;
}

// ---------- Java driver scaffolding ----------
function driver({ readCase, runCase, imports = '' }) {
  return `import java.util.*;
import java.io.*;
${imports}
public class Main {
  static PrintStream OUT;
  static Scanner in;
  static final PrintStream SILENT = new PrintStream(new OutputStream() { public void write(int b) {} });
  static boolean[][] readGraph() {
    int n = in.nextInt(), m = in.nextInt(), d = in.nextInt();
    boolean[][] a = new boolean[n][n];
    for (int e = 0; e < m; e++) { int u = in.nextInt(), v = in.nextInt(); a[u][v] = true; if (d == 0) a[v][u] = true; }
    return a;
  }
  static boolean[][] copy(boolean[][] a) { boolean[][] c = new boolean[a.length][]; for (int i = 0; i < a.length; i++) c[i] = a[i].clone(); return c; }
  static String mat(boolean[][] r) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < r.length; i++) { for (int j = 0; j < r[i].length; j++) { if (j > 0) sb.append(' '); sb.append(r[i][j] ? 1 : 0); } sb.append('\\n'); }
    return sb.toString();
  }
  static String arr(boolean[] r) {
    StringBuilder sb = new StringBuilder();
    for (int j = 0; j < r.length; j++) { if (j > 0) sb.append(' '); sb.append(r[j] ? 1 : 0); }
    return sb.append('\\n').toString();
  }
  static Object[] readCase() {
${readCase}
  }
  static String runCase(Object[] c) throws Exception {
${runCase}
  }
  public static void main(String[] args) throws Exception {
    OUT = new PrintStream(new FileOutputStream(FileDescriptor.out), true, "UTF-8");
    System.setOut(SILENT);
    in = new Scanner(new BufferedInputStream(System.in));
    int T = in.nextInt();
    Object[][] cases = new Object[T][];
    for (int t = 0; t < T; t++) cases[t] = readCase();
    for (int t = 0; t < T; t++) {
      OUT.println("### CASE " + t);
      try { OUT.print(runCase(cases[t])); }
      catch (Throwable e) { System.setOut(SILENT); OUT.println("!!EXC " + e.getClass().getSimpleName()); }
      OUT.println("### END");
    }
  }
}
`;
}

// ---------- P1 / P2: graph classes ----------
const opsRead = `    int n = in.nextInt(); int d = in.nextInt(); int q = in.nextInt(); in.nextLine();
    String[] ops = new String[q];
    for (int i = 0; i < q; i++) ops[i] = in.nextLine().trim();
    return new Object[] { n, d == 1, ops };`;
const opsRun = cls => `    int n = (Integer) c[0]; boolean d = (Boolean) c[1]; String[] ops = (String[]) c[2];
    ${cls} g = new ${cls}(n, d);
    StringBuilder sb = new StringBuilder();
    for (String op : ops) {
      String[] p = op.split(" ");
      if (p[0].equals("addVertex")) g.addVertex();
      else if (p[0].equals("addEdge")) g.addEdge(Integer.parseInt(p[1]), Integer.parseInt(p[2]));
      else if (p[0].equals("removeEdge")) g.removeEdge(Integer.parseInt(p[1]), Integer.parseInt(p[2]));
      else if (p[0].equals("hasEdge")) sb.append(g.hasEdge(Integer.parseInt(p[1]), Integer.parseInt(p[2]))).append('\\n');
      else if (p[0].equals("degree")) sb.append(g.degree(Integer.parseInt(p[1]))).append('\\n');
    }
    return sb.toString();`;

function opsCase(rand, { n, directed, kind }) {
  const ops = [];
  let size = n;
  const pick = () => ri(rand, 0, size - 1);
  const edges = [];
  const steps = ri(rand, 8, 14);
  for (let s = 0; s < steps; s++) {
    const r = rand();
    if (kind === 'add-vertex' && s === 2) { ops.push('addVertex'); size++; ops.push(`addEdge ${size - 1} ${pick()}`); ops.push(`degree ${size - 1}`); continue; }
    if (kind === 'loops' && r < 0.25) { const v = pick(); ops.push(`addEdge ${v} ${v}`); ops.push(`degree ${v}`); ops.push(`hasEdge ${v} ${v}`); continue; }
    if (kind === 'remove-missing' && r < 0.25) { const u = pick(), v = pick(); ops.push(`removeEdge ${u} ${v}`); ops.push(`hasEdge ${u} ${v}`); continue; }
    if (r < 0.45) { let u = pick(), v = pick(); if (u === v && kind !== 'loops') v = (v + 1) % size; ops.push(`addEdge ${u} ${v}`); edges.push([u, v]); }
    else if (r < 0.6 && edges.length) { const [u, v] = edges[ri(rand, 0, edges.length - 1)]; ops.push(`removeEdge ${u} ${v}`); }
    else if (r < 0.85) { const u = pick(), v = pick(); ops.push(`hasEdge ${u} ${v}`); if (!directed) ops.push(`hasEdge ${v} ${u}`); }
    else ops.push(`degree ${pick()}`);
  }
  ops.push(`degree ${pick()}`);
  return `${n} ${directed ? 1 : 0} ${ops.length}\n${ops.join('\n')}\n`;
}
function opsRef(input) {
  const lines = input.trim().split('\n');
  const [n0, d] = lines[0].split(' ').map(Number);
  let n = n0;
  let a = emptyM(n);
  const out = [];
  for (const line of lines.slice(1)) {
    const p = line.trim().split(' ');
    const u = +p[1], v = +p[2];
    if (p[0] === 'addVertex') { n++; const b = emptyM(n); for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) b[i][j] = a[i][j]; a = b; }
    else if (p[0] === 'addEdge') { a[u][v] = true; if (!d) a[v][u] = true; }
    else if (p[0] === 'removeEdge') { a[u][v] = false; if (!d) a[v][u] = false; }
    else if (p[0] === 'hasEdge') out.push(String(a[u][v]));
    else if (p[0] === 'degree') {
      let deg = 0;
      if (d) { for (let j = 0; j < n; j++) { if (a[u][j]) deg++; if (a[j][u]) deg++; } }
      else { for (let j = 0; j < n; j++) if (j !== u && a[u][j]) deg++; if (a[u][u]) deg += 2; }
      out.push(String(deg));
    }
  }
  return out.join('\n') + (out.length ? '\n' : '');
}
const opsGen = (rand, visible) => visible
  ? [{ category: 'sample', input: '4 0 6\naddEdge 0 1\naddEdge 1 2\nhasEdge 1 0\ndegree 1\nremoveEdge 0 1\nhasEdge 0 1\n' }]
  : [
    { category: 'directed', input: opsCase(rand, { n: 5, directed: true }) },
    { category: 'directed', input: opsCase(rand, { n: 6, directed: true }) },
    { category: 'undirected', input: opsCase(rand, { n: 5, directed: false }) },
    { category: 'undirected', input: opsCase(rand, { n: 6, directed: false }) },
    { category: 'loops', input: opsCase(rand, { n: 4, directed: false, kind: 'loops' }) },
    { category: 'remove-missing', input: opsCase(rand, { n: 5, directed: true, kind: 'remove-missing' }) },
    { category: 'add-vertex', input: opsCase(rand, { n: 3, directed: false, kind: 'add-vertex' }) },
  ];

const P1_STARTER = `// P1: a graph stored in an adjacency matrix (Drozdek §8.1).
// Vertices are numbered 0..n-1. Do not use java.util collections.
public class MatrixGraph {
    private boolean[][] adj;
    private boolean directed;

    public MatrixGraph(int n, boolean directed) {
        // TODO
    }

    /** Adds a new vertex numbered n (the matrix grows by one row and one column). */
    public void addVertex() {
        // TODO
    }

    public void addEdge(int u, int v) {
        // TODO: remember that an undirected edge goes both ways
    }

    public void removeEdge(int u, int v) {
        // TODO
    }

    public boolean hasEdge(int u, int v) {
        return false; // TODO
    }

    /** Number of edges incident with v. In a digraph: in-degree + out-degree. A loop adds 2. */
    public int degree(int v) {
        return 0; // TODO
    }
}
`;
const P2_STARTER = `// P2: the same graph operations, stored as adjacency lists of your own nodes (Drozdek §8.1).
// Do not use java.util collections or a 2D array for the edges.
public class ListGraph {
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
        // TODO: grow the heads array by one
    }

    public void addEdge(int u, int v) {
        // TODO: ignore an edge that already exists
    }

    public void removeEdge(int u, int v) {
        // TODO
    }

    public boolean hasEdge(int u, int v) {
        return false; // TODO
    }

    /** Number of edges incident with v. In a digraph: in-degree + out-degree. A loop adds 2. */
    public int degree(int v) {
        return 0; // TODO
    }
}
`;

// ---------- P3: conversions ----------
function incidenceRef(a) {
  const n = a.length, cols = [];
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) if (a[i][j]) cols.push([i, j]);
  const rows = [];
  for (let v = 0; v < n; v++) rows.push(cols.length ? cols.map(([i, j]) => (i === v || j === v ? 1 : 0)).join(' ') : '-');
  return rows;
}
function starRef(a) {
  return a.map(row => { const nb = []; row.forEach((x, j) => x && nb.push(j)); return nb.length ? nb.join(' ') : '-'; });
}
const P3_STARTER = `// P3: convert an undirected adjacency matrix into other representations (Drozdek §8.1).
public class Convert {
    /**
     * Incidence matrix: one row per vertex, one column per edge.
     * Number the edges by scanning the matrix row by row, using only cells with i <= j.
     * A loop (adj[i][i]) is a column with a single 1.
     */
    public static int[][] incidence(boolean[][] adj) {
        return new int[adj.length][0]; // TODO
    }

    /** Forward star table: row v lists v's neighbours in increasing order. */
    public static int[][] star(boolean[][] adj) {
        return new int[adj.length][0]; // TODO
    }
}
`;

// ---------- P4: classifier ----------
function classifyRef(c) {
  const n = c.length;
  let sym = true;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (c[i][j] !== c[j][i]) sym = false;
  const directed = !sym;
  let loop = false; for (let i = 0; i < n; i++) if (c[i][i] > 0) loop = true;
  let complete = !loop;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && c[i][j] !== 1) complete = false;
  const isolated = [];
  let degSum = 0;
  for (let i = 0; i < n; i++) {
    let deg = 0;
    if (directed) { for (let j = 0; j < n; j++) deg += c[i][j] + c[j][i]; }
    else { for (let j = 0; j < n; j++) deg += i === j ? 2 * c[i][i] : c[i][j]; }
    if (deg === 0) isolated.push(i);
    degSum += deg;
  }
  return `${directed}\n${complete}\n${loop}\n${isolated.length ? isolated.join(' ') : 'none'}\n${degSum}\n`;
}
const countText = c => `${c.length}\n` + c.map(r => r.join(' ')).join('\n') + '\n';
function kn(n) { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : 1))); }
const P4_STARTER = `// P4: classify a graph given as a matrix of edge counts (Drozdek Ch. 8 intro).
// c[i][j] = number of edges from i to j. If c is symmetric the graph is undirected:
// then c[i][j] == c[j][i] counts the edges between i and j, and c[i][i] counts loops at i.
public class Classify {
    /** True when the matrix is not symmetric. */
    public static boolean isDirected(int[][] c) { return false; }

    /** K_n: no loops, and exactly one edge between every pair of distinct vertices. */
    public static boolean isComplete(int[][] c) { return false; }

    public static boolean hasLoop(int[][] c) { return false; }

    /** Vertices of degree 0, in increasing order. */
    public static int[] isolatedVertices(int[][] c) { return new int[0]; }

    /** Sum of all vertex degrees. A loop adds 2. In a digraph a vertex's degree is in-degree + out-degree. */
    public static int degreeSum(int[][] c) { return 0; }
}
`;

// ---------- P5–P11 ----------
const closureCats = (rand, visible) => visible
  ? [{ category: 'sample', input: graphText([[false, true, false], [false, false, true], [false, false, false]]) }]
  : [
    { category: 'short', input: graphText(shortMatrix(rand, ri(rand, 6, 8))) },
    { category: 'long-chain', input: graphText(chainMatrix(rand, ri(rand, 5, 7))) },
    { category: 'long-chain', input: graphText(chainMatrix(rand, ri(rand, 8, 10))) },
    { category: 'cycle', input: graphText(cycleMatrix(rand, ri(rand, 4, 6))) },
    { category: 'self-loop', input: (() => { const a = randomMatrix(rand, 5, 0.2); a[ri(rand, 0, 4)][ri(rand, 0, 4)] = true; const v = ri(rand, 0, 4); a[v][v] = true; return graphText(a); })() },
    { category: 'complete', input: graphText(kn(ri(rand, 3, 5)).map(r => r.map(Boolean))) },
    { category: 'no-edges', input: graphText(emptyM(ri(rand, 3, 5))) },
    { category: 'random', input: graphText(randomMatrix(rand, ri(rand, 6, 9), 0.25)) },
    { category: 'undirected', input: graphText(randomMatrix(rand, ri(rand, 5, 7), 0.3, { directed: false }), false) },
    { category: 'large', input: graphText(randomMatrix(rand, 120, 0.02)) },
  ];
const closureRef = input => { const { a } = parseGraph(input.trim().split(/\s+/), 0); return mat01(closure(a)); };

const WARSHALL_STARTER = `// P7: transitive closure with Warshall's algorithm (Drozdek §8.3.1, with OR and AND).
// r[i][j] must be true when j can be reached from i by a path of ONE OR MORE edges.
public class Warshall {
    public static boolean[][] closure(boolean[][] adj) {
        int n = adj.length;
        boolean[][] r = new boolean[n][n];
        // TODO: copy adj into r, then apply Warshall's algorithm
        return r;
    }
}
`;
const BUGGY_STARTER = `// P10: find the bug. This method passes some tests but not others.
// Fix it so it computes the full transitive closure.
public class Warshall {
    public static boolean[][] closure(boolean[][] adj) {
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
`;

function prereqCase(rand, kind) {
  const n = ri(rand, 5, 7);
  let a;
  if (kind === 'circular') a = cycleMatrix(rand, n);
  else if (kind === 'strong') { a = cycleMatrix(rand, n); }
  else if (kind === 'chain') a = chainMatrix(rand, n);
  else a = (() => { const b = emptyM(n); for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rand() < 0.3) b[i][j] = true; return b; })();
  const qs = [];
  for (let k = 0; k < 4; k++) qs.push(`p ${ri(rand, 0, n - 1)} ${ri(rand, 0, n - 1)}`);
  qs.push('c', 's');
  return graphText(a) + `${qs.length}\n${qs.join('\n')}\n`;
}
function prereqRef(input) {
  const tok = input.trim().split(/\s+/);
  const { a, next } = parseGraph(tok, 0);
  const r = closure(a);
  const q = +tok[next];
  let p = next + 1;
  const out = [];
  for (let i = 0; i < q; i++) {
    const t = tok[p++];
    if (t === 'p') { const x = +tok[p++], y = +tok[p++]; out.push(String(r[x][y])); }
    else if (t === 'c') out.push(String(r.some((row, k) => row[k])));
    else if (t === 's') { let s = true; for (let x = 0; x < a.length; x++) for (let y = 0; y < a.length; y++) if (x !== y && !r[x][y]) s = false; out.push(String(s)); }
  }
  return out.join('\n') + '\n';
}

function traceRef(input) {
  const { a } = parseGraph(input.trim().split(/\s+/), 0);
  return warshallTrace(a).slice(1).map(s => `k=${s.k}\n` + mat01(s.matrix)).join('');
}

export const PROBLEMS = [
  {
    id: 'P1', title: 'Graph on an adjacency matrix', level: 'Core', unit: 'U3', file: 'MatrixGraph', outcomes: ['AL-Foundational CS 1a', 'AL-Foundational CS 1b'],
    drozdek: '§8.1, pp. 377–379',
    statement: 'Write a `MatrixGraph` class that stores a simple graph in a boolean adjacency matrix. Support addVertex, addEdge, removeEdge, hasEdge and degree, for both directed and undirected graphs. Loops are allowed; adding an edge that already exists changes nothing.',
    starter: P1_STARTER,
    driver: driver({ readCase: opsRead, runCase: opsRun('MatrixGraph') }),
    tests: opsGen, reference: opsRef,
    sampleNote: 'Each test is a list of operations; the output is one line per hasEdge or degree call.',
  },
  {
    id: 'P2', title: 'Graph on adjacency lists', level: 'Core', unit: 'U3', file: 'ListGraph', outcomes: ['AL-Foundational CS 1a', 'AL-Foundational CS 1b', 'AL-Complexity CS 8'],
    drozdek: '§8.1, p. 377',
    statement: 'Write a `ListGraph` class with the same operations as P1, but store each vertex\'s neighbours in a linked list of your own Node objects. No 2D arrays and no java.util collections.',
    starter: P2_STARTER,
    driver: driver({ readCase: opsRead, runCase: opsRun('ListGraph') }),
    tests: opsGen, reference: opsRef,
  },
  {
    id: 'P3', title: 'Convert representations', level: 'Core', unit: 'U2', file: 'Convert', outcomes: ['AL-Foundational CS 1a'],
    drozdek: '§8.1, pp. 377–379',
    statement: 'Write `Convert.incidence`, which turns an undirected adjacency matrix into an incidence matrix, and `Convert.star`, which turns it into a forward star table. Number the edges by scanning the matrix row by row, using only cells with i ≤ j.',
    starter: P3_STARTER,
    driver: driver({
      readCase: '    return new Object[] { readGraph() };',
      runCase: `    boolean[][] a = (boolean[][]) c[0];
    int[][] inc = Convert.incidence(copy(a));
    int[][] st = Convert.star(copy(a));
    StringBuilder sb = new StringBuilder();
    for (int[] row : inc) { if (row.length == 0) sb.append("-"); for (int j = 0; j < row.length; j++) { if (j > 0) sb.append(' '); sb.append(row[j]); } sb.append('\\n'); }
    sb.append("--\\n");
    for (int[] row : st) { if (row.length == 0) sb.append("-"); for (int j = 0; j < row.length; j++) { if (j > 0) sb.append(' '); sb.append(row[j]); } sb.append('\\n'); }
    return sb.toString();`,
    }),
    tests: (rand, visible) => visible
      ? [{ category: 'sample', input: '3 2 0\n0 1\n1 2\n' }]
      : [
        { category: 'ordinary', input: graphText(randomMatrix(rand, ri(rand, 4, 6), 0.45, { directed: false }), false) },
        { category: 'ordinary', input: graphText(randomMatrix(rand, ri(rand, 5, 7), 0.35, { directed: false }), false) },
        { category: 'isolated', input: (() => { const n = ri(rand, 5, 6); const a = randomMatrix(rand, n, 0.5, { directed: false }); const v = ri(rand, 0, n - 1); for (let j = 0; j < n; j++) { a[v][j] = false; a[j][v] = false; } return graphText(a, false); })() },
        { category: 'loops', input: graphText(randomMatrix(rand, ri(rand, 4, 5), 0.4, { directed: false, loops: true }), false) },
        { category: 'no-edges', input: graphText(emptyM(ri(rand, 3, 4)), false) },
      ],
    reference: input => { const { a } = parseGraph(input.trim().split(/\s+/), 0); return incidenceRef(a).join('\n') + '\n--\n' + starRef(a).join('\n') + '\n'; },
  },
  {
    id: 'P4', title: 'Classify a graph', level: 'Core', unit: 'U1', file: 'Classify', outcomes: ['MSF-Discrete 7a'],
    drozdek: 'Ch. 8 intro, pp. 376–377; §8.14 ex. 2',
    statement: 'Write the five `Classify` methods for a graph given as a matrix of edge counts: isDirected, isComplete, hasLoop, isolatedVertices and degreeSum. Check your degreeSum against Drozdek exercise 2: how does the sum of degrees relate to the number of edges?',
    starter: P4_STARTER,
    driver: driver({
      readCase: `    int n = in.nextInt(); int[][] c = new int[n][n];
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) c[i][j] = in.nextInt();
    return new Object[] { c };`,
      runCase: `    int[][] m = (int[][]) c[0];
    StringBuilder sb = new StringBuilder();
    sb.append(Classify.isDirected(m)).append('\\n');
    sb.append(Classify.isComplete(m)).append('\\n');
    sb.append(Classify.hasLoop(m)).append('\\n');
    int[] iso = Classify.isolatedVertices(m);
    if (iso == null || iso.length == 0) sb.append("none"); else for (int j = 0; j < iso.length; j++) { if (j > 0) sb.append(' '); sb.append(iso[j]); }
    sb.append('\\n').append(Classify.degreeSum(m)).append('\\n');
    return sb.toString();`,
    }),
    tests: (rand, visible) => visible
      ? [{ category: 'sample', input: countText(kn(3)) }]
      : [
        { category: 'complete', input: countText(kn(ri(rand, 4, 6))) },
        { category: 'complete-with-loop', input: countText((() => { const c = kn(ri(rand, 4, 5)); const v = ri(rand, 0, c.length - 1); c[v][v] = 1; return c; })()) },
        { category: 'complete-with-repeated-edge', input: countText((() => { const c = kn(ri(rand, 4, 5)); const u = 0, v = ri(rand, 1, c.length - 1); c[u][v] = 2; c[v][u] = 2; return c; })()) },
        { category: 'no-edges', input: countText((() => { const n = ri(rand, 3, 5); return Array.from({ length: n }, () => Array(n).fill(0)); })()) },
        { category: 'single-vertex', input: countText([[0]]) },
        { category: 'directed', input: countText(randomMatrix(rand, ri(rand, 4, 6), 0.35).map(r => r.map(Number))) },
        { category: 'isolated', input: countText((() => { const n = ri(rand, 5, 6); const a = randomMatrix(rand, n, 0.5, { directed: false }); const v = ri(rand, 0, n - 1); for (let j = 0; j < n; j++) { a[v][j] = false; a[j][v] = false; } return a.map(r => r.map(Number)); })()) },
      ],
    reference: input => { const tok = input.trim().split(/\s+/).map(Number); const n = tok[0]; const c = []; for (let i = 0; i < n; i++) c.push(tok.slice(1 + i * n, 1 + (i + 1) * n)); return classifyRef(c); },
  },
  {
    id: 'P5', title: 'Reachable set', level: 'Core', unit: 'U4', file: 'Reach', outcomes: ['AL-Foundational CS 2'],
    drozdek: '§8.2, p. 379',
    statement: 'Write `Reach.reachable`, which uses a recursive depth-first search to return every vertex reachable from s. The start vertex s counts as reachable.',
    starter: `// P5: vertices reachable from s, found with a recursive depth-first search (Drozdek §8.2).
public class Reach {
    /** result[v] is true when v can be reached from s. s itself counts as reachable. */
    public static boolean[] reachable(boolean[][] adj, int s) {
        boolean[] seen = new boolean[adj.length];
        // TODO: visit(adj, s, seen);
        return seen;
    }
}
`,
    driver: driver({
      readCase: '    boolean[][] a = readGraph(); int s = in.nextInt(); return new Object[] { a, s };',
      runCase: '    return arr(Reach.reachable(copy((boolean[][]) c[0]), (Integer) c[1]));',
    }),
    tests: (rand, visible) => visible
      ? [{ category: 'sample', input: '4 3 1\n0 1\n1 2\n3 0\n0\n' }]
      : [
        { category: 'chain', input: (() => { const a = chainMatrix(rand, 6); return graphText(a) + `${ri(rand, 0, 5)}\n`; })() },
        { category: 'cycle', input: graphText(cycleMatrix(rand, ri(rand, 4, 7))) + `${ri(rand, 0, 3)}\n` },
        { category: 'cycle', input: graphText(randomMatrix(rand, 8, 0.35)) + `${ri(rand, 0, 7)}\n` },
        { category: 'disconnected', input: (() => { const a = emptyM(6); a[0][1] = a[1][2] = a[3][4] = a[4][5] = true; return graphText(a) + `${rand() < 0.5 ? 0 : 3}\n`; })() },
        { category: 'isolated-start', input: (() => { const a = randomMatrix(rand, 5, 0.4); for (let j = 0; j < 5; j++) { a[2][j] = false; } return graphText(a) + '2\n'; })() },
        { category: 'self-loop', input: (() => { const a = randomMatrix(rand, 5, 0.25); a[1][1] = true; return graphText(a) + '1\n'; })() },
        { category: 'undirected', input: graphText(randomMatrix(rand, 6, 0.3, { directed: false }), false) + `${ri(rand, 0, 5)}\n` },
      ],
    reference: input => { const tok = input.trim().split(/\s+/); const { a, next } = parseGraph(tok, 0); return boolArr(reachableFrom(a, +tok[next]).seen); },
  },
  {
    id: 'P6', title: 'Closure by repeated DFS', level: 'Core', unit: 'U7', file: 'ClosureDFS', outcomes: ['AL-Foundational CS 4'],
    drozdek: '§8.2 and §8.3.1',
    statement: 'Write `ClosureDFS.closure`, which computes the transitive closure by running a depth-first search from every vertex. r[i][j] is true when j can be reached from i by one or more edges, so r[i][i] is true only when i lies on a cycle.',
    starter: `// P6: transitive closure by running a DFS from every vertex.
// r[i][j] is true when j can be reached from i by ONE OR MORE edges,
// so r[i][i] is true only when i lies on a cycle.
public class ClosureDFS {
    public static boolean[][] closure(boolean[][] adj) {
        int n = adj.length;
        boolean[][] r = new boolean[n][n];
        // TODO
        return r;
    }
}
`,
    driver: driver({ readCase: '    return new Object[] { readGraph() };', runCase: '    return mat(ClosureDFS.closure(copy((boolean[][]) c[0])));' }),
    tests: closureCats, reference: closureRef,
  },
  {
    id: 'P7', title: "Warshall's algorithm", level: 'Core', unit: 'U6', file: 'Warshall', outcomes: ['AL-Foundational CS 3', 'AL-Foundational KA 8a'],
    drozdek: '§8.3.1, pp. 390–392',
    statement: "Write `Warshall.closure`, which computes the transitive closure of a graph with Warshall's algorithm: Drozdek's WFIalgorithm with OR and AND in place of min and +. A diagonal entry is true only when the vertex lies on a cycle.",
    starter: WARSHALL_STARTER,
    driver: driver({ readCase: '    return new Object[] { readGraph() };', runCase: '    return mat(Warshall.closure(copy((boolean[][]) c[0])));' }),
    tests: closureCats, reference: closureRef,
  },
  {
    id: 'P8', title: "Warshall's trace", level: 'Core', unit: 'U6', file: 'Trace', outcomes: ['AL-Foundational KA 8b'],
    drozdek: '§8.3.1, pp. 390–391',
    statement: 'Write `Trace.printTrace`, which prints the matrix after each value of k. For each k from 0 to n − 1, print a line `k=<k>` followed by n rows of 0s and 1s separated by single spaces.',
    starter: `// P8: print Warshall's matrix after each value of k.
// Format for each k = 0..n-1:
// k=0
// 0 1 0
// 0 0 1
// 0 0 0
public class Trace {
    public static void printTrace(boolean[][] adj) {
        // TODO: use System.out.println
    }
}
`,
    driver: driver({
      readCase: '    return new Object[] { readGraph() };',
      runCase: `    ByteArrayOutputStream bos = new ByteArrayOutputStream();
    System.setOut(new PrintStream(bos, true, "UTF-8"));
    try { Trace.printTrace(copy((boolean[][]) c[0])); } finally { System.setOut(SILENT); }
    return bos.toString("UTF-8");`,
    }),
    tests: (rand, visible) => visible
      ? [{ category: 'sample', input: '3 2 1\n0 1\n1 2\n' }]
      : [
        { category: 'long-chain', input: graphText(chainMatrix(rand, 4)) },
        { category: 'cycle', input: graphText(cycleMatrix(rand, 4)) },
        { category: 'self-loop', input: (() => { const a = randomMatrix(rand, 4, 0.3); a[2][2] = true; return graphText(a); })() },
        { category: 'random', input: graphText(randomMatrix(rand, 5, 0.3)) },
      ],
    reference: traceRef,
  },
  {
    id: 'P9', title: 'Apply the closure: module prerequisites', level: 'Stretch', unit: 'U8', file: 'Prereq', outcomes: ['AL-Foundational CS 3', 'MSF-Discrete 7c'],
    drozdek: '§8.3.1 and §8.6.2',
    statement: 'Modules are vertices, and an edge x → y means module x is a prerequisite of module y. Write three methods: is x a direct or indirect prerequisite of y; is there a circular prerequisite anywhere; and is the graph strongly connected?',
    starter: `// P9: module prerequisites. Edge x -> y means module x is a prerequisite of module y.
public class Prereq {
    /** True when x is a direct or indirect prerequisite of y. */
    public static boolean isPrerequisite(boolean[][] adj, int x, int y) { return false; }

    /** True when some module is (indirectly) its own prerequisite. */
    public static boolean hasCircular(boolean[][] adj) { return false; }

    /** True when every module can reach every other module (Drozdek §8.6.2). */
    public static boolean stronglyConnected(boolean[][] adj) { return false; }
}
`,
    driver: driver({
      readCase: `    boolean[][] a = readGraph(); int q = in.nextInt(); String[][] qs = new String[q][];
    for (int i = 0; i < q; i++) { String t = in.next(); if (t.equals("p")) qs[i] = new String[] { t, in.next(), in.next() }; else qs[i] = new String[] { t }; }
    return new Object[] { a, qs };`,
      runCase: `    boolean[][] a = (boolean[][]) c[0]; String[][] qs = (String[][]) c[1];
    StringBuilder sb = new StringBuilder();
    for (String[] q : qs) {
      if (q[0].equals("p")) sb.append(Prereq.isPrerequisite(copy(a), Integer.parseInt(q[1]), Integer.parseInt(q[2])));
      else if (q[0].equals("c")) sb.append(Prereq.hasCircular(copy(a)));
      else sb.append(Prereq.stronglyConnected(copy(a)));
      sb.append('\\n');
    }
    return sb.toString();`,
    }),
    tests: (rand, visible) => visible
      ? [{ category: 'sample', input: '4 3 1\n0 1\n1 2\n2 3\n3\np 0 3\nc\ns\n' }]
      : [
        { category: 'indirect', input: prereqCase(rand, 'chain') },
        { category: 'no-circular', input: prereqCase(rand, 'dag') },
        { category: 'circular', input: prereqCase(rand, 'circular') },
        { category: 'strongly-connected', input: prereqCase(rand, 'strong') },
        { category: 'random', input: prereqCase(rand, 'dag') },
      ],
    reference: prereqRef,
  },
  {
    id: 'P10', title: 'Find the bug', level: 'Stretch', unit: 'U6', file: 'Warshall', outcomes: ['AL-Foundational KA 8b', 'AL-Strategies CS 2'],
    drozdek: '§8.3.1, p. 390',
    statement: "This Warshall's method passes some tests and fails others. Find the bug and fix it. Think about what each loop variable means.",
    starter: BUGGY_STARTER,
    driver: driver({ readCase: '    return new Object[] { readGraph() };', runCase: '    return mat(Warshall.closure(copy((boolean[][]) c[0])));' }),
    tests: closureCats, reference: closureRef,
  },
  {
    id: 'P11', title: 'Timing experiment', level: 'Stretch', unit: 'U7', file: 'Timing', outcomes: ['AL-Complexity CS 4', 'AL-Complexity CS 7'],
    drozdek: '§8.3.1, p. 391',
    statement: "Put your P6 and P7 solutions into one `Timing` class. The app checks that both are correct, then times them on generated graphs of 50, 100 and 200 vertices at low and high density. Compare the times with the theory, and write a short report. Warshall's is Θ(V³). Repeated DFS is O(V(V+E)) with adjacency lists, but with a boolean matrix each DFS scans whole rows, so it is O(V³) too. Which one wins on sparse and dense graphs, and why?",
    starter: `// P11: put your closure methods from P6 and P7 here.
public class Timing {
    /** Your Warshall's closure from P7. */
    public static boolean[][] closureWarshall(boolean[][] adj) {
        return new boolean[adj.length][adj.length]; // TODO
    }

    /** Your repeated-DFS closure from P6. */
    public static boolean[][] closureDFS(boolean[][] adj) {
        return new boolean[adj.length][adj.length]; // TODO
    }
}
`,
    driver: driver({
      readCase: '    return new Object[] { readGraph() };',
      runCase: `    boolean[][] a = (boolean[][]) c[0];
    if (a.length == 0) {
      // timing case
      StringBuilder sb = new StringBuilder();
      int[] sizes = { 50, 100, 200 }; double[] dens = { 0.03, 0.5 };
      Random rnd = new Random(42);
      for (int n : sizes) for (double d : dens) {
        boolean[][] g = new boolean[n][n];
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) g[i][j] = i != j && rnd.nextDouble() < d;
        long bw = Long.MAX_VALUE, bd = Long.MAX_VALUE;
        for (int rep = 0; rep < 3; rep++) {
          long t0 = System.nanoTime(); Timing.closureWarshall(copy(g)); long t1 = System.nanoTime(); Timing.closureDFS(copy(g)); long t2 = System.nanoTime();
          bw = Math.min(bw, t1 - t0); bd = Math.min(bd, t2 - t1);
        }
        sb.append("TIME ").append(n).append(' ').append(d).append(' ').append(bw / 1000).append(' ').append(bd / 1000).append('\\n');
      }
      return sb.toString();
    }
    return mat(Timing.closureWarshall(copy(a))) + "--\\n" + mat(Timing.closureDFS(copy(a)));`,
    }),
    tests: (rand, visible) => visible
      ? [{ category: 'sample', input: '3 2 1\n0 1\n1 2\n' }]
      : [
        { category: 'long-chain', input: graphText(chainMatrix(rand, 6)) },
        { category: 'cycle', input: graphText(cycleMatrix(rand, 5)) },
        { category: 'random', input: graphText(randomMatrix(rand, 7, 0.3)) },
        { category: 'timing', input: '0 0 1\n', timing: true },
      ],
    reference: input => { const { a } = parseGraph(input.trim().split(/\s+/), 0); if (a.length === 0) return null; const r = mat01(closure(a)); return r + '--\n' + r; },
    report: true,
  },
];

export const problemById = id => PROBLEMS.find(p => p.id === id);

/** Visible samples plus hidden tests generated from a learner-specific seed. */
export function buildTests(problem, seed, { includeHidden }) {
  const rand = seededRandom(`${problem.id}|${seed}`);
  const visible = problem.tests(rand, true).map(t => ({ ...t, visible: true }));
  const hidden = includeHidden ? problem.tests(rand, false).map(t => ({ ...t, visible: false })) : [];
  return [...visible, ...hidden].map(t => ({ ...t, expected: problem.reference(t.input) }));
}

/** Public view of a problem: no driver, no reference. */
export function publicProblem(p, seed) {
  const samples = buildTests(p, seed, { includeHidden: false }).map(t => ({ input: t.input, expected: t.expected }));
  return {
    id: p.id, title: p.title, level: p.level, unit: p.unit, file: p.file, outcomes: p.outcomes, drozdek: p.drozdek,
    statement: p.statement, starter: p.starter, samples, report: !!p.report, sampleNote: p.sampleNote || null,
  };
}
