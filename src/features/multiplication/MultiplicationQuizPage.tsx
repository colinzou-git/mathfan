import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  MultiplicationFactStats,
  MultiplicationFactKey,
  QuizAnswerLog,
  QuizSession,
  QuizQuestion,
} from './types';
import type { SessionConfig } from '../../types/math';
import { parseFactKey, createInitialFactStats } from './multiplicationFacts';
import { MultiplicationMasteryGrid } from './MultiplicationMasteryGrid';
import { applyAnswerToStats, SLOW_MS } from './masteryEngine';
import { selectQuizQuestions } from './quizQuestionSelector';
import { generateRecommendations } from './practiceRecommendation';
import { db } from '../../db/dexie';
import { generateId } from '../../utils/id';
import { recordAnswerEvent } from '../learning/learningEvents';

interface Props {
  studentId: string;
  onDone: () => void;
  onStartPractice?: (config: SessionConfig) => void;
}

type Phase = 'setup' | 'loading' | 'active' | 'feedback' | 'retry' | 'summary';

const QUIZ_LENGTHS = [10, 20, 30, 50];
const DEFAULT_LENGTH = 20;
const FEEDBACK_MS = 800;


// ── Sub-components ─────────────────────────────────────────────────────────────

function FactChip({ label, bg, text }: { label: string; bg: string; text: string }) {
  return (
    <span style={{ background: bg, color: text, borderRadius: '8px', padding: '4px 10px', fontSize: '14px', fontWeight: '600', display: 'inline-block', margin: '3px' }}>
      {label}
    </span>
  );
}

