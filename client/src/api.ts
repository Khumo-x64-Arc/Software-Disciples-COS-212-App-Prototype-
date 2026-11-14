// Client for the Node/Express API. The session token lives in localStorage.
import type { HelperAnswer, HelperContext } from '../../shared/graph-helper.mjs';
import type { Level } from '../../shared/units.mjs';

export type VideoItem = { id: string; n: number; watchUrl: string; thumbnail: string; embedUrl: string; lessons: string[]; title: string | null; channel: string | null };
export type Role = 'student' | 'tutor' | 'lecturer';
export type User = { id: string; name: string; studentNumber: string; role: Role; group: string | null; consentAt: string | null; guest?: boolean };
export type Mastery = Record<string, { attempts: number; best: number; level: Level }>;

export type ProblemState = { code: string; attempts: number; failedAttempts: number; passed: boolean; hintLevel: number; hintAvailable: boolean; hints: string[]; solution: string | null };
export type Problem = {
  id: string; title: string; level: 'Warm-up' | 'Core' | 'Challenge'; unit: string; outcomes: string[]; className: string;
  task: string; api: string[]; starter: string;
  samples: { input: string; expected: string }[]; state: ProblemState;
};
export type Misconception = { id: string; label: string; hint: string; pointsTo: string };
export type GradeResult = {
  status: 'passed' | 'failed' | 'compile-error' | 'blocked';
  passed: boolean;
  passedCount?: number;
  total?: number;
  compileErrors?: { line: number | null; message: string; raw: string }[];
  issues?: { kind: string; line: number; message: string }[];
  tests?: { name: string; caseType: string; visible: boolean; passed: boolean; status: string; input?: string; expected?: string; actual?: string }[];
  failedCaseTypes?: string[];
  runtimeError?: string | null;
  misconception?: Misconception | null;
  solution?: string | null; // the full model answer, after a wrong submission
};

const TOKEN_KEY = 'cos212-graphs:token';
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked */
  }
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'The server can’t be reached. Check your connection and try again.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const post = <T,>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => call<{ ok: boolean; java: boolean }>('/health'),
  guest: () => post<{ token: string; user: User }>('/guest', {}),
  login: (name: string, studentNumber: string, group: string) => post<{ token: string; user: User }>('/login', { name, studentNumber, group }),
  staffLogin: (name: string, code: string, role: Role, group: string) => post<{ token: string; user: User }>('/staff/login', { name, code, role, group }),
  logout: () => post('/logout', {}),
  consent: () => post<{ user: User }>('/me/consent', {}),
  me: () => call<{ user: User; progress: Record<string, unknown> | null; mastery: Mastery; threshold: number }>('/me'),
  saveProgress: (progress: unknown) => call('/me/progress', { method: 'PUT', body: JSON.stringify({ progress }) }),
  check: (unit: string, correct: number, total: number, misconceptions: string[]) =>
    post<{ score: number; passed: boolean; mastery: Mastery }>('/checks', { unit, correct, total, misconceptions }),
  problems: () => call<{ problems: Problem[] }>('/problems'),
  submit: (id: string, code: string) => post<{ result: GradeResult; state: ProblemState }>(`/problems/${id}/submit`, { code }),
  tryInput: (id: string, code: string, input: string) =>
    post<{ status?: string; actual?: string; expected?: string; passed?: boolean; compileErrors?: GradeResult['compileErrors']; issues?: GradeResult['issues'] }>(`/problems/${id}/try`, { code, input }),
  hint: (id: string) => post<{ state: ProblemState }>(`/problems/${id}/hint`, {}),
  chat: (message: string, context: HelperContext) => post<HelperAnswer>('/chat', { message, context }),
  videos: () => call<{ videos: VideoItem[] }>('/videos'),
  dashboard: (q: Record<string, string>) => call<Dashboard>(`/dashboard?${new URLSearchParams(q)}`),
  student: (id: string, q: Record<string, string>) => call<StudentProfile>(`/dashboard/students/${id}?${new URLSearchParams(q)}`),
  exportUrl: (view: string, q: Record<string, string>) => `/api/dashboard/export.csv?${new URLSearchParams({ ...q, view })}`,
};

export type Dashboard = {
  range: { from: string; to: string };
  mostAsked: { question: string; count: number; previous: number; trend: 'rising' | 'falling' | 'steady' }[];
  unanswered: string[];
  overview: {
    units: { id: string; title: string; attempted: number; secure: number; rate: number | null }[];
    problems: { id: string; title: string; attempted: number; passed: number; rate: number | null }[];
    misconceptions: { id: string; label: string; count: number }[];
    outcomes: { outcome: string; rate: number | null }[];
    exam: { attempted: number; passed: number; rate: number | null; passMark: number };
  };
  struggle: { units: string[]; rows: { id: string; studentNumber: string; name: string; group: string; guest: boolean; points: number; rank: string; levels: Record<string, Level> }[] };
  needsHelp: { id: string; studentNumber: string; units: string[] }[];
  students: number;
};

export type StudentProfile = {
  student: { id: string; studentNumber: string; name: string; group: string; guest: boolean };
  points: number;
  rank: string;
  summary: Record<Level, number>;
  units: { id: string; title: string; level: Level; attempts: number; best: number | null; last: number | null }[];
  problems: { id: string; title: string; status: string; attempts: number; failedCaseTypes: string[]; misconception: string | null; hintLevel: number }[];
  misconceptions: { id: string; label: string; count: number }[];
  highestHintLevel: number;
  timeSpentMinutes: number;
  exam: { attempts: number; best: number | null };
  lastActivity: string | null;
  suggestion: string;
};
