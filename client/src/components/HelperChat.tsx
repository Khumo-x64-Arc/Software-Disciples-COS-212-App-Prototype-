import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { api } from '../api';
import { answer as localAnswer, suggestions as localSuggestions, type HelperAnswer, type HelperContext } from '../../../shared/graph-helper.mjs';
import { useSpeech } from '../speech/useSpeech';
import { toSpoken } from '../speech/spoken';
import { useI18n } from '../i18n';

type Msg = { id: number; from: 'me' | 'bot'; text: string; a?: HelperAnswer };
type Ctx = {
  context: HelperContext;
  setContext: Dispatch<SetStateAction<HelperContext>>;
  open: (message?: string) => void;
  highlight: HelperAnswer['highlight'] | null;
  clearHighlight: () => void;
};

const HelperCtx = createContext<Ctx | null>(null);
export function useHelper(): Ctx {
  const c = useContext(HelperCtx);
  if (!c) throw new Error('useHelper must be used inside <HelperProvider>');
  return c;
}


/**
 * Graph Helper (design doc): answers from (1) the learner's own graph, (2) the
 * knowledge-base cards with a Drozdek source, or (3) a fallback with the three
 * closest topics and the module email. No external AI. Never gives test code.
 */
export function HelperProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [context, setContext] = useState<HelperContext>({});
  const [isOpen, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HelperAnswer['highlight'] | null>(null);

  const open = useCallback((message?: string) => {
    setOpen(true);
    if (message) setPending(message);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'h' || e.key === 'H' || e.code === 'KeyH')) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ context, setContext, open, highlight, clearHighlight: () => setHighlight(null) }), [context, open, highlight]);

  return (
    <HelperCtx.Provider value={value}>
      {children}
      {isOpen ? (
        <HelperPanel context={context} onClose={() => setOpen(false)} pending={pending} clearPending={() => setPending(null)} onHighlight={setHighlight} />
      ) : (
        <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-keyshortcuts="Alt+H" title={`${t('chat.title')} (Alt + H)`}>
          <span aria-hidden>🤖</span> <span className="chat-fab-label">{t('chat.title')}</span>
        </button>
      )}
    </HelperCtx.Provider>
  );
}

let nextId = 1;

function HelperPanel({ context, onClose, pending, clearPending, onHighlight }: {
  context: HelperContext; onClose: () => void; pending: string | null; clearPending: () => void; onHighlight: (h: HelperAnswer['highlight'] | null) => void;
}) {
  const { t, lang } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ id: nextId++, from: 'bot', text: t('chat.hello') }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [readAnswers, setReadAnswers] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak, stop, active, supported } = useSpeech();
  const chips = (msgs.at(-1)?.a?.suggestions ?? localSuggestions(context)).slice(0, 4);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, stop]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs, busy]);

  const send = useCallback(
    async (message: string) => {
      const m = message.trim();
      if (!m || busy) return;
      setMsgs(x => [...x, { id: nextId++, from: 'me', text: m }]);
      setText('');
      setBusy(true);
      let a: HelperAnswer;
      try {
        a = await api.chat(m, { ...context, graph: context.graph ?? null });
      } catch {
        a = localAnswer(m, context); // still works offline (not logged)
      }
      setBusy(false);
      setMsgs(x => [...x, { id: nextId++, from: 'bot', text: a.reply, a }]);
      onHighlight(a.highlight ?? null);
      if (readAnswers) speak([{ key: `m${nextId - 1}`, say: toSpoken(a.reply) }]);
    },
    [busy, context, onHighlight, readAnswers, speak],
  );

  useEffect(() => {
    if (pending) {
      void send(pending);
      clearPending();
    }
  }, [pending, send, clearPending]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <section className="chat-panel" role="dialog" aria-modal="false" aria-labelledby="helper-title">
      <header className="chat-head">
        <span className="chat-avatar" aria-hidden>🤖</span>
        <div className="chat-titles">
          <h2 id="helper-title">{t('chat.title')}</h2>
          <span className="small">{t('chat.sub')}</span>
        </div>
        <button type="button" className="chat-close" onClick={onClose} aria-label={`${t('common.close')} (Esc)`}>✕</button>
      </header>
      <div className="chat-log" ref={logRef} aria-live="polite" aria-relevant="additions">
        {msgs.map(m => (
          <div key={m.id} className={`chat-msg ${m.from}`}>
            <p>{m.text}</p>
            {m.from === 'bot' && m.a && (
              <div className="chat-msg-tools">
                {m.a.src && <span className="chat-src">{t('chat.source')}: {m.a.src}</span>}
                {supported && (
                  <button type="button" className={`speaker ${active?.key === `m${m.id}` ? 'reading' : ''}`} onClick={() => (active?.key === `m${m.id}` ? stop() : speak([{ key: `m${m.id}`, say: toSpoken(m.text) }]))}>
                    {active?.key === `m${m.id}` ? '■' : '🔊'} <span className="sr-only">Read this answer</span>
                  </button>
                )}
              </div>
            )}
            {m.a?.closest && m.a.closest.length > 0 && (
              <div className="chat-closest">
                <span className="small">{t('chat.closest')}</span>
                {m.a.closest.map(c => (
                  <button key={c.id} type="button" className="chat-chip" onClick={() => void send(c.label)}>{c.label}</button>
                ))}
              </div>
            )}
            {m.a?.email && (
              <p className="small">
                <a href={m.a.email}>{t('chat.email', { email: 'cos212queries@cs.up.ac.za' })}</a>
              </p>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-msg bot typing" aria-label={t('chat.typing')}>
            <span className="dot" /><span className="dot" /><span className="dot" />
          </div>
        )}
      </div>
      <div className="chat-suggestions" aria-label="Suggested questions">
        {chips.map(s => (
          <button key={s} type="button" className="chat-chip" onClick={() => void send(s)}>{s}</button>
        ))}
      </div>
      <form className="chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="helper-input">{t('home.ask')}</label>
        <input id="helper-input" ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder={t('chat.placeholder')} autoComplete="off" maxLength={500} />
        <button type="submit" disabled={busy || !text.trim()}>{t('chat.ask')}</button>
      </form>
      <label className="toggle chat-read-toggle small">
        <input type="checkbox" checked={readAnswers} onChange={e => { setReadAnswers(e.target.checked); if (!e.target.checked) stop(); }} /> {t('chat.read')}
      </label>
      <p className="chat-privacy small muted">{t('chat.privacy')}{lang !== 'en' ? ` ${t('chat.englishNote')}` : ''}</p>
    </section>
  );
}
