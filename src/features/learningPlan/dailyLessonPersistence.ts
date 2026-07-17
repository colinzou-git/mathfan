import { db } from '../../db/dexie';
import type { PersistedDailyLessonPlan } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
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

export async function markDailyLessonProgressFromEvent(event: MathAnswerEvent): Promise<'not_applicable' | 'updated' | 'already_updated'> {
  if (!event.lessonPlanId) return 'not_applicable';
  const itemInstanceId = event.itemInstanceId ?? event.itemId;
  return db.transaction('rw', db.dailyLessonPlans, async () => {
    const plan = await db.dailyLessonPlans.get(event.lessonPlanId!);
    if (!plan || plan.status === 'replaced') throw new Error(`Daily lesson plan is unavailable: ${event.lessonPlanId}`);
    if (plan.completedItemInstanceIds.includes(itemInstanceId)) return 'already_updated';
    const itemExists = plan.items.some(entry => (entry.item.instanceKey ?? entry.item.id) === itemInstanceId);
    if (!itemExists) throw new Error(`Daily lesson item is unavailable: ${itemInstanceId}`);
    await db.dailyLessonPlans.put({
      ...plan, status: 'in_progress',
      completedItemInstanceIds: [...plan.completedItemInstanceIds, itemInstanceId],
      updatedAt: event.createdAt,
    });
    return 'updated';
  });
}

/** Repairs plan progress only from durable canonical events with stable item-instance identity. */
export async function reconcileDailyLessonProgress(studentId: string, planId: string): Promise<PersistedDailyLessonPlan | undefined> {
  return db.transaction('rw', db.dailyLessonPlans, db.mathAnswerEvents, async () => {
    const plan = await db.dailyLessonPlans.get(planId);
    if (!plan || plan.studentId !== studentId || plan.status === 'replaced') return plan;
    const events = await db.mathAnswerEvents.where('studentId').equals(studentId)
      .and(event => event.lessonPlanId === planId && event.isCorrect && Boolean(event.itemInstanceId)).toArray();
    const validIds = new Set(plan.items.map(entry => entry.item.instanceKey ?? entry.item.id));
    const completed = new Set(plan.completedItemInstanceIds);
    for (const event of events) if (event.itemInstanceId && validIds.has(event.itemInstanceId)) completed.add(event.itemInstanceId);
    const completedItemInstanceIds = [...completed];
    const status = completedItemInstanceIds.length >= plan.items.length ? 'completed' as const : completedItemInstanceIds.length ? 'in_progress' as const : plan.status;
    if (completedItemInstanceIds.length === plan.completedItemInstanceIds.length && status === plan.status) return plan;
    const updated = { ...plan, completedItemInstanceIds, status, updatedAt: events.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)?.createdAt ?? plan.updatedAt };
    await db.dailyLessonPlans.put(updated);
    return updated;
  });
}

export async function completeDailyLessonPlan(planId: string, now = new Date().toISOString()): Promise<void> {
  await db.transaction('rw', db.dailyLessonPlans, async () => {
    const plan = await db.dailyLessonPlans.get(planId);
    if (!plan || plan.status === 'replaced') return;
    await db.dailyLessonPlans.put({ ...plan, status: 'completed', updatedAt: now });
  });
}
