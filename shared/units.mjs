// The lesson plan, rewards ladder and references. Shared by the server
// (dashboard, checks) and the app (navigation, rewards).
//
// One main path of twelve lessons in order: Part 1, graphs and traversal (L1–L8),
// then Part 2, transitive closure (L9–L12). Nothing is locked: every lesson opens
// at any time. The final exam is the bonus quest: it is recommended once all twelve
// lessons are done, but it is never blocked.

export const MASTERY_THRESHOLD = 80;

/**
 * CS2023 (Kumar et al., 2024), Algorithmic Foundations, pages 88–90.
 * Topic codes cite the AL-Foundational knowledge unit's topic list; ILO codes cite
 * its Illustrative Learning Outcomes; STR codes cite AL-Strategies (CS core).
 * Chosen pair (COS750 spec, section 2): the Graph data structure (CS core 8) and
 * transitive closure with Warshall's algorithm (KA core 15a). BFS and DFS are taught
 * as the building blocks for it: CS2023 lists them as uninformed search (CS core 11c).
 */
export const OUTCOMES = {
  'CS-ADT': 'AL-Foundational CS core 1: abstract data types and the operations on them',
  'CS-ARR': 'AL-Foundational CS core 2b: arrays, single (vector) vs multidimensional (matrix)',
  'CS-LIST': 'AL-Foundational CS core 4: linked lists',
  'CS-GRAPH': 'AL-Foundational CS core 8: graphs, [un]directed, [a]cyclic, [un]connected and [un]weighted',
  'CS-REP': 'AL-Foundational CS core 8a: graph representation, adjacency list vs matrix',
  'CS-BFS': 'AL-Foundational CS core 11c: uninformed breadth-first search (here applied to graphs)',
  'CS-DFS': 'AL-Foundational CS core 11c: uninformed depth-first search (here applied to graphs)',
  'KA-TC': 'AL-Foundational KA core 15a: graph algorithms, transitive closure (e.g., Warshall’s)',
  'ILO-CS1': 'AL-Foundational outcome CS 1a–b: explain a data structure’s definition, properties, representations and ADT operations, and how each operation transforms it',
  'ILO-CS2': 'AL-Foundational outcome CS 2: explain step by step how each algorithm operates',
  'ILO-CS4': 'AL-Foundational outcome CS 4: develop several solutions to a problem and evaluate which best fits',
  'ILO-CS6': 'AL-Foundational outcome CS 6: factors beyond efficiency (programming time, maintainability, input patterns)',
  'ILO-KA8': 'AL-Foundational outcome KA 8a–b: explain a prototypical example of a KA-core algorithm and how it operates step by step',
  'STR-DP': 'AL-Strategies CS core 1e(iv): dynamic programming (e.g., Warshall)',
  'STR-REC': 'AL-Strategies CS core 3: iteration vs recursion',
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
  { id: 'L1', track: 'graphs', icon: '📦', title: 'Recap: lists and arrays', short: 'Arrays, 2D arrays and linked lists, the building blocks of graphs', ref: 'lists', outcomes: ['CS-ARR', 'CS-LIST', 'CS-ADT'] },
  { id: 'L2', track: 'graphs', icon: '🕸️', title: 'Introduction to graphs', short: 'Vertices, edges, neighbours, paths and degree', ref: 'intro', outcomes: ['CS-GRAPH', 'ILO-CS1'], videos: ['-VgHk7UMPP4'] },
  { id: 'L3', track: 'graphs', icon: '🧭', title: 'Types of graphs', short: 'Directed or not, weighted or not, cyclic or not, connected or not', ref: 'intro', outcomes: ['CS-GRAPH', 'ILO-CS1'] },
  { id: 'L4', track: 'graphs', icon: '🌍', title: 'Applications of graphs', short: 'Maps, social networks, the web and module prerequisites', ref: 'intro', outcomes: ['CS-GRAPH'] },
  { id: 'L5', track: 'graphs', icon: '🧱', title: 'Building a graph in code', short: 'Adjacency matrix and list; add and remove nodes and edges', ref: 'rep', outcomes: ['CS-REP', 'CS-ADT', 'CS-ARR', 'CS-LIST', 'ILO-CS1'] },
  { id: 'L6', track: 'graphs', icon: '🌊', title: 'Introduction to BFS', short: 'Breadth-first search with a queue, level by level', ref: 'trav', outcomes: ['CS-BFS', 'ILO-CS2'], videos: ['zaBhtODEL0w'] },
  { id: 'L7', track: 'graphs', icon: '🕳️', title: 'Introduction to DFS', short: 'Depth-first search with recursion or a stack', ref: 'trav', outcomes: ['CS-DFS', 'ILO-CS2', 'STR-REC'], videos: ['zaBhtODEL0w'] },
  { id: 'L8', track: 'graphs', icon: '🎬', title: 'Traversal walkthrough', short: 'Watch BFS and DFS explore a campus map step by step', ref: 'trav', outcomes: ['CS-BFS', 'CS-DFS', 'ILO-CS2'] },
  { id: 'L9', track: 'closure', icon: '🔗', title: 'Transitive closure as a relation', short: 'R, R⁺, the reachability matrix, weak vs strong', ref: 'conn', outcomes: ['KA-TC', 'ILO-KA8'], videos: ['sioNsVeSbQo'] },
  { id: 'L10', track: 'closure', icon: '🧮', title: 'Warshall’s algorithm', short: 'R(k) from R(k−1), k is the outer loop, Θ(V³)', ref: 'wfi', outcomes: ['KA-TC', 'ILO-KA8', 'STR-DP'] },
  { id: 'L11', track: 'closure', icon: '⚖️', title: 'Comparing approaches', short: 'Repeated DFS vs Warshall’s on sparse and dense graphs', ref: 'wfi', outcomes: ['KA-TC', 'CS-DFS', 'ILO-CS4', 'ILO-CS6'] },
  { id: 'L12', track: 'closure', icon: '🎓', title: 'Apply it', short: 'Model module prerequisites and read answers off the closure', ref: 'wfi', outcomes: ['KA-TC', 'ILO-CS4'] },
];
// Older code and the dashboard call these "units".
export const UNITS = LESSONS;
/** Part 1: graphs and traversal. Part 2: transitive closure. Both are the main path. */
export const PART1 = LESSONS.filter(l => l.track === 'graphs');
export const PART2 = LESSONS.filter(l => l.track === 'closure');
/** The coding questions open once Part 1 (L1–L8) is done. */
export const CODING_AFTER = [];

