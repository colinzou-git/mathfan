import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import {
  CanonicalEventConflictError, canonicalEventFingerprint, mergeCanonicalEvents,
} from '../features/sync/canonicalEventMerge';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { rebuildItemStatesFromEvents } from '../features/learning/eventRebuild';
import { canonicalDailyLessonPlanId, LEARNER_OWNED_TABLES, mergeSnapshot, type AppSnapshot } from '../features/sync/snapshot';
import type { PersistedDailyLessonPlan, StudentProfile } from '../types/math';

function profile(id: string, learnerKey = id): StudentProfile {
  return {
    id, learnerKey, displayName: id, gradeLevel: 3, timezone: 'UTC', createdAt: '2026-01-01T00:00:00Z',
    settings: { audioEnabled: true, speechRate: 1, dailyGoalMinutes: 10, sessionLength: 10, autoAdvance: true,
      theme: 'indigo', allowTimedMode: true, competitionModeEnabled: false, parentModeEnabled: false },
  };
}

function event(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: 'event-1', studentId: 'student-1', sessionId: 'session-1', itemId: 'MUL_7x8', mode: 'practice',
    promptShown: '7x8', correctAnswer: 56, studentAnswer: 56, isCorrect: true, isRetry: false, hintUsed: false,
    latencyMs: 1000, reviewGrade: 'good', cardKey: 'fact:mul:7x8', schedulingEligible: true,
    schedulingApplied: true, createdAt: '2026-01-01T00:00:00Z', ...overrides,
  };
}

function snapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    appId: 'mathfan', snapshotVersion: 2, snapshotAt: '2026-01-02T00:00:00Z', students: [], itemStates: [],
    attempts: [], sessions: [], multFactStats: [], quizSessions: [], mathAnswerEvents: [], learningGoals: [],
    goalEvents: [], goalEvaluations: [], dailyLessonPlans: [], ...overrides,
  };
}

async function clearAll() {
  await db.students.clear();
  for (const table of Object.values(LEARNER_OWNED_TABLES)) await table.clear();
}

beforeEach(clearAll);
afterEach(clearAll);

