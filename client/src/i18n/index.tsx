// Interface and lesson-text translations for the eleven official written
// languages of South Africa. English is the source; a missing key falls back to it.
// The non-English text is a DRAFT for review by first-language speakers.
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import en, { type LessonText, type Locale } from './locales/en';
import zu from './locales/zu';
import xh from './locales/xh';
import nso from './locales/nso';
import af from './locales/af';
import tn from './locales/tn';
import st from './locales/st';
import ts from './locales/ts';
import ss from './locales/ss';
import ve from './locales/ve';
import nr from './locales/nr';

export type Lang = 'en' | 'zu' | 'xh' | 'nso' | 'af' | 'tn' | 'st' | 'ts' | 'ss' | 've' | 'nr';

export const LANGUAGES: { code: Lang; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'zu', name: 'isiZulu', english: 'Zulu' },
  { code: 'xh', name: 'isiXhosa', english: 'Xhosa' },
  { code: 'nso', name: 'Sepedi', english: 'Sepedi (Northern Sotho)' },
  { code: 'af', name: 'Afrikaans', english: 'Afrikaans' },
  { code: 'tn', name: 'Setswana', english: 'Tswana' },
  { code: 'st', name: 'Sesotho', english: 'Southern Sotho' },
  { code: 'ts', name: 'Xitsonga', english: 'Tsonga' },
  { code: 'ss', name: 'siSwati', english: 'Swati' },
  { code: 've', name: 'Tshivenḓa', english: 'Venda' },
  { code: 'nr', name: 'isiNdebele', english: 'Southern Ndebele' },
];

const LOCALES: Record<Lang, Partial<Locale>> = { en, zu, xh, nso, af, tn, st, ts, ss, ve, nr };

export type T = (key: string, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const s = LOCALES[lang]?.ui?.[key] ?? en.ui[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}

export function lessonText(lang: Lang, id: string): LessonText {
  const base = en.lessons[id];
  const tr = LOCALES[lang]?.lessons?.[id];
  if (!tr) return base;
  return { ...base, ...tr, points: tr.points?.length === base.points.length ? tr.points : base.points };
}

type Ctx = { lang: Lang; t: T; lesson: (id: string) => LessonText; isDraft: boolean };
const I18nCtx = createContext<Ctx>({ lang: 'en', t: (k, v) => translate('en', k, v), lesson: id => lessonText('en', id), isDraft: false });

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = useCallback<T>((k, v) => translate(lang, k, v), [lang]);
  const lesson = useCallback((id: string) => lessonText(lang, id), [lang]);
  const value = useMemo(() => ({ lang, t, lesson, isDraft: lang !== 'en' }), [lang, t, lesson]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);
export const useT = () => useContext(I18nCtx).t;

/** Keys used by the app but missing from a language (for the review checklist). */
export function missingKeys(lang: Lang): string[] {
  const loc = LOCALES[lang];
  const ui = Object.keys(en.ui).filter(k => !loc.ui?.[k]);
  const lessons = Object.keys(en.lessons).filter(k => !loc.lessons?.[k]).map(k => `lesson ${k}`);
  return [...ui, ...lessons];
}
