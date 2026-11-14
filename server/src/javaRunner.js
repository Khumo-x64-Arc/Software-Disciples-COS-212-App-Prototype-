// Compiles and runs learners' Java in a separate process with time, memory and
// output limits. The child gets a scrubbed environment and its own temp folder.
//
// Production note: a process is not a full sandbox. Deploy the runner inside a
// container with no network (e.g. docker run --network none --read-only
// --memory 512m --pids-limit 64) as the design doc asks.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const JAVAC = process.env.JAVAC ?? 'javac';
const JAVA = process.env.JAVA ?? 'java';
const MAX_PARALLEL = Number(process.env.JAVA_PARALLEL ?? 2);
const OUTPUT_LIMIT = 64 * 1024; // stdout/stderr of the JVM itself
const TEST_OUTPUT_LIMIT = 1024 * 1024; // one test's output (P8 prints n matrices)

// ---- a tiny queue so a class full of learners can't start 100 JVMs at once ----
let running = 0;
const waiting = [];
async function slot(fn) {
  if (running >= MAX_PARALLEL) await new Promise(r => waiting.push(r));
  running += 1;
  try {
    return await fn();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

function run(cmd, args, { cwd, timeoutMs, input }) {
  return new Promise(resolve => {
    const env = { PATH: process.env.PATH, HOME: cwd, LANG: 'C.UTF-8' }; // no JAVA_TOOL_OPTIONS, no secrets
    const child = spawn(cmd, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', d => { if (stdout.length < OUTPUT_LIMIT) stdout += d; });
    child.stderr.on('data', d => { if (stderr.length < OUTPUT_LIMIT) stderr += d; });
    child.on('error', err => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err), killed });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, killed });
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

export async function javaAvailable() {
  const r = await run(JAVAC, ['-version'], { cwd: os.tmpdir(), timeoutMs: 10000 });
  return r.code === 0;
}

// ---- static checks (study-guide rules and basic safety) ----

const BLOCKED = [
  { re: /\bjava\.util\.(?!Scanner\b)[A-Za-z_*]/, kind: 'builtin-collection', msg: 'The study guide forbids built-in data structures. Use your own node class or arrays instead of java.util.' },
  { re: /\bimport\s+java\.util\s*\.\s*\*/, kind: 'builtin-collection', msg: 'The study guide forbids built-in data structures. Remove the java.util.* import.' },
  { re: /\b(ArrayList|LinkedList|HashMap|HashSet|TreeMap|TreeSet|ArrayDeque|Stack|Vector|PriorityQueue|Queue|Deque|List|Map|Set)\s*</, kind: 'builtin-collection', msg: 'The study guide forbids built-in data structures such as ArrayList or HashMap. Use your own node class or arrays.' },
  { re: /\bjava\.(net|nio)\b|\bProcessBuilder\b|Runtime\s*\.\s*getRuntime|java\.lang\.reflect|\bClassLoader\b|System\s*\.\s*exit|new\s+(File|FileWriter|FileOutputStream|FileReader|Socket)\b/, kind: 'unsafe', msg: 'This code uses files, the network, processes or System.exit, which the test section does not allow.' },
];

export function staticCheck(code, className) {
  const issues = [];
  const lineOf = idx => code.slice(0, idx).split('\n').length;
  if (/^\s*package\s/m.test(code)) issues.push({ kind: 'package', line: 1, message: 'Remove the package line: the test section compiles your file on its own.' });
  if (!new RegExp(`\\bpublic\\s+(final\\s+)?class\\s+${className}\\b`).test(code)) {
    issues.push({ kind: 'class-name', line: 1, message: `Your file must contain "public class ${className}".` });
  }
  const noComments = code.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
  for (const b of BLOCKED) {
    const m = b.re.exec(noComments);
    if (m) issues.push({ kind: b.kind, line: lineOf(m.index), message: b.msg });
  }
  if (code.length > 50000) issues.push({ kind: 'size', line: 1, message: 'Your file is longer than 50 000 characters.' });
  return issues;
}

/** Turns javac messages into plain language with line numbers. */
export function explainCompileErrors(stderr, fileName) {
  const out = [];
  const lines = stderr.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:.*[\\/])?([\w]+\.java):(\d+): error: (.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, file, lineNo, raw] = m;
    if (file !== fileName) continue;
    const following = lines.slice(i + 1, i + 5).join('\n');
    const symbol = /symbol:\s+(?:variable|method|class)\s+([\w]+)/.exec(following)?.[1];
    let message = raw;
    if (/cannot find symbol/.test(raw)) message = `Java doesn’t know “${symbol ?? 'this name'}”. Check the spelling, and that it is declared before you use it.`;
    else if (/';' expected/.test(raw)) message = 'A semicolon (;) is missing at the end of this line or the one before.';
    else if (/incompatible types: (.+) cannot be converted to (.+)/.test(raw)) {
      const [, a, b] = /incompatible types: (.+) cannot be converted to (.+)/.exec(raw);
      message = `You used a ${a} where a ${b} is needed.`;
    } else if (/missing return statement/.test(raw)) message = 'The method can finish without returning a value. Add a return statement at the end.';
    else if (/reached end of file while parsing/.test(raw)) message = 'A closing brace } is missing near the end of the file.';
    else if (/class .* is public, should be declared in a file named/.test(raw)) message = 'The public class name must match the problem’s class name.';
    else if (/illegal start of (expression|type)/.test(raw)) message = 'Java expected a value or a statement here. Look for a missing value, an extra symbol, or a missing bracket on this line or the one before.';
    else if (/not a statement/.test(raw)) message = 'This line is not a complete Java statement.';
    else if (/'\)' expected|'\(' expected|'\{' expected|'\}' expected/.test(raw)) message = `A bracket is missing: ${raw.replace('expected', 'was expected here')}.`;
    else if (/might not have been initialized/.test(raw)) message = `${raw.replace(/^variable /, 'The variable ')}. Give it a value before you use it.`;
    out.push({ line: Number(lineNo), message, raw });
  }
  if (!out.length && stderr.trim()) out.push({ line: null, message: 'The code did not compile.', raw: stderr.split('\n').slice(0, 6).join('\n') });
  return out;
}

