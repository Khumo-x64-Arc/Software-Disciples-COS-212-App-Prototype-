// Mastery levels, student profiles and the lecturer dashboard views.
import { getDb } from './store.js';
import { UNITS } from './units.js';
import { PROBLEMS } from './problems.js';
import { MISCONCEPTIONS, categoryLabel } from './feedback.js';
import { CARDS } from './chatbot.js';

export const SECURE = 0.8;
const UNIT_IDS = UNITS.map(u => u.id);

/** Mastery rule (proposed in the design doc):
 *  not started: no attempts · secure: best check ≥ 80% · struggling: 3+ attempts below 80%,
 *  or the same misconception matched 3+ times in that unit · developing: everything else. */
export function unitMastery(userId, unitId) {
  const db = getDb();
  const checks = db.checkAttempts.filter(a => a.userId === userId && a.unit === unitId);
  const probs = db.problemAttempts.filter(a => a.userId === userId && PROBLEMS.find(p => p.id === a.problemId)?.unit === unitId);
  const best = checks.reduce((m, a) => Math.max(m, a.score), 0);
  const misCounts = {};
  for (const a of [...probs, ...checks]) for (const m of a.misconceptions || []) misCounts[m] = (misCounts[m] || 0) + 1;
  const repeated = Object.entries(misCounts).filter(([, c]) => c >= 3).map(([m]) => m);
  if (!checks.length && !probs.length) return { level: 'not-started', best: null, attempts: 0, repeated };
  if (best >= SECURE) return { level: 'secure', best, attempts: checks.length, repeated };
  const below = checks.filter(a => a.score < SECURE).length;
  if (below >= 3 || repeated.length) return { level: 'struggling', best, attempts: checks.length, repeated };
  return { level: 'developing', best: checks.length ? best : null, attempts: checks.length, repeated };
}

export function problemStatus(userId, pid) {
  const atts = getDb().problemAttempts.filter(a => a.userId === userId && a.problemId === pid);
  if (!atts.length) return { status: 'not-started', attempts: 0 };
  const passed = atts.some(a => a.allPassed);
  const last = atts[atts.length - 1];
  return {
    status: passed ? 'passed' : 'failing', attempts: atts.length, best: Math.max(...atts.map(a => a.passed / Math.max(a.total, 1))),
    lastFailedCategories: (last.failedCategories || []).map(categoryLabel), misconceptions: [...new Set(atts.flatMap(a => a.misconceptions || []))],
  };
}

export function unitUnlocked(userId, unitId, role) {
  if (role !== 'student') return true;
  const i = UNIT_IDS.indexOf(unitId);
  if (i <= 1) return true; // U0 is advisory, U1 always open
  return unitMastery(userId, UNIT_IDS[i - 1]).level === 'secure';
}

export function studentProfile(userId) {
  const db = getDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return null;
  const units = UNITS.map(u => ({ id: u.id, title: u.title, ...unitMastery(userId, u.id) }));
  const problems = PROBLEMS.map(p => ({ id: p.id, title: p.title, unit: p.unit, ...problemStatus(userId, p.id) }));
  const misCount = {};
  for (const a of db.problemAttempts.filter(a => a.userId === userId)) for (const m of a.misconceptions || []) misCount[m] = (misCount[m] || 0) + 1;
  const misconceptions = Object.entries(misCount).sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, title: MISCONCEPTIONS[id]?.title || id, count, unit: MISCONCEPTIONS[id]?.pointsTo?.unit }));
  const hints = db.hintEvents.filter(h => h.userId === userId);
  const maxHint = hints.reduce((m, h) => Math.max(m, h.level), 0);
  const acts = [...db.checkAttempts, ...db.problemAttempts, ...db.hintEvents].filter(a => a.userId === userId);
  const lastActive = acts.reduce((m, a) => Math.max(m, a.ts), 0) || null;
  const timeMin = Math.round(acts.reduce((s, a) => s + (a.seconds || 0), 0) / 60);
  const struggling = units.filter(u => u.level === 'struggling');
  const followUp = [];
  for (const u of struggling) {
    const mis = misconceptions.find(m => m.unit === u.id);
    followUp.push(`Tutor check-in on ${u.id} ${u.title}${mis ? `: ${mis.title.charAt(0).toLowerCase()}${mis.title.slice(1)}` : ''}.`);
  }
  const failing = problems.filter(p => p.status === 'failing' && p.attempts >= 3);
  for (const p of failing.slice(0, 2)) followUp.push(`${p.id} has failed ${p.attempts} times${p.lastFailedCategories.length ? ` on ${p.lastFailedCategories.map(categoryLabel).join(', ')}` : ''}: replay the matching Build a graph demo together.`);
  return {
    id: user.id, name: user.name, group: user.group, demo: !!user.demo,
    units, problems, misconceptions, maxHintLevel: maxHint, lastActive, timeMinutes: timeMin,
    counts: { secure: units.filter(u => u.level === 'secure').length, developing: units.filter(u => u.level === 'developing').length, struggling: struggling.length, notStarted: units.filter(u => u.level === 'not-started').length },
    followUp: followUp.length ? followUp : ['No follow-up needed right now.'],
  };
}

