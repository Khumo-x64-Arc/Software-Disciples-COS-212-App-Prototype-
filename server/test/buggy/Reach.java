public class Reach {
    public static boolean[] reachable(boolean[][] adj, int s) { boolean[] seen = new boolean[adj.length]; visit(adj, s, seen); return seen; }
    static void visit(boolean[][] adj, int v, boolean[] seen) { seen[v] = true; for (int w = 0; w < adj.length; w++) if (adj[v][w]) visit(adj, w, seen); }
}