/**
 * Compiles the learner's class with the problem's harness and runs every test
 * in one JVM (each test on its own thread with a time limit).
 */
export async function runJava({ className, code, harness, tests, perTestMs = 2000 }) {
  return slot(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cos212-'));
    try {
      fs.writeFileSync(path.join(dir, `${className}.java`), code);
      const files = [`${className}.java`];
      if (harness) {
        fs.writeFileSync(path.join(dir, 'Main.java'), harness);
        files.push('Main.java');
      }
      fs.mkdirSync(path.join(dir, 'out'));
      const comp = await run(JAVAC, ['--release', '8', '-nowarn', '-encoding', 'UTF-8', '-d', 'out', ...files], { cwd: dir, timeoutMs: 30000 });
      if (comp.code !== 0) {
        return { compiled: false, compileErrors: explainCompileErrors(comp.stderr, `${className}.java`) };
      }
      if (!harness) {
        // Stand-alone program (P11): run main with a 10 s budget.
        const r = await run(JAVA, ['-Xmx256m', '-cp', 'out', className], { cwd: dir, timeoutMs: 10000 });
        return { compiled: true, program: { stdout: r.stdout, stderr: r.stderr, timedOut: r.killed, exitCode: r.code } };
      }
      const tdir = path.join(dir, 'tests');
      fs.mkdirSync(tdir);
      tests.forEach((t, i) => fs.writeFileSync(path.join(tdir, `${i}.in`), t.input));
      const r = await run(JAVA, ['-Xmx256m', '-Xss8m', '-cp', 'out', 'Main', String(tests.length), tdir, String(perTestMs)], {
        cwd: dir,
        timeoutMs: tests.length * perTestMs + 8000,
      });
      const status = new Map();
      for (const line of r.stdout.split('\n')) {
        const m = /^RESULT (\d+) (.*)$/.exec(line.trim());
        if (m) status.set(Number(m[1]), m[2]);
      }
      const results = tests.map((t, i) => {
        let actual = '';
        try {
          actual = fs.readFileSync(path.join(tdir, `${i}.out`), 'utf8').slice(0, TEST_OUTPUT_LIMIT);
        } catch {
          /* not run */
        }
        const st = status.get(i) ?? (r.killed ? 'TIMEOUT' : 'NOT RUN');
        return { index: i, status: st, actual };
      });
      return { compiled: true, results };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}
