public class Bfs {
    public static int[] order(int[][] adj, int start) {
        int n = adj.length;
        int[] queue = new int[n];          // each vertex enters the queue at most once
        int head = 0, tail = 0;
        boolean[] visited = new boolean[n];
        visited[start] = true;             // mark when it goes IN to the queue
        queue[tail++] = start;
        while (head < tail) {
            int u = queue[head++];         // first in, first out
            for (int v = 0; v < n; v++) {
                if (adj[u][v] > 0 && !visited[v]) {
                    visited[v] = true;
                    queue[tail++] = v;
                }
            }
        }
        // The queue array now holds the vertices in the order BFS visited them.
        int[] out = new int[tail];
        for (int i = 0; i < tail; i++) out[i] = queue[i];
        return out;
    }
}
