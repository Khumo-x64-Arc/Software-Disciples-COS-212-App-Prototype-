public class MatrixGraph {
    private boolean[][] adj;
    private boolean directed;

    public MatrixGraph(int n, boolean directed) {
        this.adj = new boolean[n][n];
        this.directed = directed;
    }

    public void addVertex() {
        int n = adj.length;
        boolean[][] bigger = new boolean[n + 1][n + 1];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                bigger[i][j] = adj[i][j];
        adj = bigger;
    }

    public void removeVertex(int v) {
        int n = adj.length;
        boolean[][] smaller = new boolean[n - 1][n - 1];
        for (int i = 0, r = 0; i < n; i++) {
            if (i == v) continue;            // skip row v
            for (int j = 0, c = 0; j < n; j++) {
                if (j == v) continue;        // skip column v
                smaller[r][c++] = adj[i][j];
            }
            r++;
        }
        adj = smaller;
    }

    public int vertexCount() {
        return adj.length;
    }

    public void addEdge(int u, int v) {
        adj[u][v] = true;
        if (!directed) adj[v][u] = true;
    }

    public void removeEdge(int u, int v) {
        adj[u][v] = false;
        if (!directed) adj[v][u] = false;
    }

    public boolean hasEdge(int u, int v) {
        return adj[u][v];
    }

    public int degree(int v) {
        int d = 0;
        for (int j = 0; j < adj.length; j++) if (adj[v][j]) d++;
        if (!directed && adj[v][v]) d++;
        return d;
    }
}
