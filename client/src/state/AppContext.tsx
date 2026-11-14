import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, getToken, setToken, type Mastery, type Role, type User } from '../api';
import type { Graph } from '../../../shared/graph-core.mjs';
import type { Lang } from '../i18n';

export type Settings = {
  lang: Lang;
  rate: number;
  autoRead: boolean; // read new questions and helper replies aloud
  narration: boolean; // read each trace step aloud
  announceAloud: boolean; // read Build-a-graph changes aloud (they are always announced to screen readers)
  largeText: boolean; // extra line, letter and word spacing (text size is textScale)
  textScale: number; // 0.85–1.6, multiplies the base 16px text size
  reducedMotion: boolean;
  theme: ThemeChoice; // night = black and blue, day = blue and white, system = follow the device
};
export type ThemeChoice = 'night' | 'day' | 'system';
export const defaultSettings: Settings = { lang: 'en', rate: 1, autoRead: false, narration: false, announceAloud: false, largeText: false, textScale: 1, reducedMotion: false, theme: 'night' };
export const TEXT_SCALE = { min: 0.85, max: 1.6, step: 0.05 } as const;
export const clampScale = (n: unknown) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 1;
  return Math.round(Math.min(TEXT_SCALE.max, Math.max(TEXT_SCALE.min, v)) * 100) / 100;
};
/** Fills in settings saved by older versions: the old Larger text switch becomes 120% text. */
export function normaliseSettings(s: Partial<Settings>): Settings {
  const merged = { ...defaultSettings, ...s };
  if (s.textScale === undefined && s.largeText) merged.textScale = 1.2;
  merged.textScale = clampScale(merged.textScale);
  return merged;
}

