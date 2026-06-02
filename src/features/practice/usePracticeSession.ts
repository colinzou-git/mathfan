import { useState, useCallback, useRef } from 'react';
import type {
  PracticeItem, StudentItemState, SessionConfig,
} from '../../types/math';
import { checkAnswer } from './answerChecker';
import { classifyAttempts } from './metrics';
import { applyReview, createInitialState, planSession, planTableSession } from '../scheduler/scheduler';
import {
  generateSingleTableItems, generateMultipleTablesItems, generateMultiplicationRangeItems,
  ALL_ITEMS, ITEM_MAP,
} from '../curriculum/multiplicationItems';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import {
  generateAdditionItems, generateSubtractionItems, generateDivisionItemsRange,
} from '../curriculum/arithmeticItems';
import { generateFractionItems } from '../curriculum/fractionItems';
import { generateWordProblemItems } from '../curriculum/wordProblemItems';
import { generateRoundingItems } from '../curriculum/roundingItems';
import { generateNumberTheoryItems } from '../curriculum/numberTheoryItems';
import { generateDecimalItems } from '../curriculum/decimalItems';
import { itemStateRepo, sessionRepo } from '../../db/repositories';
import { db } from '../../db/dexie';
import { appNow } from '../time/clock';
import { generateId } from '../../utils/id';
import { recordPracticeAnswer, type PracticeAnswerPayload } from '../learning/recordAnswer';
import type { PracticeItem as PItem } from '../../types/math';

// ── Public types ──────────────────────────────────────────────────────────────

export interface CorrectResult {
  latencyMs: number;
  isNewPersonalBest: boolean;
}

/** Snapshot of the previous session of the same mode, for session-over-session comparison. */
export interface LastSessionSummary {
  firstTryAccuracy: number | null; // 0–1; null when the prior session predates first-try tracking
  averageLatencyMs: number;
}

export interface SessionState {
  /** idle → active → correct → (next question or complete) */
  phase: 'idle' | 'active' | 'correct' | 'complete';
  currentItem: PracticeItem | null;
  /** Increments on every wrong answer — lets PracticeScreen clear the input. */
  retryKey: number;
  /** Set when the last answer was wrong; null when answer is correct or session just advanced. */
  errorText: string | null;
  correctResult: CorrectResult | null;
  completedCount: number;
  correctCount: number;
  /** Solved on the first attempt. */
  firstTryCount: number;
  /** Solved in exactly 2 attempts (one miss, then right). */
  correctedCount: number;
  /** Solved in 3+ attempts. */
  repeatedCount: number;
  /** First-try solves that were correct but slow (graded 'hard'). */
  slowFirstTryCount: number;
  /** Total answer submissions (right and wrong). */
  attemptCount: number;
  totalPlanned: number;
  sessionId: string | null;
  /** Correct-answer latencies for the session (used in SessionSummary). */
  latencies: number[];
  fastestMs: number | null;
  /** Distinct prompts the student got wrong at least once this session. */
  missedFacts: string[];
  /** Prior session of the same mode (captured at start), for comparison. */
  lastSession: LastSessionSummary | null;
}

// ── Internal state helpers ────────────────────────────────────────────────────

