import { describe, expect, it } from 'vitest';
import { BANK_LESSONS, bankFor, blankCorrect, makeQuiz, type QuizQ } from './quizBank';
import { LESSONS, TIERS_BY_LEVEL } from '../../../shared/units.mjs';
import { makeExam } from './quizBank';
import { EXAM } from '../../../shared/units.mjs';
import { VIDEOS } from '../../../shared/videos.mjs';

const valid = (q: QuizQ) => {
  if (q.kind === 'mc') {
    expect(q.options.filter(o => o.correct).length, q.key).toBe(1);
    expect(q.options.length, q.key).toBeGreaterThanOrEqual(2);
    expect(new Set(q.options.map(o => o.text)).size, q.key).toBe(q.options.length);
  } else if (q.kind === 'blank') {
    expect(q.answers.length, q.key).toBeGreaterThan(0);
    expect(blankCorrect(q, `  ${q.answers[0].toUpperCase()} `), q.key).toBe(true);
  } else if (q.kind === 'order') {
    expect(q.items.length, q.key).toBeGreaterThanOrEqual(3);
    expect(new Set(q.items).size, `${q.key} items unique`).toBe(q.items.length);
  } else {
    expect(q.items.length, q.key).toBeGreaterThanOrEqual(4);
    expect(q.items.every(i => i.bucket >= 0 && i.bucket < q.buckets.length), q.key).toBe(true);
  }
};

describe('quiz bank', () => {
  it('has a bank for every lesson', () => expect(BANK_LESSONS.sort()).toEqual(LESSONS.map(l => l.id).sort()));
  for (const id of BANK_LESSONS) {
    it(`${id}: every question is well formed, every level gets 5, and all four kinds appear in the core`, () => {
      const kinds = new Set<string>();
      const keys = new Set<string>();
      for (let seed = 1; seed <= 150; seed++) {
        for (const q of bankFor(id, seed * 7919)) {
          valid(q);
          kinds.add(q.kind);
          keys.add(q.key);
        }
        for (const lvl of [1, 2, 3, 4]) {
          const quiz = makeQuiz(id, lvl, seed * 104729 + lvl);
          expect(quiz.length).toBe(5);
          expect(new Set(quiz.map(q => q.key)).size).toBe(5);
          // easy → hard
          for (let i = 1; i < quiz.length; i++) expect(quiz[i].tier).toBeGreaterThanOrEqual(quiz[i - 1].tier);
        }
      }
      if (id.startsWith('L')) expect(kinds.has('mc')).toBe(true);
      expect(keys.size).toBeGreaterThanOrEqual(5);
    });
  }
  it('harder questions as the level goes up', () => {
    const avg = (lvl: number) => {
      let s = 0;
      for (let seed = 1; seed <= 40; seed++) for (const id of BANK_LESSONS) s += makeQuiz(id, lvl, seed).reduce((a, q) => a + q.tier, 0);
      return s;
    };
    expect(avg(4)).toBeGreaterThan(avg(2));
    expect(avg(2)).toBeGreaterThan(avg(1));
    expect(Object.keys(TIERS_BY_LEVEL)).toEqual(['1', '2', '3', '4']);
  });
  it('the core lessons use all four question kinds between them', () => {
    const kinds = new Set<string>();
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']) for (const q of bankFor(id, 3)) kinds.add(q.kind);
    expect([...kinds].sort()).toEqual(['blank', 'mc', 'order', 'sort']);
  });
});

describe('final exam (bonus quest)', () => {
  it('draws two questions from every lesson, L1 to L12 in order, mostly core and challenge tiers', () => {
    for (const seed of [1, 7, 42, 2026]) {
      const exam = makeExam(seed);
      expect(exam).toHaveLength(LESSONS.length * EXAM.perLesson);
      const order = exam.map(q => q.lesson);
      expect([...new Set(order)]).toEqual(LESSONS.map(l => l.id));
      for (const l of LESSONS) {
        const mine = exam.filter(q => q.lesson === l.id);
        expect(mine).toHaveLength(EXAM.perLesson);
        expect(new Set(mine.map(q => q.key)).size).toBe(EXAM.perLesson);
      }
      expect(exam.filter(q => q.tier >= 2).length).toBeGreaterThanOrEqual(exam.length - 4);
    }
  });
  it('every lesson that has a video points at a video in the list, and the Videos tab keeps all of them', () => {
    const withVideo = LESSONS.filter(l => l.videos?.length).map(l => l.id);
    expect(withVideo).toEqual(['L2', 'L6', 'L7', 'L9']);
    for (const l of LESSONS) for (const v of l.videos ?? []) expect(VIDEOS.some(x => x.id === v)).toBe(true);
    expect(VIDEOS).toHaveLength(4);
  });
});
