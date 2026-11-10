public class Prereq {
    static boolean[][] cl(boolean[][] a) { int n = a.length; boolean[][] r = new boolean[n][n]; for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) r[i][j] = a[i][j]; for (int k = 0; k < n; k++) for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) if (r[i][k] && r[k][j]) r[i][j] = true; return r; }
    public static boolean isPrerequisite(boolean[][] adj, int x, int y) { return cl(adj)[x][y]; }
    public static boolean hasCircular(boolean[][] adj) { boolean[][] r = cl(adj); for (int i = 0; i < r.length; i++) if (r[i][i]) return true; return false; }
    public static boolean stronglyConnected(boolean[][] adj) { boolean[][] r = cl(adj); for (int i = 0; i < r.length; i++) for (int j = 0; j < r.length; j++) if (i != j && !r[i][j]) return false; return true; }
}
