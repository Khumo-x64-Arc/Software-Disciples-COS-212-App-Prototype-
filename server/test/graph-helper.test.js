import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answer, CARDS } from '../../shared/graph-helper.mjs';
import * as G from '../../shared/graph-core.mjs';

const doc = (() => {
  let g = G.emptyGraph({ directed: true });
  for (let i = 0; i < 5; i++) g = G.addVertex(g, 60 * i, 60).graph;
  for (const [u, v] of [['a', 'b'], ['b', 'c'], ['a', 'd'], ['d', 'e']]) g = G.addEdge(g, u, v).graph;
  return g;
})();

test('knowledge base: the design doc’s starter questions find the right card', () => {
  const cases = {
    'What is the difference between a circuit and a cycle?': 'circuit-cycle',
    'What is the difference between an array and a linked list?': 'array-vs-list',
    'How do I remove a node from an adjacency list?': 'remove-vertex',
    'Why does BFS use a queue?': 'queue-stack',
    'How does DFS work?': 'dfs-how',
    'Where are graphs used in real life?': 'applications',
    'How do I become a Legend?': 'app-levels',
    'Why is the coding section locked?': 'app-locked',
    'When is an adjacency list better than a matrix?': 'list-vs-matrix',
    'Why does DFS need a visited mark on graphs but not on trees?': 'visited',
    'What is the difference between weakly and strongly connected?': 'weak-strong',
    'What does the closure add?': 'closure-what',
    'Why must k be the outer loop?': 'k-outer',
    "Why is Warshall's Θ(V³)?": 'theta-v3',
    'When is repeated DFS faster?': 'dfs-faster',
    'How do I store a graph without java.util?': 'java-no-util',
    'How do I read the test input format?': 'java-format',
    'Matrix or list for a sparse graph?': 'list-vs-matrix',
    'how many edges does K4 have': 'complete',
    'is a reachability matrix the same as the closure': 'closure-what',
  };
  for (const [q, id] of Object.entries(cases)) {
    const r = answer(q, {});
    assert.equal(r.cardId, id, `${q} → ${r.cardId ?? r.layer}`);
    assert.ok(r.src, 'every answer names its source');
  }
  for (const c of CARDS) assert.ok(c.a.split(/(?<=[.!?])\s+/).length <= 3, `${c.id} answer is over three sentences`);
});

test('graph engine: exact answers about the learner’s graph', () => {
  const ctx = { graph: doc };
  const reach = answer('Can a reach e?', ctx);
  assert.equal(reach.layer, 'graph');
  assert.match(reach.reply, /Yes: a reaches e along a → d → e/);
  assert.equal(reach.src, 'Computed from your graph');
  assert.match(answer('can c reach a?', ctx).reply, /^No/);
  assert.match(answer('What is the degree of a?', ctx).reply, /out-degree 2 and in-degree 0/);
  assert.match(answer('Is my graph strongly connected?', ctx).reply, /weakly connected/);
  assert.match(answer('Why is row a of the closure all 1s?', ctx).reply, /b, c, d, e/);
  assert.match(answer('what does the closure add to my graph', ctx).reply, /a→c, a→e/);
  assert.match(answer('BFS from a', ctx).reply, /a → b → d → c → e/);
  assert.match(answer('DFS from a', ctx).reply, /a → b → c → d → e/);
  assert.match(answer('shortest path from a to e', ctx).reply, /a → d → e \(2 edges/);
});

test('asks for an attempt before the model answer, and gives the next hint', () => {
  const hints = { P7: ['h1', 'h2', 'h3'] };
  const r = answer('can you give me the code for P7', { problemHints: hints });
  assert.equal(r.layer, 'guard');
  assert.match(r.reply, /Have a go at P7 first.*model solution.*hint 1 of 3\): h1/);
  const r2 = answer('just show me the solution', { problem: { id: 'P7', hintLevel: 1 }, problemHints: hints });
  assert.match(r2.reply, /hint 2 of 3\): h2/);
});

test('fallback: off-topic redirect, unknown on-topic logged with closest topics and email', () => {
  const off = answer('What is the weather in Pretoria?', {});
  assert.equal(off.layer, 'fallback');
  assert.match(off.reply, /only help with lists and arrays, graphs/);
  const unk = answer('Who first proved the graph minor theorem?', {});
  assert.equal(unk.layer, 'fallback');
  assert.match(unk.email, /cos212queries@cs\.up\.ac\.za/);
});
