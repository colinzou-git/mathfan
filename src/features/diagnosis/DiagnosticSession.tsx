/**
 * DiagnosticSession — a self-contained diagnostic flow for Grade 3
 * multiplication and division.
 *
 * Records answers into mathAnswerEvents so the skill mastery engine
 * can update skill summaries after the session completes.
 *
 * No timer pressure. Uses QuestionRenderer with visual models.
 * Does not break existing practice or quiz flows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PracticeItem, AttemptLog } from '../../types/math';
import { buildDiagnosticPlan } from './diagnosticPlanner';
import { QuestionRenderer } from '../practice/QuestionRenderer';
import { NumPad } from '../../components/NumPad';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { flushDiagnosticWriteJobs, recordDiagnosticAnswerWithRetry, type DiagnosticWriteJob } from './diagnosticPersistence';
import { checkAnswer } from '../practice/answerChecker';
import { applyReview, createInitialState } from '../scheduler/scheduler';
import { deriveCardKey } from '../scheduler/cardModel';
import {
  applyMisconceptionConfirmation,
  applyMisconceptionDetection,
  detectMistakes,
} from '../mastery/misconceptionEngine';
import { itemStateRepo } from '../../db/repositories';
import { generateId } from '../../utils/id';
import { appNow } from '../time/clock';
import { buildSchedulingTelemetry } from '../learning/schedulingTelemetry';

interface Props {
  studentId: string;
  /** Called when all diagnostic questions are answered. */
  onComplete: () => void | Promise<void>;
  /** Called if the student wants to exit early. */
  onCancel: () => void;
}

interface QuestionResult {
  item: PracticeItem;
  studentAnswer: string;
  isCorrect: boolean;
  latencyMs: number;
}

type DiagPhase = 'intro' | 'active' | 'done';
type SaveState = 'idle' | 'saving' | 'error';

const FEEDBACK_MS = 1200;

