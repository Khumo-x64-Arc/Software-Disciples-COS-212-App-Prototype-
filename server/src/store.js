// Small JSON-file data store. Fine for a pilot; swap for a database (e.g. PostgreSQL) in production.
// Chat records hold no user id: lecturers can see what is asked, never who asked it.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'db.json');

const empty = () => ({ users: [], sessions: {}, checkAttempts: [], problemAttempts: [], hintEvents: [], chats: [], code: {}, demo: false });
let db = empty();
if (existsSync(FILE)) { try { db = { ...empty(), ...JSON.parse(readFileSync(FILE, 'utf8')) }; } catch { db = empty(); } }

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE + '.tmp', JSON.stringify(db));
    renameSync(FILE + '.tmp', FILE);
  }, 200);
}
export const getDb = () => db;
export function resetDb() { db = empty(); save(); }

export const GROUPS = ['Group A', 'Group B', 'Group C', 'Group D'];
export function groupFor(studentNumber) {
  let h = 0; for (const ch of studentNumber) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GROUPS[h % GROUPS.length];
}

export function upsertUser(u) {
  let user = db.users.find(x => x.id === u.id);
  if (!user) { user = { createdAt: Date.now(), ...u }; db.users.push(user); }
  else Object.assign(user, u);
  save();
  return user;
}
export const userById = id => db.users.find(u => u.id === id);

export function createSession(userId) {
  const token = randomBytes(24).toString('hex');
  db.sessions[token] = { userId, createdAt: Date.now() };
  save();
  return token;
}
export function sessionUser(token) {
  const s = token && db.sessions[token];
  return s ? userById(s.userId) : null;
}
export function endSession(token) { delete db.sessions[token]; save(); }

export function recordCheck(a) { db.checkAttempts.push({ ts: Date.now(), ...a }); save(); }
export function recordProblem(a) { db.problemAttempts.push({ ts: Date.now(), ...a }); save(); }
export function recordHint(h) { db.hintEvents.push({ ts: Date.now(), ...h }); save(); }
export function recordChat(c) { db.chats.push({ ts: Date.now(), ...c }); save(); }
export function saveCode(userId, problemId, code) { db.code[`${userId}|${problemId}`] = code; save(); }
export const savedCode = (userId, problemId) => db.code[`${userId}|${problemId}`];
export function checkAttemptCount(userId, unit) { return db.checkAttempts.filter(a => a.userId === userId && a.unit === unit).length; }
export function problemAttemptCount(userId, pid) { return db.problemAttempts.filter(a => a.userId === userId && a.problemId === pid).length; }