function inRange(ts, from, to) { return (!from || ts >= from) && (!to || ts <= to); }

export function studentsVisibleTo(viewer, group) {
  let s = getDb().users.filter(u => u.role === 'student');
  if (viewer.role === 'tutor') s = s.filter(u => u.group === viewer.group);
  if (group && group !== 'all') s = s.filter(u => u.group === group);
  return s;
}

export function mostAsked({ from, to }) {
  const chats = getDb().chats;
  const span = (to || Date.now()) - (from || 0);
  const cur = chats.filter(c => inRange(c.ts, from, to));
  const prev = from ? chats.filter(c => inRange(c.ts, from - span, from - 1)) : [];
  const count = arr => arr.reduce((m, c) => { if (c.cardId) m[c.cardId] = (m[c.cardId] || 0) + 1; return m; }, {});
  const now = count(cur), before = count(prev);
  const top = Object.entries(now).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
    const card = CARDS.find(c => c.id === id);
    const b = before[id] || 0;
    return { cardId: id, question: card?.title || id, group: card?.group, unit: card?.unit, count: n, trend: !from ? 'flat' : n > b ? 'up' : n < b ? 'down' : 'flat', previous: b };
  });
  const byGroup = {};
  for (const t of top) byGroup[t.group] = (byGroup[t.group] || 0) + t.count;
  const unanswered = cur.filter(c => !c.answered && c.kind !== 'offtopic').map(c => ({ text: c.text, ts: c.ts })).reverse().slice(0, 50);
  const graphQuestions = cur.filter(c => c.kind === 'graph').length;
  return { total: cur.length, top, byGroup, unanswered, graphQuestions };
}

export function classOverview(viewer, { group, from, to }) {
  const db = getDb();
  const students = studentsVisibleTo(viewer, group);
  const ids = new Set(students.map(s => s.id));
  const units = UNITS.map(u => {
    const levels = students.map(s => unitMastery(s.id, u.id).level);
    const attempted = levels.filter(l => l !== 'not-started').length;
    return { id: u.id, title: u.title, attempted, secure: levels.filter(l => l === 'secure').length, struggling: levels.filter(l => l === 'struggling').length, passRate: attempted ? levels.filter(l => l === 'secure').length / attempted : null };
  });
  const problems = PROBLEMS.map(p => {
    const atts = db.problemAttempts.filter(a => a.problemId === p.id && ids.has(a.userId) && inRange(a.ts, from, to));
    const who = new Set(atts.map(a => a.userId));
    const passed = new Set(atts.filter(a => a.allPassed).map(a => a.userId));
    return { id: p.id, title: p.title, attempted: who.size, passed: passed.size, passRate: who.size ? passed.size / who.size : null };
  });
  const misCount = {};
  for (const a of db.problemAttempts.filter(a => ids.has(a.userId) && inRange(a.ts, from, to))) for (const m of new Set(a.misconceptions || [])) misCount[m] = (misCount[m] || 0) + 1;
  const misconceptions = Object.entries(misCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, title: MISCONCEPTIONS[id]?.title || id, count: n, unit: MISCONCEPTIONS[id]?.pointsTo?.unit }));
  const outcomeMap = {};
  for (const u of UNITS) for (const o of u.outcomes) (outcomeMap[o] ||= { units: new Set(), problems: new Set() }).units.add(u.id);
  for (const p of PROBLEMS) for (const o of p.outcomes) (outcomeMap[o] ||= { units: new Set(), problems: new Set() }).problems.add(p.id);
  const outcomes = Object.entries(outcomeMap).map(([o, m]) => {
    const rates = [...units.filter(u => m.units.has(u.id)).map(u => u.passRate), ...problems.filter(p => m.problems.has(p.id)).map(p => p.passRate)].filter(r => r !== null);
    return { outcome: o, rate: rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null, units: [...m.units], problems: [...m.problems] };
  }).sort((a, b) => a.outcome.localeCompare(b.outcome));
  return { students: students.length, units, problems, misconceptions, outcomes };
}

export function struggleMap(viewer, { group }) {
  const students = studentsVisibleTo(viewer, group);
  const rows = students.map(s => ({ id: s.id, name: s.name, group: s.group, demo: !!s.demo, levels: UNITS.map(u => unitMastery(s.id, u.id).level) }));
  const needsHelp = rows.filter(r => r.levels.includes('struggling')).map(r => ({ id: r.id, name: r.name, units: UNITS.filter((u, i) => r.levels[i] === 'struggling').map(u => u.id) }));
  rows.sort((a, b) => b.levels.filter(l => l === 'struggling').length - a.levels.filter(l => l === 'struggling').length || a.id.localeCompare(b.id));
  return { units: UNITS.map(u => ({ id: u.id, title: u.title })), rows, needsHelp };
}

export function toCsv(rows) {
  const esc = v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return rows.map(r => r.map(esc).join(',')).join('\n') + '\n';
}
