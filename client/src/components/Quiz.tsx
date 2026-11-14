// A lesson quiz: five questions (multiple choice, fill in the blank, put in
// order, sort into boxes) with instant feedback, points, and a chatbot
// notification after every answer. Questions get harder as the level rises.
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { api } from '../api';
import { blankCorrect, makeQuiz, type BlankQ, type MCQ, type OrderQ, type SortQ } from '../lib/quizBank';
import { POINTS, unitById } from '../../../shared/units.mjs';
import { useApp } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useT } from '../i18n';
import { useSpeech } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';
import { GraphCanvas } from './GraphCanvas';
import { MatrixTable } from './ui';
import { useHelper } from './HelperChat';
import { shuffle } from '../lib/checkKit';
import { rng } from '../../../shared/graph-core.mjs';

const LETTERS = 'ABCDE';
type Answer = { correct: boolean; misconception?: string; points: number };

export function Quiz({ lesson, onFinished }: { lesson: string; onFinished?: (score: number) => void }) {
  const { setMastery, updateProgress } = useApp();
  const { level, award, answered, notify } = useRewards();
  const t = useT();
  const helper = useHelper();
  const [seed, setSeed] = useState(() => Date.now());
  // The level is read when a quiz starts, so it does not change mid-quiz.
  const startLevel = useRef(level.n);
  const questions = useMemo(() => makeQuiz(lesson, startLevel.current, seed), [lesson, seed]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [checked, setChecked] = useState<{ correct: boolean; why?: string; shown?: string } | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const { speak, stop, active, supported } = useSpeech();
  const q = questions[index];

  const { setContext } = helper;
  useEffect(() => {
    setContext(c => (c.unit === lesson ? c : { ...c, unit: lesson }));
  }, [lesson, setContext]);

  const submit = (correct: boolean, why?: string, shown?: string, misconception?: string) => {
    if (checked) return;
    stop();
    const pts = correct ? award(`q:${lesson}:${q.key}`, POINTS.question[q.tier]) : 0;
    answered(correct, pts);
    setChecked({ correct, why, shown });
    setAnswers(a => [...a, { correct, misconception: correct ? undefined : misconception ?? q.misconception, points: pts }]);
  };

  const next = async () => {
    stop();
    setChecked(null);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      requestAnimationFrame(() => headRef.current?.focus());
      return;
    }
    const all = answers;
    const correct = all.filter(a => a.correct).length;
    const pct = Math.round((100 * correct) / questions.length);
    setScore(pct);
    updateProgress(p => ({ ...p, done: { ...(p.done ?? {}), [lesson]: true }, quizBest: { ...(p.quizBest ?? {}), [lesson]: Math.max(pct, p.quizBest?.[lesson] ?? 0) } }));
    const lp = award(`lesson:${lesson}`, POINTS.lesson);
    if (lp) notify('good', t('fb.lessonDone', { n: lp }), '🏅');
    onFinished?.(pct);
    try {
      const r = await api.check(lesson, correct, questions.length, all.map(a => a.misconception).filter((m): m is string => Boolean(m)));
      setMastery(r.mastery);
    } catch {
      /* offline: the result still counts locally */
    }
  };

  const retry = () => {
    startLevel.current = level.n;
    setSeed(Date.now());
    setIndex(0);
    setAnswers([]);
    setChecked(null);
    setScore(null);
  };

  if (score !== null) {
    const earned = answers.reduce((a, b) => a + b.points, 0);
    return (
      <section className="card quiz-result" aria-labelledby="quiz-result">
        <h2 id="quiz-result" tabIndex={-1}>{t('quiz.score', { score })}</h2>
        <div className="result-stars" aria-hidden>{'★'.repeat(Math.round(score / 20))}{'☆'.repeat(5 - Math.round(score / 20))}</div>
        <p className="lead">{score >= 80 ? t('road.strong') : score >= 60 ? t('road.ok') : t('road.revisit')}</p>
        {earned > 0 && <p className="points-pill">{t('quiz.earned', { n: earned })}</p>}
        {answers.some(a => !a.correct) && (
          <details>
            <summary>{t('road.revisit')}</summary>
            <ul>{questions.map((qq, i) => (!answers[i]?.correct ? <li key={qq.key}>{qq.explain}</li> : null))}</ul>
          </details>
        )}
        <div className="button-row">
          <button type="button" className="secondary" onClick={retry}>{t('quiz.again')}</button>
        </div>
      </section>
    );
  }
  if (!q) return null;

  return (
    <section className="card quiz" aria-labelledby="quiz-head">
      <div className="question-meta">
        <h2 id="quiz-head" ref={headRef} tabIndex={-1}>{t('quiz.question', { i: index + 1, n: questions.length })}</h2>
        <span className={`tier tier-${q.tier}`}>{t(`quiz.tier${q.tier}`)} · +{POINTS.question[q.tier]}</span>
        <div className="dots" aria-hidden>
          {questions.map((_, i) => <span key={i} className={`dot ${i < answers.length ? (answers[i].correct ? 'done' : 'missed') : ''} ${i === index ? 'current' : ''}`} />)}
        </div>
        <span className="spacer" />
        {supported && (
          <button type="button" className={`speaker ${active ? 'reading' : ''}`} onClick={() => (active ? stop() : speak([{ key: 'q', say: toSpoken(q.prompt) }]))}>
            {active ? '■' : '🔊'} <span className="sr-only">Read the question</span>
          </button>
        )}
      </div>
      <p className="prompt">{q.prompt}</p>
      {q.code && <pre className="code-block">{q.code}</pre>}
      {q.graph && <GraphCanvas graph={q.graph} title="Graph for this question" highlight={q.tags ? { tags: q.tags } : undefined} />}
      {q.matrix && <MatrixTable labels={q.matrix.labels} matrix={q.matrix.cells} caption={q.matrix.caption} kRow={q.matrix.kRow} />}

      {q.kind === 'mc' && <McAnswer key={q.key + seed} q={q} done={checked !== null} onAnswer={submit} />}
      {q.kind === 'blank' && <BlankAnswer key={q.key + seed} q={q} done={checked !== null} onAnswer={submit} />}
      {q.kind === 'order' && <OrderAnswer key={q.key + seed} q={q} seed={seed} done={checked !== null} onAnswer={submit} />}
      {q.kind === 'sort' && <SortAnswer key={q.key + seed} q={q} seed={seed} done={checked !== null} onAnswer={submit} />}

      {checked && (
        <div className={`feedback ${checked.correct ? 'ok' : 'no'}`} role="status">
          <p className="feedback-head"><strong>{checked.correct ? `✓ ${t('quiz.correct')}` : `✗ ${t('quiz.wrong')}`}</strong></p>
          {!checked.correct && checked.why && <p>{checked.why}</p>}
          {!checked.correct && checked.shown && <p>{t('quiz.answerWas', { a: checked.shown })}</p>}
          <p>{q.explain}</p>
          <div className="button-row">
            <button type="button" onClick={() => void next()} autoFocus>{index + 1 < questions.length ? t('quiz.next') : t('quiz.finish')}</button>
            {!checked.correct && <button type="button" className="secondary" onClick={() => helper.open(`Explain: ${q.prompt}`)}>💬 {t('home.ask')}</button>}
          </div>
        </div>
      )}
    </section>
  );
}

