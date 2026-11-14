import { addEdge, addVertex, emptyGraph, type Graph } from '../../../shared/graph-core.mjs';

/** Builds a graph from labelled positions and an edge list such as 'ab bc'. */
export function build(opts: Partial<Graph>, pos: Record<string, [number, number]>, edges: string, weights: number[] = []): Graph {
  let g = emptyGraph({ allowLoops: true, allowMulti: true, ...opts });
  for (const [x, y] of Object.values(pos)) g = addVertex(g, x, y).graph;
  edges
    .split(/\s+/)
    .filter(Boolean)
    .forEach((pair, i) => {
      g = addEdge(g, pair[0], pair[1], weights[i] ?? 1).graph;
    });
  return { ...g, allowLoops: g.edges.some(e => e.from === e.to) || Boolean(opts.allowLoops), allowMulti: Boolean(opts.allowMulti) };
}

/** a → b → c → d plus a back edge, a branch and an isolated vertex. */
export const closureDemo = build(
  { directed: true },
  { a: [90, 90], b: [250, 70], c: [400, 130], d: [520, 260], e: [260, 280], f: [90, 300] },
  'ab bc cd ce eb',
);

export const EXAMPLES: { name: string; graph: Graph }[] = [
  { name: 'Closure demo (directed)', graph: closureDemo },
  {
    name: 'Prerequisites',
    graph: build({ directed: true }, { a: [80, 190], b: [220, 100], c: [220, 280], d: [380, 190], e: [520, 100], f: [520, 280] }, 'ab ac bd cd de df'),
  },
  {
    name: 'Friends (undirected)',
    graph: build({ directed: false }, { a: [100, 100], b: [280, 70], c: [460, 110], d: [140, 290], e: [330, 280], f: [510, 300] }, 'ab bc ad be de cf'),
  },
  {
    name: 'Strongly connected cycle',
    graph: build({ directed: true }, { a: [300, 60], b: [470, 190], c: [300, 320], d: [130, 190] }, 'ab bc cd da'),
  },
];
