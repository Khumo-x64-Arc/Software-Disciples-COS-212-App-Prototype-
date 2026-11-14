// The lesson plan, rewards ladder and references. Shared by the server
// (dashboard, checks) and the app (navigation, rewards).
//
// Nothing is locked: every lesson opens at any time. The Transitive closure
// lessons (U5–U8) are *recommended* once a learner reaches Level 2 (Rookie),
// but they are never blocked.

export const MASTERY_THRESHOLD = 80;

/** CS2023 Algorithmic Foundations, AL-Foundational knowledge unit. */
export const OUTCOMES = {
  'CS-ADT': 'AL-Foundational (CS core): abstract data types and their operations, e.g. List',
  'CS-ARR': 'AL-Foundational (CS core): arrays, single and multi-dimensional',
  'CS-GRAPH': 'AL-Foundational (CS core): graphs: (un)directed, (a)cyclic, (un)connected, (un)weighted',
  'CS-REP': 'AL-Foundational (CS core): adjacency list and adjacency matrix representations',
  'CS-BFS': 'AL-Foundational (CS core): breadth-first search: connectivity, fewest-edges paths',
  'CS-DFS': 'AL-Foundational (CS core): depth-first search: connectivity, cycles, reachability',
  'KA-TC': 'AL-Foundational (KA core): transitive closure, Warshall’s algorithm',
  'KA-CMP': 'AL-Foundational (KA core): choosing between algorithms by their cost',
};

/** References, written out in full so they read cleanly (no § symbols). */
export const REFS = {
  lists: { book: 'Drozdek (2010)', chapter: 'Chapter 3, Linked lists', slides: 'COS212 slides: Linked lists' },
  intro: { book: 'Drozdek (2010)', section: 'Chapter 8 introduction', pages: '376–377', slides: 'COS212 slides: Chapter 9 part 1, Graph basics' },
  rep: { book: 'Drozdek (2010)', section: 'Section 8.1, Graph representation', pages: '377–379', slides: 'COS212 slides: Chapter 9 part 1, Graph basics' },
  trav: { book: 'Drozdek (2010)', section: 'Section 8.2, Graph traversals', pages: '379–382', slides: 'COS212 slides: Chapter 9, Unweighted shortest path (BFS)' },
  conn: { book: 'Drozdek (2010)', section: 'Section 8.6, Connectivity', pages: '399–402', slides: 'COS212 slides: Chapter 9, Connectivity in directed graphs' },
  wfi: { book: 'Drozdek (2010)', section: 'Section 8.3.1, All-to-all shortest path problem', pages: '390–392', slides: 'COS212 slides: Chapter 9, Weighted shortest path' },
};

/** "Drozdek (2010), Section 8.3.1, All-to-all shortest path problem, pages 390–392" */
export function cite(ref) {
  const r = typeof ref === 'string' ? REFS[ref] : ref;
  if (!r) return '';
  const where = r.section ?? r.chapter ?? '';
  const pages = r.pages ? `, ${r.pages.includes('–') ? 'pages' : 'page'} ${r.pages}` : '';
  return `${r.book}, ${where}${pages}`;
}

