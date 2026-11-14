// Points, the four levels, badges, the chatbot's "well done / try again"
// notifications and the level-up pop-up.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EXAM, LESSONS, LEVELS, PART1, PART2, levelFor } from '../../../shared/units.mjs';
import { useApp, type Progress } from './AppContext';
import { useT } from '../i18n';
import { Confetti } from '../components/ui';

export type Badge = { id: string; icon: string; colors: [string, string]; earned: (p: Progress, points: number) => boolean };

const done = (p: Progress, ids: string[]) => ids.every(id => p.done?.[id]);
const best = (p: Progress, id: string) => p.quizBest?.[id] ?? 0;
const awardedKeys = (p: Progress) => Object.keys(p.rewards?.awarded ?? {});

export const BADGES: Badge[] = [
  { id: 'first-answer', icon: '🎯', colors: ['#1a73ff', '#00c2ff'], earned: p => awardedKeys(p).some(k => k.startsWith('q:')) },
  { id: 'first-lesson', icon: '📘', colors: ['#3d5afe', '#8c9eff'], earned: p => Object.values(p.done ?? {}).some(Boolean) },
  { id: 'array-ace', icon: '📦', colors: ['#ff9100', '#ffd180'], earned: p => best(p, 'L1') >= 80 },
  { id: 'graph-explorer', icon: '🕸️', colors: ['#00bfa5', '#64ffda'], earned: p => done(p, ['L2', 'L3', 'L4']) },
  { id: 'builder', icon: '🧱', colors: ['#ff5252', '#ff8a80'], earned: p => best(p, 'L5') >= 80 },
  { id: 'wave-rider', icon: '🌊', colors: ['#2979ff', '#82b1ff'], earned: p => best(p, 'L6') >= 80 },
  { id: 'deep-diver', icon: '🤿', colors: ['#651fff', '#b388ff'], earned: p => best(p, 'L7') >= 80 },
  { id: 'pathfinder', icon: '🧭', colors: ['#00c853', '#b9f6ca'], earned: p => Boolean(p.done?.L8) },
  { id: 'part1-complete', icon: '🗺️', colors: ['#00b8d4', '#84ffff'], earned: p => done(p, PART1.map(l => l.id)) },
  { id: 'core-complete', icon: '🏁', colors: ['#ffd600', '#fff59d'], earned: p => done(p, LESSONS.map(l => l.id)) },
  { id: 'coder', icon: '💻', colors: ['#00e5ff', '#18ffff'], earned: p => awardedKeys(p).some(k => k.startsWith('problem:')) },
  { id: 'bug-hunter', icon: '🐞', colors: ['#d50000', '#ff8a80'], earned: p => awardedKeys(p).includes('problem:P9') },
  { id: 'closure-champ', icon: '🔗', colors: ['#aa00ff', '#ea80fc'], earned: p => done(p, PART2.map(l => l.id)) },
  { id: 'quest-taken', icon: '📝', colors: ['#6200ea', '#b388ff'], earned: p => p.examBest !== undefined },
  { id: 'exam-ace', icon: '🎖️', colors: ['#ff6d00', '#ffd180'], earned: p => (p.examBest ?? 0) >= EXAM.passMark },
  { id: 'streak-5', icon: '🔥', colors: ['#ff3d00', '#ffab40'], earned: p => (p.bestStreak ?? 0) >= 5 },
  { id: 'perfect', icon: '💯', colors: ['#c51162', '#ff80ab'], earned: p => Object.values(p.quizBest ?? {}).some(x => x === 100) },
  { id: 'rookie', icon: LEVELS[1].icon, colors: ['#1a73ff', '#7fb2ff'], earned: (_p, pts) => pts >= LEVELS[1].min },
  { id: 'master', icon: LEVELS[2].icon, colors: ['#304ffe', '#b0bec5'], earned: (_p, pts) => pts >= LEVELS[2].min },
  { id: 'legend', icon: LEVELS[3].icon, colors: ['#ffab00', '#ffe57f'], earned: (_p, pts) => pts >= LEVELS[3].min },
];

export const pointsOf = (p: Progress) => Object.values(p.rewards?.awarded ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);

type Toast = { id: number; tone: 'good' | 'retry' | 'badge' | 'info'; text: string; icon?: string };
type Ctx = {
  points: number;
  level: ReturnType<typeof levelFor>;
  earned: Badge[];
  streak: number;
  /** True once every lesson is done: the final exam (bonus quest) is recommended. Never enforced. */
  examRecommended: boolean;
  /** Awards points once per key. Returns the points actually added (0 if already awarded). */
  award: (key: string, pts: number) => number;
  /** Records a quiz answer: updates the streak and shows the chatbot notification. */
  answered: (correct: boolean, pts: number) => void;
  notify: (tone: Toast['tone'], text: string, icon?: string) => void;
};

const RewardsCtx = createContext<Ctx | null>(null);
export function useRewards(): Ctx {
  const c = useContext(RewardsCtx);
  if (!c) throw new Error('useRewards must be used inside <RewardsProvider>');
  return c;
}

