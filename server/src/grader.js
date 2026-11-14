// Marks a Java submission and matches what went wrong to a known misconception
// (design doc: "Misconception catalogue for coding and trace answers").
import { problemById, testsFor, warshallKInnermost } from './problems.js';
import { runJava, staticCheck } from './javaRunner.js';

export const MISCONCEPTIONS = {
  'k-not-outer': {
    label: 'The intermediate vertex k is not the outermost loop',
    hint: 'Your closure finds pairs one stop apart but misses longer chains. Which loop should choose the intermediate vertex?',
    pointsTo: 'Lesson L10 trace',
  },
  'one-direction': {
    label: 'Edge added in one direction only',
    hint: 'In an undirected graph, adding edge(u, v) must update both u’s and v’s entries.',
    pointsTo: 'Lesson L5',
  },
  diagonal: {
    label: 'Diagonal always 1, or never 1',
    hint: 'A vertex reaches itself only if it lies on a cycle.',
    pointsTo: 'Lesson L9; Drozdek (2010), Section 8.3.1'
  },
  'no-visited-mark': {
    label: 'DFS without visited marks',
    hint: 'Your search revisits vertices on a cycle. Mark each vertex the first time you visit it.',
    pointsTo: 'Lesson L7; Drozdek (2010), Section 8.2'
  },
  'numbered-from-1': {
    label: 'Vertices numbered from 1',
    hint: 'Vertices in the test input are numbered from 0.',
    pointsTo: 'Input format',
  },
  'builtin-collection': {
    label: 'Built-in data structure used',
    hint: 'The study guide forbids built-in data structures. Use your own node class.',
    pointsTo: 'P2',
  },
  'dfs-bfs-order': {
    label: 'Mixes up BFS and DFS order',
    hint: 'Your order is the other traversal’s order. BFS takes vertices out of a queue (first in, first out, level by level); DFS goes deep first (recursion or a stack).',
    pointsTo: 'L6 and L7',
  },
  spacing: {
    label: 'Output format',
    hint: 'Your answer is right. Check the spaces and line breaks against the sample.',
    pointsTo: 'Input format',
  },
};

const norm = s => s.replace(/\s+/g, ' ').trim();
const matrixOf = text => text.trim().split('\n').filter(Boolean).map(r => r.trim().split(/\s+/).map(Number));

