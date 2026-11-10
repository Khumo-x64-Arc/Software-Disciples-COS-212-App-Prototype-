public class ClosureDFS {
    public static boolean[][] closure(boolean[][] adj) {
        int n = adj.length; boolean[][] r = new boolean[n][n];
        for (int s = 0; s < n; s++) { boolean[] seen = new boolean[n]; for (int w = 0; w < n; w++) if (adj[s][w] && !seen[w]) visit(adj, w, seen); r[s] = seen; }
        return r;
    }
    static void visit(boolean[][] adj, int v, boolean[] seen) { seen[v] = true; for (int w = 0; w < adj.length; w++) if (adj[v][w] && !seen[w]) visit(adj, w, seen); }
}
