public class Classify {
    public static boolean isDirected(int[][] c) { for (int i = 0; i < c.length; i++) for (int j = 0; j < c.length; j++) if (c[i][j] != c[j][i]) return true; return false; }
    public static boolean isComplete(int[][] c) { if (hasLoop(c)) return false; for (int i = 0; i < c.length; i++) for (int j = 0; j < c.length; j++) if (i != j && c[i][j] != 1) return false; return true; }
    public static boolean hasLoop(int[][] c) { for (int i = 0; i < c.length; i++) if (c[i][i] > 0) return true; return false; }
    static int deg(int[][] c, int i) { int d = 0; if (isDirected(c)) { for (int j = 0; j < c.length; j++) d += c[i][j] + c[j][i]; } else { for (int j = 0; j < c.length; j++) d += (i == j) ? 2 * c[i][i] : c[i][j]; } return d; }
    public static int[] isolatedVertices(int[][] c) { int k = 0; for (int i = 0; i < c.length; i++) if (deg(c, i) == 0) k++; int[] r = new int[k]; k = 0; for (int i = 0; i < c.length; i++) if (deg(c, i) == 0) r[k++] = i; return r; }
    public static int degreeSum(int[][] c) { int s = 0; for (int i = 0; i < c.length; i++) s += deg(c, i); return s; }
}
