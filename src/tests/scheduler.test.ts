import { describe, it, expect } from 'vitest';
import {
  applyReview, createInitialState, updateMasteryLevel, planSession, planTableSession,
  fsrsRetrievability, fsrsInterval, TARGET_RETENTION,
} from '../features/scheduler/scheduler';
import { generateMultiplicationItems, generateSingleTableItems } from '../features/curriculum/multiplicationItems';
import type { StudentItemState } from '../types/math';

const MS_DAY = 86_400_000;
const items = generateMultiplicationItems();
const item = items.find(i => i.id === 'MUL_8x9')!;
const now = new Date('2026-06-01T10:00:00Z');
const fresh = () => createInitialState('s1', item);

// ── FSRS utility math ─────────────────────────────────────────────────────────

// FSRS-4.5: R(t,S) = (1 + FACTOR·t/S)^DECAY  where DECAY=-0.5, FACTOR=19/81
describe('fsrsRetrievability (FSRS-4.5)', () => {
  it('is 1.0 at t=0', () => expect(fsrsRetrievability(0, 5)).toBeCloseTo(1, 5));
  it('R(S, S) equals target retention — retrievability equals 0.9 after one interval', () => {
    // At t = fsrsInterval(S, 0.9) = S, R = 0.9 exactly.
    expect(fsrsRetrievability(10, 10)).toBeCloseTo(0.9, 5);
  });
  it('decreases as time passes', () => {
    expect(fsrsRetrievability(10, 5)).toBeLessThan(fsrsRetrievability(2, 5));
  });
  it('s <= 0 returns 0', () => {
    expect(fsrsRetrievability(5, 0)).toBe(0);
    expect(fsrsRetrievability(5, -1)).toBe(0);
  });
});

describe('fsrsInterval (FSRS-4.5)', () => {
  it('equals stability at 90% target retention', () => {
    expect(fsrsInterval(10, 0.9)).toBeCloseTo(10, 5);
  });
  it('lower target retention → longer interval', () => {
    expect(fsrsInterval(10, 0.8)).toBeGreaterThan(fsrsInterval(10, 0.9));
  });
  it('default target retention is 0.9', () => expect(TARGET_RETENTION).toBe(0.9));
  it('fsrsRetrievability and fsrsInterval are inverses (round-trip)', () => {
    // R(I(r, S), S) = r for any r and S
    expect(fsrsRetrievability(fsrsInterval(15, 0.85), 15)).toBeCloseTo(0.85, 5);
    expect(fsrsRetrievability(fsrsInterval(7, 0.7), 7)).toBeCloseTo(0.7, 5);
  });
});

// ── applyReview: first review via ts-fsrs ─────────────────────────────────────

