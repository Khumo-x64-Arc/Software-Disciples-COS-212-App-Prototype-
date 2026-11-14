public class Warshall {
    public static boolean[][] closure(boolean[][] adj) {
        int n = adj.length;
        boolean[][] r = new boolean[n][n];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                r[i][j] = adj[i][j];
        for (int k = 0; k < n; k++)
            for (int i = 0; i < n; i++)
                for (int j = 0; j < n; j++)
                    r[i][j] = r[i][j] || (r[i][k] && r[k][j]);
        return r;
    }
}