function StatBox({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '12px', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

// ── Setup screen ───────────────────────────────────────────────────────────────

function SetupScreen({
  quizLength, onSelectLength, onStart, onBack,
}: {
  quizLength: number;
  onSelectLength: (n: number) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack} aria-label="Back">←</button>
        <h1 style={s.pageTitle}>Multiplication Quiz</h1>
        <div style={{ width: '40px' }} />
      </div>

      <p style={s.subtitle}>Test your multiplication facts from 0×0 to 12×12.</p>
      <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px', textAlign: 'center' }}>
        How many questions?
      </p>

      <div style={s.lengthGrid}>
        {QUIZ_LENGTHS.map(len => (
          <button
            key={len}
            style={{
              ...s.lengthBtn,
              background: quizLength === len ? 'var(--primary)' : '#fff',
              color: quizLength === len ? '#fff' : '#374151',
              borderColor: quizLength === len ? 'var(--primary)' : '#e5e7eb',
              fontWeight: quizLength === len ? 'bold' : '600',
            }}
            onClick={() => onSelectLength(len)}
          >
            {len}
          </button>
        ))}
      </div>

      <button style={s.startBtn} onClick={onStart}>
        Start {quizLength}-Question Quiz
      </button>
    </div>
  );
}

// Build a SessionConfig that practices exactly the given facts (repeated to fill sessionLength).
// Uses specificItemIds so only those facts appear — no other table combinations are added.
function recommendedPracticeConfig(facts: MultiplicationFactKey[], sessionLength: number): SessionConfig {
  const specificItemIds = facts.map(key => `MUL_${key}`);
  return { mode: 'multi_table', specificItemIds, sessionLength };
}

// ── Summary screen ─────────────────────────────────────────────────────────────

function SummaryScreen({
  session, statsMap, onDone, onStartPractice,
}: {
  session: QuizSession;
  statsMap: Map<MultiplicationFactKey, MultiplicationFactStats>;
  onDone: () => void;
  onStartPractice?: (config: SessionConfig) => void;
}) {
  const [practiceRounds, setPracticeRounds] = useState(3);
  const [showPracticeSetup, setShowPracticeSetup] = useState(false);

  const acc = Math.round(session.accuracy * 100);
  const avgSec = session.averageResponseTimeMs
    ? (session.averageResponseTimeMs / 1000).toFixed(1)
    : '—';
  const accColor = acc >= 80 ? '#16a34a' : acc >= 60 ? '#d97706' : '#dc2626';

  const wrongLogs = session.answerLogs.filter(l => !l.isCorrect);
  const slowWrongLogs = session.answerLogs.filter(l => l.isCorrect && l.responseTimeMs > SLOW_MS);
  const strongLogs = session.answerLogs
    .filter(l => l.isCorrect && (l.newMasteryState === 'strong' || l.newMasteryState === 'mastered'))
    .slice(0, 6);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={{ width: '40px' }} />
        <h1 style={s.pageTitle}>Quiz Complete!</h1>
        <div style={{ width: '40px' }} />
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <StatBox label="Score" value={`${session.correctCount}/${session.quizLength}`} color={accColor} />
        <StatBox label="Accuracy" value={`${acc}%`} color={accColor} />
        <StatBox label="Avg Time" value={`${avgSec}s`} />
      </div>

      {/* Wrong answers */}
      {wrongLogs.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Needs Work ({wrongLogs.length})</h3>
          <div>
            {wrongLogs.map(l => (
              <FactChip key={l.factKey} label={`${l.left}×${l.right}=${l.correctAnswer}`} bg="#fef2f2" text="#dc2626" />
            ))}
          </div>
          {onStartPractice && (
            <div style={{ marginTop: '10px' }}>
              {showPracticeSetup ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: '#374151' }}>Rounds per fact:</span>
                  <input
                    type="number" min={1} max={10} value={practiceRounds}
                    onChange={e => {
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n)) setPracticeRounds(Math.max(1, Math.min(10, n)));
                    }}
                    style={{ width: '56px', padding: '4px 8px', fontSize: '16px', textAlign: 'center', border: '1.5px solid #d1d5db', borderRadius: '8px' }}
                  />
                  <button
                    onClick={() => onStartPractice(recommendedPracticeConfig(
                      wrongLogs.map(l => l.factKey),
                      wrongLogs.length * practiceRounds,
                    ))}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => setShowPracticeSetup(false)}
                    style={{ background: 'none', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPracticeSetup(true)}
                  style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Practice
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Slow correct answers */}
      {slowWrongLogs.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Correct but Slow ({slowWrongLogs.length})</h3>
          <div>
            {slowWrongLogs.map(l => (
              <FactChip key={l.factKey} label={`${l.left}×${l.right}=${l.correctAnswer}`} bg="#fef3c7" text="#92400e" />
            ))}
          </div>
        </div>
      )}

      {/* Forgotten */}
      {session.forgottenFactsDiscovered.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Forgotten ({session.forgottenFactsDiscovered.length})</h3>
          <div>
            {session.forgottenFactsDiscovered.map(key => {
              const { left, right, answer } = parseFactKey(key);
              return <FactChip key={key} label={`${left}×${right}=${answer}`} bg="#fef08a" text="#713f12" />;
            })}
          </div>
        </div>
      )}

      {/* Recommended practice */}
      {session.recommendedPracticeFacts.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Practice These Next</h3>
          <div>
            {session.recommendedPracticeFacts.map(key => {
              const { left, right, answer } = parseFactKey(key);
              return <FactChip key={key} label={`${left}×${right}=${answer}`} bg="var(--primary-light)" text="var(--primary)" />;
            })}
          </div>
        </div>
      )}

      {/* Strong facts */}
      {strongLogs.length > 0 && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Strong Facts ✓</h3>
          <div>
            {strongLogs.map(l => (
              <FactChip key={l.factKey} label={`${l.left}×${l.right}=${l.correctAnswer}`} bg="#f0fdf4" text="#15803d" />
            ))}
          </div>
        </div>
      )}

      {/* Mastery grid */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>Mastery Grid (0–12)</h3>
        <MultiplicationMasteryGrid statsMap={statsMap} />
      </div>

      {/* Practice recommended facts */}
      {onStartPractice && session.recommendedPracticeFacts.length > 0 && (
        <button
          style={{ ...s.doneBtn, background: '#f0fdf4', color: '#15803d', borderColor: '#86efac' }}
          onClick={() => onStartPractice(recommendedPracticeConfig(session.recommendedPracticeFacts, 20))}
        >
          Practice Recommended Facts →
        </button>
      )}

      <button style={s.doneBtn} onClick={onDone}>
        Back to Dashboard
      </button>
    </div>
  );
}

