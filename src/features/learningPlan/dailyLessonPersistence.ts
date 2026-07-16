import { db } from '../../db/dexie';
import type { PersistedDailyLessonPlan } from '../../types/math';
import { DAILY_LESSON_PLANNER_VERSION } from '../learning/schedulingTelemetry';
import { learnerLocalDateKey } from '../time/localDate';
import { planDailyLesson, type PlanDailyLessonArgs } from './dailyLessonPlanner';

function materialize(args: PlanDailyLessonArgs, revision: number): PersistedDailyLessonPlan {
  const planned = planDailyLesson(args);
  const localDate = learnerLocalDateKey(new Date(args.now), args.timezone);
  const id = `${planned.id}:r${revision}`;
  return {
    id,
    studentId: args.studentId,
    localDate,
    timezone: args.timezone,
    plannerVersion: DAILY_LESSON_PLANNER_VERSION,
    revision,
    generatedAt: args.now,
    updatedAt: args.now,
    status: 'planned',
    focusSkillId: planned.focusSkillId,
    focusSkillTitle: planned.focusSkillTitle,
    estimatedMinutes: planned.estimatedMinutes,
    items: planned.items.map(value => ({
      ...value,
      selection: { ...value.selection, lessonPlanId: id },
    })),
    completedItemInstanceIds: [],
    warnings: planned.warnings,
  };
}

export async function getOrCreateDailyLessonPlan(args: PlanDailyLessonArgs): Promise<PersistedDailyLessonPlan> {
  const localDate = learnerLocalDateKey(new Date(args.now), args.timezone);
  const existing = await db.dailyLessonPlans.where('[studentId+localDate]').equals([args.studentId, localDate]).toArray();
  const active = existing
    .filter(plan => plan.status !== 'replaced')
    .sort((a, b) => b.revision - a.revision)[0];
  if (active) return active;
  const plan = materialize(args, Math.max(0, ...existing.map(value => value.revision)) + 1);
  await db.dailyLessonPlans.put(plan);
  return plan;
}

export async function regenerateDailyLessonPlan(args: PlanDailyLessonArgs): Promise<PersistedDailyLessonPlan> {
  const localDate = learnerLocalDateKey(new Date(args.now), args.timezone);
  return db.transaction('rw', db.dailyLessonPlans, async () => {
    const existing = await db.dailyLessonPlans.where('[studentId+localDate]').equals([args.studentId, localDate]).toArray();
    for (const plan of existing.filter(value => value.status !== 'replaced')) {
      await db.dailyLessonPlans.put({ ...plan, status: 'replaced', updatedAt: args.now });
    }
    const next = materialize(args, Math.max(0, ...existing.map(value => value.revision)) + 1);
    await db.dailyLessonPlans.put(next);
    return next;
  });
}

export async function markDailyLessonProgress(planId: string, itemInstanceId: string, now = new Date().toISOString()): Promise<void> {
  await db.transaction('rw', db.dailyLessonPlans, async () => {
    const plan = await db.dailyLessonPlans.get(planId);
    if (!plan || plan.status === 'completed' || plan.status === 'replaced') return;
    const completedItemInstanceIds = plan.completedItemInstanceIds.includes(itemInstanceId)
      ? plan.completedItemInstanceIds
      : [...plan.completedItemInstanceIds, itemInstanceId];
    await db.dailyLessonPlans.put({ ...plan, status: 'in_progress', completedItemInstanceIds, updatedAt: now });
  });
}

export async function completeDailyLessonPlan(planId: string, now = new Date().toISOString()): Promise<void> {
  await db.transaction('rw', db.dailyLessonPlans, async () => {
    const plan = await db.dailyLessonPlans.get(planId);
    if (!plan || plan.status === 'replaced') return;
    await db.dailyLessonPlans.put({ ...plan, status: 'completed', updatedAt: now });
  });
}
