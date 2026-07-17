/**
 * Integration tests for usePracticeSession — exercising the wrong-first-attempt
 * + correct-retry flow through the hook. DB modules are mocked so the tests run
 * without IndexedDB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────
// Paths are relative to this file (src/tests/) and resolve to the same modules
// that usePracticeSession imports.

vi.mock('../features/learning/recordAnswer', () => ({
  recordPracticeAnswer: vi.fn(),
  recordRelatedEvidenceWrites: vi.fn(),
}));

vi.mock('../features/scheduler/scheduler', async importOriginal => {
  const actual = await importOriginal<typeof import('../features/scheduler/scheduler')>();
  return { ...actual, applyReview: vi.fn(actual.applyReview) };
});

vi.mock('../db/repositories', () => ({
  itemStateRepo: { getForStudent: vi.fn() },
  mathAnswerEventRepo: { getDirectCorrectFirstAttempts: vi.fn() },
  sessionRepo: {
    getLastByMode: vi.fn(),
    save: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../db/dexie', () => ({
  db: { sessions: { delete: vi.fn() } },
}));

vi.mock('../features/time/clock', () => ({
  appNow: vi.fn(),
}));

vi.mock('../features/learningPlan/dailyLessonPersistence', () => ({
  markDailyLessonProgressFromEvent: vi.fn(),
  completeDailyLessonPlan: vi.fn(),
}));

vi.mock('../utils/id', () => ({
  generateId: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { usePracticeSession } from '../features/practice/usePracticeSession';
import { recordPracticeAnswer, recordRelatedEvidenceWrites } from '../features/learning/recordAnswer';
import { itemStateRepo, mathAnswerEventRepo, sessionRepo } from '../db/repositories';
import { appNow } from '../features/time/clock';
import { generateId } from '../utils/id';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { applyReview } from '../features/scheduler/scheduler';
import { markDailyLessonProgressFromEvent } from '../features/learningPlan/dailyLessonPersistence';
import type { SessionConfig } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

// ── Helpers ───────────────────────────────────────────────────────────────────

const FIXED_NOW = new Date('2026-06-01T10:00:00Z');
const STUDENT_ID = 'student-test';

// MUL_7x8: 7 × 8 = 56
const SESSION_CONFIG: SessionConfig = {
  mode: 'daily_review',
  sessionLength: 2,
  specificItemIds: ['MUL_7x8'],
};

// ── Setup ─────────────────────────────────────────────────────────────────────

let idSeq = 0;

beforeEach(() => {
  idSeq = 0;
  vi.clearAllMocks();
  vi.mocked(recordPracticeAnswer).mockResolvedValue(undefined);
  vi.mocked(recordRelatedEvidenceWrites).mockResolvedValue(undefined);
  vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([]);
  vi.mocked(mathAnswerEventRepo.getDirectCorrectFirstAttempts).mockResolvedValue([]);
  vi.mocked(sessionRepo.getLastByMode).mockResolvedValue(undefined);
  vi.mocked(sessionRepo.save).mockResolvedValue(undefined);
  vi.mocked(sessionRepo.get).mockResolvedValue(undefined);
  vi.mocked(appNow).mockReturnValue(FIXED_NOW);
  vi.mocked(markDailyLessonProgressFromEvent).mockResolvedValue('updated');
  vi.mocked(generateId).mockImplementation(() => `id-${++idSeq}`);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePracticeSession — wrong first attempt + correct retry', () => {
  it('records scheduler failure without an after snapshot and releases the card for a later presentation', async () => {
    vi.mocked(applyReview).mockImplementationOnce(() => {
      throw new RangeError('future review date');
    });
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({ ...SESSION_CONFIG, repeatPolicy: 'user_requested_rounds', rounds: 2 });
    });

    await act(async () => { await result.current.submitAnswer('56'); });
    const failed = vi.mocked(recordPracticeAnswer).mock.calls[0][0];
    expect(failed.event).toMatchObject({
      schedulingEligible: true, schedulingApplied: false, schedulerErrorCode: 'clock_drift',
    });
    expect(failed.event.schedulingTelemetry).toMatchObject({
      schedulingEligible: true, schedulingApplied: false, schedulerErrorCode: 'clock_drift',
    });
    expect(failed.event.schedulingTelemetry?.after).toBeUndefined();

    await act(async () => { await result.current.nextQuestion(); });
    await act(async () => { await result.current.submitAnswer('56'); });
    const recovered = vi.mocked(recordPracticeAnswer).mock.calls[1][0];
    expect(recovered.event).toMatchObject({ schedulingEligible: true, schedulingApplied: true });
    expect(recovered.event.schedulingTelemetry?.after).toBeDefined();
  });

  it('uses a newly durable fifth sample when grading the next presentation', async () => {
    let clock = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const history: MathAnswerEvent[] = [100, 200, 300, 400].map((latencyMs, index) => ({
      id: `history-${index}`, studentId: STUDENT_ID, sessionId: `old-${index}`,
      itemId: 'MUL_7x8', cardKey: 'fact:mul:7x8', mode: 'practice', promptShown: '7 × 8',
      correctAnswer: 56, studentAnswer: 56, isCorrect: true, isRetry: false, hintUsed: false,
      latencyMs, schedulingEligible: true, responsePolicy: 'atomic_fluency',
      createdAt: `2026-05-0${index + 1}T10:00:00.000Z`,
    }));
    vi.mocked(mathAnswerEventRepo.getDirectCorrectFirstAttempts).mockResolvedValue(history);
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));

    await act(async () => {
      await result.current.startSession({ ...SESSION_CONFIG, repeatPolicy: 'user_requested_rounds', rounds: 2 });
    });
    clock = 500;
    await act(async () => { await result.current.submitAnswer('56'); });
    expect(vi.mocked(recordPracticeAnswer).mock.calls[0][0].event.reviewGrade).toBe('good');

    await act(async () => { await result.current.nextQuestion(); });
    clock = 600;
    await act(async () => { await result.current.submitAnswer('56'); });
    const secondEvent = vi.mocked(recordPracticeAnswer).mock.calls[1][0].event;
    expect(secondEvent.reviewGrade).toBe('easy');
    expect(secondEvent.schedulingTelemetry?.rating).toMatchObject({
      fluencyBaselineSource: 'student', fluencySampleCount: 5,
      fluencyFastCutoffMs: 200, fluencySlowCutoffMs: 400,
    });
    nowSpy.mockRestore();
  });

  it('records two events: wrong first attempt and correct retry', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));

    // Start session with MUL_7x8 (answer = 56)
    await act(async () => {
      await result.current.startSession(SESSION_CONFIG);
    });

    expect(result.current.state.phase).toBe('active');
    expect(result.current.state.currentItem?.id).toBe('MUL_7x8');

    // Wrong first attempt (63 ≠ 56)
    await act(async () => {
      await result.current.submitAnswer('63');
    });

    expect(result.current.state.phase).toBe('active');
    expect(vi.mocked(recordPracticeAnswer)).toHaveBeenCalledTimes(1);

    // Correct retry (56 = 56)
    await act(async () => {
      await result.current.submitAnswer('56');
    });

    expect(result.current.state.phase).toBe('correct');
    expect(vi.mocked(recordPracticeAnswer)).toHaveBeenCalledTimes(2);
  });

  it('only the first-attempt event carries updatedState; retry event does not', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));

    await act(async () => {
      await result.current.startSession(SESSION_CONFIG);
    });

    await act(async () => {
      await result.current.submitAnswer('63'); // wrong
    });

    await act(async () => {
      await result.current.submitAnswer('56'); // correct retry
    });

    const calls = vi.mocked(recordPracticeAnswer).mock.calls;
    const [firstPayload] = calls[0];
    const [secondPayload] = calls[1];

    // First attempt: FSRS state must be persisted
    expect(firstPayload.updatedState).toBeDefined();
    // Second attempt (retry): no FSRS update
    expect(secondPayload.updatedState).toBeUndefined();
  });

  it('first-attempt itemState has correctCount=0, attemptCount=1, reps=1 after wrong answer', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));

    await act(async () => {
      await result.current.startSession(SESSION_CONFIG);
    });

    await act(async () => {
      await result.current.submitAnswer('63'); // wrong first attempt
    });

    const [firstPayload] = vi.mocked(recordPracticeAnswer).mock.calls[0];
    const s = firstPayload.updatedState!;

    expect(s.correctCount).toBe(0);
    expect(s.attemptCount).toBe(1);
    expect(s.reps).toBe(1);
  });

  it('first-attempt event is flagged isRetry=false; retry event is flagged isRetry=true', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));

    await act(async () => {
      await result.current.startSession(SESSION_CONFIG);
    });

    await act(async () => {
      await result.current.submitAnswer('63');
    });

    await act(async () => {
      await result.current.submitAnswer('56');
    });

    const calls = vi.mocked(recordPracticeAnswer).mock.calls;
    expect(calls[0][0].event.isRetry).toBe(false);
    expect(calls[1][0].event.isRetry).toBe(true);
  });

  it('retries recordPracticeAnswer once on transient failure and does not throw', async () => {
    // Simulate first attempt failing, retry succeeding
    vi.mocked(recordPracticeAnswer)
      .mockRejectedValueOnce(new Error('DB busy'))
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));

    await act(async () => {
      await result.current.startSession(SESSION_CONFIG);
    });

    // Should not throw even when the first write fails
    await act(async () => {
      await result.current.submitAnswer('56'); // correct on first try
    });

    // Called at least twice: initial attempt + retry
    expect(vi.mocked(recordPracticeAnswer).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.current.state.phase).toBe('correct');
  });

  it('keeps progress unchanged after two write failures and retries the same payload idempotently', async () => {
    vi.mocked(recordPracticeAnswer).mockRejectedValueOnce(new Error('DB busy')).mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession(SESSION_CONFIG); });
    await act(async () => { await result.current.submitAnswer('56'); });

    expect(result.current.state).toMatchObject({ phase: 'active', completedCount: 0, correctCount: 0, attemptCount: 0, saveStatus: 'error' });
    const firstPayload = vi.mocked(recordPracticeAnswer).mock.calls[0][0];
    expect(vi.mocked(recordPracticeAnswer).mock.calls[1][0]).toBe(firstPayload);

    vi.mocked(recordPracticeAnswer).mockResolvedValueOnce(undefined);
    await act(async () => { await result.current.retrySave(); });
    expect(vi.mocked(recordPracticeAnswer).mock.calls[2][0]).toBe(firstPayload);
    expect(result.current.state).toMatchObject({ phase: 'correct', completedCount: 1, correctCount: 1, attemptCount: 1, saveStatus: 'idle' });
  });

  it('preserves first-attempt semantics when a failed wrong answer is later saved', async () => {
    vi.mocked(recordPracticeAnswer).mockRejectedValueOnce(new Error('DB busy')).mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession(SESSION_CONFIG); });
    await act(async () => { await result.current.submitAnswer('15'); });
    expect(result.current.state.retryKey).toBe(0);
    vi.mocked(recordPracticeAnswer).mockResolvedValue(undefined);
    await act(async () => { await result.current.retrySave(); });
    expect(result.current.state.retryKey).toBe(1);
    await act(async () => { await result.current.submitAnswer('56'); });
    const corrected = vi.mocked(recordPracticeAnswer).mock.calls.at(-1)![0];
    expect(corrected.event).toMatchObject({ isRetry: true, schedulingEligible: false });
  });

  it('persists Daily New for Goals attribution on the session, event, and attempt', async () => {
    const config: SessionConfig = {
      ...SESSION_CONFIG,
      origin: 'daily_new_for_goals',
      goalId: 'goal-1',
      goalTargetId: 'target-1',
      goalIds: ['goal-1', 'goal-2'],
      goalTargetIds: ['target-1', 'target-2'],
      goalLearningKind: 'planned',
    };
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));

    await act(async () => {
      await result.current.startSession(config);
    });
    await act(async () => {
      await result.current.submitAnswer('56');
    });

    expect(vi.mocked(sessionRepo.save)).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'daily_new_for_goals',
      goalId: 'goal-1',
      goalTargetId: 'target-1',
      goalIds: ['goal-1', 'goal-2'],
      goalTargetIds: ['target-1', 'target-2'],
      goalLearningKind: 'planned',
    }));
    const [payload] = vi.mocked(recordPracticeAnswer).mock.calls[0];
    expect(payload.event).toEqual(expect.objectContaining({
      origin: 'daily_new_for_goals',
      goalId: 'goal-1',
      goalTargetId: 'target-1',
      goalIds: ['goal-1', 'goal-2'],
      goalTargetIds: ['target-1', 'target-2'],
      goalLearningKind: 'planned',
    }));
    expect(payload.attempt).toEqual(expect.objectContaining({
      origin: 'daily_new_for_goals',
      goalId: 'goal-1',
      goalTargetId: 'target-1',
      goalIds: ['goal-1', 'goal-2'],
      goalTargetIds: ['target-1', 'target-2'],
      goalLearningKind: 'planned',
    }));
  });
});

// ── Phase 6: mistake pattern detection ───────────────────────────────────────

describe('usePracticeSession — mistake pattern detection', () => {
  it('wrong first attempt records mistakePatterns in updatedState', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession(SESSION_CONFIG); });

    // 63 = 7×9 → mul:neighbor_fact; |63−56|=7 → mul:skip_count_error
    await act(async () => { await result.current.submitAnswer('63'); });

    const [payload] = vi.mocked(recordPracticeAnswer).mock.calls[0];
    expect(payload.updatedState?.mistakePatterns).toContain('mul:neighbor_fact');
  });

  it('retry does not add new mistakePatterns', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession(SESSION_CONFIG); });

    await act(async () => { await result.current.submitAnswer('63'); }); // wrong first attempt
    await act(async () => { await result.current.submitAnswer('15'); }); // wrong retry

    const calls = vi.mocked(recordPracticeAnswer).mock.calls;
    // Retry payload has no updatedState — mistakePatterns cannot have been modified
    expect(calls[1][0].updatedState).toBeUndefined();
  });

  it('correct answer does not add mistakes', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession(SESSION_CONFIG); });

    await act(async () => { await result.current.submitAnswer('56'); }); // correct

    const [payload] = vi.mocked(recordPracticeAnswer).mock.calls[0];
    expect(payload.updatedState?.mistakePatterns ?? []).toHaveLength(0);
  });

  it('existing mistakePatterns are preserved and deduplicated', async () => {
    vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([{
      studentId: STUDENT_ID,
      cardKey: 'fact:mul:7x8',
      lastItemId: 'MUL_7x8',
      skillId: 'mul-7',
      attemptCount: 5,
      correctCount: 3,
      lastCorrect: true,
      lastLatencyMs: 2000,
      medianLatencyMs: 2000,
      ease: 2.5,
      stabilityDays: 1,
      difficulty: 0.3,
      masteryLevel: 'learning' as const,
      mistakePatterns: ['mul:neighbor_fact'],
    }]);

    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession(SESSION_CONFIG); });

    // 63 → mul:neighbor_fact (already present) + mul:skip_count_error (new)
    await act(async () => { await result.current.submitAnswer('63'); });

    const [payload] = vi.mocked(recordPracticeAnswer).mock.calls[0];
    const patterns: string[] = payload.updatedState?.mistakePatterns ?? [];
    expect(patterns).toContain('mul:neighbor_fact');
    expect(patterns).toContain('mul:skip_count_error');
    // No duplicates of the pre-existing pattern
    expect(patterns.filter(p => p === 'mul:neighbor_fact')).toHaveLength(1);
  });
});

// ── Measurement mode ──────────────────────────────────────────────────────────

describe('usePracticeSession — measurement mode', () => {
  it('creates a non-empty queue and enters active phase', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({ mode: 'measurement', sessionLength: 10 });
    });
    expect(result.current.state.phase).toBe('active');
    expect(result.current.state.totalPlanned).toBe(10);
    expect(result.current.state.currentItem).not.toBeNull();
  });

  it('first queued item ID reconstructs via makeItemFromId', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({ mode: 'measurement', sessionLength: 5 });
    });
    const id = result.current.state.currentItem?.id;
    expect(id).toBeDefined();
    if (id) {
      expect(makeItemFromId(id)).not.toBeNull();
    }
  });

  it('specificItemIds sessions still work as before', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({ mode: 'daily_review', sessionLength: 2, specificItemIds: ['MUL_7x8'] });
    });
    expect(result.current.state.phase).toBe('active');
    expect(result.current.state.currentItem?.id).toBe('MUL_7x8');
  });
});

// ── Adaptive selection ────────────────────────────────────────────────────────

describe('usePracticeSession — adaptive selection', () => {
  it('preserves a preplanned adaptive lesson queue and session metadata', async () => {
    const planned = [makeItemFromId('MUL_3x4')!, makeItemFromId('DIV_12d3')!];
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({
        mode: 'adaptive_lesson', sessionLength: 2, preplannedItems: planned,
        lessonPlanId: 'lesson-plan', lessonKind: 'adaptive_daily_lesson', focusSkillId: 'g3-mul-tables-basic',
        lessonSegments: [{ kind: 'retrieval', itemInstanceIds: ['MUL_3x4'] }, { kind: 'focus', itemInstanceIds: ['DIV_12d3'] }],
        lessonRationales: { MUL_3x4: 'Due retrieval.', DIV_12d3: 'Focus bridge.' },
      });
    });
    expect(result.current.state.currentItem?.id).toBe('MUL_3x4');
    expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ lessonPlanId: 'lesson-plan', lessonKind: 'adaptive_daily_lesson', focusSkillId: 'g3-mul-tables-basic' }));
    await act(async () => { await result.current.submitAnswer('12'); });
    expect(vi.mocked(recordPracticeAnswer).mock.calls[0][0].event).toEqual(expect.objectContaining({ lessonPlanId: 'lesson-plan', lessonSegment: 'retrieval', lessonRationale: 'Due retrieval.' }));
    expect(vi.mocked(recordPracticeAnswer).mock.calls[0][0].event.schedulingTelemetry).toMatchObject({
      version: 1, cardKey: 'fact:mul:3x4', presentationIndex: 1, attemptNo: 1,
      schedulingEligible: true, evidenceKind: 'direct',
      selection: { origin: 'due_retrieval', plannerVersion: 'daily-lesson-v1', lessonPlanId: 'lesson-plan' },
      before: { stabilityDays: 0 },
      rating: { reviewGrade: expect.any(String) },
    });
  });

  it('does not reschedule a card recorded by a persisted lesson before resume', async () => {
    const item = makeItemFromId('MUL_3x4')!;
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession({
      mode: 'adaptive_lesson', sessionLength: 1,
      plannedPracticeItems: [{
        item, schedulingEligible: true,
        selection: { origin: 'due_retrieval', rationaleCodes: ['due'], lessonPlanId: 'lesson-plan' },
      }],
      initialScheduledCardKeys: ['fact:mul:3x4'], lessonPlanId: 'lesson-plan',
    }); });
    await act(async () => { await result.current.submitAnswer('12'); });
    expect(vi.mocked(recordPracticeAnswer).mock.calls[0][0].event).toMatchObject({
      schedulingEligible: false, schedulingApplied: false,
    });
    expect(applyReview).not.toHaveBeenCalled();
  });

  it('honors planner-level scheduling ineligibility for a queued lesson item', async () => {
    const item = makeItemFromId('MUL_3x4')!;
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession({
      mode: 'adaptive_lesson', sessionLength: 1,
      plannedPracticeItems: [{
        item, schedulingEligible: false,
        selection: { origin: 'transfer', rationaleCodes: ['transfer'], lessonPlanId: 'lesson-plan' },
      }], lessonPlanId: 'lesson-plan',
    }); });
    await act(async () => { await result.current.submitAnswer('12'); });
    expect(vi.mocked(recordPracticeAnswer).mock.calls[0][0].event).toMatchObject({
      schedulingEligible: false, schedulingApplied: false,
    });
    expect(applyReview).not.toHaveBeenCalled();
  });

  it('commits a canonical answer once when auxiliary lesson progress fails', async () => {
    vi.mocked(markDailyLessonProgressFromEvent).mockRejectedValueOnce(new Error('plan replaced')).mockResolvedValueOnce('updated');
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession({
      mode: 'adaptive_lesson', sessionLength: 1, preplannedItems: [makeItemFromId('MUL_3x4')!],
      lessonPlanId: 'lesson-plan', lessonKind: 'adaptive_daily_lesson',
    }); });
    await act(async () => { await result.current.submitAnswer('12'); });
    expect(result.current.state.phase).toBe('correct');
    expect(result.current.state.completedCount).toBe(1);
    expect(result.current.state.saveStatus).toBe('idle');
    expect(result.current.state.auxiliarySaveError).toMatch(/answer is saved/i);
    expect(recordPracticeAnswer).toHaveBeenCalledOnce();
    await act(async () => { await result.current.retryAuxiliaryWrites(); });
    expect(markDailyLessonProgressFromEvent).toHaveBeenCalledTimes(2);
    expect(recordPracticeAnswer).toHaveBeenCalledOnce();
    expect(result.current.state.auxiliarySaveStatus).toBe('complete');
  });

  it('non-daily_review specificItemIds still produce a valid, reconstructable queue', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({
        mode: 'area',
        sessionLength: 4,
        specificItemIds: ['AREA_RECT_3x4', 'AREA_RECT_5x6'],
      });
    });
    expect(result.current.state.phase).toBe('active');
    expect(result.current.state.totalPlanned).toBe(4);
    const id = result.current.state.currentItem?.id;
    expect(id).toBeDefined();
    expect(makeItemFromId(id!)).not.toBeNull();
  });

  it('daily_review with due specificItemIds includes every due item', async () => {
    const ids = ['MUL_2x3', 'MUL_4x5', 'MUL_6x7'];
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({ mode: 'daily_review', sessionLength: 3, specificItemIds: ids });
    });

    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const cur = result.current.state.currentItem;
      expect(cur).not.toBeNull();
      seen.add(cur!.id);
      await act(async () => { await result.current.submitAnswer(String(cur!.answer)); });
      await act(async () => { await result.current.nextQuestion(); });
    }
    expect(seen).toEqual(new Set(ids));
    for (const call of vi.mocked(recordPracticeAnswer).mock.calls) {
      expect(call[0].event).toMatchObject({
        selectionOrigin: 'due_retrieval',
        selectionRationaleCodes: ['daily_review_requested_due'],
        schedulingTelemetry: {
          selection: { origin: 'due_retrieval', rationaleCodes: ['daily_review_requested_due'] },
        },
      });
    }
  });

  it('preserves distinct overdue and weak backfill selection metadata through queue progression', async () => {
    vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([
      {
        studentId: STUDENT_ID, cardKey: 'fact:mul:2x2', lastItemId: 'MUL_2x2', skillId: 'mul',
        attemptCount: 4, correctCount: 3, lastCorrect: true, lastLatencyMs: 0, medianLatencyMs: 0,
        ease: 2.5, stabilityDays: 1, difficulty: 0.3, masteryLevel: 'developing',
        nextDueAt: '2026-05-01T00:00:00Z', mistakePatterns: [],
      },
      {
        studentId: STUDENT_ID, cardKey: 'fact:mul:3x3', lastItemId: 'MUL_3x3', skillId: 'mul',
        attemptCount: 4, correctCount: 1, lastCorrect: false, lastLatencyMs: 0, medianLatencyMs: 0,
        ease: 2.5, stabilityDays: 1, difficulty: 0.3, masteryLevel: 'learning',
        nextDueAt: '2026-07-01T00:00:00Z', mistakePatterns: [],
      },
    ]);
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({ mode: 'daily_review', sessionLength: 3, specificItemIds: ['MUL_7x8'] });
    });
    for (let i = 0; i < 3; i++) {
      const current = result.current.state.currentItem!;
      await act(async () => { await result.current.submitAnswer(String(current.answer)); });
      await act(async () => { await result.current.nextQuestion(); });
    }
    const events = vi.mocked(recordPracticeAnswer).mock.calls.map(call => call[0].event);
    expect(events.find(event => event.itemId === 'MUL_2x2')?.schedulingTelemetry?.selection).toMatchObject({
      origin: 'due_retrieval', rationaleCodes: ['daily_review_backfill_overdue'],
    });
    expect(events.find(event => event.itemId === 'MUL_3x3')?.schedulingTelemetry?.selection).toMatchObject({
      origin: 'weak_skill', rationaleCodes: ['daily_review_backfill_weak'],
    });
  });

  it('keeps explicit table practice manual and daily goal content new-learning', async () => {
    const manual = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await manual.result.current.startSession({ mode: 'single_table', tables: [7], sessionLength: 1 });
    });
    await act(async () => {
      await manual.result.current.submitAnswer(String(manual.result.current.state.currentItem!.answer));
    });
    expect(vi.mocked(recordPracticeAnswer).mock.calls[0][0].event.schedulingTelemetry?.selection.origin).toBe('manual');

    vi.mocked(recordPracticeAnswer).mockClear();
    const goal = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await goal.result.current.startSession({
        mode: 'area', sessionLength: 1, specificItemIds: ['AREA_RECT_3x4'],
        goalId: 'goal-1', origin: 'daily_new_for_goals',
      });
    });
    await act(async () => {
      await goal.result.current.submitAnswer(String(goal.result.current.state.currentItem!.answer));
    });
    expect(vi.mocked(recordPracticeAnswer).mock.calls[0][0].event.schedulingTelemetry?.selection).toMatchObject({
      origin: 'new_learning', rationaleCodes: ['daily_goal_new_item'],
    });
  });

  it('records different origins when the same item is selected manually and by Today Plan', async () => {
    for (const config of [
      { mode: 'area', sessionLength: 1, specificItemIds: ['AREA_RECT_3x4'] },
      { mode: 'daily_review', sessionLength: 1, specificItemIds: ['AREA_RECT_3x4'] },
    ] satisfies SessionConfig[]) {
      const hook = renderHook(() => usePracticeSession(STUDENT_ID));
      await act(async () => { await hook.result.current.startSession(config); });
      await act(async () => {
        await hook.result.current.submitAnswer(String(hook.result.current.state.currentItem!.answer));
      });
    }
    expect(vi.mocked(recordPracticeAnswer).mock.calls.map(call =>
      call[0].event.schedulingTelemetry?.selection.origin,
    )).toEqual(['manual', 'due_retrieval']);
  });

  it('daily_review user rounds produce the exact requested presentation count', async () => {
    const ids = ['MUL_2x3', 'MUL_4x5'];
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({ mode: 'daily_review', sessionLength: 6, specificItemIds: ids, repeatPolicy: 'user_requested_rounds', rounds: 3 });
    });
    expect(result.current.state.totalPlanned).toBe(6);
    for (let i = 0; i < 6; i++) {
      const current = result.current.state.currentItem!;
      await act(async () => { await result.current.submitAnswer(String(current.answer)); });
      await act(async () => { await result.current.nextQuestion(); });
    }
    const writes = vi.mocked(recordPracticeAnswer).mock.calls.map(call => call[0]);
    expect(writes).toHaveLength(6);
    for (const itemId of ids) {
      const cardWrites = writes.filter(write => write.event.itemId === itemId);
      expect(cardWrites.map(write => write.event.presentationIndex)).toEqual([1, 2, 3]);
      expect(cardWrites.map(write => write.event.schedulingEligible)).toEqual([true, false, false]);
      expect(cardWrites.filter(write => write.updatedState)).toHaveLength(1);
    }
  });

  it('word_problem mode builds a problem around the student\'s weak/due multiplication fact', async () => {
    // MUL_8x7 is due and still being learned — generation should target it
    // rather than relying on a random pool happening to include 8 × 7.
    vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([{
      studentId: STUDENT_ID, cardKey: 'fact:mul:7x8', lastItemId: 'MUL_8x7', skillId: 'mul',
      attemptCount: 4, correctCount: 1, lastCorrect: false, lastLatencyMs: 0,
      medianLatencyMs: 0, ease: 2.5, stabilityDays: 0, difficulty: 0.3,
      masteryLevel: 'learning' as const, nextDueAt: '2026-05-01T00:00:00Z', mistakePatterns: [],
    }]);

    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession({
        mode: 'word_problem', sessionLength: 5, grade: 3, operandMin: 2, operandMax: 10,
      });
    });

    const cur = result.current.state.currentItem;
    expect(cur).not.toBeNull();
    expect([cur!.factA, cur!.factB].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([7, 8]);
  });
});

// ── Issue #28: one long-term scheduling update per card per session ───────────

describe('usePracticeSession — one scheduling update per card per session', () => {
  it('a card presented more than once in a session (pool smaller than sessionLength cycles) schedules only once', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      // A single-item pool with sessionLength 3 forces selectAdaptiveItems to
      // cycle the same card to fill the queue.
      await result.current.startSession({
        mode: 'area',
        sessionLength: 3,
        specificItemIds: ['AREA_RECT_3x4'],
      });
    });
    expect(result.current.state.totalPlanned).toBe(3);

    for (let i = 0; i < 3; i++) {
      const cur = result.current.state.currentItem!;
      expect(cur.id).toBe('AREA_RECT_3x4');
      await act(async () => { await result.current.submitAnswer(String(cur.answer)); });
      await act(async () => { await result.current.nextQuestion(); });
    }

    const calls = vi.mocked(recordPracticeAnswer).mock.calls;
    expect(calls).toHaveLength(3);

    // Only the first presentation actually schedules (updatedState written).
    expect(calls[0][0].updatedState).toBeDefined();
    expect(calls[1][0].updatedState).toBeUndefined();
    expect(calls[2][0].updatedState).toBeUndefined();

    // The repeats are recorded as direct evidence, explicitly marked non-scheduling.
    expect(calls[0][0].event.schedulingEligible).toBe(true);
    expect(calls[1][0].event.schedulingEligible).toBe(false);
    expect(calls[1][0].event.ratingReason).toBe('same_session_repeat');
    expect(calls[2][0].event.schedulingEligible).toBe(false);
    expect(calls[2][0].event.ratingReason).toBe('same_session_repeat');

    // presentationIndex increments across repeats of the same card.
    expect(calls[0][0].event.presentationIndex).toBe(1);
    expect(calls[1][0].event.presentationIndex).toBe(2);
    expect(calls[2][0].event.presentationIndex).toBe(3);
  });

  it('a wrong retry within one presentation is still marked isRetry and does not schedule', async () => {
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => {
      await result.current.startSession(SESSION_CONFIG);
    });

    await act(async () => { await result.current.submitAnswer('wrong'); }); // wrong first attempt
    await act(async () => { await result.current.submitAnswer('56'); }); // correct retry

    const calls = vi.mocked(recordPracticeAnswer).mock.calls;
    expect(calls[0][0].event.isRetry).toBe(false);
    expect(calls[0][0].updatedState).toBeDefined();
    expect(calls[1][0].event.isRetry).toBe(true);
    expect(calls[1][0].updatedState).toBeUndefined();
  });
});

describe('usePracticeSession — session-level related evidence ledger', () => {
  const factState = {
    studentId: STUDENT_ID, cardKey: 'fact:mul:3x4', lastItemId: 'MUL_3x4', skillId: 'mul',
    attemptCount: 4, correctCount: 3, lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1100,
    ease: 2.5, stabilityDays: 5, fsrsDifficulty: 5, difficulty: .2, reps: 3, lapses: 0,
    lastSeenAt: '2026-05-20T00:00:00Z', nextDueAt: '2026-05-25T00:00:00Z', masteryLevel: 'developing' as const, mistakePatterns: [],
  };

  it('caps three related successes at one deferred canonical nudge', async () => {
    vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([factState]);
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession({ mode: 'area', sessionLength: 3, specificItemIds: ['AREA_RECT_3x4'] }); });
    for (let index = 0; index < 3; index++) {
      await act(async () => { await result.current.submitAnswer('12'); });
      await act(async () => { await result.current.nextQuestion(); });
    }
    expect(recordRelatedEvidenceWrites).toHaveBeenCalledTimes(1);
    const writes = vi.mocked(recordRelatedEvidenceWrites).mock.calls[0][0];
    expect(writes).toHaveLength(1);
    expect(writes[0].event).toMatchObject({ cardKey: 'fact:mul:3x4', relatedEvidence: true, schedulingEligible: true, evidenceSourceItemId: 'AREA_RECT_3x4' });
    expect(writes[0].event.schedulingTelemetry?.selection.rationaleCodes).toContain('deferred_single_related_evidence');
  });

  it('cancels pending related evidence when a direct fact review occurs later', async () => {
    vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([factState]);
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession({ mode: 'adaptive_lesson', sessionLength: 2, preplannedItems: [makeItemFromId('AREA_RECT_3x4')!, makeItemFromId('MUL_3x4')!] }); });
    await act(async () => { await result.current.submitAnswer('12'); await result.current.nextQuestion(); });
    await act(async () => { await result.current.submitAnswer('12'); await result.current.nextQuestion(); });
    expect(recordRelatedEvidenceWrites).not.toHaveBeenCalled();
  });

  it('completes direct work and exposes retry when deferred persistence fails', async () => {
    vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([factState]);
    vi.mocked(recordRelatedEvidenceWrites).mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => usePracticeSession(STUDENT_ID));
    await act(async () => { await result.current.startSession({ mode: 'area', sessionLength: 1, specificItemIds: ['AREA_RECT_3x4'] }); });
    await act(async () => { await result.current.submitAnswer('12'); });
    await act(async () => { await result.current.nextQuestion(); });
    expect(result.current.state.phase).toBe('complete');
    expect(result.current.state.auxiliarySaveStatus).toBe('error');
    expect(result.current.state.auxiliarySaveError).toMatch(/answers are saved/i);
    await act(async () => { await result.current.retryAuxiliaryWrites(); });
    expect(recordRelatedEvidenceWrites).toHaveBeenCalledTimes(2);
    const firstId = vi.mocked(recordRelatedEvidenceWrites).mock.calls[0][0][0].event.id;
    const retryId = vi.mocked(recordRelatedEvidenceWrites).mock.calls[1][0][0].event.id;
    expect(firstId).toMatch(/^related:id-\d+:fact%3Amul%3A3x4$/);
    expect(retryId).toBe(firstId);
    expect(result.current.state.phase).toBe('complete');
    expect(result.current.state.auxiliarySaveStatus).toBe('complete');
  });
});
