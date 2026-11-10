// Graph & Transitive Closure e-learning app: Node.js (Express) back end.
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as store from './store.js';
import { UNITS, generateCheck, publicCheck, gradeQuestion } from './units.js';
import { PROBLEMS, problemById, publicProblem, buildTests } from './problems.js';
import { runJava, staticCheck } from './runner.js';
import { detectMisconceptions, hintStep, MISCONCEPTIONS, categoryLabel, rubricCheck, P11_RUBRIC } from './feedback.js';
import { answer as chatAnswer } from './chatbot.js';
import { unitMastery, unitUnlocked, problemStatus, studentProfile, mostAsked, classOverview, struggleMap, studentsVisibleTo, toCsv, SECURE } from './analytics.js';
import { seedDemo, clearDemo } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '200kb' }));

const PASSCODES = { lecturer: process.env.LECTURER_PASSCODE || 'cos212-lecturer', tutor: process.env.TUTOR_PASSCODE || 'cos212-tutor' };
if (process.env.SEED_DEMO !== '0') seedDemo();

// ---------- auth (pilot sign-in; replace with UP single sign-on in production) ----------
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const user = store.sessionUser(token);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  req.user = user; req.token = token;
  next();
}
const staffOnly = (req, res, next) => (['lecturer', 'tutor'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Lecturers and tutors only.' }));

app.post('/api/login', (req, res) => {
  const { role = 'student', studentNumber = '', name = '', passcode = '', group } = req.body || {};
  if (role === 'student') {
    const id = String(studentNumber).trim().toLowerCase();
    if (!/^u\d{8}$/.test(id)) return res.status(400).json({ error: 'Use your student number, for example u21000001.' });
    const existing = store.userById(id);
    const user = store.upsertUser({ id, role: 'student', name: name.trim() || existing?.name || id, group: existing?.group || store.groupFor(id) });
    return res.json({ token: store.createSession(user.id), user, consentNeeded: !user.consentAt });
  }
  if (!PASSCODES[role] || passcode !== PASSCODES[role]) return res.status(401).json({ error: 'That staff passcode is not right.' });
  const id = `${role}-${(name || role).trim().toLowerCase().replace(/\s+/g, '-')}`;
  const user = store.upsertUser({ id, role, name: name.trim() || (role === 'lecturer' ? 'Lecturer' : 'Tutor'), group: role === 'tutor' ? (store.GROUPS.includes(group) ? group : 'Group A') : null, consentAt: Date.now() });
  res.json({ token: store.createSession(user.id), user, consentNeeded: false });
});
app.post('/api/consent', auth, (req, res) => { store.upsertUser({ id: req.user.id, consentAt: Date.now() }); res.json({ ok: true }); });
app.post('/api/logout', auth, (req, res) => { store.endSession(req.token); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));
app.get('/api/me/profile', auth, (req, res) => res.json(studentProfile(req.user.id)));

// ---------- units ----------
app.get('/api/units', auth, (req, res) => {
  res.json(UNITS.map(u => ({
    id: u.id, track: u.track, title: u.title, summary: u.summary, minutes: u.minutes, advisory: !!u.advisory, outcomes: u.outcomes,
    mastery: unitMastery(req.user.id, u.id), unlocked: unitUnlocked(req.user.id, u.id, req.user.role),
  })));
});
app.get('/api/units/:id', auth, (req, res) => {
  const u = UNITS.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'No such unit.' });
  res.json({ ...u, mastery: unitMastery(req.user.id, u.id), unlocked: unitUnlocked(req.user.id, u.id, req.user.role) });
});
app.post('/api/units/:id/check/start', auth, (req, res) => {
  const u = UNITS.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'No such unit.' });
  if (!unitUnlocked(req.user.id, u.id, req.user.role)) return res.status(403).json({ error: 'Reach 80% on the previous unit\'s check to open this one.' });
  const attempt = store.checkAttemptCount(req.user.id, u.id) + 1;
  const qs = generateCheck(u.id, `${req.user.id}|${attempt}`);
  res.json({ attempt, startedAt: Date.now(), questions: publicCheck(qs) });
});
app.post('/api/units/:id/check/submit', auth, (req, res) => {
  const u = UNITS.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'No such unit.' });
  const { attempt, responses = {}, startedAt } = req.body || {};
  const qs = generateCheck(u.id, `${req.user.id}|${attempt}`);
  const results = qs.map(q => ({ id: q.id, ...gradeQuestion(q, responses[q.id]) }));
  const correct = results.filter(r => r.correct).length;
  const score = correct / results.length;
  const misconceptions = results.filter(r => r.misconception === 'one-direction').map(() => 'one-direction');
  store.recordCheck({ userId: req.user.id, unit: u.id, attempt, score, correct, total: results.length, misconceptions, seconds: startedAt ? Math.min(3600, Math.round((Date.now() - startedAt) / 1000)) : 0 });
  const idx = UNITS.findIndex(x => x.id === u.id);
  const next = UNITS[idx + 1];
  res.json({ results, correct, total: results.length, score, secure: score >= SECURE, mastery: unitMastery(req.user.id, u.id), nextUnlocked: next ? unitUnlocked(req.user.id, next.id, req.user.role) : null, next: next?.id || null });
});

