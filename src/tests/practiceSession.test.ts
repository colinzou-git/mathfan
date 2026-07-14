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
}));

vi.mock('../db/repositories', () => ({
  itemStateRepo: { getForStudent: vi.fn() },
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

vi.mock('../utils/id', () => ({
  generateId: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { usePracticeSession } from '../features/practice/usePracticeSession';
import { recordPracticeAnswer } from '../features/learning/recordAnswer';
import { itemStateRepo, sessionRepo } from '../db/repositories';
import { appNow } from '../features/time/clock';
import { generateId } from '../utils/id';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import type { SessionConfig } from '../types/math';

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
  vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([]);
  vi.mocked(sessionRepo.getLastByMode).mockResolvedValue(undefined);
  vi.mocked(sessionRepo.save).mockResolvedValue(undefined);
  vi.mocked(sessionRepo.get).mockResolvedValue(undefined);
  vi.mocked(appNow).mockReturnValue(FIXED_NOW);
  vi.mocked(generateId).mockImplementation(() => `id-${++idSeq}`);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePracticeSession — wrong first attempt + correct retry', () => {
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
    expect(cur!.factA === 8 && cur!.factB === 7).toBe(true);
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