// ── Main quiz component ────────────────────────────────────────────────────────

export function MultiplicationQuizPage({ studentId, onDone, onStartPractice }: Props) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [quizLength, setQuizLength] = useState(DEFAULT_LENGTH);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [lastIsCorrect, setLastIsCorrect] = useState<boolean | null>(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState<number>(0);
  const [answerLogs, setAnswerLogs] = useState<QuizAnswerLog[]>([]);
  const [statsMap, setStatsMap] = useState<Map<MultiplicationFactKey, MultiplicationFactStats>>(new Map());
  const [summary, setSummary] = useState<QuizSession | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionId = useRef(generateId());
  const sessionStartedAt = useRef(new Date().toISOString());
  const questionStartTime = useRef(0);

  // Cleanup timer on unmount
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);

  // Focus input on each new active question and when entering retry mode
  useEffect(() => {
    if (phase === 'active' || phase === 'retry') {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [phase, currentIndex]);

  const startQuiz = useCallback(async (length: number) => {
    setPhase('loading');
    sessionId.current = generateId();
    sessionStartedAt.current = new Date().toISOString();

    const all = await db.multFactStats.where('studentId').equals(studentId).toArray();
    const map = new Map(all.map(s => [s.key as MultiplicationFactKey, s as MultiplicationFactStats]));
    setStatsMap(map);

    const keys = selectQuizQuestions(studentId, map, length);
    const qs: QuizQuestion[] = keys.map(key => {
      const { left, right, answer } = parseFactKey(key);
      return { factKey: key, left, right, answer };
    });

    setQuestions(qs);
    setCurrentIndex(0);
    setAnswerLogs([]);
    setInput('');
    questionStartTime.current = Date.now();
    setPhase('active');
  }, [studentId]);

  const finishQuiz = useCallback((
    logs: QuizAnswerLog[],
    map: Map<MultiplicationFactKey, MultiplicationFactStats>,
    totalQuestions: number,
  ) => {
    const correct = logs.filter(l => l.isCorrect).length;
    const avgTime = logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + l.responseTimeMs, 0) / logs.length)
      : null;

    const session: QuizSession = {
      id: sessionId.current,
      studentId,
      category: 'multiplication',
      quizLength: totalQuestions,
      startedAt: sessionStartedAt.current,
      completedAt: new Date().toISOString(),
      answerLogs: logs,
      correctCount: correct,
      incorrectCount: logs.length - correct,
      accuracy: logs.length > 0 ? correct / logs.length : 0,
      averageResponseTimeMs: avgTime,
      weakFactsDiscovered:    logs.filter(l => l.newMasteryState === 'weak').map(l => l.factKey),
      strongFactsConfirmed:   logs.filter(l => l.isCorrect && (l.newMasteryState === 'strong' || l.newMasteryState === 'mastered')).map(l => l.factKey),
      forgottenFactsDiscovered: logs.filter(l => l.newMasteryState === 'forgotten').map(l => l.factKey),
      untestedFactsCovered:   logs.filter(l => l.previousMasteryState === 'new').map(l => l.factKey),
      recommendedPracticeFacts: generateRecommendations(logs, map),
    };

    db.quizSessions.put(session).catch(console.warn);
    setSummary(session);
    setStatsMap(map);
    setPhase('summary');
  }, [studentId]);

  const handleSubmit = useCallback(async () => {
    if (phase !== 'active' && phase !== 'retry') return;
    if (questions.length === 0) return;
    const q = questions[currentIndex];
    if (!q) return;

    const parsed = input.trim() === '' ? null : parseInt(input.trim(), 10);
    const studentAnswer = parsed !== null && !isNaN(parsed) ? parsed : null;
    const isCorrect = studentAnswer !== null && studentAnswer === q.answer;

    if (phase === 'retry') {
      // Retry: check correctness but don't record a new answer log
      setLastIsCorrect(isCorrect);
      if (isCorrect) {
        setPhase('feedback');
        setInput('');
        const nextIndex = currentIndex + 1;
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => {
          if (nextIndex >= questions.length) {
            finishQuiz(answerLogs, statsMap, questions.length);
          } else {
            setCurrentIndex(nextIndex);
            setInput('');
            questionStartTime.current = Date.now();
            setPhase('active');
          }
        }, FEEDBACK_MS);
      } else {
        // Still wrong: clear input so the student can try again
        setInput('');
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return;
    }

    // First attempt (phase === 'active')
    const responseTimeMs = Date.now() - questionStartTime.current;
    const answeredAt = new Date().toISOString();

    const prevStats = statsMap.get(q.factKey) ?? createInitialFactStats(studentId, q.left, q.right);
    const { updated, prevState, prevScore } = applyAnswerToStats(prevStats, isCorrect, responseTimeMs, answeredAt);

    const newMap = new Map(statsMap);
    newMap.set(q.factKey, updated);

    const log: QuizAnswerLog = {
      quizId: sessionId.current,
      factKey: q.factKey,
      left: q.left,
      right: q.right,
      correctAnswer: q.answer,
      studentAnswer,
      isCorrect,
      responseTimeMs,
      answeredAt,
      previousMasteryScore: prevScore,
      newMasteryScore: updated.masteryScore,
      previousMasteryState: prevState,
      newMasteryState: updated.masteryState,
    };

    const newLogs = [...answerLogs, log];

    setLastIsCorrect(isCorrect);
    setLastCorrectAnswer(q.answer);
    setAnswerLogs(newLogs);
    setStatsMap(newMap);

    db.multFactStats.put(updated).catch(console.warn);
    recordAnswerEvent({
      id: generateId(),
      studentId,
      sessionId: sessionId.current,
      itemId: `MUL_${q.factKey}`,
      mode: 'quiz',
      promptShown: `${q.left} × ${q.right} = ?`,
      correctAnswer: q.answer,
      studentAnswer,
      isCorrect,
      isRetry: false,
      hintUsed: false,
      latencyMs: responseTimeMs,
      factStatusBefore: prevState,
      factStatusAfter: updated.masteryState,
      createdAt: answeredAt,
    }).catch(console.warn);

    if (isCorrect) {
      setPhase('feedback');

      const nextIndex = currentIndex + 1;
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => {
        if (nextIndex >= questions.length) {
          finishQuiz(newLogs, newMap, questions.length);
        } else {
          setCurrentIndex(nextIndex);
          setInput('');
          questionStartTime.current = Date.now();
          setPhase('active');
        }
      }, FEEDBACK_MS);
    } else {
      // Wrong on first attempt: enter retry mode (log already recorded as wrong)
      setPhase('retry');
      setInput('');
      questionStartTime.current = Date.now();
    }
  }, [phase, questions, currentIndex, input, answerLogs, statsMap, studentId, finishQuiz]);

  const handleSkip = useCallback(() => {
    if (phase !== 'retry') return;
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    const nextIndex = currentIndex + 1;
    setInput('');
    if (nextIndex >= questions.length) {
      finishQuiz(answerLogs, statsMap, questions.length);
    } else {
      setCurrentIndex(nextIndex);
      questionStartTime.current = Date.now();
      setPhase('active');
    }
  }, [phase, currentIndex, questions, answerLogs, statsMap, finishQuiz]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  }, [handleSubmit]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <SetupScreen
        quizLength={quizLength}
        onSelectLength={setQuizLength}
        onStart={() => startQuiz(quizLength)}
        onBack={onDone}
      />
    );
  }

  if (phase === 'loading') {
    return (
      <div style={{ ...s.container, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '40px' }}>⏳</div>
      </div>
    );
  }

  if (phase === 'summary' && summary) {
    return <SummaryScreen session={summary} statsMap={statsMap} onDone={onDone} onStartPractice={onStartPractice} />;
  }

  const q = questions[currentIndex];
  if (!q) return null;

  const isFeedbackCorrect = phase === 'feedback' && lastIsCorrect === true;
  const isFeedbackWrong   = phase === 'feedback' && lastIsCorrect === false;
  const isRetrying        = phase === 'retry';
  const correctSoFar = answerLogs.filter(l => l.isCorrect).length;
  const wrongSoFar   = answerLogs.filter(l => !l.isCorrect).length;

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={onDone} aria-label="Quit quiz">←</button>
        <span style={s.progressText}>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <div style={{ width: '40px' }} />
      </div>

      {/* Progress bar */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${(currentIndex / questions.length) * 100}%` }} />
      </div>

      {/* Score tracker */}
      <div style={s.scoreRow}>
        <span style={{ color: '#16a34a', fontWeight: '700' }}>✓ {correctSoFar}</span>
        <span style={{ color: '#dc2626', fontWeight: '700' }}>✗ {wrongSoFar}</span>
      </div>

      {/* Question card */}
      <div style={{
        ...s.card,
        background: isFeedbackCorrect ? '#f0fdf4' : (isFeedbackWrong || isRetrying) ? '#fef2f2' : '#fff',
        borderColor: isFeedbackCorrect ? '#4ade80' : (isFeedbackWrong || isRetrying) ? '#fca5a5' : '#e5e7eb',
      }}>
        <div style={s.questionText}>{q.left} × {q.right} = ?</div>

        {phase === 'feedback' ? (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            {isFeedbackCorrect ? (
              <div style={{ fontSize: '32px', color: '#16a34a', fontWeight: 'bold' }}>
                ✓ {lastCorrectAnswer}
              </div>
            ) : (
              <div style={{ fontSize: '18px', color: '#dc2626', fontWeight: '600' }}>
                The answer is <strong style={{ fontSize: '28px' }}>{lastCorrectAnswer}</strong>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={s.inputRow}>
              <input
                ref={inputRef}
                type="number"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={s.answerInput}
                placeholder="?"
                min={0}
                max={999}
                inputMode="numeric"
                aria-label="Your answer"
              />
              <button
                style={{ ...s.submitBtn, opacity: input.trim() === '' ? 0.45 : 1 }}
                onClick={handleSubmit}
                disabled={input.trim() === ''}
                aria-label="Submit answer"
              >
                ✓
              </button>
            </div>
            {isRetrying && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                <button onClick={handleSkip} style={s.skipBtn}>
                  Skip →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: 'system-ui, sans-serif',
    minHeight: '100dvh',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '8px',
    color: '#374151',
    width: '40px',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '15px',
    margin: '0 0 16px',
  },
  progressText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
  },
  progressBar: {
    height: '6px',
    background: '#e5e7eb',
    borderRadius: '3px',
    marginBottom: '12px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--primary)',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  scoreRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    fontSize: '18px',
    marginBottom: '16px',
  },
  card: {
    background: '#fff',
    border: '2px solid #e5e7eb',
    borderRadius: '20px',
    padding: '32px 24px',
    textAlign: 'center',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    transition: 'background 0.15s, border-color 0.15s',
    marginBottom: '16px',
  },
  questionText: {
    fontSize: '52px',
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: '-1px',
    marginBottom: '4px',
  },
  inputRow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center',
    marginTop: '20px',
  },
  answerInput: {
    width: '120px',
    padding: '14px 16px',
    fontSize: '28px',
    fontWeight: 'bold',
    textAlign: 'center',
    border: '2.5px solid var(--primary)',
    borderRadius: '14px',
    outline: 'none',
    color: '#111827',
    background: '#fff',
  },
  submitBtn: {
    width: '60px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '24px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    transition: 'opacity 0.15s',
  },
  lengthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
    marginBottom: '24px',
  },
  lengthBtn: {
    padding: '18px 0',
    fontSize: '24px',
    fontWeight: '600',
    border: '2px solid',
    borderRadius: '14px',
    cursor: 'pointer',
    touchAction: 'manipulation',
    transition: 'background 0.1s, color 0.1s',
  },
  startBtn: {
    width: '100%',
    padding: '18px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
  },
  doneBtn: {
    width: '100%',
    padding: '16px',
    background: '#f9fafb',
    color: '#374151',
    border: '1.5px solid #e5e7eb',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    marginBottom: '24px',
  },
  skipBtn: {
    background: 'none',
    border: '1.5px solid #d1d5db',
    borderRadius: '10px',
    padding: '8px 24px',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: '0 0 8px',
  },
};
