import { useState, useRef, useEffect, useCallback } from 'react';
import { askTutor, explainAiError, type ChatMessage, type ProblemContext } from './gemini';
import { isAiConfigured } from './aiConfig';

interface Props {
  context: ProblemContext;
  onClose: () => void;
  onOpenSettings: () => void;
}

const QUICK_PROMPTS = ['Give me a hint', 'I don’t understand', 'Check my thinking', 'Show me a strategy'];

export function TutorChat({ context, onClose, onOpenSettings }: Props) {
  const configured = isAiConfigured();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, busy]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(next);
    setInput('');
    setBusy(true);
    abortRef.current = new AbortController();
    try {
      const reply = await askTutor(next, context, abortRef.current.signal);
      setMessages(m => [...m, { role: 'model', text: reply }]);
    } catch (err) {
      setError(explainAiError(err));
    } finally {
      setBusy(false);
    }
  }, [messages, busy, context]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="tutor-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Math tutor">
      <div className="tutor-panel" onClick={e => e.stopPropagation()}>
        <header className="tutor-head">
          <div className="tutor-title">
            <span style={{ fontSize: 20 }}>💡</span>
            <div>
              <div style={{ fontWeight: 700 }}>Math Tutor</div>
              <div className="tutor-sub">Here to help you think — not to give answers!</div>
            </div>
          </div>
          <button className="tutor-x" onClick={onClose} aria-label="Close tutor">✕</button>
        </header>

        <div className="tutor-context">Working on: <strong>{context.prompt}</strong></div>

        <div className="tutor-scroll" ref={scrollRef}>
          {!configured ? (
            <div className="tutor-empty">
              <p style={{ fontSize: 32, margin: 0 }}>🔑</p>
              <p>The AI tutor isn't set up yet.</p>
              <p className="tutor-sub">A grown-up can add a free Google&nbsp;Gemini key in Settings.</p>
              <button className="tutor-cta" onClick={onOpenSettings}>Open Settings</button>
            </div>
          ) : messages.length === 0 ? (
            <div className="tutor-empty">
              <p style={{ fontSize: 32, margin: 0 }}>🦉</p>
              <p>Hi! Stuck on this one? Ask me anything and I'll help you figure it out.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`tutor-msg ${m.role === 'user' ? 'tutor-user' : 'tutor-model'}`}>
                {m.text}
              </div>
            ))
          )}
          {busy && <div className="tutor-msg tutor-model tutor-typing">thinking…</div>}
          {error && <div className="tutor-error">{error}</div>}
        </div>

        {configured && (
          <>
            <div className="tutor-quick">
              {QUICK_PROMPTS.map(q => (
                <button key={q} className="tutor-chip" disabled={busy} onClick={() => send(q)}>{q}</button>
              ))}
            </div>
            <div className="tutor-inputrow">
              <input
                ref={inputRef}
                className="tutor-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type what you're thinking…"
                aria-label="Message the tutor"
              />
              <button className="tutor-send" disabled={busy || !input.trim()} onClick={() => send(input)}>
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
