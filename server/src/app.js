import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { answer as helperAnswer } from '../../shared/graph-helper.mjs';
import { EXAM, UNITS, currentId, masteryLevel, MASTERY_THRESHOLD } from '../../shared/units.mjs';
import { VIDEOS } from '../../shared/videos.mjs';
import { dashboard, exportCsv, studentProfile } from './dashboard.js';
import { grade } from './grader.js';
import { runJava, staticCheck } from './javaRunner.js';
import { booleanMatrix, matrixText, parseText, warshall } from '../../shared/graph-core.mjs';
import { PROBLEMS, problemById, solutionFor, testsFor } from './problems.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(here, '..', '..', 'client', 'dist');
const STAFF_CODE = process.env.STAFF_CODE ?? 'cos212-staff';
const GROUPS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];

const isText = (v, max = 100) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const studentNo = /^u?\d{8}$/i;

export function createApp(store, { javaReady = Promise.resolve(true) } = {}) {
  const app = express();
  app.use(express.json({ limit: '300kb' }));

  app.get('/api/health', async (_req, res) => res.json({ ok: true, java: await javaReady }));

  // ---------- sign-in is optional: anyone can start as a guest ----------

  const bearer = req => /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? null;

  app.post('/api/guest', (_req, res) => {
    const user = store.createGuest();
    res.status(201).json({ token: store.newSession(user.id), user });
  });

  // A stand-in for UP single sign-on. A guest who signs in keeps their points and work.
  app.post('/api/login', (req, res) => {
    const { name, studentNumber, group } = req.body ?? {};
    if (!isText(name, 80) || !isText(studentNumber, 12) || !studentNo.test(studentNumber.trim())) {
      return res.status(400).json({ error: 'Enter your name and your 8-digit student number, for example u21000001.' });
    }
    const sn = studentNumber.trim().toLowerCase().replace(/^(?!u)/, 'u');
    const user = store.upsertUser({ name: name.trim(), studentNumber: sn, role: 'student', group: GROUPS.includes(group) ? group : null });
    const prev = bearer(req) ? store.sessionUser(bearer(req)) : null;
    if (prev?.guest) store.mergeGuest(prev.id, user.id);
    res.json({ token: store.newSession(user.id), user });
  });

  app.post('/api/staff/login', (req, res) => {
    const { name, code, role, group } = req.body ?? {};
    if (!isText(name, 80) || code !== STAFF_CODE || !['lecturer', 'tutor'].includes(role)) return res.status(403).json({ error: 'Staff sign-in failed: check the staff code.' });
    if (role === 'tutor' && !GROUPS.includes(group)) return res.status(400).json({ error: 'Tutors must choose their tutorial group.' });
    const user = store.upsertUser({ name: name.trim(), studentNumber: `staff:${name.trim().toLowerCase()}`, role, group: role === 'tutor' ? group : null });
    res.json({ token: store.newSession(user.id), user });
  });

  const auth = (req, res, next) => {
    const token = bearer(req);
    const user = token ? store.sessionUser(token) : null;
    if (!user) return res.status(401).json({ error: 'Please sign in again.' });
    req.user = user;
    req.token = token;
    next();
  };
  const staff = (req, res, next) => (['lecturer', 'tutor'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Staff only.' }));

  app.post('/api/logout', auth, (req, res) => {
    store.endSession(req.token);
    res.json({ ok: true });
  });

  app.post('/api/me/consent', auth, (req, res) => res.json({ user: store.consent(req.user.id) }));

  const masteryFor = userId => {
    const checks = store.checksFor(userId);
    return Object.fromEntries(
      UNITS.map(u => {
        const att = checks.filter(c => c.unit === u.id);
        return [u.id, { attempts: att.length, best: att.length ? Math.max(...att.map(a => a.score)) : 0, level: masteryLevel(att) }];
      }),
    );
  };

  /** The final exam (bonus quest): attempts and best score. */
  const examFor = userId => {
    const att = store.checksFor(userId).filter(c => c.unit === EXAM.id);
    return { attempts: att.length, best: att.length ? Math.max(...att.map(a => a.score)) : null, passed: att.some(a => a.score >= EXAM.passMark) };
  };

  app.get('/api/me', auth, (req, res) => {
    res.json({ user: req.user, progress: store.progress(req.user.id), mastery: masteryFor(req.user.id), exam: examFor(req.user.id), threshold: MASTERY_THRESHOLD });
  });

  app.put('/api/me/progress', auth, (req, res) => {
    const p = req.body?.progress;
    if (!p || typeof p !== 'object') return res.status(400).json({ error: 'progress must be an object' });
    res.json({ progress: store.saveProgress(req.user.id, p) });
  });

  // ---------- unit checks (questions are generated and marked in the app) ----------

  app.post('/api/checks', auth, (req, res) => {
    const { correct, total, misconceptions } = req.body ?? {};
    const unit = typeof req.body?.unit === 'string' ? currentId(req.body.unit) : null;
    if (!(UNITS.some(u => u.id === unit) || unit === EXAM.id) || !Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
      return res.status(400).json({ error: 'unit, correct and total are required' });
    }
    const score = Math.round((100 * correct) / total);
    store.addCheck(req.user.id, { unit, correct, total, score, passed: score >= (unit === EXAM.id ? EXAM.passMark : MASTERY_THRESHOLD), misconceptions: Array.isArray(misconceptions) ? misconceptions.slice(0, 20).map(String) : [] });
    res.status(201).json({ score, passed: score >= (unit === EXAM.id ? EXAM.passMark : MASTERY_THRESHOLD), mastery: masteryFor(req.user.id), exam: examFor(req.user.id) });
  });

  // ---------- test section: Java problems ----------

  const publicProblem = (p, userId) => ({
    id: p.id, title: p.title, level: p.level, unit: p.unit, outcomes: p.outcomes, className: p.className,
    task: p.task, api: p.api, starter: p.starter,
    samples: testsFor(p, userId).filter(t => t.visible).map(t => ({ input: t.input, expected: t.expected })),
  });

  const problemState = (userId, p) => {
    const subs = store.submissionsFor(userId, p.id);
    const failed = subs.filter(s => !s.passed).length;
    const level = store.hintLevel(userId, p.id);
    return {
      code: store.code(userId, p.id) ?? p.starter,
      attempts: subs.length,
      failedAttempts: failed,
      passed: subs.some(s => s.passed),
      hintLevel: level,
      hintAvailable: level < p.hints.length,
      hints: p.hints.slice(0, level),
      // The full model answer, once a submission has been wrong.
      solution: store.solutionSeen(userId, p.id) ? solutionFor(p) : null,
    };
  };

  app.get('/api/problems', auth, (req, res) => {
    res.json({ problems: PROBLEMS.map(p => ({ ...publicProblem(p, req.user.id), state: problemState(req.user.id, p) })) });
  });

  app.post('/api/problems/:id/submit', auth, async (req, res) => {
    const p = problemById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Unknown problem' });
    const { code } = req.body ?? {};
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'code is required' });
    if (!(await javaReady)) return res.status(503).json({ error: 'Java is not installed on the server, so code cannot be marked right now.' });
    store.saveCode(req.user.id, p.id, code);
    try {
      const result = await grade(p.id, code, req.user.id);
      // A wrong answer shows the full code solution straight away.
      if (!result.passed) {
        result.solution = solutionFor(p);
        store.markSolutionSeen(req.user.id, p.id);
      }
      store.addSubmission(req.user.id, {
        problem: p.id,
        status: result.status,
        passed: result.passed,
        passedCount: result.passedCount ?? null,
        total: result.total ?? null,
        failedCaseTypes: result.failedCaseTypes ?? [],
        misconception: result.misconception?.id ?? null,
      });
      res.json({ result, state: problemState(req.user.id, p) });
    } catch (err) {
      res.status(500).json({ error: `Marking failed: ${String(err.message ?? err)}` });
    }
  });

  // Hand-off from Build a graph: run your code on your own exported graph.
  app.post('/api/problems/:id/try', auth, async (req, res) => {
    const p = problemById(req.params.id);
    if (!p || !['P5', 'P6', 'P7', 'P9'].includes(p.id)) return res.status(400).json({ error: 'Custom graphs can be tried on P5, P6, P7 and P9.' });
    const { code, input } = req.body ?? {};
    if (typeof code !== 'string' || typeof input !== 'string' || input.length > 5000) return res.status(400).json({ error: 'code and input are required' });
    let expected;
    try {
      const g = parseText(input);
      const r = warshall(booleanMatrix(g));
      if (p.id === 'P7') {
        const m = booleanMatrix(g);
        expected = '';
        for (let k = 0; k < m.length; k++) {
          for (let i = 0; i < m.length; i++) if (m[i][k]) for (let j = 0; j < m.length; j++) if (m[k][j]) m[i][j] = 1;
          expected += `k = ${k}\n` + matrixText(m);
        }
      } else expected = matrixText(r);
    } catch (e) {
      return res.status(400).json({ error: `That input is not in the test format: ${e.message}` });
    }
    if (!(await javaReady)) return res.status(503).json({ error: 'Java is not installed on the server.' });
    const issues = staticCheck(code, p.className);
    if (issues.length) return res.json({ issues });
    const r = await runJava({ className: p.className, code, harness: p.harness(), tests: [{ input }] });
    if (!r.compiled) return res.json({ compileErrors: r.compileErrors });
    const out = r.results[0];
    res.json({ status: out.status, actual: out.actual, expected, passed: out.status === 'OK' && out.actual === expected });
  });

  app.post('/api/problems/:id/hint', auth, (req, res) => {
    const p = problemById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Unknown problem' });
    const st = problemState(req.user.id, p);
    if (!st.hintAvailable) return res.status(409).json({ error: 'You have every hint for this problem.', state: st });
    store.setHintLevel(req.user.id, p.id, st.hintLevel + 1);
    res.json({ state: problemState(req.user.id, p) });
  });

  // ---------- Videos ----------
  // Titles and channels come from YouTube's public oEmbed endpoint, cached for a day.
  // If YouTube cannot be reached, the page still shows each thumbnail and link.
  const videoInfo = new Map();
  async function lookUp(v) {
    const hit = videoInfo.get(v.id);
    if (hit && Date.now() - hit.at < 86400000) return hit.info;
    let info = null;
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(v.watchUrl)}`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const j = await r.json();
        info = { title: String(j.title ?? ''), channel: String(j.author_name ?? '') };
      }
    } catch {
      info = null;
    }
    if (info) videoInfo.set(v.id, { at: Date.now(), info });
    return info;
  }
  app.get('/api/videos', auth, async (req, res) => {
    const list = await Promise.all(VIDEOS.map(async v => ({ ...v, ...((await lookUp(v)) ?? { title: null, channel: null }) })));
    res.json({ videos: list });
  });

  // ---------- Graph Helper ----------

  app.post('/api/chat', auth, (req, res) => {
    const { message, context } = req.body ?? {};
    if (typeof message !== 'string') return res.status(400).json({ error: 'message must be a string' });
    const ctx = context && typeof context === 'object' ? { ...context } : {};
    // Hints go up one rung at a time: the ones already opened, plus the next.
    ctx.problemHints = Object.fromEntries(PROBLEMS.map(p => [p.id, p.hints.slice(0, store.hintLevel(req.user.id, p.id) + 1)]));
    const named = /\bp([1-9])\b/i.exec(message)?.[0].toUpperCase();
    const pid = named ?? (typeof ctx.problem?.id === 'string' ? ctx.problem.id : null);
    ctx.problem = pid && problemById(pid) ? { id: pid, hintLevel: store.hintLevel(req.user.id, pid) } : null;
    const result = helperAnswer(message, ctx);
    // A hint given in chat counts on the problem's hint ladder.
    if (result.layer === 'guard' && result.problem) {
      const cur = store.hintLevel(req.user.id, result.problem);
      if (result.hintLevel > cur) store.setHintLevel(req.user.id, result.problem, result.hintLevel);
    }
    // Stored without the user, as the design requires.
    store.addChat({ message: message.slice(0, 400), layer: result.layer, cardId: result.cardId ?? null, unit: typeof ctx.unit === 'string' ? ctx.unit : null });
    res.json(result);
  });

  // ---------- lecturer dashboard ----------

  app.get('/api/dashboard', auth, staff, (req, res) => res.json(dashboard(store, req.user, req.query)));

  app.get('/api/dashboard/students/:id', auth, staff, (req, res) => {
    const p = studentProfile(store, req.user, req.params.id, req.query);
    if (p === 'forbidden') return res.status(403).json({ error: 'Tutors can only see their own group.' });
    if (!p) return res.status(404).json({ error: 'Unknown student' });
    res.json(p);
  });

  app.get('/api/dashboard/export.csv', auth, staff, (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cos212-${req.query.view ?? 'struggle'}.csv"`);
    res.send(exportCsv(store, req.user, req.query));
  });

  // ---------- serve the built React app ----------
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }
  return app;
}

export { GROUPS };