describe('applyReview — first review initial values', () => {
  it('creates nonzero stability and difficulty on first review', () => {
    const u = applyReview(fresh(), 'good', 2500, '72', now, { isCorrect: true });
    expect(u.stabilityDays).toBeGreaterThan(0);
    expect(u.fsrsDifficulty).toBeGreaterThan(0);
    expect(u.reps).toBe(1);
  });

  it('easy schedules further out than good, good further than hard', () => {
    const easy = applyReview(fresh(), 'easy', 1000, '72', now, { isCorrect: true });
    const good = applyReview(fresh(), 'good', 2500, '72', now, { isCorrect: true });
    const hard = applyReview(fresh(), 'hard', 5000, '72', now, { isCorrect: true });
    const days = (s: StudentItemState) => (new Date(s.nextDueAt!).getTime() - now.getTime()) / MS_DAY;
    expect(days(easy)).toBeGreaterThan(days(good));
    expect(days(good)).toBeGreaterThan(days(hard));
  });

  it('nextDueAt moves into the future after a correct review', () => {
    const u = applyReview(fresh(), 'good', 2500, '72', now, { isCorrect: true });
    expect(new Date(u.nextDueAt!).getTime()).toBeGreaterThan(now.getTime());
  });

  it('again on a fresh card is due immediately (in-session retry)', () => {
    const u = applyReview(fresh(), 'again', 1000, '63', now, { isCorrect: false });
    expect(u.nextDueAt).toBe(now.toISOString());
    expect(u.reps).toBe(1);
  });

  // In standard FSRS a new card's first failure is NOT a lapse — a lapse is
  // forgetting a card you already knew (State.Review + Again). ts-fsrs reflects
  // this correctly: lapses stay 0 on the first-ever wrong answer.
  it('again on a fresh (New) card does NOT count as a lapse', () => {
    const u = applyReview(fresh(), 'again', 1000, '63', now, { isCorrect: false });
    expect(u.lapses).toBe(0);
  });

  it('difficulty: again ends up harder than easy', () => {
    const easy = applyReview(fresh(), 'easy', 1000, '72', now, { isCorrect: true });
    const again = applyReview(fresh(), 'again', 1000, '63', now, { isCorrect: false });
    expect(again.fsrsDifficulty!).toBeGreaterThan(easy.fsrsDifficulty!);
  });

  it('clamps difficulty into [1,10]', () => {
    const u = applyReview(fresh(), 'again', 1000, '63', now, { isCorrect: false });
    expect(u.fsrsDifficulty!).toBeGreaterThanOrEqual(1);
    expect(u.fsrsDifficulty!).toBeLessThanOrEqual(10);
  });
});

describe('applyReview — stability growth on later reviews', () => {
  it('a correct review after real elapsed time increases stability', () => {
    const first = applyReview(fresh(), 'good', 2000, '72', now, { isCorrect: true });
    const s1 = first.stabilityDays;
    const later = new Date(now.getTime() + s1 * MS_DAY);
    const second = applyReview(first, 'good', 2000, '72', later, { isCorrect: true });
    expect(second.stabilityDays).toBeGreaterThan(s1);
    expect(second.reps).toBe(2);
  });

  it('a lapse on a Review card shrinks stability and increments lapses', () => {
    const first = applyReview(fresh(), 'easy', 1000, '72', now, { isCorrect: true });
    const later = new Date(now.getTime() + first.stabilityDays * MS_DAY);
    const lapsed = applyReview(first, 'again', 5000, '0', later, { isCorrect: false });
    expect(lapsed.stabilityDays).toBeLessThan(first.stabilityDays);
    expect(lapsed.lapses).toBe(1); // first lapse on a previously-reviewed card
  });
});

describe('applyReview — counts & personal best', () => {
  it('correct increments correct + attempt counts', () => {
    const u = applyReview(fresh(), 'good', 2500, '72', now, { isCorrect: true });
    expect(u.correctCount).toBe(1);
    expect(u.attemptCount).toBe(1);
  });
  it('wrong does not increment correctCount', () => {
    const u = applyReview(fresh(), 'again', 2500, '63', now, { isCorrect: false });
    expect(u.correctCount).toBe(0);
    expect(u.attemptCount).toBe(1);
  });
  it('tracks personal best only on correct, keeps the fastest', () => {
    const a = applyReview(fresh(), 'easy', 1200, '72', now, { isCorrect: true });
    expect(a.personalBestMs).toBe(1200);
    const b = applyReview(a, 'good', 900, '72', now, { isCorrect: true });
    expect(b.personalBestMs).toBe(900);
    const c = applyReview(b, 'good', 3000, '72', now, { isCorrect: true });
    expect(c.personalBestMs).toBe(900);
  });
  it('does not set personal best on a wrong answer', () => {
    expect(applyReview(fresh(), 'again', 1200, '63', now, { isCorrect: false }).personalBestMs).toBeUndefined();
  });
});