/** Is k declared by an inner loop rather than the outermost of a triple loop? */
export function kLoopNotOuter(code) {
  const loops = [...code.matchAll(/for\s*\(\s*int\s+(\w+)\s*=/g)].map(m => m[1]);
  // look at the last triple (the closure loops come after any copy loops)
  for (let s = loops.length - 3; s >= 0; s--) {
    const trio = loops.slice(s, s + 3);
    if (trio.includes('k') && new Set(trio).size === 3) return trio[0] !== 'k';
  }
  return false;
}

function onlyDiagonalDiffers(actual, expected) {
  const a = matrixOf(actual), e = matrixOf(expected);
  if (a.length !== e.length || !a.length) return false;
  let diag = false;
  for (let i = 0; i < e.length; i++) {
    if (a[i].length !== e[i].length) return false;
    for (let j = 0; j < e[i].length; j++) {
      if (a[i][j] !== e[i][j]) {
        if (i !== j) return false;
        diag = true;
      }
    }
  }
  return diag;
}

function matchMisconception(problem, code, rows) {
  const failed = rows.filter(r => !r.passed);
  if (!failed.length) return null;
  const ids = problem.id;
  const failTypes = new Set(failed.map(r => r.caseType));

  if (['P3', 'P4', 'P5'].includes(ids)) {
    if (failed.some(r => /StackOverflowError|OutOfMemoryError|TIMEOUT/.test(r.status))) return 'no-visited-mark';
    // A search that never checks its marks overruns its arrays.
    const checksMarks = /!\s*\w*(visited|seen|marked)\w*\s*\[|(visited|seen|marked)\w*\s*\[[^\]]*\]\s*==\s*false/i.test(code);
    if (!checksMarks && failed.some(r => /ArrayIndexOutOfBounds/.test(r.status))) return 'no-visited-mark';
  }
  if (failed.some(r => /ArrayIndexOutOfBounds/.test(r.status))) return 'numbered-from-1';
  if (['P6', 'P7', 'P9'].includes(ids)) {
    const innermostLike = failed.some(r => r.kInnermost && norm(r.actual) === norm(r.kInnermost));
    if (innermostLike || kLoopNotOuter(code)) return 'k-not-outer';
  }
  if (['P5', 'P6', 'P9'].includes(ids) && failed.some(r => onlyDiagonalDiffers(r.actual, r.expected))) return 'diagonal';
  if (['P1', 'P2'].includes(ids)) {
    const und = rows.filter(r => /undirected|loops/.test(r.caseType) || (r.caseType === 'sample' && /^\d+ 0 /.test(r.input)));
    const dir = rows.filter(r => r.caseType === 'directed graph' || (r.caseType === 'sample' && /^\d+ 1 /.test(r.input)));
    if (und.some(r => !r.passed) && dir.every(r => r.passed)) return 'one-direction';
  }
  // P3/P4: each test knows the other traversal's output.
  for (const r of failed) for (const alt of r.meta?.alts ?? []) if (r.status === 'OK' && norm(r.actual) === norm(alt.output) && norm(alt.output) !== norm(r.expected)) return alt.id;
  if (failed.every(r => r.status === 'OK' && norm(r.actual) === norm(r.expected))) return 'spacing';
  void failTypes;
  return null;
}

/** Marks one submission. Returns feedback the React app shows (and can read aloud). */
export async function grade(problemId, code, userId) {
  const problem = problemById(problemId);
  if (!problem) throw new Error('Unknown problem');

  const issues = staticCheck(code, problem.className);
  if (issues.length) {
    const builtin = issues.find(i => i.kind === 'builtin-collection');
    return {
      status: 'blocked',
      issues,
      misconception: builtin ? { id: 'builtin-collection', ...MISCONCEPTIONS['builtin-collection'] } : null,
      passed: false,
    };
  }

  const tests = testsFor(problem, userId);
  const r = await runJava({ className: problem.className, code, harness: problem.harness(), tests });
  if (!r.compiled) return { status: 'compile-error', compileErrors: r.compileErrors, passed: false };

  const rows = tests.map((t, i) => {
    const res = r.results[i];
    const passed = res.status === 'OK' && res.actual.replace(/\r/g, '') === t.expected;
    let kInnermost;
    if (t.meta?.edges && ['P6', 'P9'].includes(problem.id)) {
      const n = t.meta.n;
      const m = Array.from({ length: n }, () => Array(n).fill(0));
      for (const [u, v] of t.meta.edges) { m[u][v] = 1; if (!t.meta.directed) m[v][u] = 1; }
      kInnermost = warshallKInnermost(m).map(row => row.join(' ')).join('\n') + (n ? '\n' : '');
    }
    return { ...t, ...res, passed, kInnermost };
  });
  const misconceptionId = matchMisconception(problem, code, rows);
  const passedCount = rows.filter(x => x.passed).length;
  const runtime = rows.find(x => x.status.startsWith('EXC') || x.status === 'TIMEOUT');

  return {
    status: passedCount === rows.length ? 'passed' : 'failed',
    passed: passedCount === rows.length,
    passedCount,
    total: rows.length,
    tests: rows.map(x =>
      x.visible
        ? { name: x.name, caseType: x.caseType, visible: true, passed: x.passed, status: x.status, input: x.input, expected: x.expected, actual: x.actual }
        : { name: x.name, caseType: x.caseType, visible: false, passed: x.passed, status: x.status.startsWith('EXC') ? 'runtime error' : x.status === 'TIMEOUT' ? 'time limit' : x.passed ? 'OK' : 'wrong answer' },
    ),
    failedCaseTypes: [...new Set(rows.filter(x => !x.passed).map(x => x.caseType))],
    runtimeError: runtime ? describeRuntime(runtime.status) : null,
    misconception: misconceptionId ? { id: misconceptionId, ...MISCONCEPTIONS[misconceptionId] } : null,
  };
}

function describeRuntime(status) {
  if (status === 'TIMEOUT') return 'A test ran past the time limit. Look for a loop or recursion that never stops.';
  const m = /^EXC (\w+) ?(.*)$/.exec(status);
  if (!m) return status;
  const [, name, msg] = m;
  const plain = {
    ArrayIndexOutOfBoundsException: `An array index was out of range (${msg}).`,
    NullPointerException: 'Something was null when the code used it, e.g. an array or node that was never created.',
    StackOverflowError: 'The recursion went too deep. On a graph with a cycle, this usually means a missing visited mark.',
    OutOfMemoryError: 'The program ran out of memory.',
    NegativeArraySizeException: 'An array was created with a negative size.',
  };
  return plain[name] ?? `${name}: ${msg}`;
}
