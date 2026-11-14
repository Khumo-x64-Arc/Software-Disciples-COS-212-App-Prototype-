// Lecturer dashboard (design doc, "Lecturer dashboard"): built only from what
// the app already records. Chat questions are anonymous; everything else is
// linked to student numbers. Tutors see only their own tutorial group.
import { CARDS } from '../../shared/graph-helper.mjs';
import { UNITS, levelFor, masteryLevel, MASTERY_THRESHOLD } from '../../shared/units.mjs';
import { PROBLEMS } from './problems.js';
import { MISCONCEPTIONS } from './grader.js';

const GRADED_UNITS = UNITS;
const CHECK_MISCONCEPTIONS = {
  'kn-edges': 'Counts each vertex’s edges once for Kₙ',
  'undirected-one-cell': 'Changes one matrix cell for an undirected edge',
  'diagonal': 'Diagonal always 1, or never 1',
  'k-not-outer': 'The intermediate vertex k is not the outermost loop',
  'one-stop-only': 'Closure only adds paths one stop apart',
  'direction-ignored': 'Ignores edge direction when tracing',
  'weak-strong': 'Mixes up weakly and strongly connected',
  'list-matrix-cost': 'Mixes up list and matrix costs',
  'dfs-bfs-order': 'Mixes up DFS and BFS order',
  'loop-degree': 'Counts a loop once in the degree',
  'list-index': 'Thinks a linked list can jump straight to an index',
  'queue-stack': 'Mixes up a queue and a stack',
  'remove-vertex-edges': 'Forgets the edges when removing a vertex',
};
export const misconceptionLabel = id => MISCONCEPTIONS[id]?.label ?? CHECK_MISCONCEPTIONS[id] ?? id;

/** "how do i remove a node" → "How do I remove a node?" */
const tidy = q => {
  const s = q.replace(/\bi\b/g, 'I').replace(/\b(bfs|dfs|adt|java)\b/g, w => (w === 'java' ? 'Java' : w.toUpperCase()));
  return s[0].toUpperCase() + s.slice(1) + (s.endsWith('?') ? '' : '?');
};

function inRange(iso, from, to) {
  const t = Date.parse(iso);
  return (!from || t >= Date.parse(from)) && (!to || t <= Date.parse(to) + 86399999);
}

function filters(q) {
  return {
    unit: q.unit && q.unit !== 'all' ? q.unit : null,
    problem: q.problem && q.problem !== 'all' ? q.problem : null,
    outcome: q.outcome && q.outcome !== 'all' ? q.outcome : null,
    group: q.group && q.group !== 'all' ? q.group : null,
    from: q.from || null,
    to: q.to || null,
  };
}

/** Units and problems that match the outcome / unit / problem filters. */
function scope(f) {
  let units = GRADED_UNITS;
  let problems = PROBLEMS;
  if (f.outcome) {
    units = units.filter(u => u.outcomes.includes(f.outcome));
    problems = problems.filter(p => p.outcomes.includes(f.outcome));
  }
  if (f.unit) {
    units = units.filter(u => u.id === f.unit);
    problems = problems.filter(p => p.unit === f.unit);
  }
  if (f.problem) problems = problems.filter(p => p.id === f.problem);
  return { units, problems };
}

function studentData(store, s, f) {
  const checks = store.checksFor(s.id).filter(c => inRange(c.createdAt, f.from, f.to));
  const subs = store.submissionsFor(s.id).filter(x => inRange(x.createdAt, f.from, f.to));
  const levels = {};
  for (const u of GRADED_UNITS) {
    const att = checks.filter(c => c.unit === u.id);
    let level = masteryLevel(att);
    // The same misconception matched 3+ times in this unit's problems also counts as struggling.
    if (level !== 'secure') {
      const counts = {};
      for (const x of subs) if (PROBLEMS.find(p => p.id === x.problem)?.unit === u.id && x.misconception) counts[x.misconception] = (counts[x.misconception] ?? 0) + 1;
      if (Object.values(counts).some(c => c >= 3)) level = 'struggling';
    }
    levels[u.id] = level;
  }
  return { checks, subs, levels };
}

export function visibleStudents(store, viewer, f) {
  let list = store.students();
  if (viewer.role === 'tutor') list = list.filter(s => s.group === viewer.group);
  if (f.group) list = list.filter(s => s.group === f.group);
  return list.sort((a, b) => a.studentNumber.localeCompare(b.studentNumber));
}

