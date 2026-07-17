import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { completeDailyLessonPlan, getOrCreateDailyLessonPlan, markDailyLessonProgress, markDailyLessonProgressFromEvent, reconcileDailyLessonProgress, regenerateDailyLessonPlan } from '../features/learningPlan/dailyLessonPersistence';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { learnerLocalDateKey } from '../features/time/localDate';
import type { StudentSettings } from '../types/math';
import { mulberry32 } from '../utils/rng';

const settings: StudentSettings = { audioEnabled: true, speechRate: 1, dailyGoalMinutes: 10, sessionLength: 10, autoAdvance: true, theme: 'indigo', allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false };
const base = (now: string) => ({
  studentId: 'lesson-persist-student', gradeLevel: 3 as const, now, timezone: 'America/Los_Angeles', settings,
  events: [], itemStates: [], goals: [], rng: mulberry32(7),
  skillSummaries: [{ studentId: 'lesson-persist-student', skillId: 'g3-frac-unit', status: 'new' as const, attemptCount: 0, correctCount: 0, accuracy: 0, dueItemCount: 0, itemCount: 0, mistakePatterns: [] }],
});

beforeAll(async () => { if (!db.isOpen()) await db.open(); });
beforeEach(async () => { await db.dailyLessonPlans.clear(); await db.mathAnswerEvents.clear(); });

describe('learner-local persisted daily lessons', () => {
  it('uses Los Angeles local dates across UTC midnight and DST transitions', () => {
    expect(learnerLocalDateKey(new Date('2026-07-17T00:30:00.000Z'), 'America/Los_Angeles')).toBe('2026-07-16');
    expect(learnerLocalDateKey(new Date('2026-03-08T09:30:00.000Z'), 'America/Los_Angeles')).toBe('2026-03-08');
    expect(learnerLocalDateKey(new Date('2026-11-01T08:30:00.000Z'), 'America/Los_Angeles')).toBe('2026-11-01');
  });

  it('returns an immutable revision on reload and resumes saved progress', async () => {
    const args = base('2026-07-17T00:30:00.000Z');
    const first = await getOrCreateDailyLessonPlan(args);
    await markDailyLessonProgress(first.id, first.items[0].item.id, '2026-07-17T00:31:00.000Z');
    const resumed = await getOrCreateDailyLessonPlan({ ...args, rng: mulberry32(999) });
    expect(resumed.id).toBe(first.id);
    expect(resumed.items).toEqual(first.items);
    expect(resumed.completedItemInstanceIds).toEqual([first.items[0].item.id]);
  });

  it('atomically returns one active revision to concurrent callers', async () => {
    const args = base('2026-07-17T00:30:00.000Z');
    const plans = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      getOrCreateDailyLessonPlan({ ...args, rng: mulberry32(index + 1) })));
    expect(new Set(plans.map(plan => plan.id))).toEqual(new Set([plans[0].id]));
    expect((await db.dailyLessonPlans.toArray()).filter(plan => plan.status !== 'replaced')).toHaveLength(1);
  });

  it('creates a new explicit revision while preserving the replaced plan', async () => {
    const args = base('2026-07-17T00:30:00.000Z');
    const first = await getOrCreateDailyLessonPlan(args);
    const second = await regenerateDailyLessonPlan({ ...args, rng: mulberry32(12) });
    expect(second.revision).toBe(2);
    expect(second.id).not.toBe(first.id);
    expect((await db.dailyLessonPlans.get(first.id))?.status).toBe('replaced');
    expect(await db.dailyLessonPlans.count()).toBe(2);
  });

  it('returns the completed revision on the same local day without regenerating', async () => {
    const args = base('2026-07-17T00:30:00.000Z');
    const first = await getOrCreateDailyLessonPlan(args);
    await completeDailyLessonPlan(first.id, '2026-07-17T01:00:00.000Z');
    const sameDay = await getOrCreateDailyLessonPlan({ ...args, rng: mulberry32(100) });
    expect(sameDay.id).toBe(first.id);
    expect(sameDay.status).toBe('completed');
  });

  it('creates a new plan on the next learner-local day', async () => {
    const first = await getOrCreateDailyLessonPlan(base('2026-07-17T00:30:00.000Z'));
    const next = await getOrCreateDailyLessonPlan(base('2026-07-17T08:30:00.000Z'));
    expect(next.localDate).not.toBe(first.localDate);
    expect(next.id).not.toBe(first.id);
  });

  it('marks progress from a canonical event and reconciles the same event idempotently', async () => {
    const plan = await getOrCreateDailyLessonPlan(base('2026-07-17T00:30:00.000Z'));
    const itemInstanceId = plan.items[0].item.instanceKey ?? plan.items[0].item.id;
    const event = {
      id: 'lesson-answer', studentId: plan.studentId, sessionId: 'session-1', itemId: plan.items[0].item.id,
      itemInstanceId, lessonPlanId: plan.id, mode: 'practice', promptShown: 'prompt', correctAnswer: 1,
      studentAnswer: 1, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000,
      createdAt: '2026-07-17T00:31:00.000Z', cardKey: plan.items[0].cardKey, schedulingApplied: true,
    } as MathAnswerEvent;
    expect(await markDailyLessonProgressFromEvent(event)).toBe('updated');
    expect(await markDailyLessonProgressFromEvent(event)).toBe('already_updated');
    expect((await db.dailyLessonPlans.get(plan.id))?.scheduledCardKeys).toContain(plan.items[0].cardKey);

    await db.dailyLessonPlans.put({ ...plan, completedItemInstanceIds: [], scheduledCardKeys: [], status: 'planned' });
    await db.mathAnswerEvents.put(event);
    const repaired = await reconcileDailyLessonProgress(plan.studentId, plan.id);
    expect(repaired?.completedItemInstanceIds).toContain(itemInstanceId);
    expect(repaired?.scheduledCardKeys).toContain(plan.items[0].cardKey);
    expect((await reconcileDailyLessonProgress(plan.studentId, plan.id))?.completedItemInstanceIds).toEqual(repaired?.completedItemInstanceIds);
  });
});
