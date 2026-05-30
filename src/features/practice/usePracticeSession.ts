import { useState, useCallback, useRef } from 'react';
import type {
  PracticeItem, StudentItemState, SessionConfig,
} from '../../types/math';
import { checkAnswer } from './answerChecker';
import { applyReview, createInitialState, planSession, planTableSession } from '../scheduler/scheduler';
import {
  generateSingleTableItems, generateMultipleTablesItems,
  ALL_ITEMS, ITEM_MAP,
} from '../curriculum/multiplicationItems';
import {
  generateAdditionItems, generateSubtractionItems, generateDivisionItemsRange,
} from '../curriculum/arithmeticItems';
import { generateFractionItems } from '../curriculum/fractionItems';
import { generateWordProblemItems } from '../curriculum/wordProblemItems';
import { generateRoundingItems } from '../curriculum/roundingItems';
import { generateNumberTheoryItems } from '../curriculum/numberTheoryItems';
import { generateDecimalItems } from '../curriculum/decimalItems';
import { itemStateRepo, attemptRepo, sessionRepo } from '../../db/repositories';
import { db } from '../../db/dexie';
import { appNow } from '../time/clock';
import { generateId } from '../../utils/id';
import type { PracticeItem as PItem } from '../../types/math';

// ── Public types ──────────────────────────────────────────────────────────────

export interface CorrectResult {
  latencyMs: number;
  isNewPersonalBest: boolean;
}

/** Snapshot of the previous session of the same mode, for session-over-session comparison. */
export interface LastSessionSummary {
  accuracy: number;          // 0–1
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
  const questionStartRef = useRef<number>(Date.now());
  // Holds dynamically generated items (arithmetic/fractions) not in the static ITEM_MAP
  const dynamicItemsRef = useRef<Map<string, PItem>>(new Map());

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
    const { mode, tables, sessionLength, operandMin, operandMax, fractionMode, grade } = config;

    // Capture the most recent prior session of the same mode (before saving the new one)
    // for the session-over-session comparison on the summary screen.
    const prior = await sessionRepo.getLastByMode(studentId, mode);
    const lastSession: LastSessionSummary | null =
      prior && prior.completedQuestionCount > 0
        ? {
            accuracy: prior.correctCount / prior.completedQuestionCount,
            averageLatencyMs: prior.averageLatencyMs,
          }
        : null;
    const lo = operandMin ?? 0;
    const hi = operandMax ?? 20;
    const g = grade ?? 3;

    // Reset & populate the dynamic item registry for generated modes
    dynamicItemsRef.current = new Map();
    const registerDynamic = (items: PItem[]): string[] => {
      for (const it of items) dynamicItemsRef.current.set(it.id, it);
      return items.map(it => it.id);
    };

    if (mode === 'single_table' && tables?.length) {
      queue = planTableSession(generateSingleTableItems(tables[0]), sessionLength);
    } else if (mode === 'multi_table' && tables?.length) {
      queue = planTableSession(generateMultipleTablesItems(tables), sessionLength);
    } else if (mode === 'addition') {
      queue = registerDynamic(generateAdditionItems(lo, hi, sessionLength));
    } else if (mode === 'subtraction') {
      queue = registerDynamic(generateSubtractionItems(lo, hi, sessionLength));
    } else if (mode === 'division') {
      queue = registerDynamic(generateDivisionItemsRange(lo, hi, sessionLength));
    } else if (mode === 'fraction') {
      queue = registerDynamic(generateFractionItems(fractionMode ?? 'equivalent', sessionLength));
    } else if (mode === 'word_problem') {
      queue = registerDynamic(generateWordProblemItems(g, sessionLength));
    } else if (mode === 'rounding') {
      queue = registerDynamic(generateRoundingItems(g, sessionLength));
    } else if (mode === 'factors') {
      queue = registerDynamic(generateNumberTheoryItems(g, sessionLength));
    } else if (mode === 'decimals') {
      queue = registerDynamic(generateDecimalItems(g, sessionLength));
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
    setState(prev => {
      if (prev.phase !== 'active' || !prev.currentItem || !prev.sessionId) return prev;

      const item = prev.currentItem;
      const latencyMs = Date.now() - questionStartRef.current;
      const result = checkAnswer(item, rawInput, latencyMs);

      // Fire-and-forget DB writes (can't await inside setState)
      const existing = statesRef.current.get(item.id) ?? createInitialState(studentId, item);
      const updated = applyReview(existing, result.reviewGrade, latencyMs, rawInput, appNow());
      statesRef.current.set(item.id, updated);
      itemStateRepo.save(updated);

      attemptRepo.save({
        id: generateId(), studentId,
        itemId: item.id, skillId: item.skillId, sessionId: prev.sessionId!,
        promptShown: item.prompt, correctAnswer: item.answer,
        studentAnswer: result.studentAnswer,
        isCorrect: result.isCorrect, latencyMs,
        reviewGrade: result.reviewGrade,
        createdAt: appNow().toISOString(),
      });

      if (!result.isCorrect) {
        // Wrong: stay on same question, clear input via retryKey
        return {
          ...prev,
          retryKey: prev.retryKey + 1,
          errorText: 'Incorrect — try again',
        };
      }

      // Correct
      const isNewPB =
        existing.personalBestMs === undefined || latencyMs < existing.personalBestMs;
      const newLatencies = [...prev.latencies, latencyMs];
      const newFastest = prev.fastestMs === null
        ? latencyMs : Math.min(prev.fastestMs, latencyMs);

      // Reset question timer for next question (done in nextQuestion)
      return {
        ...prev,
        phase: 'correct',
        errorText: null,
        correctResult: { latencyMs, isNewPersonalBest: isNewPB },
        correctCount: prev.correctCount + 1,
        completedCount: prev.completedCount + 1,
        latencies: newLatencies,
        fastestMs: newFastest,
      };
    });
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