describe('canonical event semantic merge', () => {
  it('deduplicates equivalent events and normalizes set-like array ordering', () => {
    const local = event({ goalIds: ['goal-b', 'goal-a'], selectionRationaleCodes: ['weak', 'due'] });
    const remote = event({ goalIds: ['goal-a', 'goal-b', 'goal-a'], selectionRationaleCodes: ['due', 'weak'] });
    expect(canonicalEventFingerprint(local)).toBe(canonicalEventFingerprint(remote));
    expect(mergeCanonicalEvents([local], [remote])).toHaveLength(1);
  });

  it.each([
    ['studentAnswer', { studentAnswer: 55 }],
    ['isCorrect', { isCorrect: false }],
    ['reviewGrade', { reviewGrade: 'again' as const }],
    ['schedulingApplied', { schedulingApplied: false }],
    ['schedulingKind', { schedulingKind: 'relearning_step' as const }],
    ['relearningFromEventId', { relearningFromEventId: 'different-parent' }],
    ['createdAt', { createdAt: '2026-01-02T00:00:00Z' }],
  ])('rejects a conflicting %s without exposing answer values', (field, overrides) => {
    let thrown: unknown;
    try { mergeCanonicalEvents([event()], [event(overrides)]); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(CanonicalEventConflictError);
    const conflict = thrown as CanonicalEventConflictError;
    expect(conflict.details.differingFields).toContain(field);
    expect(conflict.message).not.toContain('55');
    expect(JSON.stringify(conflict.details)).not.toContain('55');
  });

  it('retains compatible optional metadata defined on only one side', () => {
    const schedulingTelemetry = { version: 1, cardKey: 'fact:mul:7x8' } as never;
    const local = event({ schedulingTelemetry });
    const remote = event({ lessonRationale: 'remote-compatible-context' });
    const merged = mergeCanonicalEvents([local], [remote])[0];
    expect(merged.schedulingTelemetry).toBe(schedulingTelemetry);
    expect(merged.lessonRationale).toBe('remote-compatible-context');
  });

  it('rejects incompatible telemetry when both copies define it', () => {
    const left = event({ schedulingTelemetry: { version: 1, cardKey: 'left' } as never });
    const right = event({ schedulingTelemetry: { version: 1, cardKey: 'right' } as never });
    expect(() => mergeCanonicalEvents([left], [right])).toThrow(CanonicalEventConflictError);
  });
});

describe('snapshot canonical event conflicts', () => {
  it('accepts the same event after duplicate learner ids remap to one owner', async () => {
    await db.students.put(profile('local-id', 'shared-key'));
    const localPlan: PersistedDailyLessonPlan = {
      id: 'local-plan', studentId: 'local-id', localDate: '2026-01-01', timezone: 'UTC', plannerVersion: 'test', revision: 1,
      generatedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', status: 'planned', estimatedMinutes: 5,
      items: [], completedItemInstanceIds: [], warnings: [],
    };
    const remotePlan = { ...localPlan, id: 'remote-plan', studentId: 'remote-id' };
    const telemetry = (lessonPlanId: string) => ({
      version: 1 as const, learnerKey: 'shared-key', cardKey: 'fact:mul:7x8', cardKind: 'atomic_fact' as const,
      schemaId: 'mul', itemInstanceId: 'instance', presentationIndex: 1, attemptNo: 1, schedulingEligible: true,
      schedulingApplied: true, evidenceKind: 'direct' as const, supportLevel: 'independent' as const,
      selection: { origin: 'focus_skill' as const, rationaleCodes: ['weak', 'due'], lessonPlanId },
      rating: { reviewGrade: 'good' as const }, instance: { difficulty: 1 },
    });
    await db.dailyLessonPlans.put(localPlan);
    await db.mathAnswerEvents.put(event({ studentId: 'local-id', lessonPlanId: localPlan.id, schedulingTelemetry: telemetry(localPlan.id) }));
    await mergeSnapshot(snapshot({
      students: [profile('remote-id', 'shared-key')],
      dailyLessonPlans: [remotePlan],
      mathAnswerEvents: [event({ studentId: 'remote-id', lessonPlanId: remotePlan.id,
        schedulingTelemetry: { ...telemetry(remotePlan.id), selection: { ...telemetry(remotePlan.id).selection, rationaleCodes: ['due', 'weak'] } } })],
    }));
    const merged = await db.mathAnswerEvents.get('event-1');
    const expectedPlanId = canonicalDailyLessonPlanId('local-id', '2026-01-01', 1);
    expect(merged).toMatchObject({ studentId: 'local-id', lessonPlanId: expectedPlanId });
    expect(merged?.schedulingTelemetry?.selection.lessonPlanId).toBe(expectedPlanId);
  });

  it('rejects a semantic conflict after owner remapping and rolls back every sync table', async () => {
    const local = profile('local-id', 'shared-key');
    await db.students.put(local);
    await db.mathAnswerEvents.put(event({ studentId: 'local-id' }));
    await db.learningGoals.put({ id: 'goal', studentId: 'local-id', title: 'Keep', source: 'manual', status: 'active',
      durationDays: 7, startDate: '2026-01-01', targetDate: '2026-01-08', targets: [],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
    const beforeStudents = await db.students.toArray();
    const beforeTables = Object.fromEntries(await Promise.all(Object.entries(LEARNER_OWNED_TABLES)
      .map(async ([name, table]) => [name, await table.toArray()])));

    await expect(mergeSnapshot(snapshot({
      students: [profile('remote-id', 'shared-key')],
      mathAnswerEvents: [event({ studentId: 'remote-id', studentAnswer: 55, isCorrect: false })],
    }))).rejects.toMatchObject({ code: 'canonical_event_conflict', details: { eventId: 'event-1' } });

    expect(await db.students.toArray()).toEqual(beforeStudents);
    const afterTables = Object.fromEntries(await Promise.all(Object.entries(LEARNER_OWNED_TABLES)
      .map(async ([name, table]) => [name, await table.toArray()])));
    expect(afterTables).toEqual(beforeTables);
  });

  it('leaves rebuilt event-derived state unchanged after an equivalent idempotent merge', async () => {
    const student = profile('student-1');
    const answer = event();
    await db.students.put(student);
    await db.mathAnswerEvents.put(answer);
    await rebuildItemStatesFromEvents(student.id);
    const before = await db.itemStates.toArray();
    await mergeSnapshot(snapshot({ students: [student], mathAnswerEvents: [answer] }));
    expect(await db.itemStates.toArray()).toEqual(before);
  });
});
