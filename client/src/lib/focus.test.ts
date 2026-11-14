import { describe, expect, it } from 'vitest';
import { focusRows, statusFor, toImprove, topMistakes } from './focus';
import { normaliseSettings, clampScale } from '../state/AppContext';

describe('What to work on', () => {
  const log = {
    L2: { right: 9, wrong: 1, skipped: 0 },
    L6: { right: 2, wrong: 5, skipped: 1, mis: { 'dfs-bfs-order': 3, 'queue-stack': 1 } },
    L10: { right: 5, wrong: 2, skipped: 1, mis: { 'k-not-outer': 2 } },
    L7: { right: 0, wrong: 1, skipped: 0, mis: { 'dfs-bfs-order': 2 } },
  };
  it('bands scores like the Roadmap', () => {
    expect([statusFor(null), statusFor(59), statusFor(60), statusFor(79), statusFor(80)]).toEqual(['untried', 'work', 'nearly', 'nearly', 'strong']);
  });
  it('counts skipped questions as not right', () => {
    const l10 = focusRows(log).find(r => r.id === 'L10')!;
    expect(l10.total).toBe(8);
    expect(l10.accuracy).toBe(63);
    expect(l10.status).toBe('nearly');
  });
  it('lists the weakest lessons first and leaves strong and untried ones out', () => {
    expect(toImprove(focusRows(log)).map(r => r.id)).toEqual(['L7', 'L6', 'L10']);
  });
  it('does not flag a lesson from skipped questions alone', () => {
    const r = focusRows({ L12: { right: 0, wrong: 0, skipped: 2 } }).find(x => x.id === 'L12')!;
    expect(r.status).toBe('untried');
    expect(r.skipped).toBe(2);
  });
  it('falls back to the best quiz score for answers saved before the log existed', () => {
    const rows = focusRows({}, { L3: 40, L4: 100 });
    expect(rows.find(r => r.id === 'L3')!.status).toBe('work');
    expect(rows.find(r => r.id === 'L4')!.status).toBe('strong');
  });
  it('names the most common mistakes and where they happened', () => {
    const top = topMistakes(log);
    expect(top[0]).toMatchObject({ id: 'dfs-bfs-order', count: 5, lessons: ['L6', 'L7'] });
    expect(top[0].label).toMatch(/DFS and BFS/);
  });
});

describe('text size', () => {
  it('keeps the scale between 85% and 160%', () => {
    expect([clampScale(0.5), clampScale(1.234), clampScale(3), clampScale('x')]).toEqual([0.85, 1.23, 1.6, 1]);
  });
  it('turns the old Larger text switch into 120% text', () => {
    expect(normaliseSettings({ largeText: true }).textScale).toBe(1.2);
    expect(normaliseSettings({ largeText: true, textScale: 1.4 }).textScale).toBe(1.4);
    expect(normaliseSettings({}).textScale).toBe(1);
  });
});
