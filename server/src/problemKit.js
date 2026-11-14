// Shared pieces for the test problems: test-graph helpers and the Java harness head.

// ---------- test-graph helpers (vertices numbered from 0, Fitchfork style) ----------

export const graphText = (n, edges, directed) => [`${n} ${edges.length} ${directed ? 1 : 0}`, ...edges.map(([u, v]) => `${u} ${v}`)].join('\n') + '\n';

export function countMatrix(n, edges, directed) {
  const a = Array.from({ length: n }, () => Array(n).fill(0));
  for (const [u, v] of edges) {
    a[u][v] += 1;
    if (!directed && u !== v) a[v][u] += 1;
  }
  return a;
}
export const boolOf = a => a.map(r => r.map(x => (x > 0 ? 1 : 0)));
export const matText = r => r.map(row => row.join(' ')).join('\n') + (r.length ? '\n' : '');

/** Graphs for each hidden-test case type named in the design doc. */
export function caseGraphs(rand, { directed = true, includeLoops = true } = {}) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const out = [];
  out.push({ caseType: 'no edges', n: 4, edges: [], directed });
  out.push({ caseType: 'single vertex', n: 1, edges: [], directed });
  if (includeLoops) out.push({ caseType: 'loops', n: 4, edges: [[0, 0], [0, 1], [2, 2], [1, 3]], directed });
  {
    const n = int(6, 8);
    out.push({ caseType: 'disconnected graph', n, edges: [[0, 1], [1, 2], [3, 4], [4, 5]].map(([u, v]) => [u, v]), directed });
  }
  {
    const n = int(5, 7);
    const edges = [];
    for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n]);
    edges.push([0, 2]);
    out.push({ caseType: 'cycles', n, edges, directed });
  }
  {
    const n = int(4, 5);
    const edges = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && (directed || i < j)) edges.push([i, j]);
    out.push({ caseType: 'complete graph', n, edges, directed });
  }
  {
    const n = int(6, 9);
    const perm = [...Array(n).keys()].sort(() => rand() - 0.5);
    const edges = [];
    for (let i = n - 2; i >= 0; i--) edges.push([perm[i], perm[i + 1]]); // listed backwards: needs long chains
    out.push({ caseType: 'long chain', n, edges, directed });
  }
  {
    const n = int(30, 40);
    const edges = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && (directed || i < j) && rand() < 0.08) edges.push([i, j]);
    out.push({ caseType: 'large random graph', n, edges, directed });
  }
  return out;
}

export const SAMPLE_PATH = { caseType: 'sample', n: 3, edges: [[0, 1], [1, 2]], directed: true };
export const SAMPLE_CYCLE = { caseType: 'sample', n: 4, edges: [[0, 1], [1, 2], [2, 0], [2, 3]], directed: true };

// ---------- Java harness pieces ----------

export const HARNESS_HEAD = `import java.io.*;
import java.util.Scanner;

public class Main {
  public static void main(String[] args) throws Exception {
    final int count = Integer.parseInt(args[0]);
    final String dir = args[1];
    final long limit = Long.parseLong(args[2]);
    final PrintStream real = System.out;
    for (int t = 0; t < count; t++) {
      final File in = new File(dir, t + ".in");
      final PrintStream ps = new PrintStream(new FileOutputStream(new File(dir, t + ".out")), true, "UTF-8");
      final String[] status = {"OK"};
      Thread th = new Thread(null, new Runnable() {
        public void run() {
          try (Scanner sc = new Scanner(in, "UTF-8")) {
            System.setOut(ps);
            solve(sc, ps);
          } catch (Throwable e) {
            status[0] = "EXC " + e.getClass().getSimpleName() + " " + String.valueOf(e.getMessage()).replace('\\n', ' ');
          }
        }
      }, "test", 64L << 20);
      th.setDaemon(true);
      th.start();
      th.join(limit);
      ps.flush();
      if (th.isAlive()) { real.println("RESULT " + t + " TIMEOUT"); real.flush(); System.exit(0); }
      real.println("RESULT " + t + " " + status[0]);
      real.flush();
    }
    System.exit(0);
  }

  static boolean directed;
  static int[][] readGraph(Scanner sc) {
    int n = sc.nextInt(), m = sc.nextInt(), d = sc.nextInt();
    directed = d == 1;
    int[][] a = new int[n][n];
    for (int k = 0; k < m; k++) { int u = sc.nextInt(), v = sc.nextInt(); a[u][v]++; if (!directed && u != v) a[v][u]++; }
    return a;
  }
  static boolean[][] bool(int[][] a) {
    boolean[][] b = new boolean[a.length][a.length];
    for (int i = 0; i < a.length; i++) for (int j = 0; j < a.length; j++) b[i][j] = a[i][j] > 0;
    return b;
  }
  static void printMatrix(PrintStream out, boolean[][] r, int n) {
    for (int i = 0; i < n; i++) {
      StringBuilder sb = new StringBuilder();
      for (int j = 0; j < n; j++) { if (j > 0) sb.append(' '); sb.append(r[i][j] ? '1' : '0'); }
      out.println(sb);
    }
  }
  static String join(int[] xs) {
    if (xs == null || xs.length == 0) return "none";
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < xs.length; i++) { if (i > 0) sb.append(' '); sb.append(xs[i]); }
    return sb.toString();
  }
`;

