public class Trace {
    public static void printTrace(boolean[][] adj) {
        int n = adj.length; boolean[][] r = new boolean[n][n];
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) r[i][j] = adj[i][j];
        for (int k = 0; k < n; k++) {
            boolean[][] nx = new boolean[n][n];
            for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) nx[i][j] = r[i][j] || (r[i][k] && r[k][j]);
            r = nx;
            System.out.println("k=" + k);
            for (int i = 0; i < n; i++) { StringBuilder sb = new StringBuilder(); for (int j = 0; j < n; j++) { if (j > 0) sb.append(' '); sb.append(r[i][j] ? 1 : 0); } System.out.println(sb); }
        }
    }
}
