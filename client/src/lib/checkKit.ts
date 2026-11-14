// Shared helpers for the unit-check generators.
import { addEdge, addVertex, circleLayout, emptyGraph, ids, randomGraph, type Graph } from '../../../shared/graph-core.mjs';

export type Option = { text: string; correct?: boolean; misconception?: string; why?: string };
export type Question = {
  id: string;
  prompt: string;
  graph?: Graph;
  matrix?: { labels: string[]; cells: number[][]; caption: string; kRow?: number };
  code?: string;
  options: Option[];
  explain: string; // shown after answering
};

export type Rand = () => number;
export const pick = <T,>(r: Rand, xs: T[]): T => xs[Math.floor(r() * xs.length)];
export function shuffle<T>(r: Rand, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** De-duplicates option texts (keeping the correct one) and shuffles. */
export function opts(r: Rand, list: Option[]): Option[] {
  const seen = new Set<string>();
  const out: Option[] = [];
  for (const o of [...list].sort((a, b) => Number(Boolean(b.correct)) - Number(Boolean(a.correct)))) {
    if (seen.has(o.text)) continue;
    seen.add(o.text);
    out.push(o);
  }
  return shuffle(r, out);
}
export const set = (xs: string[]) => (xs.length ? `{${xs.join(', ')}}` : '{ } (none)');

/** A random graph that is guaranteed to have at least `min` edges. */
export function graphWith(r: Rand, o: { n: number; directed: boolean; density?: number; loops?: boolean; min?: number }): Graph {
  for (let t = 0; t < 50; t++) {
    const g = randomGraph({ n: o.n, directed: o.directed, density: o.density ?? 0.35, loops: o.loops, seed: Math.floor(r() * 1e9) });
    if (g.edges.length >= (o.min ?? 2)) return g;
  }
  return randomGraph({ n: o.n, directed: o.directed, density: 0.6, seed: 7 });
}
export function fromPairs(n: number, pairs: [number, number][], directed: boolean): Graph {
  let g = emptyGraph({ directed, allowLoops: true, allowMulti: true });
  const pos = circleLayout(n);
  for (let i = 0; i < n; i++) g = addVertex(g, pos[i].x, pos[i].y).graph;
  const L = ids(g);
  for (const [a, b] of pairs) g = addEdge(g, L[a], L[b]).graph;
  return g;
}

