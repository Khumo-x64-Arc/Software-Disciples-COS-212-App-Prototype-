public class Prerequisites {
    private static boolean[][] close(boolean[][] adj) { return Warshall2.closure(adj); }
    public static boolean isIndirectPrerequisite(boolean[][] adj, int x, int y) { return close(adj)[x][y]; }
    public static boolean hasCircularPrerequisite(boolean[][] adj) {
        boolean[][] r = close(adj);
        for (int i = 0; i < r.length; i++) if (r[i][i]) return true;
        return false;
    }
    public static boolean isStronglyConnected(boolean[][] adj) {
        boolean[][] r = close(adj);
        for (int i = 0; i < r.length; i++) for (int j = 0; j < r.length; j++) if (i != j && !r[i][j]) return false;
        return true;
    }
    static class Warshall2 {
        static boolean[][] closure(boolean[][] adj) {
            int n = adj.length;
            boolean[][] r = new boolean[n][n];
            for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) r[i][j] = adj[i][j];
            for (int k = 0; k < n; k++) for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) r[i][j] = r[i][j] || (r[i][k] && r[k][j]);
            return r;
        }
    }
}