// ---------- problems ----------
app.get('/api/problems', auth, (req, res) => {
  res.json(PROBLEMS.map(p => ({ id: p.id, title: p.title, level: p.level, unit: p.unit, outcomes: p.outcomes, ...problemStatus(req.user.id, p.id) })));
});
app.get('/api/problems/:id', auth, (req, res) => {
  const p = problemById(req.params.id);
  if (!p) return res.status(404).json({ error: 'No such problem.' });
  res.json({ ...publicProblem(p, req.user.id), customOk: CUSTOM_OK.includes(p.id), saved: store.savedCode(req.user.id, p.id) || null, status: problemStatus(req.user.id, p.id) });
});

const CUSTOM_OK = ['P3', 'P5', 'P6', 'P7', 'P8', 'P10'];
let running = 0;
const queue = [];
const MAX_PARALLEL = +(process.env.RUNNER_PARALLEL || 2);
const busy = new Set();
function withSlot(fn) {
  return new Promise((resolve, reject) => {
    const go = () => { running++; fn().then(resolve, reject).finally(() => { running--; const n = queue.shift(); if (n) n(); }); };
    if (running < MAX_PARALLEL) go(); else queue.push(go);
  });
}

app.post('/api/problems/:id/run', auth, async (req, res) => {
  const p = problemById(req.params.id);
  if (!p) return res.status(404).json({ error: 'No such problem.' });
  const { code = '', mode = 'visible', report = '', startedAt } = req.body || {};
  if (code.length > 60000) return res.status(400).json({ error: 'That file is too long.' });
  if (busy.has(req.user.id)) return res.status(429).json({ error: 'Your previous run is still going. Wait for it to finish.' });
  store.saveCode(req.user.id, p.id, code);
  const st = staticCheck(code, p);
  const submit = mode === 'submit';
  const attemptNo = store.problemAttemptCount(req.user.id, p.id) + 1;
  if (st.blocked) {
    const reasons = st.findings.filter(f => f.blocking).map(f => (f.id === 'java-util' ? 'it uses a java.util collection, which the study guide forbids' : f.id === 'class-name' ? `the class must be called ${f.detail}` : `it ${f.detail}, which is not allowed here`));
    const mis = detectMisconceptions(p, { phase: 'static' }, st.findings);
    if (submit) store.recordProblem({ userId: req.user.id, problemId: p.id, passed: 0, total: 0, allPassed: false, failedCategories: [], misconceptions: mis });
    return res.json({ phase: 'static', message: `Your code was not run because ${reasons.join('; ')}.`, misconceptions: mis.map(id => ({ id, title: MISCONCEPTIONS[id]?.title, hint: hintStep(id, 1).text })) });
  }
  let custom = null;
  if (mode === 'custom') {
    if (!CUSTOM_OK.includes(p.id)) return res.status(400).json({ error: 'This problem does not take a custom graph.' });
    const tok = String(req.body.input || '').trim().split(/\s+/).map(Number);
    const [n, m, d] = tok;
    const ok = Number.isInteger(n) && n >= 1 && n <= 25 && Number.isInteger(m) && m >= 0 && m <= 300 && (d === 0 || d === 1) && tok.length >= 3 + 2 * m && tok.slice(3, 3 + 2 * m).every(x => Number.isInteger(x) && x >= 0 && x < n);
    if (!ok) return res.status(400).json({ error: 'Use the test format: "n m d" on the first line, then one "u v" edge per line, with 1 to 25 vertices.' });
    const text = `${n} ${m} ${d}\n` + Array.from({ length: m }, (_, e) => `${tok[3 + 2 * e]} ${tok[4 + 2 * e]}`).join('\n') + (m ? '\n' : '') + (p.id === 'P5' ? '0\n' : '');
    custom = [{ category: 'your graph', input: text, visible: true, expected: p.reference(text) }];
  }
  busy.add(req.user.id);
  try {
    const tests = custom || buildTests(p, `${req.user.id}|${attemptNo}`, { includeHidden: submit });
    const run = await withSlot(() => runJava(p, code, tests));
    if (run.phase === 'compile') {
      if (submit) store.recordProblem({ userId: req.user.id, problemId: p.id, passed: 0, total: tests.length, allPassed: false, failedCategories: ['compile'], misconceptions: [] });
      return res.json({ phase: 'compile', compileErrors: run.compileErrors });
    }
    const mis = detectMisconceptions(p, run, st.findings);
    const cases = run.cases.map(c => c.visible
      ? { visible: true, category: c.category, categoryLabel: categoryLabel(c.category), passed: c.passed, status: c.status, exception: c.exception, input: c.input, expected: c.expected, output: c.output, formatOnly: c.formatOnly }
      : { visible: false, category: c.category, categoryLabel: categoryLabel(c.category), passed: c.passed, status: c.status, exception: c.exception, timing: c.timing, output: c.timing ? c.output : undefined });
    const scored = run.cases.filter(c => !c.timing);
    const passed = scored.filter(c => c.passed).length;
    const allPassed = passed === scored.length && run.cases.every(c => c.passed);
    const failedCategories = [...new Set(run.cases.filter(c => !c.passed).map(c => c.category))];
    let rubric = null;
    if (p.report && submit) rubric = rubricCheck(report, P11_RUBRIC);
    if (submit) store.recordProblem({ userId: req.user.id, problemId: p.id, passed, total: scored.length, allPassed, failedCategories, misconceptions: allPassed ? [] : mis, seconds: startedAt ? Math.min(3600, Math.round((Date.now() - startedAt) / 1000)) : 0 });
    res.json({
      phase: 'run', submit, passed, total: scored.length, allPassed, cases, failedCategories,
      misconceptions: allPassed ? [] : mis.map(id => ({ id, title: MISCONCEPTIONS[id]?.title, hint: hintStep(id, 1, failedCategories[0]).text })),
      rubric,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'The Java runner failed. Please try again.' });
  } finally { busy.delete(req.user.id); }
});