const INITIAL: SessionState = {
  phase: 'idle',
  currentItem: null,
  retryKey: 0,
  errorText: null,
  correctResult: null,
  completedCount: 0,
  correctCount: 0,
  firstTryCount: 0,
  correctedCount: 0,
  repeatedCount: 0,
  slowFirstTryCount: 0,
  attemptCount: 0,
  totalPlanned: 0,
  sessionId: null,
  latencies: [],
  fastestMs: null,
  missedFacts: [],
  lastSession: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePracticeSession(studentId: string) {
  const [state, setState] = useState<SessionState>(INITIAL);

  // Mutable refs — accessed inside callbacks without being dependencies
  const queueRef = useRef<string[]>([]);
  const statesRef = useRef<Map<string, StudentItemState>>(new Map());
  const configRef = useRef<SessionConfig | null>(null);
  const sessionStartRef = useRef<number>(0);
  const questionStartRef = useRef<number>(0);
  // Attempts at the *current* presentation — reset whenever a new item is shown, so retries
  // accumulate but re-queued facts (table drills) start fresh.
  const currentAttemptsRef = useRef<number>(0);
  // Holds dynamically generated items (arithmetic/fractions) not in the static ITEM_MAP
  const dynamicItemsRef = useRef<Map<string, PItem>>(new Map());
  // Carries the write payload from inside setState out to the async write call below it
  const pendingWriteRef = useRef<PracticeAnswerPayload | null>(null);

  const resolveItem = useCallback((id: string): PItem => {
    return dynamicItemsRef.current.get(id) ?? getStaticItem(id);
  }, []);

  // ── startSession ──────────────────────────────────────────────────────────

  const startSession = useCallback(async (config: SessionConfig) => {
    configRef.current = config;
    const now = appNow();
    sessionStartRef.current = Date.now();

    const allStates = await itemStateRepo.getForStudent(studentId);
    const stateMap = new Map(allStates.map(s => [s.itemId, s]));
    statesRef.current = stateMap;

    let queue: string[];
    const {
      mode, tables, sessionLength, specificItemIds,
      operandMin, operandMax, operand2Min, operand2Max, fractionMode, grade,
    } = config;

    // Capture the most recent prior session of the same mode (before saving the new one)
    // for the session-over-session comparison on the summary screen.
    const prior = await sessionRepo.getLastByMode(studentId, mode);
    const lastSession: LastSessionSummary | null =
      prior && prior.completedQuestionCount > 0
        ? {
            firstTryAccuracy: prior.firstTryCount != null
              ? prior.firstTryCount / prior.completedQuestionCount
              : null,
            averageLatencyMs: prior.averageLatencyMs,
          }
        : null;
    const lo = operandMin ?? 0;
    const hi = operandMax ?? 20;
    const lo2 = operand2Min ?? lo;
    const hi2 = operand2Max ?? hi;
    const g = grade ?? 3;

    // Reset & populate the dynamic item registry for generated modes
    dynamicItemsRef.current = new Map();
    const registerDynamic = (items: PItem[]): string[] => {
      for (const it of items) dynamicItemsRef.current.set(it.id, it);
      return items.map(it => it.id);
    };

    if (specificItemIds?.length) {
      // Focused review: practice exactly the listed items, repeated to fill sessionLength.
      // Reconstruct and register any item not already in the static ITEM_MAP.
      const validIds: string[] = [];
      for (const id of specificItemIds) {
        if (!ITEM_MAP.has(id) && !dynamicItemsRef.current.has(id)) {
          const item = makeItemFromId(id);
          if (item) dynamicItemsRef.current.set(item.id, item);
        }
        if (ITEM_MAP.has(id) || dynamicItemsRef.current.has(id)) validIds.push(id);
      }
      const shuffled = [...validIds].sort(() => Math.random() - 0.5);
      queue = [];
      while (queue.length < sessionLength && shuffled.length > 0) {
        for (const id of shuffled) {
          if (queue.length >= sessionLength) break;
          queue.push(id);
        }
      }
    } else if (mode === 'multiplication') {
      // First factor from [lo,hi], second from [lo2,hi2].
      queue = registerDynamic(generateMultiplicationRangeItems(lo, hi, lo2, hi2, sessionLength));
    } else if (mode === 'single_table' && tables?.length) {
      queue = planTableSession(generateSingleTableItems(tables[0]), sessionLength);
    } else if (mode === 'multi_table' && tables?.length) {
      queue = planTableSession(generateMultipleTablesItems(tables), sessionLength);
    } else if (mode === 'addition') {
      queue = registerDynamic(generateAdditionItems(lo, hi, sessionLength, lo2, hi2));
    } else if (mode === 'subtraction') {
      queue = registerDynamic(generateSubtractionItems(lo, hi, sessionLength, lo2, hi2));
    } else if (mode === 'division') {
      // operand range = dividend, operand2 range = divisor.
      queue = registerDynamic(generateDivisionItemsRange(lo2, hi2, sessionLength, lo, hi));
    } else if (mode === 'fraction') {
      // operand range = numerator, operand2 range = denominator.
      queue = registerDynamic(generateFractionItems(fractionMode ?? 'equivalent', sessionLength, lo, hi, lo2, hi2));
    } else if (mode === 'word_problem') {
      queue = registerDynamic(generateWordProblemItems(g, sessionLength, operandMin, operandMax));
    } else if (mode === 'rounding') {
      queue = registerDynamic(generateRoundingItems(g, sessionLength, operandMin, operandMax));
    } else if (mode === 'factors') {
      queue = registerDynamic(generateNumberTheoryItems(g, sessionLength, operandMin, operandMax));
    } else if (mode === 'decimals') {
      queue = registerDynamic(generateDecimalItems(g, sessionLength, operandMin, operandMax));
    } else {
      const plan = planSession(ALL_ITEMS, stateMap, now, sessionLength);
      queue = [...plan.dueItems, ...plan.weakItems, ...plan.newItems];
    }

    const sessionId = generateId();
    await sessionRepo.save({
      id: sessionId, studentId,
      startedAt: now.toISOString(),
      mode, tables,
      plannedQuestionCount: queue.length,
      completedQuestionCount: 0, correctCount: 0, averageLatencyMs: 0,
    });

    queueRef.current = queue;

    if (queue.length === 0) {
      setState({ ...INITIAL, phase: 'complete', sessionId, totalPlanned: 0, lastSession });
      return;
    }

    const first = resolveItem(queueRef.current.shift()!);
    questionStartRef.current = Date.now();
    currentAttemptsRef.current = 0;
    setState({
      ...INITIAL, phase: 'active',
      currentItem: first,
      totalPlanned: queue.length + 1,
      sessionId,
      lastSession,
    });
  }, [studentId]);

  // ── submitAnswer ──────────────────────────────────────────────────────────

  const submitAnswer = useCallback(async (rawInput: string) => {
    pendingWriteRef.current = null;

    setState(prev => {
      if (prev.phase !== 'active' || !prev.currentItem || !prev.sessionId) return prev;

      const item = prev.currentItem;
      const latencyMs = Date.now() - questionStartRef.current;
      const result = checkAnswer(item, rawInput, latencyMs);
      const attemptNo = (currentAttemptsRef.current += 1);
      const now = appNow();
      const createdAt = now.toISOString();

      const existing = statesRef.current.get(item.id) ?? createInitialState(studentId, item);

      // Only the first attempt at each question presentation updates long-term
      // FSRS scheduling. Retries are logged for stats but don't distort the
      // spaced-repetition schedule.
      const isFirstAttempt = attemptNo === 1;
      const updated = isFirstAttempt
        ? applyReview(existing, result.reviewGrade, latencyMs, rawInput, now, { isCorrect: result.isCorrect })
        : existing;
      if (isFirstAttempt) {
        statesRef.current.set(item.id, updated);
      }

      pendingWriteRef.current = {
        event: {
          id: generateId(),
          studentId,
          sessionId: prev.sessionId!,
          itemId: item.id,
          mode: 'practice',
          promptShown: item.prompt,
          correctAnswer: item.answer,
          studentAnswer: result.studentAnswer,
          isCorrect: result.isCorrect,
          isRetry: !isFirstAttempt,
          hintUsed: false,
          latencyMs,
          reviewGrade: result.reviewGrade,
          factStatusBefore: existing.masteryLevel,
          factStatusAfter: updated.masteryLevel,
          createdAt,
        },
        // Retries do not change FSRS state — pass undefined to skip the itemStates write.
        updatedState: isFirstAttempt ? updated : undefined,
        attempt: {
          id: generateId(),
          studentId,
          itemId: item.id,
          skillId: item.skillId,
          sessionId: prev.sessionId!,
          promptShown: item.prompt,
          correctAnswer: item.answer,
          studentAnswer: result.studentAnswer,
          isCorrect: result.isCorrect,
          latencyMs,
          reviewGrade: result.reviewGrade,
          createdAt,
        },
      };

      if (!result.isCorrect) {
        // Wrong: stay on same question, clear input via retryKey, and remember the fact.
        const missedFacts = prev.missedFacts.includes(item.prompt)
          ? prev.missedFacts
          : [...prev.missedFacts, item.prompt];
        return {
          ...prev,
          retryKey: prev.retryKey + 1,
          errorText: 'Incorrect — try again',
          attemptCount: prev.attemptCount + 1,
          missedFacts,
        };
      }

      // Correct — classify how this presentation was solved.
      const outcome = classifyAttempts(attemptNo);
      const isSlowFirstTry = outcome === 'first-try' && result.reviewGrade === 'hard';
      const isNewPB =
        existing.personalBestMs === undefined || latencyMs < existing.personalBestMs;
      const newLatencies = [...prev.latencies, latencyMs];
      const newFastest = prev.fastestMs === null
        ? latencyMs : Math.min(prev.fastestMs, latencyMs);

      return {
        ...prev,
        phase: 'correct',
        errorText: null,
        correctResult: { latencyMs, isNewPersonalBest: isNewPB },
        correctCount: prev.correctCount + 1,
        completedCount: prev.completedCount + 1,
        attemptCount: prev.attemptCount + 1,
        firstTryCount: prev.firstTryCount + (outcome === 'first-try' ? 1 : 0),
        correctedCount: prev.correctedCount + (outcome === 'corrected' ? 1 : 0),
        repeatedCount: prev.repeatedCount + (outcome === 'repeated' ? 1 : 0),
        slowFirstTryCount: prev.slowFirstTryCount + (isSlowFirstTry ? 1 : 0),
        latencies: newLatencies,
        fastestMs: newFastest,
      };
    });

    if (pendingWriteRef.current) {
      recordPracticeAnswer(pendingWriteRef.current).catch(console.warn);
    }
  }, [studentId]);

  // ── nextQuestion ──────────────────────────────────────────────────────────

  const nextQuestion = useCallback(async () => {
    const nextId = queueRef.current.shift();

    // Update session record
    setState(prev => {
      if (prev.sessionId) {
        const avgMs = prev.latencies.length
          ? Math.round(prev.latencies.reduce((s, v) => s + v, 0) / prev.latencies.length)
          : 0;
        const isEnding = !nextId;
        sessionRepo.get(prev.sessionId).then(s => {
          if (!s) return;
          if (isEnding && prev.completedCount === 0) {
            // Never answered anything — remove the session entirely
            db.sessions.delete(s.id);
          } else {
            sessionRepo.save({
              ...s,
              completedQuestionCount: prev.completedCount,
              correctCount: prev.correctCount,
              firstTryCount: prev.firstTryCount,
              correctedCount: prev.correctedCount,
              repeatedCount: prev.repeatedCount,
              slowFirstTryCount: prev.slowFirstTryCount,
              attemptCount: prev.attemptCount,
              averageLatencyMs: avgMs,
              fastestCorrectMs: prev.fastestMs ?? undefined,
              endedAt: isEnding ? appNow().toISOString() : undefined,
            });
          }
        });
      }

      if (!nextId) {
        return { ...prev, phase: 'complete', correctResult: null, errorText: null };
      }

      questionStartRef.current = Date.now();
      currentAttemptsRef.current = 0;
      return {
        ...prev,
        phase: 'active',
        currentItem: resolveItem(nextId),
        retryKey: 0,
        errorText: null,
        correctResult: null,
      };
    });
  }, []);

  // ── resetSession ─────────────────────────────────────────────────────────

  const resetSession = useCallback(() => {
    queueRef.current = [];
    configRef.current = null;
    setState(INITIAL);
  }, []);

  return { state, startSession, submitAnswer, nextQuestion, resetSession };
}

function getStaticItem(id: string): PracticeItem {
  const item = ITEM_MAP.get(id);
  if (!item) throw new Error(`Item not found: ${id}`);
  return item;
}