describe('applyReview — legacy state compatibility', () => {
  it('legacy state with only stabilityDays and fsrsDifficulty can be reviewed without crashing', () => {
    // Existing users may have records without the full ts-fsrs card envelope.
    const legacy: StudentItemState = {
      studentId: 's1', itemId: 'MUL_8x9', skillId: 'sk',
      attemptCount: 5, correctCount: 4, lastCorrect: true,
      lastLatencyMs: 2000, medianLatencyMs: 2200, ease: 2.5,
      stabilityDays: 7, fsrsDifficulty: 5,
      reps: 5, lapses: 1,
      difficulty: 0.8, masteryLevel: 'strong', mistakePatterns: [],
      lastSeenAt: '2026-05-25T10:00:00Z',
      nextDueAt: '2026-06-01T10:00:00Z',
    };
    expect(() => applyReview(legacy, 'good', 2000, '72', now, { isCorrect: true })).not.toThrow();
    const updated = applyReview(legacy, 'good', 2000, '72', now, { isCorrect: true });
    expect(updated.stabilityDays).toBeGreaterThan(0);
    expect(updated.reps).toBe(6);
  });

  it('state with stabilityDays=0 (uninitialised) is treated as a fresh card', () => {
    const unInit: StudentItemState = {
      ...fresh(),
      reps: 3, stabilityDays: 0, fsrsDifficulty: 0,
    };
    expect(() => applyReview(unInit, 'good', 2000, '72', now, { isCorrect: true })).not.toThrow();
  });

  it('does not throw when lastSeenAt is in the future (clock drift / Drive sync)', () => {
    // Regression: ts-fsrs throws FSRSValidationError for delta_t < 0. This can happen
    // when the device clock was set ahead when the item was last reviewed.
    const future = new Date(now.getTime() + 38 * MS_DAY); // 38 days in the future
    const driftState: StudentItemState = {
      studentId: 's1', itemId: 'MUL_8x9', skillId: 'sk',
      attemptCount: 10, correctCount: 9, lastCorrect: true,
      lastLatencyMs: 1500, medianLatencyMs: 1600, ease: 2.5,
      stabilityDays: 14, fsrsDifficulty: 4.5,
      reps: 10, lapses: 0, fsrsCardState: 2,
      difficulty: 0.6, masteryLevel: 'strong', mistakePatterns: [],
      lastSeenAt: future.toISOString(),
      nextDueAt: future.toISOString(),
    };
    expect(() => applyReview(driftState, 'good', 1500, '72', now, { isCorrect: true })).not.toThrow();
    const updated = applyReview(driftState, 'good', 1500, '72', now, { isCorrect: true });
    // After clamping, the next due date should be in the future from now
    expect(new Date(updated.lastSeenAt!).getTime()).toBeLessThanOrEqual(now.getTime());
  });
});

// ── Retry behaviour ───────────────────────────────────────────────────────────
// These tests exercise the pure scheduler logic. Integration of retry-skipping
// in usePracticeSession and eventRebuild is covered by their own test files.

describe('applyReview — retry semantics', () => {
  it('applying applyReview twice represents two independent reviews (not retries)', () => {
    // In usePracticeSession, applyReview is only called once per question
    // presentation. Two separate calls here simulate two separate sessions.
    const first = applyReview(fresh(), 'again', 1000, '63', now, { isCorrect: false });
    const second = applyReview(first, 'good', 2000, '72', now, { isCorrect: true });
    // Second call should show improvement
    expect(second.correctCount).toBe(1);
    expect(second.attemptCount).toBe(2);
  });
});

// ── mastery / planning ────────────────────────────────────────────────────────

