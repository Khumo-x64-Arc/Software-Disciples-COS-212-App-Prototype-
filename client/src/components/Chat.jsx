import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, useApp } from '../lib.jsx';

const STARTERS = ['What is transitive closure?', 'Why must k be the outer loop?', 'Matrix or list for a sparse graph?', 'Is my graph strongly connected?'];

export default function Chat() {
  const { chat, openChat, closeChat, graph, setHighlight, speak, readAloud } = useApp();
  const loc = useLocation();
  const [msgs, setMsgs] = useState([{ who: 'bot', text: "Hi! I'm Graph Helper. Ask me about graphs, Warshall's algorithm, or the graph on your Build a graph page.", suggestions: STARTERS }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); chat.open ? closeChat() : openChat(); } if (e.key === 'Escape' && chat.open) closeChat(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chat.open, openChat, closeChat]);
  useEffect(() => {
    if (chat.open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      if (chat.context) { ctxRef.current = chat.context; if (chat.prefill) send(chat.prefill); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.open, chat.context]);
  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs]);

  async function send(q) {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    setText(''); setBusy(true);
    setMsgs(m => [...m, { who: 'me', text: question }]);
    try {
      const onBuilder = loc.pathname.startsWith('/build');
      const r = await api('/chat', { method: 'POST', body: { text: question, graph: graph && graph.vertices.length ? graph : null, context: ctxRef.current } });
      // the feedback context explains one answer; later questions keep only which problem the learner is on
      if (ctxRef.current?.misconception) ctxRef.current = { problemId: ctxRef.current.problemId, category: ctxRef.current.category };
      setMsgs(m => [...m, { who: 'bot', text: r.answer, source: r.source, unit: r.unit, suggestions: r.suggestions, email: r.email, highlight: r.highlight, onBuilder }]);
      if (r.highlight && (r.highlight.path || r.highlight.vertices)) setHighlight(r.highlight);
      if (readAloud) speak(r.answer);
    } catch (e) {
      setMsgs(m => [...m, { who: 'bot', text: `Sorry, something went wrong: ${e.message}` }]);
    }
    setBusy(false);
  }

  if (!chat.open) return <button className="btn primary chat-fab" onClick={() => openChat()} aria-label="Open Graph Helper chat (Ctrl+/)">💬 Graph Helper</button>;
  return (
    <aside className="chat" aria-label="Graph Helper chat">
      <header>
        <b style={{ fontFamily: 'var(--display)' }}>💬 Graph Helper</b>
        <span className="small muted">no API keys · answers from the course</span>
        <span className="spacer" />
        <button className="btn small ghost" onClick={closeChat} aria-label="Close chat">✕</button>
      </header>
      <div className="msgs" ref={listRef} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.who === 'me' ? 'me' : ''}`}>
            <div>{m.text}</div>
            {m.source && <div className="src">Source: {m.source}{m.unit?.startsWith('U') && <> · <Link to={`/unit/${m.unit}`} onClick={closeChat}>{m.unit}</Link></>}</div>}
            {m.highlight && m.onBuilder && <div className="src">Highlighted on your canvas.</div>}
            {m.suggestions && <div className="sugs" style={{ marginTop: 6 }}>{m.suggestions.map(s => <button key={s} className="btn small" onClick={() => send(s)}>{s}</button>)}</div>}
            {m.email && <div className="src"><a href={m.email}>Email this question to COS212 queries</a></div>}
            {m.who === 'bot' && i > 0 && <button className="btn small ghost readbtn" onClick={() => speak(m.text, true)} aria-label="Read this answer aloud">🔊</button>}
          </div>
        ))}
        {busy && <div className="msg">…</div>}
      </div>
      <form onSubmit={e => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="chat-in">Ask a question</label>
        <input id="chat-in" ref={inputRef} type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Ask about graphs…" autoComplete="off" />
        <button className="btn primary small" disabled={busy}>Ask</button>
      </form>
    </aside>
  );
}
