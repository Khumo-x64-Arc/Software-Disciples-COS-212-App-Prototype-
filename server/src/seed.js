// Demo learners so the lecturer dashboard has something to show in a pilot. Every demo record is flagged demo: true.
// Disable with SEED_DEMO=0, or remove with POST /api/admin/clear-demo (lecturer only).
import { getDb, save, groupFor } from './store.js';
import { seededRandom } from '../../shared/graph.js';
import { UNITS } from './units.js';
import { PROBLEMS } from './problems.js';
import { CARDS } from './chatbot.js';

const NAMES = ['Thabo M.', 'Lerato K.', 'Sipho N.', 'Ayesha P.', 'Johan V.', 'Naledi D.', 'Kagiso T.', 'Zanele R.', 'Pieter B.', 'Fatima S.', 'Lwazi G.', 'Megan O.', 'Tshepo L.', 'Anele Z.', 'Ruan C.', 'Palesa F.', 'Bongani H.', 'Chloe W.', 'Mpho J.', 'Keabetswe A.', 'Sizwe E.', 'Nadia I.', 'Themba U.', 'Refilwe Y.'];
const TYPICAL = { P1: ['one-direction'], P2: ['used-matrix', 'one-direction'], P3: ['format'], P4: ['complete-by-count'], P5: ['no-visited'], P6: ['diagonal', 'no-visited'], P7: ['k-not-outer', 'diagonal'], P8: ['k-not-outer'], P9: ['diagonal'], P10: ['k-not-outer'], P11: ['too-slow'] };
const CATS = { P1: ['undirected'], P2: ['undirected'], P3: ['loops'], P4: ['complete-with-loop'], P5: ['cycle'], P6: ['self-loop'], P7: ['long-chain'], P8: ['long-chain'], P9: ['circular'], P10: ['long-chain'], P11: ['large'] };
const CHAT_WEIGHTS = { 'k-outer': 9, 'which-rep': 7, 'closure-def': 6, 'weak-strong': 5, incidence: 4, 'closure-diagonal': 4, warshall: 4, 'warshall-time': 3, visited: 3, 'dfs-vs-warshall': 3, 'java-no-util': 3, 'test-format': 2, complete: 2, 'circuit-cycle': 2, subgraph: 2, 'multi-pseudo': 1, degree: 1, prereq: 1, wfi: 2 };
const UNANSWERED = ['is warshall the same as dijkstra', 'what is an euler path', 'do we need to know graph colouring for the exam', 'how does the closure handle weighted edges', 'can i use recursion in p7', 'what is a bipartite graph'];

export function seedDemo() {
  const db = getDb();
  if (db.demo || db.users.some(u => u.role === 'student')) return false;
  const rand = seededRandom('cos212-demo');
  const day = 864e5;
  const now = Date.now();
  NAMES.forEach((name, i) => {
    const id = `u2100${String(1001 + i * 37).padStart(4, '0')}`;
    db.users.push({ id, name, role: 'student', group: groupFor(id), demo: true, createdAt: now - 20 * day });
    const ability = 0.35 + rand() * 0.6; // how far and how well this learner gets
    const reach = Math.min(UNITS.length, Math.max(1, Math.round(ability * 11)));
    UNITS.slice(0, reach).forEach((u, k) => {
      const tries = 1 + Math.floor(rand() * (ability > 0.7 ? 1.5 : 3.5));
      for (let t = 0; t < tries; t++) {
        const difficulty = k >= 6 ? 0.15 : k >= 4 ? 0.08 : 0;
        const score = Math.min(1, Math.round((ability - difficulty + t * 0.12 + rand() * 0.25) * 5) / 5);
        db.checkAttempts.push({ userId: id, unit: u.id, attempt: t + 1, score: Math.max(0, score), correct: Math.round(score * 5), total: 5, misconceptions: [], ts: now - (14 - k) * day + t * 3600e3, seconds: 300 + Math.floor(rand() * 600), demo: true });
      }
    });
    PROBLEMS.forEach(p => {
      const ui = UNITS.findIndex(u => u.id === p.unit);
      if (ui >= reach || (p.level === 'Stretch' && ability < 0.6)) return;
      const tries = 1 + Math.floor(rand() * (ability > 0.75 ? 2 : 5));
      for (let t = 0; t < tries; t++) {
        const pass = rand() < ability - 0.1 + t * 0.15;
        const total = 8;
        const passed = pass ? total : Math.floor(total * (0.3 + rand() * 0.5));
        const mis = pass ? [] : [TYPICAL[p.id][Math.floor(rand() * TYPICAL[p.id].length)]];
        db.problemAttempts.push({ userId: id, problemId: p.id, passed, total, allPassed: pass, failedCategories: pass ? [] : CATS[p.id], misconceptions: mis, ts: now - (12 - ui) * day + t * 1800e3, seconds: 400 + Math.floor(rand() * 900), demo: true });
        if (!pass && rand() < 0.6) db.hintEvents.push({ userId: id, problemId: p.id, misconception: mis[0], level: 1 + Math.floor(rand() * 3), ts: now - (12 - ui) * day + t * 1800e3 + 600e3, demo: true });
        if (pass) break;
      }
    });
  });
  const pool = Object.entries(CHAT_WEIGHTS).flatMap(([id, w]) => Array(w).fill(id));
  for (let c = 0; c < 260; c++) {
    const cardId = pool[Math.floor(rand() * pool.length)];
    const recent = rand() < 0.55;
    db.chats.push({ text: CARDS.find(x => x.id === cardId).q[0], cardId, kind: 'kb', answered: true, ts: now - (recent ? rand() * 7 : 7 + rand() * 7) * day, demo: true });
  }
  for (let c = 0; c < 40; c++) db.chats.push({ text: 'graph question', kind: 'graph', answered: true, ts: now - rand() * 14 * day, demo: true });
  UNANSWERED.forEach((text, k) => db.chats.push({ text, kind: 'fallback', answered: false, ts: now - k * 0.7 * day, demo: true }));
  db.demo = true;
  save();
  return true;
}

export function clearDemo() {
  const db = getDb();
  db.users = db.users.filter(u => !u.demo);
  db.checkAttempts = db.checkAttempts.filter(a => !a.demo);
  db.problemAttempts = db.problemAttempts.filter(a => !a.demo);
  db.hintEvents = db.hintEvents.filter(a => !a.demo);
  db.chats = db.chats.filter(a => !a.demo);
  db.demo = false;
  save();
}