export const LESSONS = [
  { id: 'L1', track: 'core', icon: '📦', title: 'Recap: lists and arrays', short: 'Arrays, 2D arrays and linked lists, the building blocks of graphs', ref: 'lists', outcomes: ['CS-ARR', 'CS-ADT'] },
  { id: 'L2', track: 'core', icon: '🕸️', title: 'Introduction to graphs', short: 'Vertices, edges, neighbours, paths and degree', ref: 'intro', outcomes: ['CS-GRAPH'] },
  { id: 'L3', track: 'core', icon: '🧭', title: 'Types of graphs', short: 'Directed or not, weighted or not, cyclic or not, connected or not', ref: 'intro', outcomes: ['CS-GRAPH'] },
  { id: 'L4', track: 'core', icon: '🌍', title: 'Applications of graphs', short: 'Maps, social networks, the web and module prerequisites', ref: 'intro', outcomes: ['CS-GRAPH'] },
  { id: 'L5', track: 'core', icon: '🧱', title: 'Building a graph in code', short: 'Adjacency matrix and list; add and remove nodes and edges', ref: 'rep', outcomes: ['CS-REP', 'CS-ADT', 'CS-ARR'] },
  { id: 'L6', track: 'core', icon: '🌊', title: 'Introduction to BFS', short: 'Breadth-first search with a queue, level by level', ref: 'trav', outcomes: ['CS-BFS'] },
  { id: 'L7', track: 'core', icon: '🕳️', title: 'Introduction to DFS', short: 'Depth-first search with recursion or a stack', ref: 'trav', outcomes: ['CS-DFS'] },
  { id: 'L8', track: 'core', icon: '🎬', title: 'Traversal walkthrough', short: 'Watch BFS and DFS explore a campus map step by step', ref: 'trav', outcomes: ['CS-BFS', 'CS-DFS'] },
  { id: 'U5', track: 'closure', icon: '🔗', title: 'Transitive closure as a relation', short: 'R, R⁺, the reachability matrix, weak vs strong', ref: 'conn', outcomes: ['CS-DFS', 'KA-TC'] },
  { id: 'U6', track: 'closure', icon: '🧮', title: 'Warshall’s algorithm', short: 'R(k) from R(k−1), k is the outer loop, Θ(V³)', ref: 'wfi', outcomes: ['KA-TC'] },
  { id: 'U7', track: 'closure', icon: '⚖️', title: 'Comparing approaches', short: 'Repeated DFS vs Warshall’s on sparse and dense graphs', ref: 'wfi', outcomes: ['KA-TC', 'KA-CMP', 'CS-DFS'] },
  { id: 'U8', track: 'closure', icon: '🎓', title: 'Apply it', short: 'Model module prerequisites and read answers off the closure', ref: 'wfi', outcomes: ['KA-TC'] },
];
// Older code and the dashboard call these "units".
export const UNITS = LESSONS;
export const CORE = LESSONS.filter(l => l.track === 'core');
export const CLOSURE = LESSONS.filter(l => l.track === 'closure');
export const unitById = id => LESSONS.find(u => u.id === id);

// ---------- rewards ----------

export const LEVELS = [
  { n: 1, name: 'Beginner', min: 0, icon: '🌱' },
  { n: 2, name: 'Rookie', min: 200, icon: '⚡' },
  { n: 3, name: 'Master', min: 500, icon: '🛡️' },
  { n: 4, name: 'Legend', min: 900, icon: '👑' },
];
/** The closure lessons are recommended from this many points (Level 2, Rookie). Not enforced. */
export const CLOSURE_THRESHOLD = 200;

export function levelFor(points) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) cur = l;
  const next = LEVELS.find(l => l.min > points) ?? null;
  return { ...cur, next, toNext: next ? next.min - points : 0, progress: next ? (points - cur.min) / (next.min - cur.min) : 1 };
}

/** Points for each kind of success. Harder questions are worth more. */
export const POINTS = { question: [0, 10, 15, 20], lesson: 25, problem: 60, problemAfterSolution: 20 };

/** Which question tiers a quiz draws, by level (harder questions as you climb). */
export const TIERS_BY_LEVEL = { 1: [1, 1, 1, 2, 2], 2: [1, 2, 2, 2, 3], 3: [2, 2, 3, 3, 3], 4: [2, 3, 3, 3, 3] };

/**
 * Mastery level for one lesson's quizzes: not started · developing ·
 * struggling (3+ attempts below 80%, or the same misconception 3+ times) · secure (80%+).
 */
export function masteryLevel(attempts) {
  if (!attempts.length) return 'not-started';
  const best = Math.max(...attempts.map(a => a.score));
  if (best >= MASTERY_THRESHOLD) return 'secure';
  const counts = {};
  for (const a of attempts) for (const m of a.misconceptions ?? []) counts[m] = (counts[m] ?? 0) + 1;
  if (attempts.length >= 3 || Object.values(counts).some(c => c >= 3)) return 'struggling';
  return 'developing';
}
