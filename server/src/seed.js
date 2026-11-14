// Fills the store with SAMPLE data so the lecturer dashboard can be demonstrated.
// Usage: npm run seed   (writes to DATA_FILE, default server/data/db.json)
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { rng } from '../../shared/graph-core.mjs';
import { CARDS } from '../../shared/graph-helper.mjs';
import { createStore } from './store.js';
import { PROBLEMS } from './problems.js';
import { UNITS } from '../../shared/units.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export function sampleData(seed = 2027) {
  const rand = rng(seed);
  const day = 86400000;
  const now = Date.now();
  const when = daysAgo => new Date(now - daysAgo * day - Math.floor(rand() * day)).toISOString();
  const id = () => crypto.randomUUID();
  const users = [];
  const checks = [];
  const submissions = [];
  const hints = {};
  const progress = {};
  const names = ['Thandi', 'Sipho', 'Lerato', 'Ayesha', 'Johan', 'Naledi', 'Pieter', 'Zanele', 'Kagiso', 'Fatima', 'Liam', 'Bongani', 'Megan', 'Tshepo', 'Anika', 'Mpho', 'Ruan', 'Palesa', 'Yusuf', 'Karabo'];
  const unitMis = {
    L1: ['list-index'], L2: ['loop-degree'], L3: ['weak-strong', 'direction-ignored'], L4: ['direction-ignored'],
    L5: ['undirected-one-cell', 'list-matrix-cost', 'remove-vertex-edges'], L6: ['queue-stack', 'dfs-bfs-order'], L7: ['dfs-bfs-order'], L8: ['dfs-bfs-order', 'queue-stack'],
    U5: ['weak-strong', 'diagonal'], U6: ['k-not-outer', 'one-stop-only'], U7: ['list-matrix-cost'], U8: ['diagonal'],
  };
  const probMis = { P1: 'one-direction', P2: 'builtin-collection', P3: 'dfs-bfs-order', P4: 'no-visited-mark', P5: 'diagonal', P6: 'k-not-outer', P7: 'k-not-outer', P9: 'k-not-outer' };
  const order = UNITS.map(u => u.id);
  const award = (uid, key, pts) => {
    const p = (progress[uid] ??= { rewards: { awarded: {} }, done: {} });
    p.rewards.awarded[key] = pts;
  };

  names.forEach((name, i) => {
    const u = { id: id(), name: `${name} (sample)`, studentNumber: `u2100${String(i + 1).padStart(4, '0')}`, role: 'student', group: `G${(i % 4) + 1}`, consentAt: when(20), createdAt: when(21) };
    users.push(u);
    progress[u.id] = { rewards: { awarded: {} }, done: {}, timeSpent: {} };
    const ability = 0.45 + rand() * 0.5;
    const reach = Math.min(order.length, Math.max(2, Math.round(4 + ability * 8 + (rand() - 0.5) * 3)));
    let day0 = 18;
    for (let n = 0; n < reach; n++) {
      const unit = order[n];
      const hard = n >= 8 ? 0.12 : n >= 5 ? 0.05 : 0;
      let best = 0;
      for (let tries = 1; tries <= 3 && best < 80; tries++) {
        const score = Math.min(100, Math.round((ability - hard + rand() * 0.35) * 100 / 10) * 10);
        const mis = score < 80 ? [unitMis[unit][Math.floor(rand() * unitMis[unit].length)]] : [];
        checks.push({ id: id(), userId: u.id, unit, correct: Math.round(score / 20), total: 5, score, passed: score >= 80, misconceptions: mis, createdAt: when(day0) });
        day0 = Math.max(0, day0 - 1);
        best = Math.max(best, score);
      }
      progress[u.id].done[unit] = true;
      progress[u.id].timeSpent[unit] = 600 + Math.floor(rand() * 1500);
      award(u.id, `lesson:${unit}`, 25);
      award(u.id, `quiz:${unit}`, Math.round(best * 0.35));
    }
    if (reach < 8) return; // the coding section opens after the core lessons
    for (const p of PROBLEMS) {
      if (rand() > 0.85) continue;
      let ok = false;
      let att = 0;
      while (!ok && att < 6) {
        att += 1;
        ok = rand() < ability - (p.level === 'Challenge' ? 0.2 : 0) + att * 0.08;
        submissions.push({
          id: id(), userId: u.id, problem: p.id, status: ok ? 'passed' : 'failed', passed: ok, passedCount: ok ? 10 : 6, total: 10,
          failedCaseTypes: ok ? [] : p.id === 'P6' ? ['long chain', 'cycles'] : ['cycles'],
          misconception: ok ? null : probMis[p.id] ?? null,
          createdAt: when(Math.max(0, 12 - att)),
        });
      }
      if (ok) award(u.id, `problem:${p.id}`, att === 1 ? 40 : 15);
      if (!ok && att >= 3) hints[u.id] = { ...(hints[u.id] ?? {}), [p.id]: Math.min(3, att - 3) };
    }
  });

  // A student who matches the design doc's example profile: stuck on Warshall's loop order.
  const ex = users[2];
  ex.studentNumber = 'u21000003';
  for (let i = checks.length - 1; i >= 0; i--) if (checks[i].userId === ex.id) checks.splice(i, 1);
  const exChecks = [['L1', 100], ['L2', 80], ['L3', 100], ['L4', 100], ['L5', 80], ['L6', 60], ['L6', 80], ['L7', 100], ['L8', 80], ['U5', 80], ['U6', 40], ['U6', 60], ['U6', 60]];
  exChecks.forEach(([unit, score], k) => checks.push({ id: id(), userId: ex.id, unit, correct: score / 20, total: 5, score, passed: score >= 80, misconceptions: unit === 'U6' ? ['k-not-outer'] : score < 80 ? [unitMis[unit][0]] : [], createdAt: when(14 - k) }));
  for (let i = submissions.length - 1; i >= 0; i--) if (submissions[i].userId === ex.id) submissions.splice(i, 1);
  for (const pid of ['P1', 'P2', 'P3', 'P4', 'P5']) submissions.push({ id: id(), userId: ex.id, problem: pid, status: 'passed', passed: true, passedCount: 10, total: 10, failedCaseTypes: [], misconception: null, createdAt: when(9) });
  for (let k = 0; k < 5; k++) submissions.push({ id: id(), userId: ex.id, problem: 'P6', status: 'failed', passed: false, passedCount: 7, total: 12, failedCaseTypes: ['long chain', 'cycles'], misconception: k < 4 ? 'k-not-outer' : null, createdAt: when(5 - k) });
  hints[ex.id] = { P6: 2 };

  // Anonymous chat questions, weighted like the design doc's sample.
  const weights = { 'queue-stack': 44, 'k-outer': 38, 'remove-vertex': 31, 'list-vs-matrix': 27, visited: 22, 'closure-what': 18, 'array-vs-list': 15, 'weak-strong': 12, 'app-levels': 9, 'java-no-util': 6 };
  const chats = [];
  for (const [cardId, w] of Object.entries(weights)) {
    const card = CARDS.find(c => c.id === cardId);
    for (let k = 0; k < w; k++) chats.push({ id: id(), message: card.q[k % card.q.length], layer: 'kb', cardId, unit: card.unit, createdAt: when(Math.floor(rand() * 6)) });
    for (let k = 0; k < Math.round(w * 0.6); k++) chats.push({ id: id(), message: card.q[0], layer: 'kb', cardId, unit: card.unit, createdAt: when(7 + Math.floor(rand() * 6)) });
  }
  for (let k = 0; k < 9; k++) chats.push({ id: id(), message: 'can a reach e?', layer: 'graph', cardId: null, unit: 'U5', createdAt: when(Math.floor(rand() * 6)) });
  for (const q of ['Is BFS on the second semester test?', 'Can transitive closure handle weighted edges?', 'What is the difference between a walk and a trail?', 'Does Warshall work on undirected graphs?', 'Is a doubly linked list better for adjacency lists?', 'What is iterative deepening?']) {
    chats.push({ id: id(), message: q, layer: 'fallback', cardId: null, unit: null, createdAt: when(Math.floor(rand() * 6)) });
  }
  return { users, sessions: {}, progress, checks, submissions, code: {}, hints, chats };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.env.DATA_FILE ?? path.join(here, '..', 'data', 'db.json');
  const store = createStore(file);
  store.replaceAll(sampleData());
  console.log(`Wrote sample data (20 students, chat questions, test results) to ${file}.`);
  console.log(`Staff sign-in code: ${process.env.STAFF_CODE ?? 'cos212-staff'}`);
}
