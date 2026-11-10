// Compiles and runs learners' Java code against the tests of a problem.
// Default mode runs javac/java as local child processes with time and memory limits.
// RUNNER=docker runs the same steps in a throwaway container with no network (recommended in production).
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MODE = process.env.RUNNER || 'local';
const DOCKER_IMAGE = process.env.RUNNER_IMAGE || 'eclipse-temurin:21-jdk';

const BANNED_COLLECTIONS = /\b(ArrayList|LinkedList|HashMap|HashSet|TreeMap|TreeSet|LinkedHashMap|LinkedHashSet|ArrayDeque|PriorityQueue|Vector|Stack|Hashtable|Collections|Arrays|List|Map|Set|Queue|Deque|Iterator)\s*[<.(]/;
const BANNED_IMPORT = /import\s+java\.util\.(?!Scanner\s*;)[\w.*]+\s*;/;
const UNSAFE = [
  [/\bRuntime\b|\bProcessBuilder\b/, 'starts other programs'],
  [/java\.net\b|\bSocket\b|\bURL\s*\(/, 'uses the network'],
  [/java\.nio\.file|\bFileWriter\b|\bFileOutputStream\b|\bnew\s+File\s*\(/, 'writes files'],
  [/System\s*\.\s*exit/, 'calls System.exit'],
  [/java\.lang\.reflect|\.getDeclared\w*\(|setAccessible/, 'uses reflection'],
  [/\bnew\s+Thread\b|\bExecutors\b/, 'starts threads'],
];

/** Static checks on the learner's file before compiling. Returns { blocked, findings }. */
export function staticCheck(code, problem) {
  const findings = [];
  const noComments = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (BANNED_IMPORT.test(noComments) || BANNED_COLLECTIONS.test(noComments)) findings.push({ id: 'java-util', blocking: true });
  for (const [re, what] of UNSAFE) if (re.test(noComments)) findings.push({ id: 'unsafe', blocking: true, detail: what });
  if (!new RegExp(`class\\s+${problem.file}\\b`).test(noComments)) findings.push({ id: 'class-name', blocking: true, detail: problem.file });
  if (problem.id === 'P2' && /\b(boolean|int)\s*\[\s*\]\s*\[\s*\]/.test(noComments)) findings.push({ id: 'used-matrix', blocking: false });
  if (['P7', 'P10', 'P11'].includes(problem.id)) {
    const order = warshallLoopOrder(noComments);
    if (order && !order.outer) findings.push({ id: 'k-not-outer-static', blocking: false, detail: order });
  }
  return { blocked: findings.some(f => f.blocking), findings };
}

/** Finds the intermediate-vertex variable in r[i][k] && r[k][j] and checks it is the outermost of the three loops. */
export function warshallLoopOrder(code) {
  const m = code.match(/\w+\s*\[\s*(\w+)\s*\]\s*\[\s*(\w+)\s*\]\s*&&\s*\w+\s*\[\s*(\w+)\s*\]\s*\[\s*(\w+)\s*\]/);
  if (!m) return null;
  let k = null;
  if (m[2] === m[3]) k = m[2];
  else if (m[1] === m[4]) k = m[1];
  if (!k) return null;
  // the three for-loops nearest before the condition
  const before = code.slice(0, m.index);
  const loops = [...before.matchAll(/for\s*\(\s*(?:int\s+)?(\w+)\s*=/g)].map(x => x[1]);
  const last3 = loops.slice(-3);
  if (last3.length < 3 || !last3.includes(k)) return null;
  return { k, loops: last3, outer: last3[0] === k };
}

function sh(cmd, args, { cwd, input, timeoutMs }) {
  return new Promise(resolve => {
    const env = { ...process.env };
    delete env.JAVA_TOOL_OPTIONS;
    const child = spawn(cmd, args, { cwd, env });
    let stdout = '', stderr = '', killed = false;
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; if (stdout.length > 2_000_000) { killed = true; child.kill('SIGKILL'); } });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut: killed }); });
    child.on('error', err => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: String(err), timedOut: false }); });
    if (input) child.stdin.end(input); else child.stdin.end();
  });
}

const PLAIN_ERRORS = [
  [/cannot find symbol/, 'Java does not recognise a name here. Check the spelling, and that the variable or method is declared before you use it.'],
  [/';' expected/, 'A statement is missing its semicolon at the end.'],
  [/incompatible types/, 'A value of one type is being stored in a variable of another type, for example an int where a boolean is expected.'],
  [/missing return statement/, 'The method can reach its end without returning a value. Make sure every path ends with a return.'],
  [/class, interface, enum, or record expected|reached end of file while parsing/, 'The braces { } do not match up. Check that every opening brace has a closing one.'],
  [/is public, should be declared in a file named/, 'The public class name must match the file name given in the problem.'],
  [/might not have been initialized/, 'A variable is used before it has been given a value.'],
  [/unreachable statement/, 'Some code can never run, usually because it comes after a return.'],
  [/array required, but/, 'You are using [ ] on something that is not an array.'],
  [/cannot be applied to given types/, 'A method is called with the wrong number or types of arguments.'],
];

