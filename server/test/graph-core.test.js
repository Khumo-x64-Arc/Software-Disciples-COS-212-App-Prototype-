import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../shared/graph-core.mjs';

const build = (directed, edges, n, opts = {}) => {
  let g = G.emptyGraph({ directed, ...opts });
  for (let i = 0; i < n; i++) g = G.addVertex(g, 50 * i, 50).graph;
  for (const [u, v] of edges) g = G.addEdge(g, u, v).graph;
  return g;
};

test('design-doc example: closure adds a→c and a→e', () => {
  const g = build(true, [['a', 'b'], ['b', 'c'], ['a', 'd'], ['d', 'e']], 5);
  assert.deepEqual(G.closureAddedPairs(g), [['a', 'c'], ['a', 'e']]);
  const p = G.properties(g);
  assert.equal(p.cyclic, false);
  assert.equal(p.connectivity, 'weakly connected');
});

test('Fitchfork format example: path 0→1→2', () => {
  const g = G.parseText('3 2 1\n0 1\n1 2\n');
  assert.equal(G.matrixText(G.warshall(G.booleanMatrix(g))), '0 1 1\n0 0 1\n0 0 0\n');
  assert.equal(G.exportText(g), '3 2 1\n0 1\n1 2\n');
});

test('diagonal is 1 only for vertices on a cycle (directed)', () => {
  const g = build(true, [['a', 'b'], ['b', 'a'], ['b', 'c']], 3);
  const r = G.warshall(G.booleanMatrix(g));
  assert.deepEqual(r.map((row, i) => row[i]), [1, 1, 0]);
});

test('Warshall agrees with repeated DFS on random graphs; k-innermost does not always', () => {
  let bugCaught = false;
  for (let seed = 1; seed <= 300; seed++) {
    const g = G.randomGraph({ n: 6, density: 0.25, directed: seed % 3 !== 0, loops: seed % 5 === 0, seed });
    const adj = G.booleanMatrix(g);
    assert.deepEqual(G.warshall(adj), G.closureByDFS(g), `seed ${seed}`);
    const { matrix, lists } = G.randomAdjacency(7, 0.3, seed);
    assert.deepEqual(G.closureFromLists(lists).map(r => [...r]), G.warshall(matrix));
    assert.deepEqual(G.closureFromMatrixDFS(matrix).map(r => [...r]), G.warshall(matrix));
    if (JSON.stringify(G.warshallKInnermost(adj)) !== JSON.stringify(G.warshall(adj))) bugCaught = true;
  }
  assert.ok(bugCaught, 'the k-innermost bug should differ on some graph');
});

test('Warshall trace: changed cells and reasons', () => {
  const g = build(true, [['a', 'b'], ['b', 'c'], ['c', 'd']], 4);
  const steps = G.warshallTrace(g);
  assert.equal(steps.length, 6); // R(0), k = a..d, done
  const kb = steps[2];
  assert.equal(kb.k, 1);
  assert.deepEqual(kb.changed, [{ i: 0, j: 2 }]);
  assert.match(kb.note, /a now reaches c \(a reaches b, b reaches c\)/);
  assert.deepEqual(steps.at(-1).matrix, G.warshall(G.booleanMatrix(g)));
});

test('properties: K4, trees, pseudographs, multigraphs, degree sum', () => {
  const pairs = [];
  for (const u of 'abcd') for (const v of 'abcd') if (u < v) pairs.push([u, v]);
  const k4 = G.properties(build(false, pairs, 4));
  assert.equal(k4.edges, 6);
  assert.equal(k4.complete, true);
  assert.equal(k4.knEdges, 6);
  assert.equal(k4.degreeSum, 2 * k4.edges);

  const tree = G.properties(build(false, [['a', 'b'], ['a', 'c'], ['c', 'd']], 4));
  assert.equal(tree.isTree, true);
  assert.equal(tree.edges, tree.vertices - 1);

  const pseudo = G.properties(build(false, [['a', 'a'], ['a', 'b']], 3, { allowLoops: true }));
  assert.equal(pseudo.kind, 'pseudograph');
  assert.deepEqual(pseudo.isolated, ['c']);
  assert.equal(pseudo.deg.a, 3); // a loop counts twice
  assert.equal(pseudo.degreeSum, 4);

  const multi = G.properties(build(false, [['a', 'b'], ['a', 'b']], 2, { allowMulti: true }));
  assert.equal(multi.kind, 'multigraph');
  assert.equal(multi.cyclic, true);

  const strong = G.properties(build(true, [['a', 'b'], ['b', 'c'], ['c', 'a']], 3));
  assert.equal(strong.connectivity, 'strongly connected');
});

test('representations: matrix counts, star table, incidence', () => {
  const g = build(false, [['a', 'b'], ['a', 'b'], ['b', 'b']], 3, { allowMulti: true, allowLoops: true });
  assert.deepEqual(G.adjacencyMatrix(g), [[0, 2, 0], [2, 1, 0], [0, 0, 0]]);
  assert.deepEqual(G.starForward(g), { start: [0, 2, 5, 5], neighbours: ['b', 'b', 'a', 'a', 'b'] });
  const inc = G.incidenceMatrix(g);
  assert.deepEqual(inc.cells.map(r => r[2]), [0, 1, 0]); // a loop column has a single 1
});

test('ADT operations respect loops and multi-edge settings', () => {
  let g = build(true, [], 2);
  assert.equal(G.addEdge(g, 'a', 'a').ok, false);
  g = G.addEdge(g, 'a', 'b').graph;
  assert.equal(G.addEdge(g, 'a', 'b').ok, false);
  assert.equal(G.hasEdge(g, 'a', 'b'), true);
  assert.equal(G.hasEdge(g, 'b', 'a'), false);
  g = G.removeVertex(g, 'b');
  assert.equal(g.edges.length, 0);
});

test('DFS and BFS traces', () => {
  const g = build(true, [['a', 'b'], ['a', 'c'], ['b', 'd'], ['d', 'a']], 5);
  assert.deepEqual(G.dfsTrace(g, 'a').order, ['a', 'b', 'd', 'c']);
  assert.deepEqual(G.bfsTrace(g, 'a').order, ['a', 'b', 'c', 'd']);
  assert.deepEqual([...G.reachableFrom(g, 'e')], ['e']);
});