describe('updateMasteryLevel', () => {
  const base: StudentItemState = {
    studentId: 's1', itemId: 'x', skillId: 'sk',
    attemptCount: 0, correctCount: 0, lastCorrect: false,
    lastLatencyMs: 0, medianLatencyMs: 0, ease: 2.5,
    stabilityDays: 1, difficulty: 0.5, masteryLevel: 'new', mistakePatterns: [],
  };
  it('no attempts → new', () => expect(updateMasteryLevel(base)).toBe('new'));
  it('low accuracy → learning', () =>
    expect(updateMasteryLevel({ ...base, attemptCount: 4, correctCount: 1, stabilityDays: 2 })).toBe('learning'));
  it('high accuracy + long stability → mastered', () =>
    expect(updateMasteryLevel({ ...base, attemptCount: 20, correctCount: 19, stabilityDays: 20 })).toBe('mastered'));
  it('mid → developing', () =>
    expect(updateMasteryLevel({ ...base, attemptCount: 10, correctCount: 7, stabilityDays: 5 })).toBe('developing'));
});

describe('planSession', () => {
  const pool = generateMultiplicationItems().slice(0, 30);

  it('all unseen → fills new bucket', () => {
    const plan = planSession(pool, new Map(), now, 20);
    const total = plan.dueItems.length + plan.weakItems.length + plan.newItems.length;
    expect(total).toBeLessThanOrEqual(20);
    expect(plan.newItems.length).toBeGreaterThan(0);
  });

  it('backfills to reach totalQuestions when pools are small (regression: n=3 gave 1 question)', () => {
    const states = new Map<string, StudentItemState>();
    states.set(pool[0].id, {
      ...createInitialState('s1', pool[0]),
      attemptCount: 3, correctCount: 2, masteryLevel: 'developing',
      nextDueAt: new Date('2026-05-01T10:00:00Z').toISOString(),
    });
    const plan = planSession(pool, states, now, 3);
    const total = plan.dueItems.length + plan.weakItems.length + plan.newItems.length;
    expect(total).toBe(3);
  });

  it('due items are included', () => {
    const states = new Map<string, StudentItemState>();
    states.set(pool[0].id, {
      ...createInitialState('s1', pool[0]),
      attemptCount: 3, correctCount: 2, masteryLevel: 'developing',
      nextDueAt: new Date('2026-05-01T10:00:00Z').toISOString(),
    });
    expect(planSession(pool, states, now, 20).dueItems).toContain(pool[0].id);
  });

  it('weak (learning/developing) items are included', () => {
    const states = new Map<string, StudentItemState>();
    states.set(pool[0].id, {
      ...createInitialState('s1', pool[0]),
      attemptCount: 4, correctCount: 2, masteryLevel: 'learning',
      nextDueAt: new Date('2027-01-01').toISOString(), // not due yet
    });
    const plan = planSession(pool, states, now, 20);
    expect(plan.weakItems).toContain(pool[0].id);
  });

  it('new items are included', () => {
    // pool is all new — newItems bucket should have entries
    const plan = planSession(pool, new Map(), now, 20);
    expect(plan.newItems.length).toBeGreaterThan(0);
  });

  it('mastered items with future due date are NOT in the queue (pending FSRS review)', () => {
    const states = new Map<string, StudentItemState>();
    states.set(pool[0].id, {
      ...createInitialState('s1', pool[0]),
      attemptCount: 20, correctCount: 19, masteryLevel: 'mastered',
      nextDueAt: new Date('2027-01-01').toISOString(),
    });
    const plan = planSession(pool, states, now, 20);
    expect([...plan.dueItems, ...plan.weakItems, ...plan.newItems]).not.toContain(pool[0].id);
  });

  it('mastered items whose FSRS due date has arrived ARE included in due bucket', () => {
    const states = new Map<string, StudentItemState>();
    states.set(pool[0].id, {
      ...createInitialState('s1', pool[0]),
      attemptCount: 20, correctCount: 19, masteryLevel: 'mastered',
      nextDueAt: new Date('2026-05-01T10:00:00Z').toISOString(), // past due
    });
    expect(planSession(pool, states, now, 20).dueItems).toContain(pool[0].id);
  });
});

