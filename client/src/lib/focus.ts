// "What to work on": turns a learner's quiz and exam answers into a ranked list
// of lessons to revisit, with the mistakes behind them. Pure, so it is tested.
import { LESSONS } from '../../../shared/units.mjs';
import type { AnswerLog } from '../state/AppContext';

/** Plain-words names for the mistakes the quiz questions are built to catch (same ids as the Lecturer page). */
export const MISCONCEPTION_LABELS: Record<string, string> = {
  'kn-edges': 'Counting each vertex’s edges once for Kₙ',
  'undirected-one-cell': 'Changing only one matrix cell for an undirected edge',
  diagonal: 'Setting the diagonal always to 1, or never',
  'k-not-outer': 'Not making the intermediate vertex k the outermost loop',
  'one-stop-only': 'Adding closure paths only one stop apart',
  'direction-ignored': 'Ignoring edge direction when tracing',
  'weak-strong': 'Mixing up weakly and strongly connected',
  'list-matrix-cost': 'Mixing up adjacency list and matrix costs',
  'dfs-bfs-order': 'Mixing up DFS and BFS order',
  'loop-degree': 'Counting a loop only once in the degree',
  'list-index': 'Thinking a linked list can jump straight to an index',
  'queue-stack': 'Mixing up a queue and a stack',
  'remove-vertex-edges': 'Forgetting the edges when removing a vertex',
  'no-visited-mark': 'Traversing without marking vertices as visited',
};
export const misconceptionText = (id: string) => MISCONCEPTION_LABELS[id] ?? id;

export type FocusStatus = 'work' | 'nearly' | 'strong' | 'untried';
export type FocusRow = {
  id: string;
  right: number;
  wrong: number;
  skipped: number;
  total: number;
  accuracy: number | null; // % of answers that were right, null if none yet
  best: number | null; // best quiz score, %
  status: FocusStatus;
  mistakes: { id: string; label: string; count: number }[];
};

/** Below 60% needs work; 60–79% nearly there; 80% and above strong (the same bands as the Roadmap). */
export const statusFor = (pct: number | null): FocusStatus => (pct === null ? 'untried' : pct < 60 ? 'work' : pct < 80 ? 'nearly' : 'strong');

export function focusRows(log: AnswerLog = {}, quizBest: Record<string, number> = {}): FocusRow[] {
  return LESSONS.map(l => {
    const e = log[l.id];
    const right = e?.right ?? 0, wrong = e?.wrong ?? 0, skipped = e?.skipped ?? 0;
    const total = right + wrong + skipped;
    const best = quizBest[l.id] ?? null;
    // Skips count against a lesson only once the learner has answered something in it, so
    // submitting the exam early does not mark every lesson as weak. With no answers logged
    // (or progress saved before the log existed) the best quiz score is used instead.
    const accuracy = right + wrong > 0 ? Math.round((100 * right) / total) : best;
    const mistakes = Object.entries(e?.mis ?? {})
      .map(([id, count]) => ({ id, label: misconceptionText(id), count }))
      .sort((a, b) => b.count - a.count);
    return { id: l.id, right, wrong, skipped, total, accuracy, best, status: statusFor(accuracy), mistakes };
  });
}

/** Lessons to revisit, weakest first; ties go to the one with more wrong answers, then lesson order. */
export function toImprove(rows: FocusRow[]): FocusRow[] {
  return rows
    .filter(r => r.status === 'work' || r.status === 'nearly')
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.wrong + b.skipped - (a.wrong + a.skipped) || LESSONS.findIndex(l => l.id === a.id) - LESSONS.findIndex(l => l.id === b.id));
}

/** The mistakes made most often across every lesson. */
export function topMistakes(log: AnswerLog = {}, n = 3) {
  const all = new Map<string, { count: number; lessons: Set<string> }>();
  for (const [lesson, e] of Object.entries(log)) {
    for (const [id, c] of Object.entries(e.mis ?? {})) {
      const m = all.get(id) ?? { count: 0, lessons: new Set<string>() };
      m.count += c;
      m.lessons.add(lesson);
      all.set(id, m);
    }
  }
  return [...all.entries()]
    .map(([id, m]) => ({ id, label: misconceptionText(id), count: m.count, lessons: [...m.lessons].sort((a, b) => LESSONS.findIndex(l => l.id === a) - LESSONS.findIndex(l => l.id === b)) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
