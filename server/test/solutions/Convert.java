public class Convert {
    public static int[][] incidence(boolean[][] adj) {
        int n = adj.length, m = 0;
        for (int i = 0; i < n; i++) for (int j = i; j < n; j++) if (adj[i][j]) m++;
        int[][] r = new int[n][m]; int col = 0;
        for (int i = 0; i < n; i++) for (int j = i; j < n; j++) if (adj[i][j]) { r[i][col] = 1; r[j][col] = 1; col++; }
        return r;
    }
    public static int[][] star(boolean[][] adj) {
        int n = adj.length; int[][] r = new int[n][];
        for (int i = 0; i < n; i++) { int c = 0; for (int j = 0; j < n; j++) if (adj[i][j]) c++; r[i] = new int[c]; c = 0; for (int j = 0; j < n; j++) if (adj[i][j]) r[i][c++] = j; }
        return r;
    }
}