let toastId = 1;

export function RewardsProvider({ children }: { children: ReactNode }) {
  const { progress, updateProgress, settings } = useApp();
  const t = useT();
  const points = pointsOf(progress);
  const level = levelFor(points);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<{ n: number; name: string; icon: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const streakRef = useRef(0);
  const earned = useMemo(() => BADGES.filter(b => b.earned(progress, points)), [progress, points]);

  const notify = useCallback((tone: Toast['tone'], text: string, icon?: string) => {
    const id = toastId++;
    setToasts(ts => [...ts.slice(-2), { id, tone, text, icon }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4200);
  }, []);

  // A synchronous copy of the awarded keys, so two awards in one tick cannot double-count.
  const awardedRef = useRef<Record<string, number>>({});
  awardedRef.current = { ...(progress.rewards?.awarded ?? {}), ...awardedRef.current };
  const award = useCallback(
    (key: string, pts: number) => {
      if (awardedRef.current[key] !== undefined || progress.rewards?.awarded?.[key] !== undefined) return 0;
      awardedRef.current[key] = pts;
      updateProgress(p => ({ ...p, rewards: { awarded: { ...(p.rewards?.awarded ?? {}), [key]: pts } } }));
      return pts;
    },
    [progress.rewards, updateProgress],
  );

  const answered = useCallback(
    (correct: boolean, pts: number) => {
      if (correct) {
        const n = streakRef.current + 1;
        streakRef.current = n;
        setStreak(n);
        if (n > (progress.bestStreak ?? 0)) updateProgress(p => ({ ...p, bestStreak: Math.max(n, p.bestStreak ?? 0) }));
        notify('good', pts > 0 ? t('fb.welldone', { n: pts }) : t('fb.welldoneNoPts'), '🎉');
        if (n === 3 || n === 5 || n === 10) notify('info', t('home.streak', { n }), '🔥');
      } else {
        streakRef.current = 0;
        setStreak(0);
        notify('retry', t('fb.tryagain'), '🤖');
      }
    },
    [notify, progress.bestStreak, t, updateProgress],
  );

  // Level-up pop-up: compare with the level we last saw in this session.
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    if (lastLevel.current !== null && level.n > lastLevel.current) setLevelUp({ n: level.n, name: level.name, icon: level.icon });
    lastLevel.current = level.n;
  }, [level.n, level.name, level.icon]);

  // Badge notifications: only for badges earned during this session.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = earned.map(b => b.id);
    if (seen.current === null) {
      seen.current = new Set([...(progress.badgesSeen ?? []), ...ids]);
      return;
    }
    const fresh = ids.filter(id => !seen.current!.has(id));
    if (!fresh.length) return;
    for (const id of fresh) {
      seen.current.add(id);
      const b = BADGES.find(x => x.id === id)!;
      notify('badge', t('fb.badge', { name: t(`badge.${id}`) }), b.icon);
    }
    updateProgress(p => ({ ...p, badgesSeen: [...seen.current!] }));
  }, [earned, notify, progress.badgesSeen, t, updateProgress]);

  const value = useMemo<Ctx>(
    () => ({ points, level, earned, streak, examRecommended: done(progress, LESSONS.map(l => l.id)), award, answered, notify }),
    [points, level, earned, streak, progress, award, answered, notify],
  );

  return (
    <RewardsCtx.Provider value={value}>
      {children}
      <div className="bot-toasts" aria-live="polite" aria-atomic="false">
        {toasts.map(x => (
          <div key={x.id} className={`bot-toast tone-${x.tone}`} role="status">
            <span className="bot-toast-avatar" aria-hidden>{x.icon ?? '🤖'}</span>
            <span className="bot-toast-text"><span className="bot-toast-name">{t('chat.title')}</span>{x.text}</span>
          </div>
        ))}
      </div>
      {levelUp && <LevelUpModal level={levelUp} confetti={!settings.reducedMotion} onClose={() => setLevelUp(null)} />}
    </RewardsCtx.Provider>
  );
}

function LevelUpModal({ level, confetti, onClose }: { level: { n: number; name: string; icon: string }; confetti: boolean; onClose: () => void }) {
  const t = useT();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <Confetti show={confetti} />
      <div className="levelup" role="alertdialog" aria-modal="true" aria-labelledby="lvl-h" aria-describedby="lvl-d" onClick={e => e.stopPropagation()}>
        <div className="levelup-icon" aria-hidden>{level.icon}</div>
        <p className="levelup-kicker">{t('fb.levelUp')}</p>
        <h2 id="lvl-h" className="levelup-title">{t(`level.${level.name}`)}</h2>
        <p id="lvl-d">{t('fb.levelUpMsg', { n: level.n, name: t(`level.${level.name}`) })}.</p>
        <button ref={btn} type="button" onClick={onClose}>{t('fb.close')}</button>
      </div>
    </div>
  );
}
