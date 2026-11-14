import { CLOSURE, CORE, OUTCOMES, REFS, cite, unitById } from '../../../shared/units.mjs';
import { useApp } from '../state/AppContext';
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

export function Settings() {
  const { settings, updateSettings } = useApp();
  const { t } = useI18n();
  const toggles: [keyof typeof settings, string][] = [
    ['autoRead', t('settings.autoRead')],
    ['narration', t('settings.narration')],
    ['largeText', t('settings.largeText')],
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
  { ids: ['L2'], mins: 40, activity: 'Model the class as a friendship graph on the board. Students check the handshake rule on the res graph in the app.' },
  { ids: ['L3'], mins: 40, activity: 'Sort-into-boxes warm-up (directed or not, weighted or not), then explore the six example graphs. Kₙ and trees.' },
  { ids: ['L4'], mins: 35, activity: 'Groups model one application each (taxi routes, social network, web, prerequisites) and present vertices, edges and kind.' },
  { ids: ['L5'], mins: 50, activity: 'Add and remove nodes and edges on both representations in the app; then the matrix vs list cost discussion. Coding warm-up: P1 on paper.' },
  { ids: ['L6'], mins: 45, activity: 'Act out BFS with a queue of students at the door. Step the BFS trace in the app; predict each next vertex.' },
  { ids: ['L7'], mins: 45, activity: 'Act out DFS as a maze walk with a stack of sticky notes. Queue vs stack checkpoint. Why visited marks matter.' },
  { ids: ['L8'], mins: 40, activity: 'Play the Orientation Week walkthrough; pause and let students predict. Then the drag-and-drop BFS and DFS order questions.' },
  { ids: ['U5', 'U6'], mins: 50, activity: 'Bonus (from Rookie): R⁺ as reachability, then Warshall’s step by step. Why k is the outermost loop.' },
  { ids: ['U7', 'U8'], mins: 50, activity: 'Bonus: compare repeated DFS and Warshall’s; model module prerequisites and read answers off the closure.' },
];

export function LessonPlan() {
  return (
    <div>
      <h1 className="page-title">Lesson plan</h1>
      <p className="lead">Eight core lessons, then the Transitive closure bonus quest (recommended from Level 2, Rookie; never enforced). Each lesson is Learn → Try it → Quiz, and the coding questions open after L8.</p>
      <table className="cost-table">
        <caption className="sr-only">Lesson plan</caption>
        <thead><tr><th scope="col">Lesson</th><th scope="col">Time</th><th scope="col">Activity</th><th scope="col">Sources</th><th scope="col">CS2023</th></tr></thead>
        <tbody>
          {PLAN.map(p => (
            <tr key={p.ids.join()}>
              <th scope="row">{p.ids.map(id => `${id} ${unitById(id)!.title}`).join(' + ')}</th>
              <td>{p.mins} min</td>
              <td>{p.activity}</td>
              <td className="small">{[...new Set(p.ids.map(id => unitById(id)!.ref))].map(r => <span key={r} className="block">{cite(REFS[r])}; {REFS[r].slides}</span>)}</td>
              <td className="small">{[...new Set(p.ids.flatMap(id => unitById(id)!.outcomes))].map(o => <span key={o} className="chip outcome" title={OUTCOMES[o]}>{o}</span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="section-title">Assessment</h2>
      <ul>
        <li><strong>During lessons:</strong> each quiz has 5 questions mixing multiple choice, fill in the blank and drag and drop (order and sort). Tiers rise with the learner’s level.</li>
        <li><strong>After all {CORE.length} core lessons:</strong> short Java coding questions on graph creation (add and remove nodes), BFS and DFS, and transitive closure. A wrong submission shows the full model solution.</li>
        <li><strong>Bonus:</strong> the {CLOSURE.length} Transitive closure lessons and P5–P9.</li>
      </ul>
      <h2 className="section-title">CS2023 coverage (AL-Foundational)</h2>
      <table className="cost-table">
        <thead><tr><th scope="col">Code</th><th scope="col">Outcome</th><th scope="col">Lessons</th></tr></thead>
        <tbody>
          {Object.entries(OUTCOMES).map(([k, v]) => (
            <tr key={k}><th scope="row">{k}</th><td>{v}</td><td>{[...CORE, ...CLOSURE].filter(l => l.outcomes.includes(k)).map(l => l.id).join(', ')}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
