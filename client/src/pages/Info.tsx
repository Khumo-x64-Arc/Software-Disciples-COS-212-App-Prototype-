import { CODING_AFTER, LESSONS, OUTCOMES, REFS, cite, unitById } from '../../../shared/units.mjs';
import { useApp, resolveTheme, clampScale, TEXT_SCALE, type ThemeChoice } from '../state/AppContext';
import { LANGUAGES, useI18n, type Lang } from '../i18n';
import { speechSupported } from '../speech/useSpeech';

/** The language picker, used on the welcome screen and in Settings. */
export function LanguagePicker({ id = 'lang' }: { id?: string }) {
  const { settings, updateSettings } = useApp();
  const { t } = useI18n();
  return (
    <label htmlFor={id} className="lang-picker">
      <span>🌍 {t('settings.language')}</span>
      <select id={id} value={settings.lang} onChange={e => updateSettings({ lang: e.target.value as Lang })}>
        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}{l.name !== l.english ? ` (${l.english})` : ''}</option>)}
      </select>
    </label>
  );
}

const THEMES: { id: ThemeChoice; icon: string; key: string }[] = [
  { id: 'night', icon: '🌙', key: 'settings.themeNight' },
  { id: 'day', icon: '☀️', key: 'settings.themeDay' },
  { id: 'system', icon: '🖥️', key: 'settings.themeSystem' },
];