describe('planTableSession', () => {
  const pool = generateSingleTableItems(7);
  it('returns exactly count items', () => {
    expect(planTableSession(pool, 10).length).toBe(10);
    expect(planTableSession(pool, 25).length).toBe(25);
  });
  it('uses items from the pool', () => {
    const ids = new Set(pool.map(i => i.id));
    expect(planTableSession(pool, 25).every(id => ids.has(id))).toBe(true);
  });
  it('empty pool → empty queue', () => expect(planTableSession([], 10)).toEqual([]));
});

// ── Rebuild consistency: non-retry events produce the same result as live practice ──

describe('rebuild consistency', () => {
  it('replaying non-retry events matches live applyReview calls', () => {
    // Simulate live practice: apply three first-attempt reviews.
    const t1 = new Date('2026-06-01T10:00:00Z');
    const t2 = new Date('2026-06-04T10:00:00Z');
    const t3 = new Date('2026-06-10T10:00:00Z');

    const live1 = applyReview(fresh(), 'good', 2000, '72', t1, { isCorrect: true });
    const live2 = applyReview(live1,  'easy', 1500, '72', t2, { isCorrect: true });
    const live3 = applyReview(live2,  'hard', 4500, '72', t3, { isCorrect: true });

    // Simulate rebuild from events (same grades, same times, no retries).
    const events = [
      { reviewGrade: 'good' as const, latencyMs: 2000, studentAnswer: '72', isCorrect: true, isRetry: false, createdAt: t1.toISOString() },
      { reviewGrade: 'easy' as const, latencyMs: 1500, studentAnswer: '72', isCorrect: true, isRetry: false, createdAt: t2.toISOString() },
      { reviewGrade: 'hard' as const, latencyMs: 4500, studentAnswer: '72', isCorrect: true, isRetry: false, createdAt: t3.toISOString() },
    ];

    let rebuilt = fresh();
    for (const e of events) {
      if (e.isRetry) continue;
      rebuilt = applyReview(rebuilt, e.reviewGrade, e.latencyMs, e.studentAnswer, new Date(e.createdAt), { isCorrect: e.isCorrect });
    }

    expect(rebuilt.stabilityDays).toBeCloseTo(live3.stabilityDays, 6);
    expect(rebuilt.fsrsDifficulty).toBeCloseTo(live3.fsrsDifficulty!, 6);
    expect(rebuilt.reps).toBe(live3.reps);
    expect(rebuilt.lapses).toBe(live3.lapses);
  });

  it('retry events skipped during rebuild leave state unchanged', () => {
    const t1 = new Date('2026-06-01T10:00:00Z');
    const afterFirst = applyReview(fresh(), 'again', 1000, '63', t1, { isCorrect: false });

    // A retry event should not alter state further.
    const events = [
      { reviewGrade: 'again' as const, latencyMs: 1000, studentAnswer: '63', isCorrect: false, isRetry: false, createdAt: t1.toISOString() },
      { reviewGrade: 'good' as const,  latencyMs: 2000, studentAnswer: '72', isCorrect: true,  isRetry: true,  createdAt: t1.toISOString() }, // retry — must be skipped
    ];

    let rebuilt = fresh();
    for (const e of events) {
      if (e.isRetry) continue;
      rebuilt = applyReview(rebuilt, e.reviewGrade, e.latencyMs, e.studentAnswer, new Date(e.createdAt), { isCorrect: e.isCorrect });
    }

    expect(rebuilt.stabilityDays).toBeCloseTo(afterFirst.stabilityDays, 6);
    expect(rebuilt.correctCount).toBe(afterFirst.correctCount); // still 0
    expect(rebuilt.attemptCount).toBe(afterFirst.attemptCount); // still 1
  });
});

// ── Retry isolation: FSRS updated exactly once per question presentation ──────

