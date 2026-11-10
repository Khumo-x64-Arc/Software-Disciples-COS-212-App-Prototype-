import { readFile } from 'node:fs/promises';
import { PROBLEMS, problemById, buildTests } from '../src/problems.js';
import { runJava, staticCheck } from '../src/runner.js';
import { detectMisconceptions } from '../src/feedback.js';

async function check(pid, file, label) {
  const p = problemById(pid);
  const code = await readFile(new URL(file, import.meta.url), 'utf8');
  const st = staticCheck(code, p);
  const tests = buildTests(p, 'u21000001|1', { includeHidden: true });
  if (st.blocked) { console.log(`${label.padEnd(26)} BLOCKED`, st.findings.map(f => f.id).join(','), '->', detectMisconceptions(p, { phase: 'static' }, st.findings)); return; }
  const t0 = Date.now();
  const run = await runJava(p, code, tests);
  if (run.phase === 'compile') { console.log(`${label.padEnd(26)} COMPILE`, JSON.stringify(run.compileErrors)); return; }
  const pass = run.cases.filter(c => c.passed).length;
  const failCats = [...new Set(run.cases.filter(c => !c.passed).map(c => `${c.category}:${c.status}${c.exception ? '/' + c.exception : ''}`))];
  console.log(`${label.padEnd(26)} ${pass}/${run.cases.length}  ${Date.now() - t0}ms  fail=[${failCats.join(' ')}]  mis=${detectMisconceptions(p, run, st.findings)}`);
  if (pid === 'P11') console.log(run.cases.find(c => c.timing)?.output.trim());
}
const sol = { P1: 'MatrixGraph', P2: 'ListGraph', P3: 'Convert', P4: 'Classify', P5: 'Reach', P6: 'ClosureDFS', P7: 'Warshall', P8: 'Trace', P9: 'Prereq', P10: 'Warshall', P11: 'Timing' };
for (const p of PROBLEMS) await check(p.id, `./solutions/${sol[p.id]}.java`, `${p.id} reference`);
await check('P1', './buggy/MatrixGraph.java', 'P1 one-direction bug');
await check('P5', './buggy/Reach.java', 'P5 no-visited bug');
await check('P4', './buggy/Classify.java', 'P4 count bug');
await check('P7', './buggy/WarshallDiag.java', 'P7 diagonal bug');
await check('P7', './buggy/WarshallUtil.java', 'P7 java.util');
await check('P7', './buggy/WarshallCompile.java', 'P7 compile error');
const p10 = problemById('P10'); 
import('node:fs').then(fs => fs.writeFileSync(new URL('./buggy/P10starter.java', import.meta.url), p10.starter));
await new Promise(r => setTimeout(r, 100));
await check('P10', './buggy/P10starter.java', 'P10 starter (k inner)');
