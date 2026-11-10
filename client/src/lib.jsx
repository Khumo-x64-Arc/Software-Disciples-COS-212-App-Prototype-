// API client, app-wide state (auth, read-aloud, announcer, current graph, chat), and small shared UI pieces.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// ---------- storage that never throws ----------
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// ---------- API ----------
export async function api(path, { method = 'GET', body, raw } = {}) {
  const token = store.get('token');
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/login') { store.del('token'); window.dispatchEvent(new Event('signed-out')); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export async function download(path, filename) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- app context ----------
const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [readAloud, setReadAloudState] = useState(() => store.get('readAloud', false));
  const [message, setMessage] = useState('');
  const [graph, setGraph] = useState(null); // current Build a graph graph, shared with the chatbot
  const [highlight, setHighlight] = useState(null);
  const [chat, setChat] = useState({ open: false, context: null, prefill: '' });
  const readRef = useRef(readAloud);
  readRef.current = readAloud;

  useEffect(() => {
    if (!store.get('token')) { setReady(true); return; }
    api('/me').then(d => setUser(d.user)).catch(() => {}).finally(() => setReady(true));
    const out = () => setUser(null);
    window.addEventListener('signed-out', out);
    return () => window.removeEventListener('signed-out', out);
  }, []);

  const speak = useCallback((text, force = false) => {
    if (!(readRef.current || force) || !('speechSynthesis' in window) || !text) return;
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-ZA'; u.rate = 1; window.speechSynthesis.speak(u); } catch { /* no speech */ }
  }, []);
  /** Show in the announcement bar, tell screen readers (aria-live), and read aloud if switched on. */
  const announce = useCallback(text => { setMessage(text); speak(text); }, [speak]);
  const setReadAloud = v => { setReadAloudState(v); store.set('readAloud', v); if (!v && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };

  const value = useMemo(() => ({
    user, setUser, ready, readAloud, setReadAloud, speak, announce, message,
    graph, setGraph, highlight, setHighlight,
    chat, openChat: (opts = {}) => setChat({ open: true, context: opts.context || null, prefill: opts.prefill || '' }), closeChat: () => setChat(c => ({ ...c, open: false })),
  }), [user, ready, readAloud, speak, announce, message, graph, highlight, chat]);
  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="sr-only" aria-live="polite" role="status">{message}</div>
    </AppCtx.Provider>
  );
}

// ---------- small shared UI ----------
export function ReadButton({ text }) {
  const { speak } = useApp();
  if (!('speechSynthesis' in window)) return null;
  return <button className="btn small ghost readbtn" onClick={() => speak(text, true)} aria-label="Read this aloud">🔊 Read aloud</button>;
}

export const LEVELS = {
  'not-started': { label: 'Not started' },
  developing: { label: 'Developing' },
  struggling: { label: 'Struggling' },
  secure: { label: 'Secure' },
};
/** Mastery symbol: each level has its own shape as well as its own colour. */
export function LevelIcon({ level, title }) {
  const t = title || LEVELS[level]?.label || level;
  return (
    <svg className="lvl" viewBox="0 0 20 20" role="img" aria-label={t}>
      <title>{t}</title>
      {level === 'secure' && <><circle cx="10" cy="10" r="8.5" fill="#009E73" stroke="#1B1B2F" strokeWidth="1.5" /><path d="M5.8 10.3l2.8 2.8 5.6-6" fill="none" stroke="#1B1B2F" strokeWidth="2.2" strokeLinecap="round" /></>}
      {level === 'developing' && <><circle cx="10" cy="10" r="8" fill="#fff" stroke="#1B1B2F" strokeWidth="1.5" /><path d="M10 2a8 8 0 0 1 0 16z" fill="#F0E442" stroke="#1B1B2F" strokeWidth="1.5" /></>}
      {level === 'struggling' && <><path d="M10 1.5L19 17.5H1z" fill="#D55E00" stroke="#1B1B2F" strokeWidth="1.5" /><text x="10" y="15.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#1B1B2F">!</text></>}
      {(level === 'not-started' || !level) && <circle cx="10" cy="10" r="8" fill="none" stroke="#8a8a9a" strokeWidth="2" />}
    </svg>
  );
}

export function confetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const colours = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colours[i % colours.length];
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2400);
}

export function Matrix({ m, labels, colLabels, changed = [], kIndex = -1, added = [], caption }) {
  const isNew = (i, j) => changed.some(([a, b]) => a === i && b === j);
  const isAdded = (i, j) => added.some(([a, b]) => a === i && b === j);
  const cols = colLabels || labels;
  return (
    <table className="mx">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead><tr><th aria-hidden="true" />{cols.map((l, j) => <th key={j} scope="col" className={j === kIndex ? 'k' : ''}>{l}</th>)}</tr></thead>
      <tbody>
        {m.map((row, i) => (
          <tr key={i}>
            <th scope="row" className={i === kIndex ? 'k' : ''}>{labels[i]}</th>
            {row.map((v, j) => {
              const val = v === true ? 1 : v === false ? 0 : v === null ? '–' : v;
              return <td key={j} className={`${val && val !== '–' ? 'on' : ''} ${isNew(i, j) ? 'new' : ''} ${isAdded(i, j) ? 'added' : ''}`}>{val}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const pct = x => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`);
export const ago = ts => {
  if (!ts) return 'never';
  const d = Math.round((Date.now() - ts) / 864e5);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};