describe('retry isolation', () => {
  it('wrong first attempt + correct retry: FSRS is updated only for the first attempt', () => {
    // usePracticeSession calls applyReview only when attemptNo === 1.
    // The retry is logged (isRetry=true) but does not call applyReview.
    const afterWrongFirst = applyReview(fresh(), 'again', 1000, '63', now, { isCorrect: false });

    // Correct behaviour: state after the session = afterWrongFirst (retry not applied).
    expect(afterWrongFirst.attemptCount).toBe(1);
    expect(afterWrongFirst.correctCount).toBe(0);

    // Wrong behaviour would be applying applyReview a second time for the retry:
    const ifRetryAlsoApplied = applyReview(afterWrongFirst, 'good', 2000, '72', now, { isCorrect: true });
    // That would produce correctCount=1 and reps=2 — incorrect.
    expect(ifRetryAlsoApplied.correctCount).toBe(1);
    expect(ifRetryAlsoApplied.reps).toBe(2);

    // The retry does not update FSRS: reps stays at 1, correctCount stays at 0.
    expect(afterWrongFirst.reps).toBe(1);
    expect(afterWrongFirst.correctCount).toBe(0);
  });

  it('rebuild after wrong first + correct retry matches what live practice stored', () => {
    const t1 = new Date('2026-06-01T10:00:00Z');
    // Live practice: only first attempt ('again') updates FSRS.
    const liveState = applyReview(fresh(), 'again', 1000, '63', t1, { isCorrect: false });

    // Events logged: wrong first attempt + correct retry.
    const events = [
      { reviewGrade: 'again' as const, latencyMs: 1000, studentAnswer: '63', isCorrect: false, isRetry: false, createdAt: t1.toISOString() },
      { reviewGrade: 'good'  as const, latencyMs: 2000, studentAnswer: '72', isCorrect: true,  isRetry: true,  createdAt: t1.toISOString() },
    ];

    // Rebuild skips isRetry=true events, matching live practice.
    let rebuilt = fresh();
    for (const e of events) {
      if (e.isRetry) continue;
      rebuilt = applyReview(rebuilt, e.reviewGrade, e.latencyMs, e.studentAnswer, new Date(e.createdAt), { isCorrect: e.isCorrect });
    }

    expect(rebuilt.stabilityDays).toBeCloseTo(liveState.stabilityDays, 6);
    expect(rebuilt.fsrsDifficulty).toBeCloseTo(liveState.fsrsDifficulty!, 6);
    expect(rebuilt.reps).toBe(liveState.reps);
    expect(rebuilt.correctCount).toBe(liveState.correctCount); // 0
    expect(rebuilt.attemptCount).toBe(liveState.attemptCount); // 1
  });
});

// ── FSRS card envelope: fsrsCardState, fsrsScheduledDays, fsrsLearningSteps ───

