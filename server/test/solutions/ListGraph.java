public class ListGraph {
    private static class Node { int vertex; Node next; Node(int vertex, Node next) { this.vertex = vertex; this.next = next; } }
    private Node[] heads; private boolean directed;
    public ListGraph(int n, boolean directed) { heads = new Node[n]; this.directed = directed; }
    public void addVertex() { Node[] h = new Node[heads.length + 1]; for (int i = 0; i < heads.length; i++) h[i] = heads[i]; heads = h; }
    private boolean has(int u, int v) { for (Node p = heads[u]; p != null; p = p.next) if (p.vertex == v) return true; return false; }
    private void add(int u, int v) { if (!has(u, v)) heads[u] = new Node(v, heads[u]); }
    private void del(int u, int v) { Node prev = null; for (Node p = heads[u]; p != null; prev = p, p = p.next) if (p.vertex == v) { if (prev == null) heads[u] = p.next; else prev.next = p.next; return; } }
    public void addEdge(int u, int v) { add(u, v); if (!directed) add(v, u); }
    public void removeEdge(int u, int v) { del(u, v); if (!directed) del(v, u); }
    public boolean hasEdge(int u, int v) { return has(u, v); }
    public int degree(int v) { int d = 0; if (directed) { for (int u = 0; u < heads.length; u++) for (Node p = heads[u]; p != null; p = p.next) { if (u == v) d++; if (p.vertex == v) d++; } } else { for (Node p = heads[v]; p != null; p = p.next) d += (p.vertex == v) ? 2 : 1; } return d; }
}