export function DiagnosticSession({ studentId, onComplete, onCancel }: Props) {
  // sessionId and plan are stable for the lifetime of the component.
  // Stored in state (not ref) so they are safe to read during render.
  const [sessionId] = useState(() => generateId());
  const [plan] = useState(() => buildDiagnosticPlan(sessionId));
  const [phase, setPhase] = useState<DiagPhase>('intro');
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [unsavedAnswerCount, setUnsavedAnswerCount] = useState(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Retryable write jobs: each is a thunk that calls recordDiagnosticAnswerWithRetry
  // with a pre-captured payload. Running the thunk fresh on each retry lets
  // "Try again" actually retry instead of re-awaiting a settled promise.
  const pendingWritesRef = useRef<DiagnosticWriteJob[]>([]);
  // Tracks whether the auto-flush (triggered when phase → 'done') succeeded.
  // Used by complete() to skip duplicate writes when the user clicks "See my Math Map".
  const writesSucceededRef = useRef(false);

  const items = plan.items;
  const currentItem = items[index];
  const total = items.length;

  const flushPendingWrites = useCallback(async () => {
    const unsaved = await flushDiagnosticWriteJobs(pendingWritesRef.current);
    setUnsavedAnswerCount(unsaved);
    if (unsaved) throw new Error(`${unsaved} diagnostic answer${unsaved === 1 ? '' : 's'} remain unsaved.`);
  }, []);

  // Start timer when a new question appears
  useEffect(() => {
    if (phase === 'active' && !showFeedback) {
      startTimeRef.current = performance.now();
    }
  }, [phase, index, showFeedback]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleSubmit = useCallback(() => {
    if (!currentItem || showFeedback || !input.trim()) return;

    const latencyMs = Math.round(performance.now() - startTimeRef.current);
    const checked = checkAnswer(currentItem, input, latencyMs);
    const { isCorrect, reviewGrade, studentAnswer } = checked;

    const result: QuestionResult = {
      item: currentItem,
      studentAnswer: String(studentAnswer),
      isCorrect,
      latencyMs,
    };

    const now = appNow();
    const createdAt = now.toISOString();
    const item = currentItem;
    // Stable identities, generated once. The thunk below rebuilds the event/attempt
    // objects fresh on every run, but reuses these ids so a retry is an idempotent
    // put (no duplicate rows) even if an earlier run partially succeeded.
    const eventId = generateId();
    const attemptId = generateId();

    // Register a retryable write job that reconstructs the payload *fresh* every time
    // it runs. Building the payload inside the thunk (rather than awaiting a settled
    // promise captured at submit time) means that if payload construction itself fails
    // — e.g. the itemStateRepo.get read throws — the "Try again" path rebuilds it from
    // scratch and can actually succeed on retry.
    pendingWritesRef.current.push({ id: eventId, status: 'pending', run: async () => {
      const cardKey = deriveCardKey(item);
      let existing = await itemStateRepo.get(studentId, cardKey);
      if (!existing) existing = createInitialState(studentId, item);

      let updated = existing;
      let schedulingApplied = false;
      let schedulerErrorCode: MathAnswerEvent['schedulerErrorCode'];
      try {
        updated = applyReview(existing, reviewGrade, latencyMs, String(studentAnswer), now, { isCorrect });
        schedulingApplied = true;
      } catch (error) {
        // FSRS error (e.g. clock drift) — keep existing state rather than blocking.
        schedulerErrorCode = error instanceof RangeError ? 'clock_drift'
          : error instanceof TypeError ? 'invalid_card'
            : error instanceof Error ? 'fsrs_validation' : 'unknown';
      }
      updated = { ...updated, cardKey, lastItemId: item.id };

      let detectedMisconceptions: string[] = [];
      let confirmedMisconceptions: string[] = [];
      const misconceptionContext = { eventId, sessionId, itemId: item.id, createdAt };
      if (!isCorrect) {
        const newTags = detectMistakes(item, studentAnswer);
        if (newTags.length > 0) {
          const merged = Array.from(new Set([...(updated.mistakePatterns ?? []), ...newTags]));
          detectedMisconceptions = newTags;
          updated = {
            ...updated,
            mistakePatterns: merged,
            misconceptionEvidence: applyMisconceptionDetection(
              updated.misconceptionEvidence, newTags, misconceptionContext, existing.mistakePatterns,
            ),
          };
        }
      } else {
        const confirmation = applyMisconceptionConfirmation(
          updated.misconceptionEvidence, item, misconceptionContext, updated.mistakePatterns,
        );
        confirmedMisconceptions = confirmation.confirmedCodes;
        updated = { ...updated, misconceptionEvidence: confirmation.evidence };
      }

      const event: MathAnswerEvent = {
        id: eventId,
        studentId,
        sessionId,
        itemId: item.id,
        cardKey,
        schemaId: item.schemaId,
        mode: 'diagnostic',
        promptShown: item.prompt,
        correctAnswer: item.answer,
        studentAnswer,
        isCorrect,
        isRetry: false,
        hintUsed: false,
        schedulingEligible: true,
        schedulingApplied,
        schedulerErrorCode,
        latencyMs,
        reviewGrade,
        ratingReason: checked.ratingReason,
        responsePolicy: checked.policyKind,
        fluencyBand: checked.fluencyBand,
        detectedMisconceptions: detectedMisconceptions.length ? detectedMisconceptions : undefined,
        confirmedMisconceptions: confirmedMisconceptions.length ? confirmedMisconceptions : undefined,
        factStatusBefore: existing.masteryLevel,
        factStatusAfter: updated.masteryLevel,
        schedulingTelemetry: buildSchedulingTelemetry({
          item, stateBefore: existing, stateAfter: schedulingApplied ? updated : undefined,
          response: { reviewGrade, ratingReason: checked.ratingReason, responsePolicy: checked.policyKind, fluencyBand: checked.fluencyBand, hintUsed: false, isRetry: false, schedulingEligible: true, schedulingApplied, schedulerErrorCode },
          selection: { origin: 'diagnostic', rationaleCodes: ['diagnostic_coverage'] },
          presentationIndex: 1, attemptNo: 1, now,
        }),
        createdAt,
      };

      const attempt: AttemptLog = {
        id: attemptId,
        studentId,
        itemId: item.id,
        skillId: item.skillId,
        sessionId,
        promptShown: item.prompt,
        correctAnswer: item.answer,
        studentAnswer,
        isCorrect,
        latencyMs,
        reviewGrade,
        createdAt,
      };

      await recordDiagnosticAnswerWithRetry({ event, updatedState: updated, attempt });
    } });

    setResults(prev => [...prev, result]);
    setShowFeedback(isCorrect ? 'correct' : 'wrong');
    setInput('');

    // Auto-advance after feedback delay. On the last question, flush pending writes
    // before (or concurrently with) the done-screen transition so results are
    // persisted even if the user never taps "See my Math Map".
    timerRef.current = setTimeout(async () => {
      setShowFeedback(null);
      if (index + 1 >= total) {
        setPhase('done');
        setSaveState('saving');
        try {
          await flushPendingWrites();
          writesSucceededRef.current = true;
          setSaveState('idle');
        } catch (err) {
          console.warn('[DiagnosticSession] could not save diagnostic results', err);
          setSaveState('error');
        }
      } else {
        setIndex(i => i + 1);
      }
    }, FEEDBACK_MS);
  }, [currentItem, showFeedback, input, studentId, sessionId, index, total, flushPendingWrites]);

  // Keyboard support during active questions. Mirrors NumPad/touch behavior
  // without changing it: digits build the numeric answer, Backspace deletes,
  // number keys 1–N (or a matching single-character key) pick a choice, Enter
  // submits a non-empty answer, and Escape exits. Disabled while feedback shows
  // so a stray key can't submit the next question early.
  useEffect(() => {
    if (phase !== 'active' || showFeedback) return;
    const item = currentItem;
    if (!item) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); return; }
      if (e.key === 'Enter') {
        if (input.trim()) { e.preventDefault(); handleSubmit(); }
        return;
      }

      if (item.answerInput === 'choice') {
        const choices = item.choices ?? [];
        if (/^[1-9]$/.test(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (idx >= 0 && idx < choices.length) { e.preventDefault(); setInput(String(choices[idx])); return; }
        }
        if (e.key.length === 1) {
          const match = choices.find(c => String(c) === e.key);
          if (match !== undefined) { e.preventDefault(); setInput(String(match)); }
        }
        return;
      }

      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); setInput(v => v + e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); setInput(v => v.slice(0, -1)); }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, showFeedback, currentItem, input, onCancel, handleSubmit]);

  // ── Intro screen ─────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div style={s.container}>
        <div style={s.card}>
          <div style={s.bigIcon}>🔍</div>
          <h1 style={s.title}>Quick Check</h1>
          <p style={s.body}>
            {plan.description}
          </p>
          <p style={s.body}>
            {total} questions · No timer · Take your time!
          </p>
          <button style={s.startBtn} onClick={() => setPhase('active')}>
            Let's go!
          </button>
          <button style={s.cancelBtn} onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const correct = results.filter(r => r.isCorrect).length;
    const complete = async () => {
      if (saveState === 'saving') return;
      // Auto-flush already succeeded — skip writes and navigate directly.
      if (writesSucceededRef.current) {
        await onComplete();
        return;
      }
      // Retry failed writes.
      setSaveState('saving');
      try {
        await flushPendingWrites();
        writesSucceededRef.current = true;
        await onComplete();
      } catch (err) {
        console.warn('[DiagnosticSession] could not save diagnostic results', err);
        setSaveState('error');
      }
    };
    return (
      <div style={s.container}>
        <div style={s.card}>
          <div style={s.bigIcon}>🌟</div>
          <h1 style={s.title}>Great work!</h1>
          <p style={s.body}>
            You answered {correct} out of {total} correctly.
          </p>
          <p style={s.body}>
            {saveState === 'saving'
              ? 'Saving your results...'
              : saveState === 'error'
                ? `Could not save results. ${unsavedAnswerCount} answer${unsavedAnswerCount === 1 ? '' : 's'} remain unsaved. Try again.`
                : 'Your Math Map will update after your results are saved.'}
          </p>
          <button style={s.startBtn} disabled={saveState === 'saving'} onClick={complete}>
            {saveState === 'saving' ? 'Saving...' : saveState === 'error' ? 'Try again' : 'See my Math Map'}
          </button>
        </div>
      </div>
    );
  }

  // ── Active diagnostic ─────────────────────────────────────────────────────────

  if (!currentItem) return null;

  const progress = Math.round((index / total) * 100);
  const feedbackColor = showFeedback === 'correct' ? '#22c55e' : showFeedback === 'wrong' ? '#ef4444' : 'transparent';

  const isChoice = currentItem.answerInput === 'choice';
  const choices = currentItem.choices ?? [];

  return (
    <div style={s.container}>
      {/* Progress bar */}
      <div style={s.progressWrap}>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>
        <span style={s.progressText}>{index + 1} / {total}</span>
        <button style={s.cancelSmall} onClick={onCancel}>✕</button>
      </div>

      {/* Question card */}
      <div style={{ ...s.questionCard, borderColor: feedbackColor }}>
        {/* Mode badge */}
        <div style={s.diagBadge}>Diagnostic</div>

        <QuestionRenderer
          item={currentItem}
          mode="diagnose"
          showVisual={true}
        />

        {/* Feedback */}
        {showFeedback === 'correct' && (
          <div style={s.feedbackCorrect}>✓ Correct!</div>
        )}
        {showFeedback === 'wrong' && (
          <div style={s.feedbackWrong}>
            Nice try! Keep going.
          </div>
        )}
      </div>

      {/* Input area */}
      {!showFeedback && (
        <div style={s.inputArea}>
          {isChoice ? (
            <div style={s.choiceRow}>
              {choices.map(c => (
                <button
                  key={String(c)}
                  style={s.choiceBtn}
                  onClick={() => { setInput(String(c)); }}
                >
                  {String(c)}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div style={s.inputDisplay}>{input || '?'}</div>
              <NumPad
                value={input}
                onChange={setInput}
                allowDecimal={false}
                onSubmit={handleSubmit}
              />
            </>
          )}
          {isChoice && input && (
            <button style={s.submitBtn} onClick={handleSubmit}>
              Check ✓
            </button>
          )}
          {!isChoice && input && (
            <button style={s.submitBtn} onClick={handleSubmit}>
              Check ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: 'system-ui, sans-serif',
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '32px 24px',
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: '380px',
    marginTop: '40px',
  },
  bigIcon: {
    fontSize: '56px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#1f2937',
    margin: '0 0 12px',
  },
  body: {
    fontSize: '15px',
    color: '#6b7280',
    margin: '0 0 10px',
    lineHeight: 1.5,
  },
  startBtn: {
    width: '100%',
    padding: '14px',
    background: 'var(--primary, #4f46e5)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
    touchAction: 'manipulation',
  },
  cancelBtn: {
    width: '100%',
    padding: '10px',
    background: 'none',
    color: '#9ca3af',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '6px',
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    marginBottom: '16px',
  },
  progressBar: {
    flex: 1,
    height: '8px',
    background: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--primary, #4f46e5)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
    minWidth: '40px',
  },
  cancelSmall: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
  },
  questionCard: {
    width: '100%',
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    border: '3px solid transparent',
    transition: 'border-color 0.15s',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  diagBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#7c3aed',
    background: '#ede9fe',
    padding: '3px 10px',
    borderRadius: '20px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  feedbackCorrect: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#22c55e',
  },
  feedbackWrong: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ef4444',
  },
  inputArea: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  inputDisplay: {
    fontSize: '42px',
    fontWeight: '700',
    color: '#4f46e5',
    minHeight: '56px',
    textAlign: 'center',
  },
  choiceRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  choiceBtn: {
    padding: '14px 20px',
    background: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    cursor: 'pointer',
    touchAction: 'manipulation',
    minWidth: '64px',
  },
  submitBtn: {
    padding: '12px 32px',
    background: 'var(--primary, #4f46e5)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
};