type OnAnswer = (correct: boolean, why?: string, shown?: string, misconception?: string) => void;

function McAnswer({ q, done, onAnswer }: { q: MCQ; done: boolean; onAnswer: OnAnswer }) {
  const [chosen, setChosen] = useState<number | null>(null);
  return (
    <div className="options" role="group" aria-label="Answer options">
      {q.options.map((o, i) => {
        const state = chosen === null ? '' : o.correct ? 'right' : chosen === i ? 'wrong' : 'dim';
        return (
          <button
            key={o.text}
            type="button"
            className={`option ${state}`}
            disabled={done}
            onClick={() => {
              setChosen(i);
              onAnswer(Boolean(o.correct), o.why, q.options.find(x => x.correct)?.text, o.misconception);
            }}
          >
            <span className="option-letter" aria-hidden>{LETTERS[i]}</span>
            <span>{o.text}</span>
            {state === 'right' && <span className="sr-only">, correct answer</span>}
            {state === 'wrong' && <span className="sr-only">, your answer, wrong</span>}
          </button>
        );
      })}
    </div>
  );
}

function BlankAnswer({ q, done, onAnswer }: { q: BlankQ; done: boolean; onAnswer: OnAnswer }) {
  const t = useT();
  const [text, setText] = useState('');
  const ok = done && blankCorrect(q, text);
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || done) return;
    onAnswer(blankCorrect(q, text), undefined, q.answers[0]);
  };
  return (
    <form className="blank-form" onSubmit={go}>
      <label className="sr-only" htmlFor="blank-input">{t('quiz.typeHere')}</label>
      <input id="blank-input" className={done ? (ok ? 'input-right' : 'input-wrong') : ''} value={text} onChange={e => setText(e.target.value)} placeholder={t('quiz.typeHere')} autoComplete="off" disabled={done} autoFocus />
      <button type="submit" disabled={done || !text.trim()}>{t('quiz.check')}</button>
    </form>
  );
}

