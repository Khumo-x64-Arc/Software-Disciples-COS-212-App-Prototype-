public class MatrixGraph {
    private boolean[][] adj; private boolean directed; private int n;
    public MatrixGraph(int n, boolean directed) { this.n = n; this.directed = directed; adj = new boolean[n][n]; }
    public void addVertex() { boolean[][] b = new boolean[n + 1][n + 1]; for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) b[i][j] = adj[i][j]; adj = b; n++; }
    public void addEdge(int u, int v) { adj[u][v] = true;  }
    public void removeEdge(int u, int v) { adj[u][v] = false; if (!directed) adj[v][u] = false; }
    public boolean hasEdge(int u, int v) { return adj[u][v]; }
    public int degree(int v) { int d = 0; if (directed) { for (int j = 0; j < n; j++) { if (adj[v][j]) d++; if (adj[j][v]) d++; } } else { for (int j = 0; j < n; j++) if (j != v && adj[v][j]) d++; if (adj[v][v]) d += 2; } return d; }
}
