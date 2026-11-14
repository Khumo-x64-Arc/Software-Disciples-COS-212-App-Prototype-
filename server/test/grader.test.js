import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { grade } from '../src/grader.js';
import { PROBLEMS, opsTests, solutionFor, testsFor } from '../src/problems.js';
import { javaAvailable } from '../src/javaRunner.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sol = name => fs.readFileSync(path.join(here, '..', 'solutions', `${name}.java`), 'utf8');
let hasJava = false;
before(async () => { hasJava = await javaAvailable(); });

test('every reference solution passes its problem', { timeout: 240000 }, async t => {
  if (!hasJava) return t.skip('no javac on this machine');
  for (const p of PROBLEMS) {
    const r = await grade(p.id, sol(p.className), 'u12345678');
    assert.equal(r.status, 'passed', `${p.id}: ${JSON.stringify(r.tests?.filter(x => !x.passed) ?? r.compileErrors ?? r.issues)}`);
  }
});

test('every problem has a model solution to show after a wrong answer', () => {
  for (const p of PROBLEMS) assert.match(solutionFor(p) ?? '', new RegExp(`public class ${p.className}\\b`), p.id);
});

test('hidden tests differ per learner but samples do not', async () => {
  const p = PROBLEMS.find(x => x.id === 'P6');
  const a = testsFor(p, 'u1'), b = testsFor(p, 'u2');
  assert.deepEqual(a.filter(x => x.visible), b.filter(x => x.visible));
  assert.notDeepEqual(a.map(x => x.input), b.map(x => x.input));
});

test('the add/remove-node model renumbers vertices after removeVertex', () => {
  const tests = opsTests(() => 0.5, true);
  const t = tests.find(x => x.caseType === 'removing a vertex');
  // 5 vertices; edges 0→4, 4→1, 2→4, 3→0; remove 2 → old 3 is now 2, old 4 is now 3.
  // New edges: 0→3, 3→1, 2→0.
  assert.equal(t.expected, '4\ntrue\ntrue\n1\n1\ntrue\n');
});

test('common mistakes are matched to the right misconception', { timeout: 240000 }, async t => {
  if (!hasJava) return t.skip('no javac on this machine');
  const cases = [
    ['P9', sol('BuggyWarshall').replace(/for \(int k = 0; k < n; k\+\+\)\n(\s+)for \(int i = 0; i < n; i\+\+\)\n(\s+)for \(int j = 0; j < n; j\+\+\)/, 'for (int i = 0; i < n; i++)\n$1for (int j = 0; j < n; j++)\n$2for (int k = 0; k < n; k++)'), 'k-not-outer'],
    ['P6', sol('Warshall').replace('return r;', 'for (int i = 0; i < n; i++) r[i][i] = true;\n        return r;'), 'diagonal'],
    ['P4', sol('Dfs').replace('&& !visited[v]', ''), 'no-visited-mark'],
    ['P1', sol('MatrixGraph').replace('if (!directed) adj[v][u] = true;', ''), 'one-direction'],
    ['P2', sol('ListGraph').replace('public class ListGraph {', 'import java.util.ArrayList;\npublic class ListGraph {'), 'builtin-collection'],
    // A queue taken from the back is a stack: BFS turns into a DFS-like order.
    ['P3', sol('Bfs').replace('int u = queue[head++];', 'int u = queue[--tail]; head = 0;').replace('while (head < tail)', 'while (tail > 0)'), null],
    // DFS written with a queue gives the BFS order.
    ['P4', sol('Dfs').replace('visit(adj, v, visited);    // go deep before trying the next neighbour', '{ visited[v] = true; result[count++] = v; }').replace('visit(adj, start, visited);', 'visit(adj, start, visited); for (int i = 1; i < count; i++) visit2(adj, result[i], visited);').replace('    private static void visit(', '    private static void visit2(int[][] adj, int u, boolean[] visited) {\n        for (int v = 0; v < adj.length; v++) if (adj[u][v] > 0 && !visited[v]) { visited[v] = true; result[count++] = v; }\n    }\n\n    private static void visit('), 'dfs-bfs-order'],
  ];
  for (const [pid, code, want] of cases) {
    const r = await grade(pid, code, 'u12345678');
    if (want === null) {
      assert.equal(r.status, 'failed', `${pid} should fail`);
      continue;
    }
    assert.equal(r.misconception?.id, want, `${pid} expected ${want}, got ${JSON.stringify(r.misconception)} / ${r.status} ${JSON.stringify(r.failedCaseTypes)}`);
  }
});

test('compile errors are explained', { timeout: 120000 }, async t => {
  if (!hasJava) return t.skip('no javac on this machine');
  const r2 = await grade('P6', 'public class Warshall {\n  public static boolean[][] closure(boolean[][] adj) {\n    int x = 1\n    return adj;\n  }\n}\n', 'u1');
  assert.equal(r2.status, 'compile-error');
  assert.match(r2.compileErrors[0].message, /semicolon/);
  assert.equal(r2.compileErrors[0].line, 3);
});
