// A lesson quiz: five questions (multiple choice, fill in the blank, put in
// order, sort into boxes) with instant feedback, points, and a chatbot
// notification after every answer. Questions get harder as the level rises.
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { api } from '../api';
import { blankCorrect, makeExam, makeQuiz, type BlankQ, type MCQ, type OrderQ, type SortQ } from '../lib/quizBank';
import { EXAM, LESSONS, POINTS, unitById } from '../../../shared/units.mjs';
import { useApp } from '../state/AppContext';
import { useRewards } from '../state/rewards';
import { useI18n, useT } from '../i18n';
import { useSpeech } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';
import { GraphCanvas } from './GraphCanvas';
import { MatrixTable } from './ui';
import { useHelper } from './HelperChat';
import { shuffle } from '../lib/checkKit';
import { rng } from '../../../shared/graph-core.mjs';

const LETTERS = 'ABCDE';
type Answer = { correct: boolean; misconception?: string; points: number; lesson?: string; skipped?: boolean };
/** What the learner did on one question: the result, and the answer itself so it can be shown again. */
type Response = { correct: boolean; why?: string; shown?: string; misconception?: string; points: number; saved: unknown };

/**
 * A lesson quiz, or (exam) the final exam: questions from every lesson, with a
 * score per lesson at the end. The exam is the bonus quest and is never locked.
 * Learners can move back and forward, skip questions, and submit at any time;
 * a question left unanswered counts as wrong.
 */