/** Lesson ids before the renumbering (the closure lessons were U5–U8). */
export const LEGACY_IDS = { U5: 'L9', U6: 'L10', U7: 'L11', U8: 'L12' };
export const currentId = id => LEGACY_IDS[id] ?? id;
export const unitById = id => LESSONS.find(u => u.id === currentId(id));

/**
 * The bonus quest: a final exam that mixes every lesson. Recommended once all
 * twelve lessons are done; never enforced.
 */
export const EXAM = { id: 'EXAM', perLesson: 2, passMark: 80, tiers: [2, 3] };

// ---------- rewards ----------

export const LEVELS = [
  { n: 1, name: 'Beginner', min: 0, icon: '🌱' },
  { n: 2, name: 'Rookie', min: 200, icon: '⚡' },
  { n: 3, name: 'Master', min: 500, icon: '🛡️' },
  { n: 4, name: 'Legend', min: 900, icon: '👑' },
];
export function levelFor(points) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) cur = l;
  const next = LEVELS.find(l => l.min > points) ?? null;
  return { ...cur, next, toNext: next ? next.min - points : 0, progress: next ? (points - cur.min) / (next.min - cur.min) : 1 };
}

/** Points for each kind of success. Harder questions are worth more. */
export const POINTS = { question: [0, 10, 15, 20], lesson: 25, problem: 60, problemAfterSolution: 20, examQuestion: 10, examPass: 100 };

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