describe('applyReview — FSRS card envelope persists across reviews', () => {
  it('stores fsrsCardState, fsrsScheduledDays, and fsrsLearningSteps after first review', () => {
    const s = applyReview(fresh(), 'good', 2000, '72', now, { isCorrect: true });
    expect(s.fsrsCardState).toBeDefined();
    expect(s.fsrsScheduledDays).toBeDefined();
    expect(s.fsrsScheduledDays).toBeGreaterThan(0);
    expect(s.fsrsLearningSteps).toBeDefined();
    // learning_steps is always 0 with enable_short_term=false
    expect(s.fsrsLearningSteps).toBe(0);
  });

  it('fsrsScheduledDays grows on successive correct reviews', () => {
    const t1 = now;
    const first = applyReview(fresh(), 'good', 2000, '72', t1, { isCorrect: true });
    const t2 = new Date(t1.getTime() + first.stabilityDays * MS_DAY);
    const second = applyReview(first, 'good', 2000, '72', t2, { isCorrect: true });
    expect(second.fsrsScheduledDays!).toBeGreaterThan(first.fsrsScheduledDays!);
    expect(second.stabilityDays).toBeGreaterThan(first.stabilityDays);
  });

  it('stored fsrsScheduledDays is used in reconstruction — result matches direct chain', () => {
    // Apply two reviews in sequence using stored envelope fields.
    const t1 = now;
    const first = applyReview(fresh(), 'good', 2000, '72', t1, { isCorrect: true });
    const t2 = new Date(t1.getTime() + first.stabilityDays * MS_DAY);
    const direct = applyReview(first, 'good', 2000, '72', t2, { isCorrect: true });

    // Erase stored envelope (simulate a legacy record) — stateToCard falls back to deriving
    // scheduledDays from dates and assumes State.Review. For a Review card the result matches.
    const legacy = { ...first, fsrsCardState: undefined, fsrsScheduledDays: undefined, fsrsLearningSteps: undefined };
    const fromLegacy = applyReview(legacy, 'good', 2000, '72', t2, { isCorrect: true });

    expect(direct.stabilityDays).toBeCloseTo(fromLegacy.stabilityDays, 4);
    expect(direct.reps).toBe(fromLegacy.reps);
  });

  it('card envelope fields survive three consecutive reviews', () => {
    const t1 = now;
    const r1 = applyReview(fresh(), 'good', 2000, '72', t1, { isCorrect: true });
    const t2 = new Date(t1.getTime() + r1.stabilityDays * MS_DAY);
    const r2 = applyReview(r1, 'good', 2000, '72', t2, { isCorrect: true });
    const t3 = new Date(t2.getTime() + r2.stabilityDays * MS_DAY);
    const r3 = applyReview(r2, 'good', 2000, '72', t3, { isCorrect: true });

    expect(r3.fsrsCardState).toBeDefined();
    expect(r3.fsrsScheduledDays!).toBeGreaterThan(r2.fsrsScheduledDays!);
    expect(r3.fsrsLearningSteps).toBe(0);
    expect(r3.reps).toBe(3);
  });

  it('lapse preserves card envelope (fsrsCardState, lapses incremented)', () => {
    const first = applyReview(fresh(), 'easy', 1000, '72', now, { isCorrect: true });
    const later = new Date(now.getTime() + first.stabilityDays * MS_DAY);
    const lapsed = applyReview(first, 'again', 5000, '0', later, { isCorrect: false });

    expect(lapsed.fsrsCardState).toBeDefined();
    expect(lapsed.fsrsScheduledDays).toBeDefined();
    expect(lapsed.lapses).toBe(1);
    // Stability shrinks after a lapse
    expect(lapsed.stabilityDays).toBeLessThan(first.stabilityDays);
  });
});

// ── Quiz event isolation: quiz answers must not feed FSRS itemStates ──────────

describe('quiz event isolation', () => {
  it('quiz events (mode=quiz) are excluded from FSRS itemState rebuilds — design decision', () => {
    // rebuildItemStatesFromEvents filters: .and(e => e.mode === 'practice')
    // Quiz answers feed multFactStats (mastery scores); practice answers feed itemStates (FSRS).
    // This test documents the invariant by simulating the mode filter.
    const practiceEvent = { reviewGrade: 'good' as const, latencyMs: 2000, studentAnswer: '72', isCorrect: true, isRetry: false, mode: 'practice', createdAt: now.toISOString() };
    const quizEvent    = { reviewGrade: 'easy' as const, latencyMs: 1000, studentAnswer: '72', isCorrect: true, isRetry: false, mode: 'quiz',     createdAt: now.toISOString() };

    let state = fresh();
    for (const e of [practiceEvent, quizEvent]) {
      if (e.mode !== 'practice' || e.isRetry) continue;
      state = applyReview(state, e.reviewGrade, e.latencyMs, e.studentAnswer, new Date(e.createdAt), { isCorrect: e.isCorrect });
    }

    // Only the practice event was applied — reps=1, not 2.
    expect(state.reps).toBe(1);
  });
});