/** Put in order: drag the cards (mouse) or use the arrow buttons (keyboard, touch). */
function OrderAnswer({ q, seed, done, onAnswer }: { q: OrderQ; seed: number; done: boolean; onAnswer: OnAnswer }) {
  const t = useT();
  const [items, setItems] = useState(() => {
    const r = rng(seed ^ q.items.length);
    let s = shuffle(r, q.items);
    for (let k = 0; k < 5 && s.join() === q.items.join(); k++) s = shuffle(r, q.items);
    return s;
  });
  const [dragging, setDragging] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || done) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setItems(next);
  };
  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    if (dragging !== null) move(dragging, to);
    setDragging(null);
  };
  const right = items.join('\u0000') === q.items.join('\u0000');
  return (
    <div>
      <p className="small muted">{t('quiz.orderHint')}</p>
      <ol className="order-list" aria-label="Your order">
        {items.map((x, i) => (
          <li
            key={x}
            className={`order-card ${dragging === i ? 'dragging' : ''} ${done ? (q.items[i] === x ? 'right' : 'wrong') : ''}`}
            draggable={!done}
            onDragStart={() => setDragging(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={e => onDrop(e, i)}
            onDragEnd={() => setDragging(null)}
          >
            <span className="order-num" aria-hidden>{i + 1}</span>
            <span className="order-text">{x}</span>
            <span className="order-grip" aria-hidden>⋮⋮</span>
            <span className="order-buttons">
              <button type="button" className="mini" onClick={() => move(i, i - 1)} disabled={done || i === 0} aria-label={`${t('quiz.up')}: ${x}`}>↑</button>
              <button type="button" className="mini" onClick={() => move(i, i + 1)} disabled={done || i === items.length - 1} aria-label={`${t('quiz.down')}: ${x}`}>↓</button>
            </span>
          </li>
        ))}
      </ol>
      {!done && <button type="button" onClick={() => onAnswer(right, undefined, q.items.join(' → '))}>{t('quiz.check')}</button>}
    </div>
  );
}

/** Sort into boxes: drag a card onto a box, or tap a card and then a box. */
function SortAnswer({ q, seed, done, onAnswer }: { q: SortQ; seed: number; done: boolean; onAnswer: OnAnswer }) {
  const t = useT();
  const cards = useMemo(() => shuffle(rng(seed ^ 77), q.items.map(i => i.text)), [q.items, seed]);
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const pool = cards.filter(c => placed[c] === undefined);
  const bucketOf = (text: string) => q.items.find(i => i.text === text)!.bucket;
  const place = (card: string | null, b: number) => {
    if (!card || done) return;
    setPlaced(p => ({ ...p, [card]: b }));
    setSelected(null);
  };
  const unplace = (card: string) => {
    if (done) return;
    setPlaced(p => {
      const n = { ...p };
      delete n[card];
      return n;
    });
  };
  const right = q.items.every(i => placed[i.text] === i.bucket);
  const chip = (c: string, inBucket: boolean) => (
    <button
      key={c}
      type="button"
      className={`sort-chip ${selected === c ? 'selected' : ''} ${done ? (placed[c] === bucketOf(c) ? 'right' : 'wrong') : ''}`}
      draggable={!done}
      onDragStart={e => e.dataTransfer.setData('text/plain', c)}
      onClick={() => (inBucket ? unplace(c) : setSelected(selected === c ? null : c))}
      aria-pressed={!inBucket ? selected === c : undefined}
      disabled={done}
    >
      {c}
      {selected === c && <span className="sr-only">, {t('quiz.selected')}</span>}
      {done && placed[c] !== bucketOf(c) && <span className="sort-fix"> → {q.buckets[bucketOf(c)]}</span>}
    </button>
  );
  return (
    <div>
      <p className="small muted">{t('quiz.sortHint')}</p>
      {pool.length > 0 && (
        <div className="sort-pool" aria-label={t('quiz.toPlace')}>{pool.map(c => chip(c, false))}</div>
      )}
      <div className="sort-buckets">
        {q.buckets.map((b, bi) => (
          <div
            key={b}
            className={`sort-bucket ${selected ? 'armed' : ''}`}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              place(e.dataTransfer.getData('text/plain'), bi);
            }}
          >
            <button type="button" className="sort-bucket-head" onClick={() => place(selected, bi)} disabled={!selected || done} aria-label={`${b}: ${t('quiz.placeHere')}`}>
              {b}
            </button>
            <div className="sort-bucket-cards">{cards.filter(c => placed[c] === bi).map(c => chip(c, true))}</div>
          </div>
        ))}
      </div>
      {!done && (
        <button type="button" disabled={pool.length > 0} onClick={() => onAnswer(right, undefined, q.buckets.map((b, bi) => `${b}: ${q.items.filter(i => i.bucket === bi).map(i => i.text).join(', ')}`).join(' · '))}>
          {t('quiz.check')}
        </button>
      )}
    </div>
  );
}

export const lessonTitle = (id: string) => unitById(id)?.title ?? id;
