public class ListGraph {
    private static class Node {
        int vertex;
        Node next;
        Node(int vertex, Node next) { this.vertex = vertex; this.next = next; }
    }

    private Node[] heads;
    private boolean directed;

    public ListGraph(int n, boolean directed) {
        heads = new Node[n];
        this.directed = directed;
    }

    public void addVertex() {
        Node[] bigger = new Node[heads.length + 1];
        for (int i = 0; i < heads.length; i++) bigger[i] = heads[i];
        heads = bigger;
    }

    public void removeVertex(int v) {
        // 1. Drop v's own list.
        Node[] smaller = new Node[heads.length - 1];
        for (int i = 0, k = 0; i < heads.length; i++) if (i != v) smaller[k++] = heads[i];
        heads = smaller;
        // 2. Unlink v from every other list, and renumber vertices above v.
        for (int u = 0; u < heads.length; u++) {
            while (heads[u] != null && heads[u].vertex == v) heads[u] = heads[u].next;
            for (Node p = heads[u]; p != null; p = p.next) {
                while (p.next != null && p.next.vertex == v) p.next = p.next.next;
                if (p.vertex > v) p.vertex--;
            }
        }
    }

    public int vertexCount() {
        return heads.length;
    }

    private void append(int u, int v) {
        Node node = new Node(v, null);
        if (heads[u] == null) { heads[u] = node; return; }
        Node p = heads[u];
        while (p.next != null) p = p.next;
        p.next = node;
    }

    private void unlink(int u, int v) {
        if (heads[u] == null) return;
        if (heads[u].vertex == v) { heads[u] = heads[u].next; return; }
        for (Node p = heads[u]; p.next != null; p = p.next)
            if (p.next.vertex == v) { p.next = p.next.next; return; }
    }

    public void addEdge(int u, int v) {
        if (hasEdge(u, v)) return;
        append(u, v);
        if (!directed && u != v) append(v, u);
    }

    public void removeEdge(int u, int v) {
        if (!hasEdge(u, v)) return;
        unlink(u, v);
        if (!directed && u != v) unlink(v, u);
    }

    public boolean hasEdge(int u, int v) {
        for (Node p = heads[u]; p != null; p = p.next) if (p.vertex == v) return true;
        return false;
    }

    public int degree(int v) {
        int d = 0;
        for (Node p = heads[v]; p != null; p = p.next) d++;
        if (!directed && hasEdge(v, v)) d++;
        return d;
    }

    public int[] neighbours(int v) {
        int c = 0;
        for (Node p = heads[v]; p != null; p = p.next) c++;
        int[] out = new int[c];
        int i = 0;
        for (Node p = heads[v]; p != null; p = p.next) out[i++] = p.vertex;
        return out;
    }
}
