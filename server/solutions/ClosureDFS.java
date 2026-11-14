public class ClosureDFS {
    public static boolean[][] closure(boolean[][] adj) {
        int n = adj.length;
        boolean[][] r = new boolean[n][n];
        for (int s = 0; s < n; s++)
            for (int v = 0; v < n; v++)
                if (adj[s][v] && !r[s][v]) dfs(adj, v, r[s]);
        return r;
    }
    private static void dfs(boolean[][] adj, int u, boolean[] seen) {
        seen[u] = true;
        for (int v = 0; v < adj.length; v++) if (adj[u][v] && !seen[v]) dfs(adj, v, seen);
    }
}