app.post('/api/problems/:id/hint', auth, (req, res) => {
  const p = problemById(req.params.id);
  const { misconception, category, level = 2 } = req.body || {};
  if (!p || !MISCONCEPTIONS[misconception]) return res.status(400).json({ error: 'Unknown hint.' });
  const lv = Math.max(1, Math.min(3, +level));
  store.recordHint({ userId: req.user.id, problemId: p.id, misconception, level: lv });
  res.json(hintStep(misconception, lv, category));
});

// ---------- chatbot ----------
app.post('/api/chat', auth, (req, res) => {
  const { text = '', graph = null, context = null } = req.body || {};
  const reply = chatAnswer(String(text).slice(0, 500), { graph, context });
  // stored without any user id: lecturers see what is asked, never who asked it
  store.recordChat({ text: String(text).slice(0, 300), cardId: reply.cardId || null, kind: reply.kind, answered: !['fallback', 'offtopic'].includes(reply.kind) });
  res.json(reply);
});

// ---------- lecturer dashboard ----------
const range = q => ({ from: q.from ? +q.from : null, to: q.to ? +q.to : null, group: q.group || 'all' });
app.get('/api/dashboard/questions', auth, staffOnly, (req, res) => res.json(mostAsked(range(req.query))));
app.get('/api/dashboard/class', auth, staffOnly, (req, res) => res.json(classOverview(req.user, range(req.query))));
app.get('/api/dashboard/struggle', auth, staffOnly, (req, res) => res.json(struggleMap(req.user, range(req.query))));
app.get('/api/dashboard/students', auth, staffOnly, (req, res) => res.json(studentsVisibleTo(req.user, req.query.group).map(s => ({ id: s.id, name: s.name, group: s.group }))));
app.get('/api/dashboard/student/:id', auth, staffOnly, (req, res) => {
  const visible = studentsVisibleTo(req.user).some(s => s.id === req.params.id);
  if (!visible) return res.status(403).json({ error: 'This student is not in your group.' });
  res.json(studentProfile(req.params.id));
});
app.get('/api/dashboard/export', auth, staffOnly, (req, res) => {
  const view = req.query.view || 'struggle';
  let rows;
  if (view === 'struggle') {
    const m = struggleMap(req.user, range(req.query));
    rows = [['student', 'name', 'group', ...m.units.map(u => u.id)], ...m.rows.map(r => [r.id, r.name, r.group, ...r.levels])];
  } else if (view === 'questions') {
    const q = mostAsked(range(req.query));
    rows = [['question', 'topic', 'asks', 'trend'], ...q.top.map(t => [t.question, t.group, t.count, t.trend]), [], ['unanswered question', 'asked'], ...q.unanswered.map(u => [u.text, new Date(u.ts).toISOString()])];
  } else {
    const c = classOverview(req.user, range(req.query));
    rows = [['item', 'title', 'attempted', 'secure or passed', 'rate'], ...c.units.map(u => [u.id, u.title, u.attempted, u.secure, u.passRate ?? '']), ...c.problems.map(p => [p.id, p.title, p.attempted, p.passed, p.passRate ?? '']), [], ['outcome', 'rate'], ...c.outcomes.map(o => [o.outcome, o.rate ?? ''])];
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="cos212-${view}.csv"`);
  res.send(toCsv(rows));
});
app.post('/api/admin/clear-demo', auth, (req, res) => { if (req.user.role !== 'lecturer') return res.status(403).end(); clearDemo(); res.json({ ok: true }); });

// ---------- static client ----------
const dist = path.resolve(__dirname, '../../client/dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = +(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Graph app API on http://localhost:${PORT}`));