function explainCompile(stderr, fileName) {
  const out = [];
  const re = new RegExp(`${fileName}\\.java:(\\d+): error: (.*)`, 'g');
  for (const m of stderr.matchAll(re)) {
    const raw = m[2].trim();
    const plain = PLAIN_ERRORS.find(([r]) => r.test(raw));
    out.push({ line: +m[1], message: raw, plain: plain ? plain[1] : 'Java could not compile this line. Read the message and check the line above it too.' });
  }
  if (!out.length && stderr.trim()) out.push({ line: null, message: stderr.trim().split('\n')[0], plain: 'Java could not compile your code.' });
  return out.slice(0, 5);
}

const norm = s => (s ?? '').split('\n').map(l => l.trim().replace(/\s+/g, ' ')).join('\n').replace(/\n+$/, '');
const squash = s => (s ?? '').replace(/\s+/g, '');

function parseRun(stdout, count) {
  const results = Array.from({ length: count }, () => ({ status: 'not-run', output: '' }));
  const re = /### CASE (\d+)\n([\s\S]*?)(### END|$)/g;
  for (const m of stdout.matchAll(re)) {
    const i = +m[1];
    const body = m[2];
    const ended = m[3] === '### END';
    const exc = body.match(/^!!EXC (\w+)/m);
    results[i] = exc ? { status: 'exception', exception: exc[1], output: '' }
      : ended ? { status: 'done', output: body } : { status: 'timeout', output: body };
  }
  return results;
}

/** Compile and run. Returns { phase, compileErrors?, cases: [...] }. */
export async function runJava(problem, code, tests, { timeoutMs } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'graphapp-'));
  try {
    const cleaned = code.replace(/^\s*package\s+[\w.]+\s*;/m, '');
    await writeFile(path.join(dir, `${problem.file}.java`), cleaned);
    await writeFile(path.join(dir, 'Main.java'), problem.driver);
    const input = `${tests.length}\n` + tests.map(t => t.input).join('');
    const limit = timeoutMs ?? (problem.id === 'P11' ? 30000 : 10000);
    let compile, run;
    if (MODE === 'docker') {
      const script = `javac --release 8 -encoding UTF-8 -nowarn -d out *.java 2>compile.txt || { cat compile.txt >&2; exit 90; }; java -Xmx192m -Xss16m -cp out Main`;
      run = await sh('docker', ['run', '--rm', '-i', '--network', 'none', '-m', '320m', '--cpus', '1', '--pids-limit', '64', '-v', `${dir}:/work`, '-w', '/work', DOCKER_IMAGE, 'sh', '-c', script], { cwd: dir, input, timeoutMs: limit + 15000 });
      if (run.code === 90) return { phase: 'compile', compileErrors: explainCompile(run.stderr, problem.file), cases: [] };
    } else {
      compile = await sh('javac', ['--release', '8', '-encoding', 'UTF-8', '-nowarn', '-d', 'out', `${problem.file}.java`, 'Main.java'], { cwd: dir, timeoutMs: 30000 });
      if (compile.code !== 0) return { phase: 'compile', compileErrors: explainCompile(compile.stderr, problem.file), cases: [] };
      run = await sh('java', ['-Xmx192m', '-Xss16m', '-XX:+UseSerialGC', '-cp', 'out', 'Main'], { cwd: dir, input, timeoutMs: limit });
    }
    const parsed = parseRun(run.stdout, tests.length);
    if (run.timedOut) {
      const firstUnfinished = parsed.findIndex(r => r.status !== 'done' && r.status !== 'exception');
      if (firstUnfinished >= 0) parsed[firstUnfinished] = { status: 'timeout', output: parsed[firstUnfinished].output };
    }
    const cases = tests.map((t, i) => {
      const r = parsed[i];
      let passed = false, formatOnly = false;
      if (r.status === 'done') {
        if (t.timing) passed = /TIME /.test(r.output);
        else {
          passed = norm(r.output) === norm(t.expected);
          formatOnly = !passed && squash(r.output) === squash(t.expected);
        }
      }
      return { category: t.category, visible: t.visible, timing: !!t.timing, input: t.input, expected: t.expected, ...r, passed, formatOnly };
    });
    return { phase: 'run', cases };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
