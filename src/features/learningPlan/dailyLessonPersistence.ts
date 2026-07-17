import { db } from '../../db/dexie';
import type { PersistedDailyLessonPlan } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { DAILY_LESSON_PLANNER_VERSION } from '../learning/schedulingTelemetry';
import { learnerLocalDateKey } from '../time/localDate';
import { planDailyLesson, type PlanDailyLessonArgs } from './dailyLessonPlanner';

export function dailyLessonSemanticKey(studentId: string, localDate: string, revision: number): string {
  return `${studentId}|${localDate}|${revision}`;
}

export function hashDailyLessonContent(items: PersistedDailyLessonPlan['items']): string {
  const source = JSON.stringify(items);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function materialize(args: PlanDailyLessonArgs, revision: number): PersistedDailyLessonPlan {
  const planned = planDailyLesson(args);
  const localDate = learnerLocalDateKey(new Date(args.now), args.timezone);
  const id = `${planned.id}:r${revision}`;
  const items = planned.items.map(value => ({
    ...value,
    selection: { ...value.selection, lessonPlanId: id },
  }));
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
    items,
    completedItemInstanceIds: [],
    scheduledCardKeys: [],
    semanticKey: dailyLessonSemanticKey(args.studentId, localDate, revision),
    contentHash: hashDailyLessonContent(items),
    warnings: planned.warnings,
  };
}

export async function getOrCreateDailyLessonPlan(args: PlanDailyLessonArgs): Promise<PersistedDailyLessonPlan> {
  const localDate = learnerLocalDateKey(new Date(args.now), args.timezone);
  return db.transaction('rw', db.dailyLessonPlans, async () => {
    const existing = await db.dailyLessonPlans.where('[studentId+localDate]').equals([args.studentId, localDate]).toArray();
    const active = existing.filter(plan => plan.status !== 'replaced').sort((a, b) => b.revision - a.revision)[0];
    if (active) return active;
    const plan = materialize(args, Math.max(0, ...existing.map(value => value.revision)) + 1);
    const sameSemantic = existing.find(value => (value.semanticKey ?? dailyLessonSemanticKey(value.studentId, value.localDate, value.revision)) === plan.semanticKey);
    if (sameSemantic) return sameSemantic;
    await db.dailyLessonPlans.add(plan);
    return plan;
  });
}

export async function regenerateDailyLessonPlan(args: PlanDailyLessonArgs): Promise<PersistedDailyLessonPlan> {
  const localDate = learnerLocalDateKey(new Date(args.now), args.timezone);
  return db.transaction('rw', db.dailyLessonPlans, async () => {
    const existing = await db.dailyLessonPlans.where('[studentId+localDate]').equals([args.studentId, localDate]).toArray();
    const next = materialize(args, Math.max(0, ...existing.map(value => value.revision)) + 1);
    for (const plan of existing.filter(value => value.status !== 'replaced')) {
      await db.dailyLessonPlans.put({ ...plan, status: 'replaced', replacedByPlanId: next.id, updatedAt: args.now });
    }
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
    await db.dailyLessonPlans.put({ ...plan, status: 'in_progress', completedItemInstanceIds, scheduledCardKeys: plan.scheduledCardKeys ?? [], updatedAt: now });
  });
}

export async function markDailyLessonProgressFromEvent(event: MathAnswerEvent): Promise<'not_applicable' | 'updated' | 'already_updated'> {
  if (!event.lessonPlanId) return 'not_applicable';
  const itemInstanceId = event.itemInstanceId ?? event.itemId;
  return db.transaction('rw', db.dailyLessonPlans, async () => {
    const plan = await db.dailyLessonPlans.get(event.lessonPlanId!);
    if (!plan || plan.status === 'replaced') throw new Error(`Daily lesson plan is unavailable: ${event.lessonPlanId}`);
    const itemExists = plan.items.some(entry => (entry.item.instanceKey ?? entry.item.id) === itemInstanceId);
    if (!itemExists) throw new Error(`Daily lesson item is unavailable: ${itemInstanceId}`);
    const alreadyCompleted = plan.completedItemInstanceIds.includes(itemInstanceId);
    const scheduledCardKeys = event.schedulingApplied && event.cardKey
      ? [...new Set([...(plan.scheduledCardKeys ?? []), event.cardKey])]
      : plan.scheduledCardKeys ?? [];
    const schedulingAlreadyRecorded = !event.schedulingApplied || !event.cardKey || scheduledCardKeys.length === (plan.scheduledCardKeys ?? []).length;
    if (alreadyCompleted && schedulingAlreadyRecorded) return 'already_updated';
    await db.dailyLessonPlans.put({
      ...plan, status: 'in_progress',
      completedItemInstanceIds: alreadyCompleted ? plan.completedItemInstanceIds : [...plan.completedItemInstanceIds, itemInstanceId],
      scheduledCardKeys,
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
    const scheduled = new Set(plan.scheduledCardKeys ?? []);
    for (const event of events) if (event.itemInstanceId && validIds.has(event.itemInstanceId)) completed.add(event.itemInstanceId);
    for (const event of events) if (event.schedulingApplied && event.cardKey) scheduled.add(event.cardKey);
    const completedItemInstanceIds = [...completed];
    const status = completedItemInstanceIds.length >= plan.items.length ? 'completed' as const : completedItemInstanceIds.length ? 'in_progress' as const : plan.status;
    const scheduledCardKeys = [...scheduled];
    if (completedItemInstanceIds.length === plan.completedItemInstanceIds.length && scheduledCardKeys.length === (plan.scheduledCardKeys ?? []).length && status === plan.status) return plan;
    const updated = { ...plan, completedItemInstanceIds, scheduledCardKeys, status, updatedAt: events.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1)?.createdAt ?? plan.updatedAt };
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