/** The theme actually shown: 'system' resolves to the device's light or dark preference. */
export function resolveTheme(choice: ThemeChoice | undefined): 'night' | 'day' {
  if (choice === 'day' || choice === 'night') return choice;
  if (choice === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'day';
  return 'night';
}

/** Puts the theme on <html data-theme> and updates the browser's theme colour. */
export function applyTheme(choice: ThemeChoice | undefined) {
  const theme = resolveTheme(choice);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'day' ? 'light' : 'dark';
  document.body.style.background = '';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#1259d6' : '#000000');
}

export type Progress = {
  settings?: Settings;
  graph?: Graph; // the Build a graph page's graph
  timeSpent?: Record<string, number>; // seconds per lesson
  rewards?: { awarded: Record<string, number> }; // reward key → points (each key is awarded once)
  done?: Record<string, boolean>; // lessons finished (a quiz completed)
  quizBest?: Record<string, number>; // best quiz score per lesson, %
  bestStreak?: number;
  examBest?: number; // best final-exam score, %
  badgesSeen?: string[];
  unitNotes?: Record<string, unknown>;
  answerLog?: AnswerLog; // every quiz and exam answer, tallied per lesson, for "What to work on"
};
export type LessonLog = { right: number; wrong: number; skipped: number; mis?: Record<string, number> };
export type AnswerLog = Record<string, LessonLog>;

type Ctx = {
  user: User | null;
  loading: boolean;
  mastery: Mastery;
  progress: Progress;
  settings: Settings;
  startGuest: () => Promise<void>;
  signIn: (name: string, studentNumber: string, group: string) => Promise<void>;
  staffSignIn: (name: string, code: string, role: Role, group: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setMastery: (m: Mastery) => void;
  updateProgress: (fn: (p: Progress) => Progress) => void;
  updateSettings: (s: Partial<Settings>) => void;
  setUser: (u: User) => void;
};

const AppContext = createContext<Ctx | null>(null);
const LOCAL_SETTINGS = 'cos212-graphs:settings';
const STUDENT_TOKEN = 'cos212-graphs:student-token'; // kept while a lecturer session is open

const local = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [mastery, setMastery] = useState<Mastery>({});
  const [progress, setProgress] = useState<Progress>({});
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return normaliseSettings(JSON.parse(local.get(LOCAL_SETTINGS) ?? '{}'));
    } catch {
      return defaultSettings;
    }
  });
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setUser(me.user);
      setMastery(me.mastery);
      const p = (me.progress ?? {}) as Progress;
      setProgress(p);
      // The language chosen on this device wins over an older saved one.
      if (p.settings) setSettings(s => normaliseSettings({ ...s, ...p.settings, lang: s.lang }));
      loaded.current = true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Save progress (debounced) once it has been loaded from the server.
  useEffect(() => {
    if (!user || !loaded.current || user.role !== 'student') return;
    const t = setTimeout(() => void api.saveProgress({ ...progress, settings }).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, [progress, settings, user]);

  useEffect(() => {
    local.set(LOCAL_SETTINGS, JSON.stringify(settings));
    document.documentElement.classList.toggle('large-text', settings.largeText);
    document.documentElement.style.fontSize = `${16 * clampScale(settings.textScale)}px`;
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    document.documentElement.lang = settings.lang;
    applyTheme(settings.theme);
    if (settings.theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [settings]);

  const begin = useCallback(
    async (token: string, u: User) => {
      setToken(token);
      setUser(u);
      setLoading(true);
      loaded.current = false;
      await refresh();
    },
    [refresh],
  );

  const startGuest = useCallback(async () => {
    const r = await api.guest();
    await begin(r.token, r.user);
  }, [begin]);

  // The current (guest) token goes with the request, so the server can move the guest's work across.
  const signIn = useCallback(
    async (name: string, studentNumber: string, group: string) => {
      const r = await api.login(name, studentNumber, group);
      setToken(r.token);
      // The sign-in form asks for POPIA consent before it is submitted.
      const c = await api.consent().catch(() => null);
      await begin(r.token, c?.user ?? r.user);
    },
    [begin],
  );

  const staffSignIn = useCallback(
    async (name: string, code: string, role: Role, group: string) => {
      const r = await api.staffLogin(name, code, role, group);
      const cur = getToken();
      if (cur && user?.role === 'student') local.set(STUDENT_TOKEN, cur);
      await begin(r.token, r.user);
    },
    [begin, user],
  );

  const signOut = useCallback(async () => {
    window.speechSynthesis?.cancel();
    await api.logout().catch(() => {});
    setToken(null);
    setMastery({});
    setProgress({});
    loaded.current = false;
    // A lecturer who signs out goes back to the student session they came from, if any.
    const back = user?.role !== 'student' ? local.get(STUDENT_TOKEN) : null;
    local.set(STUDENT_TOKEN, null);
    window.location.hash = '#/';
    if (back) {
      setToken(back);
      setLoading(true);
      await refresh();
    } else setUser(null);
  }, [refresh, user]);

  const updateProgress = useCallback((fn: (p: Progress) => Progress) => setProgress(fn), []);
  const updateSettings = useCallback((s: Partial<Settings>) => setSettings(prev => ({ ...prev, ...s })), []);

  return (
    <AppContext.Provider value={{ user, loading, mastery, progress, settings, startGuest, signIn, staffSignIn, signOut, refresh, setMastery, updateProgress, updateSettings, setUser }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/** Counts seconds spent on a lesson page (for the lecturer's student profile). */
export function useTimeOnUnit(unit: string) {
  const { updateProgress } = useApp();
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState !== 'visible') {
        last = Date.now();
        return;
      }
      const now = Date.now();
      const secs = Math.round((now - last) / 1000);
      last = now;
      if (secs > 0 && secs < 120) updateProgress(p => ({ ...p, timeSpent: { ...(p.timeSpent ?? {}), [unit]: (p.timeSpent?.[unit] ?? 0) + secs } }));
    };
    const t = setInterval(tick, 30000);
    return () => {
      tick();
      clearInterval(t);
    };
  }, [unit, updateProgress]);
}
