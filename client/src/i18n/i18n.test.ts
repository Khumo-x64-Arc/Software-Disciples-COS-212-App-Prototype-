import { describe, expect, it } from 'vitest';
import en from './locales/en';
import { LANGUAGES, lessonText, missingKeys, translate } from './index';

describe('translations', () => {
  it('offers all eleven official written languages', () => expect(LANGUAGES.length).toBe(11));
  for (const { code } of LANGUAGES) {
    it(`${code}: every lesson is translated, placeholders match English`, () => {
      for (const id of Object.keys(en.lessons)) {
        const t = lessonText(code, id);
        expect(t.points.length).toBe(en.lessons[id].points.length);
        if (code !== 'en') expect(t.title, `${code} ${id}`).not.toBe(en.lessons[id].title);
      }
      for (const key of Object.keys(en.ui)) {
        const want = (en.ui[key].match(/\{\w+\}/g) ?? []).sort().join();
        const got = (translate(code, key).match(/\{\w+\}/g) ?? []).sort().join();
        expect(got, `${code} ${key}`).toBe(want);
      }
      expect(missingKeys(code).filter(k => k.startsWith('lesson ')), code).toEqual([]);
    });
  }
});