export function Quiz({ lesson, exam = false, onFinished }: { lesson: string; exam?: boolean; onFinished?: (score: number) => void }) {
  const { setMastery, updateProgress } = useApp();
  const { level, award, answered, notify } = useRewards();
  const t = useT();
  const helper = useHelper();
  const [seed, setSeed] = useState(() => Date.now());
  // The level is read when a quiz starts, so it does not change mid-quiz.
  const startLevel = useRef(level.n);
  const questions = useMemo(() => (exam ? makeExam(seed) : makeQuiz(lesson, startLevel.current, seed)), [exam, lesson, seed]);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, Response>>({});
  const [confirming, setConfirming] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const { speak, stop, active, supported } = useSpeech();
  const q = questions[index];
  const current = responses[index];
  const answeredCount = Object.keys(responses).length;
  const unanswered = questions.map((_, i) => i).filter(i => !responses[i]);
  const lessonOf = (qq: (typeof questions)[number]) => (exam ? qq.lesson ?? lesson : lesson);

  const { setContext } = helper;
  useEffect(() => {
    const unit = exam ? questions[index]?.lesson ?? null : lesson;
    setContext(c => (c.unit === unit ? c : { ...c, unit }));
  }, [exam, lesson, questions, index, setContext]);

  /** Adds answers to the per-lesson tally behind the Student page's "What to work on". */
  const logAnswers = (items: { lesson: string; kind: 'right' | 'wrong' | 'skipped'; misconception?: string }[]) => {
    if (!items.length) return;
    updateProgress(p => {
      const log = { ...(p.answerLog ?? {}) };
      for (const it of items) {
        const prev = log[it.lesson];
        const e = { right: prev?.right ?? 0, wrong: prev?.wrong ?? 0, skipped: prev?.skipped ?? 0, mis: prev?.mis };
        e[it.kind] += 1;
        if (it.misconception) e.mis = { ...(e.mis ?? {}), [it.misconception]: (e.mis?.[it.misconception] ?? 0) + 1 };
        log[it.lesson] = e;
      }
      return { ...p, answerLog: log };
    });
  };

  const go = (i: number) => {
    if (i < 0 || i >= questions.length) return;
    stop();
    setConfirming(false);
    setIndex(i);
    requestAnimationFrame(() => headRef.current?.focus());
  };

  const submit = (correct: boolean, why?: string, shown?: string, misconception?: string, saved?: unknown) => {
    if (current) return;
    stop();
    const pts = !correct ? 0 : exam ? award(`x:${q.lesson}:${q.key}`, POINTS.examQuestion) : award(`q:${lesson}:${q.key}`, POINTS.question[q.tier]);
    answered(correct, pts);
    const mis = correct ? undefined : misconception ?? q.misconception;
    setResponses(r => ({ ...r, [index]: { correct, why, shown, misconception: mis, points: pts, saved } }));
    logAnswers([{ lesson: lessonOf(q), kind: correct ? 'right' : 'wrong', misconception: mis }]);
  };

  const finish = async () => {
    stop();
    setConfirming(false);
    const all: Answer[] = questions.map((qq, i) => {
      const r = responses[i];
      return r
        ? { correct: r.correct, misconception: r.misconception, points: r.points, lesson: qq.lesson }
        : { correct: false, points: 0, lesson: qq.lesson, skipped: true };
    });
    logAnswers(questions.flatMap((qq, i) => (responses[i] ? [] : [{ lesson: lessonOf(qq), kind: 'skipped' as const }])));
    setAnswers(all);
    const correct = all.filter(a => a.correct).length;
    const pct = Math.round((100 * correct) / questions.length);
    setScore(pct);
    if (exam) {
      updateProgress(p => ({ ...p, examBest: Math.max(pct, p.examBest ?? 0) }));
      if (pct >= EXAM.passMark) {
        const xp = award('exam:pass', POINTS.examPass);
        notify('good', xp ? t('exam.passed', { n: xp }) : t('exam.passedAgain'), '🎖️');
      } else notify('info', t('exam.notYet', { n: EXAM.passMark }), '📝');
    } else {
      updateProgress(p => ({ ...p, done: { ...(p.done ?? {}), [lesson]: true }, quizBest: { ...(p.quizBest ?? {}), [lesson]: Math.max(pct, p.quizBest?.[lesson] ?? 0) } }));
      const lp = award(`lesson:${lesson}`, POINTS.lesson);
      if (lp) notify('good', t('fb.lessonDone', { n: lp }), '🏅');
    }
    onFinished?.(pct);
    try {
      const r = await api.check(exam ? EXAM.id : lesson, correct, questions.length, all.map(a => a.misconception).filter((m): m is string => Boolean(m)));
      setMastery(r.mastery);
    } catch {
      /* offline: the result still counts locally */
    }
  };

  /** Submit now, or first say how many questions are still unanswered. */
  const requestSubmit = () => (unanswered.length ? setConfirming(true) : void finish());

  /** After answering: the next question, the next unanswered one, or the results. */
  const afterAnswer = () => {
    const later = unanswered.find(i => i > index && i !== index);
    const earlier = unanswered.find(i => i !== index);
    if (index + 1 < questions.length) go(index + 1);
    else if (later !== undefined) go(later);
    else if (earlier !== undefined) go(earlier);
    else void finish();
  };
  const leftAfterThis = unanswered.filter(i => i !== index).length;

  const retry = () => {
    startLevel.current = level.n;
    setSeed(Date.now());
    setIndex(0);
    setResponses({});
    setAnswers([]);
    setConfirming(false);
    setScore(null);
  };

  if (score !== null) {
    const earned = answers.reduce((a, b) => a + b.points, 0);
    const skipped = answers.filter(a => a.skipped).length;
    return (
      <section className="card quiz-result" aria-labelledby="quiz-result">
        <h2 id="quiz-result" tabIndex={-1}>{t('quiz.score', { score })}</h2>
        <div className="result-stars" aria-hidden>{'★'.repeat(Math.round(score / 20))}{'☆'.repeat(5 - Math.round(score / 20))}</div>
        <p className="lead">{score >= 80 ? t('road.strong') : score >= 60 ? t('road.ok') : t('road.revisit')}</p>
        {skipped > 0 && <p className="small muted">{t('quiz.skippedCount', { n: skipped })}</p>}
        {earned > 0 && <p className="points-pill">{t('quiz.earned', { n: earned })}</p>}
        {exam && <ExamBreakdown answers={answers} />}
        {answers.some(a => !a.correct) && (
          <details>
            <summary>{t('road.revisit')}</summary>
            <ul>
              {questions.map((qq, i) =>
                !answers[i]?.correct ? (
                  <li key={qq.key}>
                    {answers[i]?.skipped && <strong>{t('quiz.notAnswered')}: </strong>}
                    {qq.explain}
                  </li>
                ) : null,
              )}
            </ul>
          </details>
        )}
        <div className="button-row">
          <button type="button" className="secondary" onClick={retry}>{t('quiz.again')}</button>
          <a className="button secondary" href="#/student">{t('quiz.seeFocus')}</a>
        </div>
      </section>
    );
  }
  if (!q) return null;

  const dotState = (i: number) => (responses[i] ? (responses[i].correct ? 'done' : 'missed') : '');
  const dotLabel = (i: number) =>
    `${t('quiz.question', { i: i + 1, n: questions.length })}: ${responses[i] ? (responses[i].correct ? t('quiz.correct') : t('quiz.wrong')) : t('quiz.notAnswered')}`;

  return (
    <section className="card quiz" aria-labelledby="quiz-head">
      <div className="question-meta">
        <h2 id="quiz-head" ref={headRef} tabIndex={-1}>{t('quiz.question', { i: index + 1, n: questions.length })}</h2>
        {exam && q.lesson && <span className="chip chip-brand">{t('exam.from', { id: q.lesson })}</span>}
        <span className={`tier tier-${q.tier}`}>{t(`quiz.tier${q.tier}`)} · +{exam ? POINTS.examQuestion : POINTS.question[q.tier]}</span>
        <span className="spacer" />
        {supported && (
          <button type="button" className={`speaker ${active ? 'reading' : ''}`} onClick={() => (active ? stop() : speak([{ key: 'q', say: toSpoken(q.prompt) }]))}>
            {active ? '■' : '🔊'} <span className="sr-only">Read the question</span>
          </button>
        )}
      </div>
      <nav className="quiz-jump" aria-label={t('quiz.jump')}>
        {questions.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`jump-dot ${dotState(i)} ${i === index ? 'current' : ''}`}
            onClick={() => go(i)}
            aria-label={dotLabel(i)}
            aria-current={i === index ? 'step' : undefined}
            title={dotLabel(i)}
          >
            {responses[i] ? (responses[i].correct ? '✓' : '✗') : i + 1}
          </button>
        ))}
        <span className="quiz-jump-count small muted">{t('quiz.answeredOf', { a: answeredCount, n: questions.length })}</span>
      </nav>
      <div key={`${q.key}-${seed}`} className="quiz-body">
        <p className="prompt">{q.prompt}</p>
        {q.code && <pre className="code-block">{q.code}</pre>}
        {q.graph && <GraphCanvas graph={q.graph} title="Graph for this question" highlight={q.tags ? { tags: q.tags } : undefined} />}
        {q.matrix && <MatrixTable labels={q.matrix.labels} matrix={q.matrix.cells} caption={q.matrix.caption} kRow={q.matrix.kRow} />}

        {q.kind === 'mc' && <McAnswer q={q} done={Boolean(current)} saved={current?.saved} onAnswer={submit} />}
        {q.kind === 'blank' && <BlankAnswer q={q} done={Boolean(current)} saved={current?.saved} onAnswer={submit} />}
        {q.kind === 'order' && <OrderAnswer q={q} seed={seed} done={Boolean(current)} saved={current?.saved} onAnswer={submit} />}
        {q.kind === 'sort' && <SortAnswer q={q} seed={seed} done={Boolean(current)} saved={current?.saved} onAnswer={submit} />}

        {current && (
          <div className={`feedback ${current.correct ? 'ok' : 'no'}`} role="status">
            <p className="feedback-head"><strong>{current.correct ? `✓ ${t('quiz.correct')}` : `✗ ${t('quiz.wrong')}`}</strong></p>
            {!current.correct && current.why && <p>{current.why}</p>}
            {!current.correct && current.shown && <p>{t('quiz.answerWas', { a: current.shown })}</p>}
            <p>{q.explain}</p>
            <div className="button-row">
              <button type="button" onClick={afterAnswer}>
                {index + 1 < questions.length ? t('quiz.next') : leftAfterThis ? t('quiz.toUnanswered', { n: leftAfterThis }) : t('quiz.finish')}
              </button>
              {!current.correct && <button type="button" className="secondary" onClick={() => helper.open(`Explain: ${q.prompt}`)}>💬 {t('home.ask')}</button>}
            </div>
          </div>
        )}
      </div>

      <div className="quiz-nav">
        <button type="button" className="secondary" onClick={() => go(index - 1)} disabled={index === 0}>← {t('quiz.prev')}</button>
        <button type="button" className="secondary" onClick={() => go(index + 1)} disabled={index + 1 >= questions.length}>
          {current ? t('quiz.nextShort') : t('quiz.skip')} →
        </button>
        <span className="spacer" />
        <button type="button" className={unanswered.length ? 'secondary' : 'glow'} onClick={requestSubmit}>
          {exam ? t('quiz.submitExam') : t('quiz.submit')}
        </button>
      </div>
      {confirming && (
        <div className="announce-bar quiz-confirm" role="alertdialog" aria-labelledby="confirm-h">
          <div>
            <p id="confirm-h"><strong>{t('quiz.confirmHead', { n: unanswered.length })}</strong></p>
            <p className="small">{t('quiz.confirmBody')}</p>
            <div className="button-row">
              <button type="button" onClick={() => void finish()} autoFocus>{t('quiz.submitAnyway')}</button>
              <button type="button" className="secondary" onClick={() => go(unanswered[0])}>{t('quiz.goTo', { i: unanswered[0] + 1 })}</button>
              <button type="button" className="link-button" onClick={() => setConfirming(false)}>{t('quiz.keepGoing')}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Final exam: the score for each lesson, so the learner knows what to revisit. */
function ExamBreakdown({ answers }: { answers: Answer[] }) {
  const { t, lesson } = useI18n();
  const rows = LESSONS.map(l => {
    const mine = answers.filter(a => a.lesson === l.id);
    return { id: l.id, right: mine.filter(a => a.correct).length, total: mine.length };
  }).filter(r => r.total > 0);
  return (
    <table className="cost-table exam-breakdown">
      <caption>{t('exam.byLesson')}</caption>
      <thead><tr><th scope="col">{t('coding.lesson')}</th><th scope="col">{t('exam.right')}</th><th scope="col">{t('exam.next')}</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} className={r.right === r.total ? 'row-good' : r.right === 0 ? 'row-bad' : ''}>
            <th scope="row">{r.id} · {lesson(r.id).title}</th>
            <td>{r.right} / {r.total}</td>
            <td>{r.right === r.total ? '✓' : <a href={`#/lesson/${r.id}`}>{t('exam.revisit')}</a>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type OnAnswer = (correct: boolean, why?: string, shown?: string, misconception?: string, saved?: unknown) => void;

function McAnswer({ q, done, saved, onAnswer }: { q: MCQ; done: boolean; saved?: unknown; onAnswer: OnAnswer }) {
  const [chosen, setChosen] = useState<number | null>(typeof saved === 'number' ? saved : null);
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
              onAnswer(Boolean(o.correct), o.why, q.options.find(x => x.correct)?.text, o.misconception, i);
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

function BlankAnswer({ q, done, saved, onAnswer }: { q: BlankQ; done: boolean; saved?: unknown; onAnswer: OnAnswer }) {
  const t = useT();
  const [text, setText] = useState(typeof saved === 'string' ? saved : '');
  const ok = done && blankCorrect(q, text);
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || done) return;
    onAnswer(blankCorrect(q, text), undefined, q.answers[0], undefined, text);
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
function OrderAnswer({ q, seed, done, saved, onAnswer }: { q: OrderQ; seed: number; done: boolean; saved?: unknown; onAnswer: OnAnswer }) {
  const t = useT();
  const [items, setItems] = useState(() => {
    if (Array.isArray(saved)) return saved as string[];
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
      {!done && <button type="button" onClick={() => onAnswer(right, undefined, q.items.join(' → '), undefined, items)}>{t('quiz.check')}</button>}
    </div>
  );
}

/** Sort into boxes: drag a card onto a box, or tap a card and then a box. */
function SortAnswer({ q, seed, done, saved, onAnswer }: { q: SortQ; seed: number; done: boolean; saved?: unknown; onAnswer: OnAnswer }) {
  const t = useT();
  const cards = useMemo(() => shuffle(rng(seed ^ 77), q.items.map(i => i.text)), [q.items, seed]);
  const [placed, setPlaced] = useState<Record<string, number>>(() => (saved && typeof saved === 'object' ? (saved as Record<string, number>) : {}));
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
        <button type="button" disabled={pool.length > 0} onClick={() => onAnswer(right, undefined, q.buckets.map((b, bi) => `${b}: ${q.items.filter(i => i.bucket === bi).map(i => i.text).join(', ')}`).join(' · '), undefined, placed)}>
          {t('quiz.check')}
        </button>
      )}
    </div>
  );
}

export const lessonTitle = (id: string) => unitById(id)?.title ?? id;