/** Night (black and blue), Day (blue and white) or follow the device. */
export function ThemePicker() {
  const { settings, updateSettings } = useApp();
  const { t } = useI18n();
  const current = settings.theme ?? 'night';
  return (
    <fieldset className="theme-picker">
      <legend className="sr-only">{t('settings.theme')}</legend>
      {THEMES.map(th => (
        <label key={th.id} className={`theme-option${current === th.id ? ' on' : ''}`}>
          <input type="radio" name="theme" value={th.id} checked={current === th.id} onChange={() => updateSettings({ theme: th.id })} />
          <span className={`theme-swatch swatch-${th.id}`} aria-hidden="true"><i /><i /><i /></span>
          <span className="theme-name">{th.icon} {t(th.key)}</span>
          <span className="small muted">{t(`${th.key}Note`)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Text size: a slider from 85% to 160%, with A− / A+ buttons for keyboard and touch. */
export function TextSizeControl() {
  const { settings, updateSettings } = useApp();
  const { t } = useI18n();
  const scale = clampScale(settings.textScale);
  const set = (n: number) => updateSettings({ textScale: clampScale(n) });
  const pct = Math.round(scale * 100);
  return (
    <div className="text-size">
      <div className="text-size-row">
        <button type="button" className="secondary text-size-btn" onClick={() => set(scale - 0.1)} disabled={scale <= TEXT_SCALE.min} aria-label={t('settings.textSmaller')}>
          <span aria-hidden style={{ fontSize: '0.85rem' }}>A−</span>
        </button>
        <label htmlFor="text-scale" className="sr-only">{t('settings.textSize')}</label>
        <input
          id="text-scale"
          type="range"
          min={TEXT_SCALE.min}
          max={TEXT_SCALE.max}
          step={TEXT_SCALE.step}
          value={scale}
          onChange={e => set(Number(e.target.value))}
          aria-valuetext={`${pct}%`}
        />
        <button type="button" className="secondary text-size-btn" onClick={() => set(scale + 0.1)} disabled={scale >= TEXT_SCALE.max} aria-label={t('settings.textBigger')}>
          <span aria-hidden style={{ fontSize: '1.25rem' }}>A+</span>
        </button>
        <output htmlFor="text-scale" className="text-size-value" aria-live="polite">{pct}%</output>
        <button type="button" className="link-button" onClick={() => set(1)} disabled={scale === 1}>{t('settings.textReset')}</button>
      </div>
      <p className="text-size-preview">{t('settings.textPreview')}</p>
    </div>
  );
}

export function Settings() {
  const { settings, updateSettings } = useApp();
  const { t } = useI18n();
  const toggles: [keyof typeof settings, string][] = [
    ['autoRead', t('settings.autoRead')],
    ['narration', t('settings.narration')],
    ['largeText', t('settings.spacing')],
    ['reducedMotion', t('settings.reducedMotion')],
  ];
  return (
    <div>
      <h1 className="page-title">{t('settings.title')}</h1>
      <section className="card">
        <h2>{t('settings.language')}</h2>
        <LanguagePicker id="settings-lang" />
        <p className="small muted">{t('settings.languageNote')}</p>
        {settings.lang !== 'en' && <p className="draft-note small">🌍 {t('lesson.draft')}</p>}
      </section>
      <section className="card">
        <h2>{t('settings.theme')}</h2>
        <ThemePicker />
        {settings.theme === 'system' && (
          <p className="small muted">{t('settings.themeNow', { theme: t(resolveTheme('system') === 'day' ? 'settings.themeDay' : 'settings.themeNight') })}</p>
        )}
      </section>
      <section className="card">
        <h2>{t('settings.textSize')}</h2>
        <TextSizeControl />
      </section>
      <section className="card">
        <h2>{t('settings.reading')}</h2>
        {toggles.map(([k, label]) => (
          <label key={k} className="toggle setting">
            <input type="checkbox" checked={Boolean(settings[k])} onChange={e => updateSettings({ [k]: e.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
        <label>
          {t('settings.rate')}: {settings.rate.toFixed(1)}×
          <input type="range" min={0.6} max={1.6} step={0.1} value={settings.rate} onChange={e => updateSettings({ rate: Number(e.target.value) })} />
        </label>
        {!speechSupported() && <p className="callout small">This browser has no speech engine, so read-aloud buttons are hidden.</p>}
      </section>
      <section className="card">
        <h2>Accessibility</h2>
        <ul className="small">
          <li>Every graph has a text description, and every matrix is a real table.</li>
          <li>Animations only play when you press Play; you can always step by hand.</li>
          <li>Drag-and-drop questions also work with buttons: arrows to reorder, or tap a card and then a box.</li>
          <li>Colour is never the only cue: ticks, crosses, shapes and words are used too.</li>
          <li>Alt + H opens Graph Helper anywhere.</li>
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- lesson plan (lecturer)

const PLAN: { ids: string[]; mins: number; activity: string }[] = [
  { ids: ['L1'], mins: 35, activity: 'Recap with the array vs linked-list activity: count the steps to read item i. Exit question: why is an adjacency matrix a 2D array?' },
  { ids: ['L2'], mins: 40, activity: 'Watch the lesson video together, then model the class as a friendship graph on the board. Students check the handshake rule on the res graph in the app.' },
  { ids: ['L3'], mins: 40, activity: 'Sort-into-boxes warm-up (directed or not, weighted or not), then explore the six example graphs. Kₙ and trees.' },
  { ids: ['L4'], mins: 35, activity: 'Groups model one application each (taxi routes, social network, web, prerequisites) and present vertices, edges and kind.' },
  { ids: ['L5'], mins: 50, activity: 'Add and remove nodes and edges on both representations in the app; then the matrix vs list cost discussion. Coding warm-up: P1 on paper.' },
  { ids: ['L6'], mins: 45, activity: 'Watch the BFS part of the lesson video. Act out BFS with a queue of students at the door. Step the BFS trace in the app; predict each next vertex.' },
  { ids: ['L7'], mins: 45, activity: 'Watch the DFS part of the lesson video. Act out DFS as a maze walk with a stack of sticky notes. Queue vs stack checkpoint. Why visited marks matter.' },
  { ids: ['L8'], mins: 40, activity: 'Play the Orientation Week walkthrough; pause and let students predict. Then the drag-and-drop BFS and DFS order questions.' },
  { ids: ['L9', 'L10'], mins: 50, activity: 'Part 2 begins. Watch the L9 video on transitive closure; R⁺ as reachability, then Warshall’s step by step. Why k is the outermost loop.' },
  { ids: ['L11', 'L12'], mins: 50, activity: 'Compare repeated DFS and Warshall’s; model module prerequisites and read answers off the closure.' },
  { ids: ['EXAM'], mins: 45, activity: 'Bonus quest: the final exam, two questions from every lesson (L1 to L12), harder tiers. Recommended after L12; students may try it any time.' },
];

export function LessonPlan() {
  return (
    <div>
      <h1 className="page-title">Lesson plan</h1>
      <p className="lead">One main path of twelve lessons in order: Part 1, graphs and traversal (L1–L8), then Part 2, transitive closure (L9–L12). Each lesson is Learn → Watch (where a lesson has a video) → Try it → Quiz. The coding questions open after L8. The bonus quest is a final exam over all twelve lessons, recommended once they are done and never enforced.</p>
      <table className="cost-table">
        <caption className="sr-only">Lesson plan</caption>
        <thead><tr><th scope="col">Lesson</th><th scope="col">Time</th><th scope="col">Activity</th><th scope="col">Sources</th><th scope="col">CS2023</th></tr></thead>
        <tbody>
          {PLAN.map(p => (
            <tr key={p.ids.join()}>
              <th scope="row">{p.ids.map(id => (id === 'EXAM' ? 'Final exam (bonus quest)' : `${id} ${unitById(id)!.title}`)).join(' + ')}</th>
              <td>{p.mins} min</td>
              <td>{p.activity}</td>
              <td className="small">{[...new Set(p.ids.filter(id => unitById(id)).map(id => unitById(id)!.ref))].map(r => <span key={r} className="block">{cite(REFS[r])}; {REFS[r].slides}</span>)}</td>
              <td className="small">{[...new Set(p.ids.flatMap(id => unitById(id)?.outcomes ?? ['all lessons']))].map(o => <span key={o} className="chip outcome" title={OUTCOMES[o]}>{o}</span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="section-title">Assessment</h2>
      <ul>
        <li><strong>During lessons:</strong> each quiz has 5 questions mixing multiple choice, fill in the blank and drag and drop (order and sort). Tiers rise with the learner’s level.</li>
        <li><strong>After Part 1 ({CODING_AFTER.length} lessons, L1–L8):</strong> short Java coding questions on graph creation (add and remove nodes), BFS and DFS, and transitive closure. A wrong submission shows the full model solution.</li>
        <li><strong>Bonus quest:</strong> a final exam that mixes questions from all {LESSONS.length} lessons, recommended once every lesson is done (not enforced).</li>
      </ul>
      <h2 className="section-title">CS2023 coverage (AL-Foundational)</h2>
      <table className="cost-table">
        <thead><tr><th scope="col">Code</th><th scope="col">Outcome</th><th scope="col">Lessons</th></tr></thead>
        <tbody>
          {Object.entries(OUTCOMES).map(([k, v]) => (
            <tr key={k}><th scope="row">{k}</th><td>{v}</td><td>{LESSONS.filter(l => l.outcomes.includes(k)).map(l => l.id).join(', ')}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
