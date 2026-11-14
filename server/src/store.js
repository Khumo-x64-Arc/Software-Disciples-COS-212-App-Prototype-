// A JSON-file data store: fine for a pilot. For production, move these tables
// to Postgres; the shapes map one-to-one.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { LEGACY_IDS, currentId } from '../../shared/units.mjs';

const EMPTY = () => ({
  users: [],
  sessions: {},
  progress: {},
  checks: [],
  submissions: [],
  code: {},
  hints: {},
  solutions: {}, // userId -> { problemId: true } once the model answer has been shown
  chats: [], // anonymous: no user id is ever stored with a chat question
});

/** Renames old lesson ids (U5–U8) to the current ones (L9–L12) in a progress record. */
export function migrateProgress(p) {
  if (!p || typeof p !== 'object') return p;
  const keys = obj => (obj && typeof obj === 'object' ? Object.fromEntries(Object.entries(obj).map(([k, v]) => [currentId(k), v])) : obj);
  const reward = k => k.replace(/^(q|lesson):(U[5-8])(?=:|$)/, (_, kind, id) => `${kind}:${LEGACY_IDS[id]}`);
  const out = { ...p, done: keys(p.done), quizBest: keys(p.quizBest), timeSpent: keys(p.timeSpent), unitNotes: keys(p.unitNotes), answerLog: keys(p.answerLog) };
  if (p.rewards?.awarded) out.rewards = { ...p.rewards, awarded: Object.fromEntries(Object.entries(p.rewards.awarded).map(([k, v]) => [reward(k), v])) };
  for (const k of ['done', 'quizBest', 'timeSpent', 'unitNotes', 'answerLog']) if (out[k] === undefined) delete out[k];
  return out;
}

/** Brings a saved database up to date with the current lesson ids. */
export function migrate(db) {
  for (const c of db.checks) c.unit = currentId(c.unit);
  for (const c of db.chats) if (c.unit) c.unit = currentId(c.unit);
  for (const id of Object.keys(db.progress)) db.progress[id] = migrateProgress(db.progress[id]);
  return db;
}

export function createStore(file) {
  let db = load();

  function load() {
    try {
      return migrate({ ...EMPTY(), ...JSON.parse(fs.readFileSync(file, 'utf8')) });
    } catch {
      return EMPTY();
    }
  }
  let timer = null;
  function save() {
    // Debounced, atomic write.
    clearTimeout(timer);
    timer = setTimeout(flush, 50);
  }
  function flush() {
    clearTimeout(timer);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, file);
  }
  const now = () => new Date().toISOString();
  const row = obj => ({ id: crypto.randomUUID(), createdAt: now(), ...obj });

  return {
    flush,
    replaceAll(data) {
      db = migrate({ ...EMPTY(), ...data });
      flush();
    },
    raw: () => db,

    upsertUser({ name, studentNumber, role, group }) {
      let u = db.users.find(x => x.studentNumber === studentNumber && x.role === role);
      if (!u) {
        u = row({ name, studentNumber, role, group: group ?? null, consentAt: null });
        db.users.push(u);
      } else {
        u.name = name;
        if (group) u.group = group;
      }
      save();
      return u;
    },
    /** A guest: no name or student number is stored, just an anonymous id. */
    createGuest() {
      const u = row({ name: 'Guest', studentNumber: `guest:${crypto.randomBytes(4).toString('hex')}`, role: 'student', group: null, guest: true, consentAt: null });
      db.users.push(u);
      save();
      return u;
    },
    /** Moves a guest's work into a signed-in account, then deletes the guest. */
    mergeGuest(guestId, userId) {
      const g = db.users.find(u => u.id === guestId && u.guest);
      if (!g || guestId === userId) return;
      for (const c of db.checks) if (c.userId === guestId) c.userId = userId;
      for (const x of db.submissions) if (x.userId === guestId) x.userId = userId;
      for (const table of ['code', 'hints', 'solutions']) {
        if (db[table][guestId]) db[table][userId] = { ...db[table][guestId], ...(db[table][userId] ?? {}) };
        delete db[table][guestId];
      }
      const gp = db.progress[guestId];
      if (gp) {
        const up = db.progress[userId] ?? {};
        db.progress[userId] = {
          ...gp,
          ...up,
          rewards: { awarded: { ...(gp.rewards?.awarded ?? {}), ...(up.rewards?.awarded ?? {}) } },
          done: { ...(gp.done ?? {}), ...(up.done ?? {}) },
          updatedAt: now(),
        };
        delete db.progress[guestId];
      }
      for (const [t, sess] of Object.entries(db.sessions)) if (sess.userId === guestId) delete db.sessions[t];
      db.users = db.users.filter(u => u.id !== guestId);
      save();
    },
    user: id => db.users.find(u => u.id === id) ?? null,
    students: () => db.users.filter(u => u.role === 'student'),
    consent(id) {
      const u = db.users.find(x => x.id === id);
      if (u) u.consentAt = now();
      save();
      return u;
    },

    newSession(userId) {
      const token = crypto.randomBytes(24).toString('hex');
      db.sessions[token] = { userId, createdAt: now() };
      save();
      return token;
    },
    sessionUser(token) {
      const s = db.sessions[token];
      return s ? db.users.find(u => u.id === s.userId) ?? null : null;
    },
    endSession(token) {
      delete db.sessions[token];
      save();
    },

    progress: userId => db.progress[userId] ?? null,
    saveProgress(userId, p) {
      db.progress[userId] = { ...migrateProgress(p), updatedAt: now() };
      save();
      return db.progress[userId];
    },

    addCheck(userId, c) {
      const r = row({ userId, ...c });
      db.checks.push(r);
      save();
      return r;
    },
    checksFor: userId => db.checks.filter(c => c.userId === userId),
    allChecks: () => db.checks,

    addSubmission(userId, s) {
      const r = row({ userId, ...s });
      db.submissions.push(r);
      save();
      return r;
    },
    submissionsFor: (userId, problem) => db.submissions.filter(s => s.userId === userId && (!problem || s.problem === problem)),
    allSubmissions: () => db.submissions,

    code: (userId, pid) => db.code[userId]?.[pid] ?? null,
    saveCode(userId, pid, code) {
      db.code[userId] = { ...(db.code[userId] ?? {}), [pid]: code };
      save();
    },
    hintLevel: (userId, pid) => db.hints[userId]?.[pid] ?? 0,
    setHintLevel(userId, pid, level) {
      db.hints[userId] = { ...(db.hints[userId] ?? {}), [pid]: level };
      save();
    },
    allHints: () => db.hints,
    solutionSeen: (userId, pid) => Boolean(db.solutions[userId]?.[pid]),
    markSolutionSeen(userId, pid) {
      db.solutions[userId] = { ...(db.solutions[userId] ?? {}), [pid]: true };
      save();
    },

    addChat(c) {
      db.chats.push(row(c));
      save();
    },
    allChats: () => db.chats,
  };
}
