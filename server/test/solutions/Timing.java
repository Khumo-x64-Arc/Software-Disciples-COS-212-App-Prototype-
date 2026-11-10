public class Timing {
    public static boolean[][] closureWarshall(boolean[][] adj) { int n = adj.length; boolean[][] r = new boolean[n][n]; for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) r[i][j] = adj[i][j]; for (int k = 0; k < n; k++) for (int i = 0; i < n; i++) if (r[i][k]) for (int j = 0; j < n; j++) if (r[k][j]) r[i][j] = true; return r; }
    public static boolean[][] closureDFS(boolean[][] adj) { int n = adj.length; boolean[][] r = new boolean[n][n]; for (int s = 0; s < n; s++) { boolean[] seen = new boolean[n]; for (int w = 0; w < n; w++) if (adj[s][w] && !seen[w]) visit(adj, w, seen); r[s] = seen; } return r; }
    static void visit(boolean[][] adj, int v, boolean[] seen) { seen[v] = true; for (int w = 0; w < adj.length; w++) if (adj[v][w] && !seen[w]) visit(adj, w, seen); }
}
