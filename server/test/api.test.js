import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';
import { sampleData } from '../src/seed.js';

let server, base, store;
before(async () => {
  store = createStore(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gt-')), 'db.json'));
  store.replaceAll(sampleData());
  const app = createApp(store, { javaReady: Promise.resolve(false) });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const req = (method, url, body, token) =>
  fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });

test('guest start: no sign-in needed; signing in later keeps the guest work', async () => {
  const g = await (await req('POST', '/api/guest', {})).json();
  assert.equal(g.user.guest, true);
  assert.equal(g.user.role, 'student');
  const me = await (await req('GET', '/api/me', null, g.token)).json();
  assert.equal(me.user.name, 'Guest');
  await req('PUT', '/api/me/progress', { progress: { rewards: { awarded: { 'lesson:L1': 25 } }, done: { L1: true } } }, g.token);
  await req('POST', '/api/checks', { unit: 'L1', correct: 4, total: 5 }, g.token);
  // Sign in with the guest token: the guest's work moves to the account.
  const s = await (await req('POST', '/api/login', { name: 'Guest Then Student', studentNumber: 'u24444444' }, g.token)).json();
  const me2 = await (await req('GET', '/api/me', null, s.token)).json();
  assert.equal(me2.progress.rewards.awarded['lesson:L1'], 25);
  assert.equal(me2.mastery.L1.best, 80);
  assert.equal((await req('GET', '/api/me', null, g.token)).status, 401, 'the guest session ends');
});

test('student sign-in, consent, checks and mastery (nothing is locked)', async () => {
  assert.equal((await req('POST', '/api/login', { name: 'X', studentNumber: '123' })).status, 400);
  const { token, user } = await (await req('POST', '/api/login', { name: 'Test Student', studentNumber: 'u29999999', group: 'G2' })).json();
  assert.equal(user.role, 'student');
  assert.equal((await req('GET', '/api/me')).status, 401);
  await req('POST', '/api/me/consent', {}, token);
  const r1 = await (await req('POST', '/api/checks', { unit: 'L6', correct: 3, total: 5, misconceptions: ['queue-stack'] }, token)).json();
  assert.equal(r1.score, 60);
  assert.equal(r1.mastery.L6.level, 'developing');
  const r2 = await (await req('POST', '/api/checks', { unit: 'L10', correct: 5, total: 6 }, token)).json();
  assert.equal(r2.passed, true);
  assert.equal(r2.mastery.L10.level, 'secure');
  const me = await (await req('GET', '/api/me', null, token)).json();
  assert.equal(me.mastery.L10.best, 83);
  assert.ok(me.user.consentAt);
  assert.deepEqual(Object.keys(me.mastery), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11', 'L12']);
});

test('coding section: 9 problems (graph creation, BFS/DFS, closure), hints any time', async () => {
  const { token } = await (await req('POST', '/api/login', { name: 'Coder', studentNumber: 'u28888888' })).json();
  const { problems } = await (await req('GET', '/api/problems', null, token)).json();
  assert.deepEqual(problems.map(p => p.id), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9']);
  assert.deepEqual(problems.map(p => p.className), ['MatrixGraph', 'ListGraph', 'Bfs', 'Dfs', 'ClosureDFS', 'Warshall', 'WarshallTrace', 'Prerequisites', 'BuggyWarshall']);
  assert.ok(problems[0].api.some(a => a.includes('removeVertex')));
  assert.ok(problems.every(p => p.samples.length >= 1));
  assert.equal(problems[0].state.hintAvailable, true);
  assert.equal(problems[0].state.solution, null);
  const h = await (await req('POST', '/api/problems/P6/hint', {}, token)).json();
  assert.equal(h.state.hints.length, 1);
  // no Java in this test server: marking says so clearly
  const sub = await req('POST', '/api/problems/P6/submit', { code: 'public class Warshall {}' }, token);
  assert.equal(sub.status, 503);
});

test('Graph Helper: answers, logs anonymously, asks for an attempt before the solution', async () => {
  const { token, user } = await (await req('POST', '/api/login', { name: 'Asker', studentNumber: 'u27777777' })).json();
  const before = store.allChats().length;
  const r = await (await req('POST', '/api/chat', { message: 'Why does BFS use a queue?', context: { unit: 'L6' } }, token)).json();
  assert.equal(r.cardId, 'queue-stack');
  const g = await (await req('POST', '/api/chat', { message: 'give me the code for P3', context: {} }, token)).json();
  assert.equal(g.layer, 'guard');
  assert.match(g.reply, /model solution/);
  assert.match(g.reply, /hint 1 of 3/);
  assert.equal(store.hintLevel(user.id, 'P3'), 1);
  const logged = store.allChats().slice(before);
  assert.equal(logged.length, 2);
  for (const c of logged) assert.equal(c.userId, undefined, 'chat rows never store the user');
});

test('dashboard: staff only, tutor sees own group, filters, profile and CSV', async () => {
  const { token: student } = await (await req('POST', '/api/login', { name: 'S', studentNumber: 'u26666666' })).json();
  assert.equal((await req('GET', '/api/dashboard', null, student)).status, 403);
  assert.equal((await req('POST', '/api/staff/login', { name: 'L', code: 'wrong', role: 'lecturer' })).status, 403);
  const { token: lect } = await (await req('POST', '/api/staff/login', { name: 'Dr L', code: 'cos212-staff', role: 'lecturer' })).json();
  const { token: tut } = await (await req('POST', '/api/staff/login', { name: 'Tutor T', code: 'cos212-staff', role: 'tutor', group: 'G3' })).json();

  const d = await (await req('GET', '/api/dashboard', null, lect)).json();
  assert.ok(d.mostAsked.length > 0);
  assert.match(d.mostAsked[0].question, /queue|outer loop/i);
  assert.ok(['rising', 'falling', 'steady'].includes(d.mostAsked[0].trend));
  assert.ok(d.unanswered.length > 0);
  assert.equal(d.struggle.units.length, 12);
  assert.ok(d.overview.problems.length === 9);
  assert.ok(d.struggle.rows.every(r => typeof r.points === 'number' && ['Beginner', 'Rookie', 'Master', 'Legend'].includes(r.rank)));

  const t = await (await req('GET', '/api/dashboard', null, tut)).json();
  assert.ok(t.struggle.rows.every(r => r.group === 'G3'));

  const f = await (await req('GET', '/api/dashboard?unit=L10&outcome=all', null, lect)).json();
  assert.deepEqual(f.struggle.units, ['L10']);
  assert.ok(f.overview.problems.every(p => ['P6', 'P7', 'P9'].includes(p.id)));

  const ex = d.struggle.rows.find(r => r.studentNumber === 'u21000003');
  assert.equal(ex.levels.L10, 'struggling');
  const prof = await (await req('GET', `/api/dashboard/students/${ex.id}`, null, lect)).json();
  assert.equal(prof.problems.find(p => p.id === 'P6').status, 'failing');
  assert.match(prof.suggestion, /L10/);
  assert.equal(prof.highestHintLevel, 2);
  if (ex.group !== 'G3') assert.equal((await req('GET', `/api/dashboard/students/${ex.id}`, null, tut)).status, 403);

  const csv = await (await req('GET', '/api/dashboard/export.csv?view=struggle', null, lect)).text();
  assert.match(csv.split('\n')[0], /^student number,name,group,points,level,L1,/);
});

test('videos: four YouTube videos with thumbnails and links', async () => {
  const { token } = await (await req('POST', '/api/login', { name: 'Viewer', studentNumber: 'u25555555' })).json();
  const { videos } = await (await req('GET', '/api/videos', null, token)).json();
  assert.deepEqual(videos.map(v => v.id), ['-VgHk7UMPP4', '4jyESQDrpls', 'sioNsVeSbQo', 'zaBhtODEL0w']);
  for (const v of videos) {
    assert.equal(v.thumbnail, `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`);
    assert.equal(v.watchUrl, `https://www.youtube.com/watch?v=${v.id}`);
    assert.ok('title' in v); // null when YouTube cannot be reached
  }
});

test('lesson renumbering: old U5–U8 progress, checks and reward keys move to L9–L12', async () => {
  const { migrate } = await import('../src/store.js');
  const db = migrate({
    users: [], sessions: {}, code: {}, hints: {}, solutions: {}, submissions: [],
    checks: [{ unit: 'U6', score: 80 }, { unit: 'L2', score: 60 }],
    chats: [{ unit: 'U5' }, { unit: null }],
    progress: { a: { done: { L1: true, U5: true }, quizBest: { U8: 90 }, rewards: { awarded: { 'q:U7:k1': 15, 'lesson:U5': 25, 'problem:P6': 60 } } } },
  });
  assert.deepEqual(db.checks.map(c => c.unit), ['L10', 'L2']);
  assert.equal(db.chats[0].unit, 'L9');
  assert.deepEqual(db.progress.a.done, { L1: true, L9: true });
  assert.deepEqual(db.progress.a.quizBest, { L12: 90 });
  assert.deepEqual(db.progress.a.rewards.awarded, { 'q:L11:k1': 15, 'lesson:L9': 25, 'problem:P6': 60 });
});

test('final exam: checks are accepted as EXAM with an 80% pass mark and reported back', async () => {
  const g = await (await req('POST', '/api/guest', {})).json();
  const r1 = await req('POST', '/api/checks', { unit: 'EXAM', correct: 18, total: 24, misconceptions: [] }, g.token);
  assert.equal(r1.status, 201);
  assert.equal((await r1.json()).passed, false);
  const r2 = await (await req('POST', '/api/checks', { unit: 'EXAM', correct: 20, total: 24, misconceptions: [] }, g.token)).json();
  assert.equal(r2.passed, true);
  assert.deepEqual(r2.exam, { attempts: 2, best: 83, passed: true });
  // An old lesson id still counts, under its new number.
  assert.equal((await req('POST', '/api/checks', { unit: 'U5', correct: 5, total: 5, misconceptions: [] }, g.token)).status, 201);
  const me = await (await req('GET', '/api/me', null, g.token)).json();
  assert.equal(me.mastery.L9.best, 100);
  assert.equal(me.exam.best, 83);
  assert.ok(!('EXAM' in me.mastery), 'the exam is not a lesson');
});
