public class Dfs {
    private static int[] result;
    private static int count;

    public static int[] order(int[][] adj, int start) {
        result = new int[adj.length];
        count = 0;
        boolean[] visited = new boolean[adj.length];
        visit(adj, start, visited);
        int[] out = new int[count];
        for (int i = 0; i < count; i++) out[i] = result[i];
        return out;
    }

    private static void visit(int[][] adj, int u, boolean[] visited) {
        visited[u] = true;                 // mark first, so a cycle cannot loop forever
        result[count++] = u;
        for (int v = 0; v < adj.length; v++) {
            if (adj[u][v] > 0 && !visited[v]) {
                visit(adj, v, visited);    // go deep before trying the next neighbour
            }
        }
    }
}