export function dashboard(store, viewer, query) {
  const f = filters(query);
  const { units, problems } = scope(f);
  const students = visibleStudents(store, viewer, f);
  const data = new Map(students.map(s => [s.id, studentData(store, s, f)]));

  // ---- most-asked questions (anonymous) with trend vs the previous period ----
  const chats = store.allChats();
  const to = f.to ? Date.parse(f.to) + 86399999 : Date.now();
  const from = f.from ? Date.parse(f.from) : to - 7 * 86400000;
  const span = to - from;
  const label = c =>
    c.cardId ? (CARDS.find(x => x.id === c.cardId)?.q[0] ?? c.cardId) : c.layer === 'graph' ? 'Questions about my own graph' : c.layer === 'guard' ? 'Asked for test-problem code (hint given)' : null;
  const tally = (lo, hi) => {
    const m = new Map();
    for (const c of chats) {
      const t = Date.parse(c.createdAt);
      if (t < lo || t > hi) continue;
      if (f.unit && c.unit && c.unit !== f.unit) continue;
      const l = label(c);
      if (l) m.set(l, (m.get(l) ?? 0) + 1);
    }
    return m;
  };
  const cur = tally(from, to);
  const prev = tally(from - span, from - 1);
  const mostAsked = [...cur.entries()]
    .map(([q, count]) => ({ question: tidy(q), count, previous: prev.get(q) ?? 0 }))
    .map(x => ({ ...x, trend: x.count > x.previous ? 'rising' : x.count < x.previous ? 'falling' : 'steady' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const unanswered = chats.filter(c => c.layer === 'fallback' && Date.parse(c.createdAt) >= from && Date.parse(c.createdAt) <= to).map(c => c.message).slice(-20).reverse();

  // ---- class overview ----
  const unitPass = units.map(u => {
    const attempted = students.filter(s => data.get(s.id).levels[u.id] !== 'not-started');
    const secure = attempted.filter(s => data.get(s.id).levels[u.id] === 'secure');
    return { id: u.id, title: u.title, attempted: attempted.length, secure: secure.length, rate: attempted.length ? Math.round((100 * secure.length) / attempted.length) : null };
  });
  const problemPass = problems.map(p => {
    const tried = students.filter(s => data.get(s.id).subs.some(x => x.problem === p.id));
    const passed = tried.filter(s => data.get(s.id).subs.some(x => x.problem === p.id && x.passed));
    return { id: p.id, title: p.title, attempted: tried.length, passed: passed.length, rate: tried.length ? Math.round((100 * passed.length) / tried.length) : null };
  });
  const mis = new Map();
  for (const s of students) {
    const d = data.get(s.id);
    for (const c of d.checks) if (!f.unit || c.unit === f.unit) for (const m of c.misconceptions ?? []) mis.set(m, (mis.get(m) ?? 0) + 1);
    for (const x of d.subs) if (x.misconception && problems.some(p => p.id === x.problem)) mis.set(x.misconception, (mis.get(x.misconception) ?? 0) + 1);
  }
  const misconceptions = [...mis.entries()].map(([id, count]) => ({ id, label: misconceptionLabel(id), count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const outcomes = [...new Set([...units.flatMap(u => u.outcomes), ...problems.flatMap(p => p.outcomes)])].sort().map(o => {
    const rates = [...unitPass.filter(u => UNITS.find(x => x.id === u.id).outcomes.includes(o)), ...problemPass.filter(p => PROBLEMS.find(x => x.id === p.id).outcomes.includes(o))]
      .map(x => x.rate)
      .filter(x => x !== null);
    return { outcome: o, rate: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null };
  });

  // ---- struggle map ----
  const map = students.map(s => {
    const points = pointsOf(store, s.id);
    return { id: s.id, studentNumber: s.studentNumber, name: s.name, group: s.group, guest: Boolean(s.guest), points, rank: levelFor(points).name, levels: Object.fromEntries(units.map(u => [u.id, data.get(s.id).levels[u.id]])) };
  });
  const needsHelp = map.filter(r => Object.values(r.levels).includes('struggling')).map(r => ({
    id: r.id,
    studentNumber: r.studentNumber,
    units: Object.entries(r.levels).filter(([, l]) => l === 'struggling').map(([u]) => u),
  }));

  return {
    filters: f,
    range: { from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10) },
    mostAsked,
    unanswered,
    overview: { units: unitPass, problems: problemPass, misconceptions, outcomes },
    struggle: { units: units.map(u => u.id), rows: map },
    needsHelp,
    students: students.length,
  };
}

/** Points are the sum of the rewards a learner has been awarded (saved with their progress). */
export function pointsOf(store, userId) {
  const awarded = store.progress(userId)?.rewards?.awarded ?? {};
  return Object.values(awarded).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function studentProfile(store, viewer, id, query = {}) {
  const f = filters(query);
  const s = store.user(id);
  if (!s || s.role !== 'student') return null;
  if (viewer.role === 'tutor' && s.group !== viewer.group) return 'forbidden';
  const d = studentData(store, s, f);
  const unitRows = GRADED_UNITS.map(u => {
    const att = d.checks.filter(c => c.unit === u.id);
    return { id: u.id, title: u.title, level: d.levels[u.id], attempts: att.length, best: att.length ? Math.max(...att.map(a => a.score)) : null, last: att.at(-1)?.score ?? null };
  });
  const probRows = PROBLEMS.map(p => {
    const subs = d.subs.filter(x => x.problem === p.id);
    const last = subs.at(-1);
    return {
      id: p.id, title: p.title,
      status: !subs.length ? 'not attempted' : subs.some(x => x.passed) ? 'passed' : 'failing',
      attempts: subs.length,
      failedCaseTypes: last && !last.passed ? last.failedCaseTypes ?? [] : [],
      misconception: last && !last.passed && last.misconception ? misconceptionLabel(last.misconception) : null,
      hintLevel: store.hintLevel(s.id, p.id),
    };
  });
  const mis = new Map();
  for (const c of d.checks) for (const m of c.misconceptions ?? []) mis.set(m, (mis.get(m) ?? 0) + 1);
  for (const x of d.subs) if (x.misconception) mis.set(x.misconception, (mis.get(x.misconception) ?? 0) + 1);
  const progress = store.progress(s.id) ?? {};
  const timeSpent = Object.values(progress.timeSpent ?? {}).reduce((a, b) => a + b, 0);
  const last = [...d.checks, ...d.subs].map(x => x.createdAt).sort().at(-1) ?? null;
  const counts = { secure: 0, developing: 0, struggling: 0, 'not-started': 0 };
  for (const u of unitRows) counts[u.level] += 1;
  const hintMax = Math.max(0, ...probRows.map(p => p.hintLevel));

  // Suggested follow-up: the first struggling unit, with its top misconception.
  const topMis = [...mis.entries()].sort((a, b) => b[1] - a[1])[0];
  const struggling = unitRows.find(u => u.level === 'struggling');
  const failing = probRows.find(p => p.status === 'failing');
  const demo = {
    L1: 'compare indexing an array with walking a linked list',
    L2: 'count degrees on a small graph and check the handshake rule',
    L3: 'sort example graphs into directed, weighted, cyclic and connected',
    L4: 'model their own timetable or taxi route as a graph',
    L5: 'step through add and remove node on both the matrix and the list',
    L6: 'replay the BFS queue one step at a time',
    L7: 'replay the DFS trace with visited marks',
    L8: 'watch the campus walkthrough and predict the next vertex',
    U5: 'turn on Closure and explain each dashed edge',
    U6: 'replay the k-by-k trace demo',
    U7: 'compare repeated DFS and Warshall’s on sparse and dense graphs',
    U8: 'redo the prerequisite model with the closure tab open',
  };
  const suggestion = struggling
    ? `Tutor check-in on ${struggling.id} (${struggling.title})${topMis ? `, focusing on “${misconceptionLabel(topMis[0]).toLowerCase()}”` : ''}; ${demo[struggling.id]}.`
    : failing
      ? `Check in on ${failing.id}${failing.misconception ? `: ${failing.misconception.toLowerCase()}` : ''}.`
      : unitRows.find(u => u.level === 'developing')
        ? `Encourage another attempt at ${unitRows.find(u => u.level === 'developing').id}.`
        : 'On track: no follow-up needed.';

  return {
    student: { id: s.id, studentNumber: s.studentNumber, name: s.name, group: s.group, guest: Boolean(s.guest) },
    points: pointsOf(store, s.id),
    rank: levelFor(pointsOf(store, s.id)).name,
    summary: counts,
    units: unitRows,
    problems: probRows,
    misconceptions: [...mis.entries()].map(([mid, count]) => ({ id: mid, label: misconceptionLabel(mid), count })).sort((a, b) => b.count - a.count),
    highestHintLevel: hintMax,
    timeSpentMinutes: Math.round(timeSpent / 60),
    lastActivity: last,
    suggestion,
    threshold: MASTERY_THRESHOLD,
  };
}

const csvCell = v => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(rows) {
  return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
}

export function exportCsv(store, viewer, query) {
  const d = dashboard(store, viewer, query);
  if (query.view === 'questions') return toCsv([['question', 'count', 'previous period', 'trend'], ...d.mostAsked.map(x => [x.question, x.count, x.previous, x.trend])]);
  if (query.view === 'overview')
    return toCsv([
      ['kind', 'id', 'title', 'attempted', 'secure or passed', 'rate %'],
      ...d.overview.units.map(u => ['unit', u.id, u.title, u.attempted, u.secure, u.rate]),
      ...d.overview.problems.map(p => ['problem', p.id, p.title, p.attempted, p.passed, p.rate]),
      ...d.overview.outcomes.map(o => ['outcome', o.outcome, '', '', '', o.rate]),
    ]);
  return toCsv([['student number', 'name', 'group', 'points', 'level', ...d.struggle.units], ...d.struggle.rows.map(r => [r.studentNumber, r.name, r.group, r.points, r.rank, ...d.struggle.units.map(u => r.levels[u])])]);
}
