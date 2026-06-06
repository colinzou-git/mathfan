import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { SessionConfig, StudentSettings } from '../../types/math';
import { db } from '../../db/dexie';
import { usePracticeSession } from './usePracticeSession';
import { NumPad } from '../../components/NumPad';
import { SessionSummary } from '../../components/SessionSummary';
import { SettingsOverlay } from '../../components/SettingsOverlay';
import { TutorChat } from '../ai/TutorChat';
import { speakProblem, speakFeedback, stopSpeech } from '../audio/speech';
import { VisualModel } from '../visuals/VisualModel';
import { hasVisualModel } from '../visuals/visualModelUtils';
import { getHint } from './hintEngine';

const AUTO_ADVANCE_MS = 700;

interface Props {
  studentId: string;
  config: SessionConfig;
  settings: StudentSettings;
  onUpdateSettings: (s: StudentSettings) => void;
  onDone: () => void;
  onOpenSettings?: () => void;
  onPlayAgain?: () => void;
  onBack?: () => void;
}

export function PracticeScreen({
  studentId, config, settings, onUpdateSettings, onDone, onOpenSettings, onPlayAgain, onBack,
}: Props) {
  const { state, startSession, submitAnswer, nextQuestion } = usePracticeSession(studentId);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showTutor, setShowTutor] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [quitting, setQuitting] = useState(false); // show summary with partial data
  const [showExplanation, setShowExplanation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current shadow of `input` state — kept in sync via useLayoutEffect
  // (runs synchronously after every commit) so the keyboard handler registered
  // via useEffect (a macro-task) never reads a stale partial value when the
  // user types the last digit and immediately presses Enter in the same frame.
  const inputLatestRef = useRef<string>('');
  useLayoutEffect(() => { inputLatestRef.current = input; });

  // ── Start ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    startSession(config);
    return () => {
      stopSpeech();
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focus helpers ─────────────────────────────────────────────────────────

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // New question or retry → clear input (update during render, not in effect)
  const [lastItemKey, setLastItemKey] = useState<string | null>(null);
  const currentItemKey = state.phase === 'active'
    ? `${state.currentItem?.id ?? ''}-${state.retryKey ?? 0}`
    : null;
  if (state.phase === 'active' && currentItemKey !== lastItemKey) {
    setLastItemKey(currentItemKey);
    setInput('');
    setShowExplanation(false);
  }

  // New question or retry → focus + speak
  useEffect(() => {
    if (state.phase === 'active') {
      focusInput();
      if (settings.audioEnabled && state.currentItem) speakProblem(state.currentItem.prompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.currentItem?.id, state.retryKey]);

  // Correct phase → focus for Enter-to-advance; optionally auto-advance
  useEffect(() => {
    if (state.phase === 'correct') {
      focusInput();
      if (settings.audioEnabled && state.currentItem) speakFeedback(true, state.currentItem.answer);
      if (settings.autoAdvance) {
        autoTimer.current = setTimeout(() => nextQuestion(), AUTO_ADVANCE_MS);
      }
      return () => { if (autoTimer.current) clearTimeout(autoTimer.current); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Re-focus after any overlay closes
  useEffect(() => {
    if (!showSettings && !showQuit && !showTutor) focusInput();
  }, [showSettings, showQuit, showTutor, focusInput]);

  // ── Quit action (declared before the keyboard effect that calls it) ─────────

  const confirmQuit = useCallback(() => {
    setShowQuit(false);
    stopSpeech();
    if (autoTimer.current) clearTimeout(autoTimer.current);
    // Delete the session record if nothing was answered
    if (state.completedCount === 0 && state.sessionId) {
      db.sessions.delete(state.sessionId).catch(() => {});
    }
    setQuitting(true);
  }, [state.completedCount, state.sessionId]);

  // ── Global keyboard handler ───────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Tutor chat owns the keyboard while open
      if (showTutor) return;

      // Quit confirmation is open
      if (showQuit) {
        if (e.key === 'Escape') { setShowQuit(false); return; }
        if (e.key === 'Enter') { confirmQuit(); return; }
        return;
      }

      if (showSettings) return;

      if (e.key === 'Escape') { setShowSettings(true); return; }

      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setShowQuit(true);
        return;
      }

      if ((e.key === 'h' || e.key === 'H') && state.phase === 'active') {
        e.preventDefault();
        setShowTutor(true);
        return;
      }

      if (state.phase === 'correct') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (autoTimer.current) clearTimeout(autoTimer.current);
          nextQuestion();
        }
        return;
      }

      if (state.phase === 'active') {
        const item = state.currentItem;
        if (item?.answerInput === 'choice') {
          const opts = (item.choices ?? []).map(String);
          // Symbol choices: accept < = > directly
          if (e.key === '<' || e.key === '=' || e.key === '>') {
            if (opts.includes(e.key)) {
              e.preventDefault();
              submitAnswer(e.key);
              setInput('');
            }
            return;
          }
          // Word choices: match a unique first letter (p/c, y/n, …)
          const matches = opts.filter(o => o[0].toLowerCase() === e.key.toLowerCase());
          if (matches.length === 1) {
            e.preventDefault();
            submitAnswer(matches[0]);
            setInput('');
          }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          // Read from ref (not closure) so rapid typing doesn't submit a stale partial value.
          const val = inputLatestRef.current;
          if (val.trim()) { submitAnswer(val); setInput(''); }
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.currentItem, showSettings, showQuit, showTutor]);

  // ── Render: summary (complete or early quit) ──────────────────────────────

  if (state.phase === 'complete' || quitting) {
    return (
      <SessionSummary
        completedCount={state.completedCount}
        correctCount={state.correctCount}
        firstTryCount={state.firstTryCount}
        correctedCount={state.correctedCount}
        repeatedCount={state.repeatedCount}
        slowFirstTryCount={state.slowFirstTryCount}
        attemptCount={state.attemptCount}
        plannedCount={state.totalPlanned}
        latencies={state.latencies}
        fastestMs={state.fastestMs}
        missedFacts={state.missedFacts}
        lastSession={state.lastSession}
        wasQuit={quitting}
        onDone={onDone}
        onPlayAgain={quitting ? undefined : onPlayAgain}
        onBack={onBack}
      />
    );
  }

  if (state.phase === 'idle') {
    return (
      <div style={st.center}>
        <div style={{ fontSize: '48px' }}>🧮</div>
        <p style={{ color: '#6b7280' }}>Preparing…</p>
      </div>
    );
  }

  // ── Render: active drill ──────────────────────────────────────────────────

  const isCorrect = state.phase === 'correct';
  const hasError = !!state.errorText;
  const isChoice = state.currentItem?.answerInput === 'choice';
  const choices = state.currentItem?.choices ?? [];
  const allowDecimal = state.currentItem?.itemType === 'decimal_add'
    || state.currentItem?.itemType === 'decimal_sub';
  const progress = state.totalPlanned
    ? Math.round((state.completedCount / state.totalPlanned) * 100) : 0;
  const isVisualItem = state.currentItem != null && hasVisualModel(state.currentItem);

  const submitChoice = (choice: string) => {
    if (isCorrect) return;
    submitAnswer(choice);
    setInput('');
  };

  return (
    <div className="drill-container" style={st.container}>
      {/* Settings overlay */}
      {showSettings && (
        <SettingsOverlay
          settings={settings}
          onChange={onUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* AI tutor */}
      {showTutor && state.currentItem && (
        <TutorChat
          context={{
            prompt: state.currentItem.prompt,
            answer: state.currentItem.answer,
            itemType: state.currentItem.itemType,
          }}
          onClose={() => setShowTutor(false)}
          onOpenSettings={() => { setShowTutor(false); onOpenSettings?.(); }}
        />
      )}

      {/* Quit confirmation overlay */}
      {showQuit && (
        <div style={st.backdrop} onClick={() => setShowQuit(false)}>
          <div style={st.quitPanel} onClick={e => e.stopPropagation()}>
            <h3 style={st.quitTitle}>Quit this session?</h3>
            <p style={st.quitBody}>
              {state.completedCount} of {state.totalPlanned} questions done
              · {state.correctCount} correct
            </p>
            <p style={st.quitBody2}>
              Your answers so far are saved. You can start a new session any time.
            </p>
            <div style={st.quitBtns}>
              <button style={st.keepBtn} onClick={() => setShowQuit(false)}>
                Keep Going <span style={st.kbTag}>Esc</span>
              </button>
              <button style={st.quitBtn} onClick={confirmQuit}>
                Quit <span style={st.kbTag}>Enter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar: progress + settings + quit */}
      <div style={st.topBar}>
        <div style={st.progressWrap}>
          <div style={st.progressBar}>
            <div style={{ ...st.progressFill, width: `${progress}%` }} />
          </div>
          <span style={st.progressText}>
            {state.completedCount}/{state.totalPlanned} · {state.correctCount} ✓
          </span>
        </div>
        <button
          style={{ ...st.iconBtn, ...st.hintBtn }}
          onClick={() => setShowTutor(true)}
          title="Ask the tutor for a hint (H)"
          tabIndex={-1}
        >💡</button>
        <button
          style={st.iconBtn}
          onClick={() => setShowSettings(true)}
          title="Settings (Esc)"
          tabIndex={-1}
        >⚙️</button>
        <button
          style={{ ...st.iconBtn, ...st.quitIconBtn }}
          onClick={() => setShowQuit(true)}
          title="Quit session (Q)"
          tabIndex={-1}
        >✕</button>
      </div>

      {/* Question card — single column on phone portrait, two on tablet landscape */}
      <div
        className="drill-card"
        style={{
          ...st.card,
          borderColor: isCorrect ? '#22c55e' : hasError ? '#ef4444' : 'transparent',
          borderWidth: 3, borderStyle: 'solid',
        }}
      >
        {settings.audioEnabled && state.currentItem && (
          <button style={st.audioBtn} tabIndex={-1}
            onClick={() => speakProblem(state.currentItem!.prompt)}
            title="Repeat">🔊
          </button>
        )}

        {/* Question zone */}
        <div className="drill-q">
          <div style={{ ...st.prompt, fontSize: isVisualItem ? '24px' : '52px', letterSpacing: isVisualItem ? 'normal' : '-1px' }}>
            {state.currentItem?.prompt}
          </div>

          {isVisualItem && state.currentItem && (
            <div style={{ margin: '10px 0 6px', display: 'flex', justifyContent: 'center' }}>
              <VisualModel item={state.currentItem} />
            </div>
          )}

          {isChoice ? (
            <div style={st.choiceDisplay}>
              {isCorrect ? String(state.currentItem?.answer ?? '') : (input || '?')}
            </div>
          ) : (
            <input
              ref={inputRef}
              type="number"
              inputMode={allowDecimal ? 'decimal' : 'numeric'}
              value={isCorrect ? String(state.currentItem?.answer ?? '') : input}
              onChange={e => { if (!isCorrect) setInput(e.target.value.slice(0, 6)); }}
              readOnly={isCorrect}
              placeholder="?"
              autoComplete="off"
              aria-label="Your answer"
              style={{
                ...st.answerInput,
                color: isCorrect ? '#22c55e' : hasError ? '#ef4444' : '#4f46e5',
                borderBottomColor: isCorrect ? '#22c55e' : hasError ? '#ef4444' : '#4f46e5',
              }}
            />
          )}

          {hasError && !isCorrect && <p style={st.errorText}>{state.errorText}</p>}

          {/* Progressive hint — shown automatically after each wrong attempt */}
          {hasError && !isCorrect && state.currentItem && state.retryKey > 0 && (() => {
            const h = getHint(state.currentItem, state.retryKey);
            if (!h) return null;
            return (
              <div style={st.hintBox} role="status" aria-live="polite">
                <p style={st.hintLabel}>💡 Hint</p>
                <p style={st.hintHintText}>{h.text}</p>
                {h.showExplanationButton && !showExplanation && (
                  <button style={st.explainBtn} onClick={() => setShowExplanation(true)}>
                    Show Explanation
                  </button>
                )}
                {showExplanation && state.currentItem.explanation && (
                  <p style={st.explanationText}>{state.currentItem.explanation}</p>
                )}
              </div>
            );
          })()}

          {isCorrect && (
            <p style={st.correctText}>
              {state.correctResult?.isNewPersonalBest ? '⚡ New personal best!' : '✓ Correct!'}
              {!settings.autoAdvance && <span style={st.subText}> · Enter to continue</span>}
            </p>
          )}

          {!hasError && !isCorrect && input === '' && (
            <p style={st.hintText}>
              {isChoice
                ? (choices.every(c => String(c).length === 1)
                    ? 'Tap a choice · keys < = > · H for a hint'
                    : 'Tap a choice · press its first letter · H for a hint')
                : 'Type your answer · Enter to check · H for a hint'}
            </p>
          )}
        </div>

        {/* Input zone */}
        <div className="drill-k">
          {!isCorrect && isChoice && (
            <div style={st.choiceRow}>
              {choices.map(c => {
                const label = String(c);
                const isSymbol = label.length === 1;
                return (
                  <button
                    key={label}
                    style={{ ...st.choiceBtn, fontSize: isSymbol ? '32px' : '18px', maxWidth: isSymbol ? '90px' : 'none' }}
                    onClick={() => submitChoice(label)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {!isCorrect && !isChoice && (
            <NumPad
              value={input}
              onChange={setInput}
              allowDecimal={allowDecimal}
              onSubmit={() => {
                if (input.trim()) { submitAnswer(input); setInput(''); }
              }}
            />
          )}

          {isCorrect && !settings.autoAdvance && (
            <button style={st.nextBtn} onClick={nextQuestion}>
              Next → <span style={st.kbTag}>Enter</span>
            </button>
          )}
        </div>
      </div>

      {/* Keyboard hint strip */}
      <div style={st.kbRow}>
        <KbChip k="0–9" label="type" />
        <KbChip k="↵" label="check/next" />
        <KbChip k="H" label="hint" />
        <KbChip k="Q" label="quit" />
        <KbChip k="Esc" label="settings" />
      </div>
    </div>
  );
}

function KbChip({ k, label }: { k: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', color: '#9ca3af' }}>
      <kbd style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '1px 5px', fontFamily: 'monospace', fontSize: '11px' }}>{k}</kbd>
      {label}
    </span>
  );
}

const st: Record<string, CSSProperties> = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '12px 16px', fontFamily: 'system-ui, sans-serif' },
  center: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '12px' },
  topBar: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' },
  progressWrap: { flex: 1 },
  progressBar: { height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' },
  progressFill: { height: '100%', background: '#4f46e5', borderRadius: '3px', transition: 'width 0.3s' },
  progressText: { fontSize: '12px', color: '#9ca3af' },
  iconBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px', borderRadius: '8px', lineHeight: 1 },
  hintBtn: { background: 'var(--primary-light)', borderRadius: '10px' },
  quitIconBtn: { color: '#9ca3af', fontSize: '16px', fontWeight: 'bold' },
  card: {
    position: 'relative', background: '#fff', borderRadius: '20px',
    padding: '28px 20px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
    textAlign: 'center', transition: 'border-color 0.15s',
  },
  audioBtn: { position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', opacity: 0.6 },
  prompt: { fontSize: '52px', fontWeight: 'bold', color: '#1f2937', marginBottom: '16px', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' },
  answerInput: {
    display: 'block', width: '140px', margin: '0 auto',
    fontSize: '44px', fontWeight: 'bold', textAlign: 'center',
    background: 'transparent', border: 'none', borderBottom: '3px solid #4f46e5',
    outline: 'none', fontVariantNumeric: 'tabular-nums', transition: 'color 0.15s, border-color 0.15s',
    MozAppearance: 'textfield' as never,
  },
  choiceDisplay: { fontSize: '44px', fontWeight: 'bold', color: '#4f46e5', minHeight: '52px', fontVariantNumeric: 'tabular-nums' },
  choiceRow: { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' },
  choiceBtn: {
    flex: 1, maxWidth: '90px', padding: '20px 0', fontSize: '32px', fontWeight: 'bold',
    background: '#fff', border: '2px solid var(--primary)', borderRadius: '14px',
    color: 'var(--primary)', cursor: 'pointer', touchAction: 'manipulation',
  },
  errorText: { color: '#ef4444', fontSize: '15px', fontWeight: '600', margin: '10px 0 0' },
  correctText: { color: '#16a34a', fontSize: '15px', fontWeight: '600', margin: '10px 0 0' },
  subText: { color: '#9ca3af', fontWeight: 'normal' },
  hintText: { color: '#d1d5db', fontSize: '13px', margin: '8px 0 0' },
  hintBox: { marginTop: '12px', padding: '10px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a', textAlign: 'left' as const },
  hintLabel: { fontSize: '12px', fontWeight: '700', color: '#92400e', margin: '0 0 4px' },
  hintHintText: { fontSize: '14px', color: '#78350f', margin: 0, lineHeight: 1.5 },
  explainBtn: { marginTop: '8px', padding: '6px 14px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  explanationText: { marginTop: '8px', fontSize: '13px', color: '#78350f', lineHeight: 1.5, borderTop: '1px solid #fde68a', paddingTop: '8px' },
  nextBtn: { display: 'block', width: '100%', marginTop: '16px', padding: '14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '17px', fontWeight: 'bold', cursor: 'pointer' },
  kbRow: { display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '14px', flexWrap: 'wrap' },
  kbTag: { fontSize: '11px', background: 'rgba(255,255,255,0.25)', borderRadius: '4px', padding: '1px 4px', fontFamily: 'monospace' },
  // Quit overlay
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' },
  quitPanel: { background: '#fff', borderRadius: '20px', padding: '28px 24px', maxWidth: '360px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  quitTitle: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 12px', textAlign: 'center' },
  quitBody: { textAlign: 'center', fontSize: '16px', color: '#374151', margin: '0 0 8px', fontWeight: '500' },
  quitBody2: { textAlign: 'center', fontSize: '13px', color: '#9ca3af', margin: '0 0 24px' },
  quitBtns: { display: 'flex', gap: '10px' },
  keepBtn: { flex: 1, padding: '14px', background: '#f3f4f6', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', color: '#374151' },
  quitBtn: { flex: 1, padding: '14px', background: '#ef4444', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', color: '#fff' },
};
