import { useState, useCallback, useRef } from 'react';
import type {
  PlannedSessionItem, PracticeItem, SelectionContext, StudentItemState, SessionConfig,
} from '../../types/math';
import { checkAnswer } from './answerChecker';
import { classifyAttempts } from './metrics';
import { applyRelatedEvidence, applyReview, createInitialState, planSession, planTableSession } from '../scheduler/scheduler';
import { deriveCardKey, stateForItem } from '../scheduler/cardModel';
import { createSessionSchedulingGuard } from '../scheduler/sessionSchedulingGuard';
import { buildDailyReviewQueue } from '../scheduler/dailyReviewQueue';
import {
  generateSingleTableItems, generateMultipleTablesItems, generateMultiplicationRangeItems,
  ALL_ITEMS, ITEM_MAP,
} from '../curriculum/multiplicationItems';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { assertValidPracticeItem, withLegacyContentSpec } from '../curriculum/practiceContentSpec';
import {
  generateAdditionItems, generateSubtractionItems, generateDivisionItemsRange,
} from '../curriculum/arithmeticItems';
import { generateFractionItems } from '../curriculum/fractionItems';
import { generateRoundingItems } from '../curriculum/roundingItems';
import { generateDecimalItems } from '../curriculum/decimalItems';
import { itemStateRepo, mathAnswerEventRepo, sessionRepo } from '../../db/repositories';
import { db } from '../../db/dexie';
import { appNow } from '../time/clock';
import { generateId } from '../../utils/id';
import { recordPracticeAnswer, recordRelatedEvidenceWrites, type PracticeAnswerPayload, type RelatedEvidenceWrite } from '../learning/recordAnswer';
import { computeRelatedEvidence, relatedEvidenceEventId } from '../adaptive/relatedEvidence';
import { RELATED_EVIDENCE_GRADE } from '../scheduler/scheduler';
import {
  applyMisconceptionConfirmation,
  applyMisconceptionDetection,
  detectMistakes,
} from '../mastery/misconceptionEngine';
import { selectAdaptiveItems } from '../adaptive/adaptiveItemSelector';
import { enrichRelatedMetadata } from '../adaptive/relatedItemMapping';
import { buildWordProblemCandidates, buildFactorCandidates } from '../adaptive/candidatePools';
import { allMeasurementItemIds, allDataItemIds } from '../../components/opSpecs';
import { mulberry32, randomSeed } from '../../utils/rng';
import type { PracticeItem as PItem } from '../../types/math';
import { ADAPTIVE_SELECTOR_VERSION, buildSchedulingTelemetry, DAILY_LESSON_PLANNER_VERSION } from '../learning/schedulingTelemetry';
import { completeDailyLessonPlan, markDailyLessonProgressFromEvent } from '../learningPlan/dailyLessonPersistence';
import { buildFluencyBaselineMap, classifyLegacyFluencyEvidence, deriveFluencyBaseline, type FluencyBaselineMap } from '../fluency/fluencyEngine';
import type { MathAnswerEvent } from '../learning/learningEvents';

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
  saveStatus: 'idle' | 'saving' | 'error';
  saveError: string | null;
  auxiliarySaveStatus: 'idle' | 'saving' | 'complete' | 'error' | 'dismissed';
  auxiliarySaveError: string | null;
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
  saveStatus: 'idle',
  saveError: null,
  auxiliarySaveStatus: 'idle',
  auxiliarySaveError: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePracticeSession(studentId: string) {
  const [state, setState] = useState<SessionState>(INITIAL);
  // Mirror of React state for reading in callbacks without closure staleness.
  // Updated synchronously alongside every setState call.
  const stateRef = useRef<SessionState>(INITIAL);

  // Mutable refs — accessed inside callbacks without being dependencies
  const queueRef = useRef<PlannedSessionItem[]>([]);
  const currentSelectionRef = useRef<SelectionContext>({
    origin: 'manual', rationaleCodes: ['manual_user_choice'],
  });
  const currentPlannerSchedulingEligibleRef = useRef(true);
  const statesRef = useRef<Map<string, StudentItemState>>(new Map());
  const configRef = useRef<SessionConfig | null>(null);
  const sessionStartRef = useRef<number>(0);
  const questionStartRef = useRef<number>(0);
  // Attempts at the *current* presentation — reset whenever a new item is shown, so retries
  // accumulate but re-queued facts (table drills) start fresh.
  const currentAttemptsRef = useRef<number>(0);
  // Holds dynamically generated items (arithmetic/fractions) not in the static ITEM_MAP
  const dynamicItemsRef = useRef<Map<string, PItem>>(new Map());
  // Enforces "at most one long-term scheduling update per card per session" (issue #28) —
  // a card may be presented more than once, but only its first scheduling-eligible
  // presentation may update FSRS state.
  const schedulingGuardRef = useRef(createSessionSchedulingGuard());
  // 1-based count of how many times the *current* item's card has been presented so far.
  const currentPresentationIndexRef = useRef<number>(1);
  const directEvidenceCardsRef = useRef(new Set<string>());
  const pendingRelatedEvidenceRef = useRef(new Map<string, { cardKey: string; relatedItemId: string; sourceItemId: string }>());
  const pendingRelatedWritesRef = useRef<RelatedEvidenceWrite[]>([]);
  const pendingLessonProgressEventRef = useRef<MathAnswerEvent | null>(null);
  const fluencyEventsRef = useRef<MathAnswerEvent[]>([]);
  const fluencyBaselinesRef = useRef<FluencyBaselineMap>(new Map());
  const pendingSaveRef = useRef<null | {
    payload: PracticeAnswerPayload;
    cardKey: string;
    schedulingApplied: boolean;
    commit: () => void;
  }>(null);

  const resolveItem = useCallback((id: string): PItem => {
    return assertValidPracticeItem(withLegacyContentSpec(dynamicItemsRef.current.get(id) ?? getStaticItem(id)));
  }, []);

  // ── startSession ──────────────────────────────────────────────────────────

  const startSession = useCallback(async (config: SessionConfig) => {
    configRef.current = config;
    const now = appNow();
    sessionStartRef.current = Date.now();
    schedulingGuardRef.current = createSessionSchedulingGuard(config.initialScheduledCardKeys ?? []);
    directEvidenceCardsRef.current.clear();
    pendingRelatedEvidenceRef.current.clear();
    pendingRelatedWritesRef.current = [];
    pendingLessonProgressEventRef.current = null;

    const [allStates, fluencyEvents] = await Promise.all([
      itemStateRepo.getForStudent(studentId),
      mathAnswerEventRepo.getDirectCorrectFirstAttempts(studentId),
    ]);
    const stateMap = new Map(allStates.map(s => [s.cardKey, s]));
    statesRef.current = stateMap;
    fluencyEventsRef.current = fluencyEvents;
    fluencyBaselinesRef.current = buildFluencyBaselineMap(fluencyEvents);

    let queue: PlannedSessionItem[];
    const {
      mode, tables, sessionLength, specificItemIds, preplannedItems, plannedPracticeItems,
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

    // Seeded RNG for reproducible adaptive selection / shuffling. A supplied seed
    // (tests, replay) is honoured; otherwise a fresh seed is generated and stored
    // on the session so the ordering can be reconstructed later.
    const seed = config.seed ?? randomSeed();
    const rng = mulberry32(seed);
    const selectOpts = { rng };

    // Reset & populate the dynamic item registry for generated modes
    dynamicItemsRef.current = new Map();
    const registerDynamic = (items: PItem[]): string[] => {
      for (const it of items) dynamicItemsRef.current.set(it.id, it);
      return items.map(it => it.id);
    };
    const planned = (
      itemIds: string[],
      selection: SelectionContext | ((itemId: string) => SelectionContext),
    ): PlannedSessionItem[] => itemIds.map(itemId => ({
      itemId,
      selection: typeof selection === 'function' ? selection(itemId) : selection,
    }));
    const manualSelection: SelectionContext = {
      origin: 'manual', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['manual_user_choice'],
    };
    const goalSelection: SelectionContext = config.origin === 'daily_new_for_goals'
      ? { origin: 'new_learning', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['daily_goal_new_item'] }
      : { origin: 'goal', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['active_goal'] };
    const automaticSelection = (itemId: string): SelectionContext => {
      const itemState = stateForItem(resolveItem(itemId), stateMap);
      if (itemState?.nextDueAt && itemState.nextDueAt <= now.toISOString()) {
        return { origin: 'due_retrieval', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['adaptive_due_item'] };
      }
      if (itemState && (itemState.masteryLevel === 'learning' || itemState.masteryLevel === 'developing')) {
        return { origin: 'weak_skill', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['adaptive_weak_item'] };
      }
      return { origin: 'new_learning', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['adaptive_new_item'] };
    };

    if (plannedPracticeItems?.length) {
      registerDynamic(plannedPracticeItems.map(value => value.item));
      queue = plannedPracticeItems.slice(0, sessionLength).map(value => ({
        itemId: value.item.id, selection: value.selection, schedulingEligible: value.schedulingEligible,
      }));
    } else if (preplannedItems?.length) {
      queue = planned(registerDynamic(preplannedItems).slice(0, sessionLength), itemId => {
        const lessonSegment = config.lessonSegments?.find(segment => segment.itemInstanceIds.includes(itemId))?.kind;
        return lessonSegment
          ? {
              origin: lessonSegment === 'retrieval' ? 'due_retrieval' : lessonSegment === 'focus' ? 'focus_skill' : 'transfer',
              plannerVersion: DAILY_LESSON_PLANNER_VERSION,
              rationaleCodes: [config.lessonRationales?.[itemId] ?? lessonSegment],
              lessonPlanId: config.lessonPlanId,
              lessonSegment,
            }
          : automaticSelection(itemId);
      });
    } else if (specificItemIds?.length) {
      // Focused review: practice exactly the listed items.
      // Reconstruct and register any item not already in the static ITEM_MAP.
      const validIds: string[] = [];
      for (const id of specificItemIds) {
        if (!ITEM_MAP.has(id) && !dynamicItemsRef.current.has(id)) {
          const item = makeItemFromId(id);
          if (item) dynamicItemsRef.current.set(item.id, item);
        }
        if (ITEM_MAP.has(id) || dynamicItemsRef.current.has(id)) validIds.push(id);
      }
      if (mode === 'daily_review') {
        // Today Plan / due-review: include every due card at most once (issue #28)
        // — never repeat a due card just to fill sessionLength. Backfills with
        // other distinct eligible cards from the student's history when the
        // requested set is smaller than sessionLength; returns a shorter queue
        // rather than a repeat when no distinct backfill exists.
        queue = buildDailyReviewQueue({
          requestedItemIds: validIds,
          states: stateMap,
          sessionLength,
          now,
          rng,
          repeatPolicy: config.repeatPolicy,
          rounds: config.rounds,
        });
        // Backfill candidates may come from outside the original specificItemIds —
        // register any not already known so resolveItem() can find them.
        for (const { itemId: id } of queue) {
          if (!ITEM_MAP.has(id) && !dynamicItemsRef.current.has(id)) {
            const backfillItem = makeItemFromId(id);
            if (backfillItem) dynamicItemsRef.current.set(id, backfillItem);
          }
        }
      } else {
        // FSRS-informed ordering: rank the listed pool by the student's own and
        // embedded-calculation history before filling the queue. Falls back to
        // near-random order when there is no history (tie-break jitter).
        const candidates = validIds.map(id => enrichRelatedMetadata(resolveItem(id)));
        for (const c of candidates) dynamicItemsRef.current.set(c.id, c);
        queue = planned(
          selectAdaptiveItems(candidates, stateMap, now, sessionLength, selectOpts),
          config.goalId || config.goalIds?.length ? goalSelection : manualSelection,
        );
      }
    } else if (mode === 'multiplication') {
      // First factor from [lo,hi], second from [lo2,hi2].
      queue = planned(registerDynamic(generateMultiplicationRangeItems(lo, hi, lo2, hi2, sessionLength)), manualSelection);
    } else if (mode === 'single_table' && tables?.length) {
      queue = planned(planTableSession(generateSingleTableItems(tables[0]), sessionLength), manualSelection);
    } else if (mode === 'multi_table' && tables?.length) {
      queue = planned(planTableSession(generateMultipleTablesItems(tables), sessionLength), manualSelection);
    } else if (mode === 'addition') {
      queue = planned(registerDynamic(generateAdditionItems(lo, hi, sessionLength, lo2, hi2)), manualSelection);
    } else if (mode === 'subtraction') {
      queue = planned(registerDynamic(generateSubtractionItems(lo, hi, sessionLength, lo2, hi2)), manualSelection);
    } else if (mode === 'division') {
      // operand range = dividend, operand2 range = divisor.
      queue = planned(registerDynamic(generateDivisionItemsRange(lo2, hi2, sessionLength, lo, hi)), manualSelection);
    } else if (mode === 'fraction') {
      // operand range = numerator, operand2 range = denominator.
      queue = planned(registerDynamic(generateFractionItems(fractionMode ?? 'equivalent', sessionLength, lo, hi, lo2, hi2)), manualSelection);
    } else if (mode === 'word_problem') {
      // Build candidates around the student's weak/due ×/÷ facts first, then mix
      // in variety, and adaptive-select from the combined pool.
      const pool = buildWordProblemCandidates(g, sessionLength, stateMap, now, operandMin, operandMax);
      registerDynamic(pool);
      queue = planned(selectAdaptiveItems(pool, stateMap, now, sessionLength, selectOpts), automaticSelection);
    } else if (mode === 'rounding') {
      queue = planned(registerDynamic(generateRoundingItems(g, sessionLength, operandMin, operandMax)), manualSelection);
    } else if (mode === 'factors') {
      const pool = buildFactorCandidates(g, sessionLength, stateMap, now, operandMin, operandMax);
      registerDynamic(pool);
      queue = planned(selectAdaptiveItems(pool, stateMap, now, sessionLength, selectOpts), automaticSelection);
    } else if (mode === 'decimals') {
      queue = planned(registerDynamic(generateDecimalItems(g, sessionLength, operandMin, operandMax)), manualSelection);
    } else if (mode === 'measurement') {
      // Fixed pool covering time, elapsed time, measurement word, bar graph, and
      // line plot — reusing the same canonical ID lists as the "Practice an
      // Operation" Measurement and Data setups so the two stay in sync.
      const pool = [...allMeasurementItemIds(), ...allDataItemIds()];
      for (const id of pool) {
        if (!dynamicItemsRef.current.has(id)) {
          const rebuilt = makeItemFromId(id);
          if (rebuilt) dynamicItemsRef.current.set(id, rebuilt);
        }
      }
      const candidates = pool
        .filter(id => dynamicItemsRef.current.has(id) || ITEM_MAP.has(id))
        .map(id => enrichRelatedMetadata(resolveItem(id)));
      for (const c of candidates) dynamicItemsRef.current.set(c.id, c);
      queue = planned(selectAdaptiveItems(candidates, stateMap, now, sessionLength, selectOpts), automaticSelection);
    } else {
      const plan = planSession(ALL_ITEMS, stateMap, now, sessionLength);
      queue = [
        ...planned(plan.dueItems, { origin: 'due_retrieval', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['scheduler_due'] }),
        ...planned(plan.weakItems, { origin: 'weak_skill', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['scheduler_weak'] }),
        ...planned(plan.newItems, { origin: 'new_learning', plannerVersion: ADAPTIVE_SELECTOR_VERSION, rationaleCodes: ['scheduler_new'] }),
      ];
    }

    const sessionId = generateId();
    await sessionRepo.save({
      id: sessionId, studentId,
      startedAt: now.toISOString(),
      mode, tables, seed,
      plannedQuestionCount: queue.length,
      completedQuestionCount: 0, correctCount: 0, averageLatencyMs: 0,
      origin: config.origin,
      goalId: config.goalId,
      goalTargetId: config.goalTargetId,
      goalIds: config.goalIds,
      goalTargetIds: config.goalTargetIds,
      goalLearningKind: config.goalLearningKind,
      lessonPlanId: config.lessonPlanId,
      lessonKind: config.lessonKind,
      focusSkillId: config.focusSkillId,
      lessonSegments: config.lessonSegments,
    });

    queueRef.current = queue;

    if (queue.length === 0) {
      const s = { ...INITIAL, phase: 'complete' as const, sessionId, totalPlanned: 0, lastSession };
      stateRef.current = s;
      setState(s);
      return;
    }

    const firstPlanned = queueRef.current.shift()!;
    currentSelectionRef.current = firstPlanned.selection;
    currentPlannerSchedulingEligibleRef.current = firstPlanned.schedulingEligible !== false;
    const first = resolveItem(firstPlanned.itemId);
    questionStartRef.current = Date.now();
    currentAttemptsRef.current = 0;
    currentPresentationIndexRef.current = schedulingGuardRef.current.presentationStarted(deriveCardKey(first));
    const s = {
      ...INITIAL, phase: 'active' as const,
      currentItem: first,
      totalPlanned: queue.length + 1,
      sessionId,
      lastSession,
    };
    stateRef.current = s;
    setState(s);
  }, [studentId, resolveItem]);

  // ── submitAnswer ──────────────────────────────────────────────────────────

  const submitAnswer = useCallback(async (rawInput: string) => {
    const prev = stateRef.current;
    if (prev.phase !== 'active' || prev.saveStatus !== 'idle' || !prev.currentItem || !prev.sessionId) return;

    const item = prev.currentItem;
    const latencyMs = Date.now() - questionStartRef.current;
    const attemptNo = currentAttemptsRef.current + 1;
    const isFirstAttemptAtPresentation = attemptNo === 1;
    const cardKey = deriveCardKey(item);
    const result = checkAnswer(item, rawInput, latencyMs, {
      hintUsed: !isFirstAttemptAtPresentation,
      studentFluency: fluencyBaselinesRef.current.get(cardKey) ?? null,
    });
    const now = appNow();
    const createdAt = now.toISOString();
    const eventId = generateId();

    const existing = stateForItem(item, statesRef.current) ?? createInitialState(studentId, item);
    const selection = currentSelectionRef.current;

    // Presentation-first-attempt (stats: first-try accuracy, misconceptions, retry
    // classification) is distinct from scheduling-first-attempt (issue #28): a card
    // may be presented more than once in a session (e.g. daily-review backfill), but
    // only its first scheduling-eligible presentation may update long-term FSRS state.
    const isFirstSchedulingAttemptInSession = currentPlannerSchedulingEligibleRef.current && schedulingGuardRef.current.canSchedule(cardKey, attemptNo);
    let schedulingApplied = false;
    let schedulerErrorCode: MathAnswerEvent['schedulerErrorCode'];
    let updated: StudentItemState;
    if (isFirstSchedulingAttemptInSession) {
      // Reserve synchronously, before the async write below, so a rapid double-submit
      // cannot schedule the same card twice while the first write is still in flight.
      schedulingGuardRef.current.markScheduled(cardKey);
      try {
        updated = applyReview(existing, result.reviewGrade, latencyMs, rawInput, now, { isCorrect: result.isCorrect });
        schedulingApplied = true;
      } catch (err) {
        // FSRS validation errors (e.g. negative delta_t from a future lastSeenAt due to
        // clock drift) must not block the state update — skip FSRS scheduling for this attempt.
        console.warn('[usePracticeSession] applyReview error; FSRS update skipped', err);
        schedulerErrorCode = err instanceof RangeError ? 'clock_drift'
          : err instanceof TypeError ? 'invalid_card'
            : err instanceof Error ? 'fsrs_validation' : 'unknown';
        updated = existing;
        schedulingGuardRef.current.releaseScheduled(cardKey);
      }
      updated = { ...updated, cardKey, lastItemId: item.id };
    } else {
      updated = existing;
    }

    // On first wrong attempt, detect misconception patterns and merge into state.
    let detectedMisconceptions: string[] = [];
    let confirmedMisconceptions: string[] = [];
    const misconceptionContext = {
      eventId, sessionId: prev.sessionId, itemId: item.id, createdAt,
    };
    if (isFirstAttemptAtPresentation && !result.isCorrect) {
      const newTags = detectMistakes(item, result.studentAnswer);
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
    } else if (isFirstAttemptAtPresentation && isFirstSchedulingAttemptInSession && result.isCorrect) {
      const confirmation = applyMisconceptionConfirmation(
        updated.misconceptionEvidence, item, misconceptionContext, updated.mistakePatterns,
      );
      confirmedMisconceptions = confirmation.confirmedCodes;
      updated = { ...updated, misconceptionEvidence: confirmation.evidence };
    }

    // Compute possible indirect evidence now, but defer its scheduler write to
    // session completion so a later direct review can take precedence (#44).
    let relatedCandidates: Array<{ cardKey: string; relatedItemId: string; sourceItemId: string }> = [];
    if (isFirstAttemptAtPresentation && result.isCorrect) {
      relatedCandidates = computeRelatedEvidence(item, statesRef.current, now)
        .map(update => ({ cardKey: update.cardKey, relatedItemId: update.relatedItemId, sourceItemId: item.id }));
    }

    // A same-session repeat presentation's first attempt looks like a fresh
    // attempt locally, but the card already updated FSRS state earlier this
    // session — record why scheduling was skipped instead of misreporting it.
    const isSameSessionRepeat = isFirstAttemptAtPresentation && !isFirstSchedulingAttemptInSession;
    const eventRatingReason = isSameSessionRepeat ? 'same_session_repeat' : result.ratingReason;

    const payload: PracticeAnswerPayload = {
      event: {
        id: eventId,
        studentId,
        sessionId: prev.sessionId,
        itemId: item.id,
        itemInstanceId: item.instanceKey ?? item.id,
        cardKey,
        schemaId: item.schemaId,
        presentationIndex: currentPresentationIndexRef.current,
        schedulingEligible: isFirstSchedulingAttemptInSession,
        schedulingApplied,
        schedulerErrorCode,
        mode: 'practice',
        promptShown: item.prompt,
        correctAnswer: item.answer,
        studentAnswer: result.studentAnswer,
        isCorrect: result.isCorrect,
        isRetry: !isFirstAttemptAtPresentation,
        hintUsed: !isFirstAttemptAtPresentation,  // hints are shown automatically after first wrong answer
        latencyMs,
        reviewGrade: result.reviewGrade,
        ratingReason: eventRatingReason,
        responsePolicy: result.policyKind,
        fluencyBand: result.fluencyBand,
        detectedMisconceptions: detectedMisconceptions.length ? detectedMisconceptions : undefined,
        confirmedMisconceptions: confirmedMisconceptions.length ? confirmedMisconceptions : undefined,
        factStatusBefore: existing.masteryLevel,
        factStatusAfter: updated.masteryLevel,
        origin: configRef.current?.origin,
        goalId: configRef.current?.goalId,
        goalTargetId: configRef.current?.goalTargetId,
        goalIds: configRef.current?.goalIds,
        goalTargetIds: configRef.current?.goalTargetIds,
        goalLearningKind: configRef.current?.goalLearningKind,
        lessonPlanId: configRef.current?.lessonPlanId,
        lessonSegment: selection.lessonSegment,
        lessonRationale: selection.rationaleCodes[0],
        selectionOrigin: selection.origin,
        selectionRationaleCodes: [...selection.rationaleCodes],
        selectionPlannerVersion: selection.plannerVersion,
        schedulingTelemetry: buildSchedulingTelemetry({
          item, stateBefore: existing, stateAfter: schedulingApplied ? updated : undefined,
          response: {
            reviewGrade: result.reviewGrade, ratingReason: eventRatingReason, responsePolicy: result.policyKind,
            fluencyBand: result.fluencyBand, hintUsed: !isFirstAttemptAtPresentation,
            fluencyBaselineSource: result.fluencyBaselineSource, fluencySampleCount: result.fluencySampleCount,
            fluencyFastCutoffMs: result.fluencyFastCutoffMs, fluencySlowCutoffMs: result.fluencySlowCutoffMs,
            isRetry: !isFirstAttemptAtPresentation, schedulingEligible: isFirstSchedulingAttemptInSession,
            schedulingApplied, schedulerErrorCode,
          },
          selection, presentationIndex: currentPresentationIndexRef.current, attemptNo, now,
        }),
        createdAt,
      },
      // Same-session repeats and mid-presentation retries do not change FSRS
      // state — pass undefined to skip the itemStates write.
      updatedState: isFirstSchedulingAttemptInSession ? updated : undefined,
      attempt: {
        id: generateId(),
        studentId,
        itemId: item.id,
        skillId: item.skillId,
        sessionId: prev.sessionId,
        promptShown: item.prompt,
        correctAnswer: item.answer,
        studentAnswer: result.studentAnswer,
        isCorrect: result.isCorrect,
        latencyMs,
        reviewGrade: result.reviewGrade,
        origin: configRef.current?.origin,
        goalId: configRef.current?.goalId,
        goalTargetId: configRef.current?.goalTargetId,
        goalIds: configRef.current?.goalIds,
        goalTargetIds: configRef.current?.goalTargetIds,
        goalLearningKind: configRef.current?.goalLearningKind,
        lessonPlanId: configRef.current?.lessonPlanId,
        lessonSegment: configRef.current?.lessonSegments?.find(segment => segment.itemInstanceIds.includes(item.id))?.kind,
        lessonRationale: configRef.current?.lessonRationales?.[item.id],
        createdAt,
      },
    };

    let nextState: SessionState;
    if (!result.isCorrect) {
      // Wrong: stay on same question, clear input via retryKey, and remember the fact.
      const missedFacts = prev.missedFacts.includes(item.prompt)
        ? prev.missedFacts
        : [...prev.missedFacts, item.prompt];
      nextState = {
        ...prev,
        retryKey: prev.retryKey + 1,
        errorText: 'Incorrect — try again',
        attemptCount: prev.attemptCount + 1,
        missedFacts,
      };
    } else {
      // Correct — classify how this presentation was solved.
      const outcome = classifyAttempts(attemptNo);
      const isSlowFirstTry = outcome === 'first-try' && result.reviewGrade === 'hard';
      const isNewPB =
        existing.personalBestMs === undefined || latencyMs < existing.personalBestMs;
      const newLatencies = [...prev.latencies, latencyMs];
      const newFastest = prev.fastestMs === null
        ? latencyMs : Math.min(prev.fastestMs, latencyMs);
      nextState = {
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
    }

    nextState = { ...nextState, saveStatus: 'idle', saveError: null };
    const commit = () => {
      currentAttemptsRef.current = attemptNo;
      if (isFirstAttemptAtPresentation) statesRef.current.set(cardKey, updated);
      if (schedulingApplied) {
        directEvidenceCardsRef.current.add(cardKey);
        pendingRelatedEvidenceRef.current.delete(cardKey);
      }
      for (const candidate of relatedCandidates) {
        if (directEvidenceCardsRef.current.has(candidate.cardKey) || pendingRelatedEvidenceRef.current.has(candidate.cardKey)) continue;
        pendingRelatedEvidenceRef.current.set(candidate.cardKey, candidate);
      }
      if (classifyLegacyFluencyEvidence(payload.event).eligible) {
        fluencyEventsRef.current.push(payload.event);
        const baseline = deriveFluencyBaseline(fluencyEventsRef.current, cardKey);
        if (baseline) fluencyBaselinesRef.current.set(cardKey, baseline);
        else fluencyBaselinesRef.current.delete(cardKey);
      }
      pendingSaveRef.current = null;
      stateRef.current = nextState;
      setState(nextState);
    };
    pendingSaveRef.current = { payload, cardKey, schedulingApplied, commit };
    const savingState = { ...prev, saveStatus: 'saving' as const, saveError: null };
    stateRef.current = savingState;
    setState(savingState);

    try {
      await recordPracticeAnswer(payload);
      commit();
      if (result.isCorrect && payload.event.lessonPlanId) {
        try { await markDailyLessonProgressFromEvent(payload.event); }
        catch (error) {
          console.error('[usePracticeSession] daily lesson progress write failed', error);
          pendingLessonProgressEventRef.current = payload.event;
          const warning = { ...stateRef.current, auxiliarySaveStatus: 'error' as const, auxiliarySaveError: 'Your answer is saved. Today’s lesson progress will retry separately.' };
          stateRef.current = warning; setState(warning);
        }
      }
      return;
    } catch (err) {
      console.warn('[usePracticeSession] event write failed, retrying…', err);
      try {
        await recordPracticeAnswer(payload);
        commit();
        if (result.isCorrect && payload.event.lessonPlanId) {
          try { await markDailyLessonProgressFromEvent(payload.event); }
          catch (error) {
            console.error('[usePracticeSession] daily lesson progress write failed', error);
            pendingLessonProgressEventRef.current = payload.event;
            const warning = { ...stateRef.current, auxiliarySaveStatus: 'error' as const, auxiliarySaveError: 'Your answer is saved. Today’s lesson progress will retry separately.' };
            stateRef.current = warning; setState(warning);
          }
        }
        return;
      } catch (retryErr) {
        console.error('[usePracticeSession] event write failed after retry', retryErr);
        if (schedulingApplied) schedulingGuardRef.current.releaseScheduled(cardKey);
        const errorState = { ...prev, saveStatus: 'error' as const, saveError: 'Your answer is ready, but it was not saved yet.' };
        stateRef.current = errorState;
        setState(errorState);
      }
    }
  }, [studentId]);

  const retrySave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending || stateRef.current.saveStatus !== 'error') return;
    if (pending.schedulingApplied) schedulingGuardRef.current.markScheduled(pending.cardKey);
    const savingState = { ...stateRef.current, saveStatus: 'saving' as const, saveError: null };
    stateRef.current = savingState;
    setState(savingState);
    try {
      await recordPracticeAnswer(pending.payload);
      pending.commit();
      if (pending.payload.event.isCorrect && pending.payload.event.lessonPlanId) {
        try { await markDailyLessonProgressFromEvent(pending.payload.event); }
        catch (error) {
          console.error('[usePracticeSession] daily lesson progress write failed', error);
          pendingLessonProgressEventRef.current = pending.payload.event;
          const warning = { ...stateRef.current, auxiliarySaveStatus: 'error' as const, auxiliarySaveError: 'Your answer is saved. Today’s lesson progress will retry separately.' };
          stateRef.current = warning; setState(warning);
        }
      }
    } catch {
      if (pending.schedulingApplied) schedulingGuardRef.current.releaseScheduled(pending.cardKey);
      const errorState = { ...stateRef.current, saveStatus: 'error' as const, saveError: 'Still not saved. Check storage and try again.' };
      stateRef.current = errorState;
      setState(errorState);
    }
  }, []);

  // ── nextQuestion ──────────────────────────────────────────────────────────

  const nextQuestion = useCallback(async () => {
    const prev = stateRef.current;
    if (prev.saveStatus !== 'idle' || pendingSaveRef.current) return;
    const nextPlanned = queueRef.current.shift();

    let auxiliaryFailure: string | null = null;
    let auxiliaryAttempted = false;
    if (!nextPlanned && prev.sessionId && pendingRelatedEvidenceRef.current.size > 0) {
      const now = appNow();
      const writes: RelatedEvidenceWrite[] = [];
      for (const candidate of pendingRelatedEvidenceRef.current.values()) {
        if (directEvidenceCardsRef.current.has(candidate.cardKey)) continue;
        const before = statesRef.current.get(candidate.cardKey);
        const factItem = makeItemFromId(candidate.relatedItemId);
        if (!before || !factItem) continue;
        const after = applyRelatedEvidence(before, now);
        writes.push({
          state: after,
          event: {
            id: relatedEvidenceEventId(prev.sessionId, candidate.cardKey), studentId, sessionId: prev.sessionId, itemId: candidate.relatedItemId,
            cardKey: candidate.cardKey, mode: 'practice', promptShown: factItem.prompt, correctAnswer: factItem.answer,
            studentAnswer: null, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 0,
            reviewGrade: RELATED_EVIDENCE_GRADE, factStatusBefore: before.masteryLevel, factStatusAfter: after.masteryLevel,
            relatedEvidence: true, evidenceSourceItemId: candidate.sourceItemId, schedulingEligible: true,
            schedulingApplied: true,
            origin: configRef.current?.origin, goalId: configRef.current?.goalId, goalTargetId: configRef.current?.goalTargetId,
            goalIds: configRef.current?.goalIds, goalTargetIds: configRef.current?.goalTargetIds, goalLearningKind: configRef.current?.goalLearningKind,
            lessonPlanId: configRef.current?.lessonPlanId,
            lessonSegment: configRef.current?.lessonSegments?.find(segment => segment.itemInstanceIds.includes(candidate.sourceItemId))?.kind,
            lessonRationale: 'One deferred indirect nudge per canonical card when no direct review occurred.',
            selectionOrigin: 'related_evidence',
            selectionRationaleCodes: ['deferred_single_related_evidence'],
            schedulingTelemetry: buildSchedulingTelemetry({
              item: factItem, stateBefore: before, stateAfter: after,
              response: { reviewGrade: RELATED_EVIDENCE_GRADE, hintUsed: false, isRetry: false, evidenceKind: 'related', schedulingEligible: true, schedulingApplied: true },
              selection: { origin: 'related_evidence', rationaleCodes: ['deferred_single_related_evidence'] },
              presentationIndex: 1, attemptNo: 1, now,
            }), createdAt: now.toISOString(),
          },
        });
      }
      if (writes.length) {
        auxiliaryAttempted = true;
        pendingRelatedWritesRef.current = writes;
        try {
          await recordRelatedEvidenceWrites(writes);
          for (const write of writes) statesRef.current.set(write.state.cardKey, write.state);
          pendingRelatedWritesRef.current = [];
          pendingRelatedEvidenceRef.current.clear();
        } catch (error) {
          console.error('[usePracticeSession] deferred related evidence write failed', error);
          auxiliaryFailure = 'Your answers are saved. One review-schedule update still needs to be saved.';
        }
      }
      if (!writes.length) pendingRelatedEvidenceRef.current.clear();
    }

    // Persist session record (side effect before setState — pure event handler, not an updater).
    if (prev.sessionId) {
      const avgMs = prev.latencies.length
        ? Math.round(prev.latencies.reduce((s, v) => s + v, 0) / prev.latencies.length)
        : 0;
      const isEnding = !nextPlanned;
      if (isEnding && configRef.current?.lessonPlanId) {
        await completeDailyLessonPlan(configRef.current.lessonPlanId, appNow().toISOString());
      }
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
            relatedEvidenceStatus: isEnding
              ? auxiliaryFailure ? 'error' : auxiliaryAttempted ? 'complete' : 'not_applicable'
              : s.relatedEvidenceStatus,
            relatedEvidenceError: auxiliaryFailure ?? undefined,
            relatedEvidenceLastAttemptAt: auxiliaryAttempted ? appNow().toISOString() : s.relatedEvidenceLastAttemptAt,
          });
        }
      });
    }

    let nextState: SessionState;
    if (!nextPlanned) {
      nextState = {
        ...prev, phase: 'complete', correctResult: null, errorText: null,
        auxiliarySaveStatus: auxiliaryFailure ? 'error' : auxiliaryAttempted ? 'complete' : 'idle',
        auxiliarySaveError: auxiliaryFailure,
      };
    } else {
      questionStartRef.current = Date.now();
      currentAttemptsRef.current = 0;
      currentSelectionRef.current = nextPlanned.selection;
      currentPlannerSchedulingEligibleRef.current = nextPlanned.schedulingEligible !== false;
      const nextItem = resolveItem(nextPlanned.itemId);
      currentPresentationIndexRef.current = schedulingGuardRef.current.presentationStarted(deriveCardKey(nextItem));
      nextState = {
        ...prev,
        phase: 'active',
        currentItem: nextItem,
        retryKey: 0,
        errorText: null,
        correctResult: null,
      };
    }

    stateRef.current = nextState;
    setState(nextState);
  }, [resolveItem, studentId]);

  const retryAuxiliaryWrites = useCallback(async () => {
    const writes = pendingRelatedWritesRef.current;
    const lessonEvent = pendingLessonProgressEventRef.current;
    const sessionId = stateRef.current.sessionId;
    if ((!writes.length && !lessonEvent) || !sessionId || stateRef.current.auxiliarySaveStatus === 'saving') return;
    const saving = { ...stateRef.current, auxiliarySaveStatus: 'saving' as const, auxiliarySaveError: null };
    stateRef.current = saving; setState(saving);
    try {
      if (lessonEvent) {
        await markDailyLessonProgressFromEvent(lessonEvent);
        pendingLessonProgressEventRef.current = null;
      }
      if (writes.length) await recordRelatedEvidenceWrites(writes);
      for (const write of writes) statesRef.current.set(write.state.cardKey, write.state);
      pendingRelatedWritesRef.current = [];
      pendingRelatedEvidenceRef.current.clear();
      const complete = { ...stateRef.current, auxiliarySaveStatus: 'complete' as const, auxiliarySaveError: null };
      stateRef.current = complete; setState(complete);
      const session = await sessionRepo.get(sessionId);
      if (session) await sessionRepo.save({ ...session, relatedEvidenceStatus: 'complete', relatedEvidenceError: undefined, relatedEvidenceLastAttemptAt: appNow().toISOString() });
    } catch {
      const failed = { ...stateRef.current, auxiliarySaveStatus: 'error' as const, auxiliarySaveError: 'That review-schedule update still needs to be saved.' };
      stateRef.current = failed; setState(failed);
    }
  }, []);

  const dismissAuxiliaryWarning = useCallback(() => {
    const dismissed = { ...stateRef.current, auxiliarySaveStatus: 'dismissed' as const, auxiliarySaveError: null };
    stateRef.current = dismissed; setState(dismissed);
  }, []);

  // ── resetSession ─────────────────────────────────────────────────────────

  const resetSession = useCallback(() => {
    queueRef.current = [];
    configRef.current = null;
    schedulingGuardRef.current.reset();
    directEvidenceCardsRef.current.clear();
    pendingRelatedEvidenceRef.current.clear();
    pendingRelatedWritesRef.current = [];
    pendingLessonProgressEventRef.current = null;
    pendingSaveRef.current = null;
    stateRef.current = INITIAL;
    setState(INITIAL);
  }, []);

  return { state, startSession, submitAnswer, retrySave, nextQuestion, retryAuxiliaryWrites, dismissAuxiliaryWarning, resetSession };
}

function getStaticItem(id: string): PracticeItem {
  const item = ITEM_MAP.get(id);
  if (!item) throw new Error(`Item not found: ${id}`);
  return item;
}
