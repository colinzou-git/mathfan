import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/dexie';
import { buildSnapshot, canonicalDailyLessonPlanId, findOrphanedStudentReferences, LEARNER_OWNED_TABLES, mergeSnapshot, SnapshotMergeError, type AppSnapshot } from '../features/sync/snapshot';
import { mergeProfilesByExactId, remapStudentId, resolveCanonicalStudentIds, resolveLearnerKeyDuplicate } from '../features/sync/learnerKeyMerge';
import type { PersistedDailyLessonPlan, StudentProfile } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { loadActiveProfileSelection, saveActiveProfileSelection } from '../features/profile/profileBootstrap';

function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: 'p1',
    displayName: 'Alex',
    gradeLevel: 3,
    timezone: 'UTC',
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: {
      audioEnabled: true,
      speechRate: 1,
      dailyGoalMinutes: 10,
      sessionLength: 10,
      autoAdvance: true,
      theme: 'indigo',
      allowTimedMode: true,
      competitionModeEnabled: false,
      parentModeEnabled: false,
    },
    ...overrides,
  };
}

function emptySnapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    appId: 'mathfan',
    snapshotVersion: 2,
    snapshotAt: new Date().toISOString(),
    students: [],
    itemStates: [],
    attempts: [],
    sessions: [],
    multFactStats: [],
    quizSessions: [],
    mathAnswerEvents: [],
    learningGoals: [],
    goalEvents: [],
    goalEvaluations: [],
    dailyLessonPlans: [],
    ...overrides,
  };
}

async function clearAll() {
  localStorage.clear();
  await db.students.clear();
  await db.itemStates.clear();
  await db.attempts.clear();
  await db.sessions.clear();
  await db.multFactStats.clear();
  await db.quizSessions.clear();
  await db.mathAnswerEvents.clear();
  await db.learningGoals.clear();
  await db.goalEvents.clear();
  await db.goalEvaluations.clear();
  await db.dailyLessonPlans.clear();
}

beforeEach(clearAll);
afterEach(clearAll);

describe('resolveLearnerKeyDuplicate', () => {
  it('prefers the profile already referenced by answer data', () => {
    const local = makeProfile({ id: 'local', learnerKey: 'k1', displayName: 'Local Name' });
    const remote = makeProfile({ id: 'remote', learnerKey: 'k1', displayName: 'Remote Name' });
    const resolved = resolveLearnerKeyDuplicate(local, remote, { local: 0, remote: 12 });
    expect(resolved.id).toBe('remote');
  });

  it('builds aliases before rows are inserted and remaps ownership immutably', () => {
    const local = makeProfile({ id: 'local', learnerKey: 'k1' });
    const remote = makeProfile({ id: 'remote', learnerKey: 'k1' });
    const aliases = resolveCanonicalStudentIds([local], [remote], { local: 3, remote: 1 });
    expect(aliases.get('remote')).toBe('local');
    const row = { id: 'e', studentId: 'remote' };
    expect(remapStudentId(row, aliases)).toEqual({ id: 'e', studentId: 'local' });
    expect(row.studentId).toBe('remote');
  });

  it('keeps the local id when local has more events', () => {
    const local = makeProfile({ id: 'local', learnerKey: 'k1' });
    const remote = makeProfile({ id: 'remote', learnerKey: 'k1' });
    const resolved = resolveLearnerKeyDuplicate(local, remote, { local: 5, remote: 1 });
    expect(resolved.id).toBe('local');
  });

  it('merges metadata from whichever side has the newer updatedAt', () => {
    const local = makeProfile({ id: 'local', learnerKey: 'k1', displayName: 'Old Name', updatedAt: '2026-01-01T00:00:00.000Z' });
    const remote = makeProfile({ id: 'remote', learnerKey: 'k1', displayName: 'New Name', updatedAt: '2026-02-01T00:00:00.000Z' });
    const resolved = resolveLearnerKeyDuplicate(local, remote, { local: 5, remote: 1 });
    expect(resolved.id).toBe('local');
    expect(resolved.displayName).toBe('New Name');
  });
});

describe('exact profile revision merge', () => {
  it('uses newer remote metadata and settings for the same profile id', async () => {
    const local = makeProfile({ id: 'alice', displayName: 'Old', timezone: 'America/Los_Angeles', updatedAt: '2026-07-01T00:00:00Z' });
    const remote = makeProfile({ id: 'alice', displayName: 'New', gradeLevel: 5, timezone: 'Pacific/Auckland', updatedAt: '2026-07-10T00:00:00Z', settings: { ...local.settings, theme: 'light-green' } });
    await db.students.put(local);
    await mergeSnapshot(emptySnapshot({ students: [remote] }));
    expect(await db.students.get('alice')).toMatchObject({ displayName: 'New', gradeLevel: 5, timezone: 'Pacific/Auckland', updatedAt: '2026-07-10T00:00:00Z', settings: { theme: 'light-green' } });
  });

  it('keeps newer local metadata for the same profile id', async () => {
    const local = makeProfile({ id: 'alice', displayName: 'Local New', updatedAt: '2026-07-10T00:00:00Z' });
    const remote = makeProfile({ id: 'alice', displayName: 'Remote Old', updatedAt: '2026-07-01T00:00:00Z' });
    await db.students.put(local);
    await mergeSnapshot(emptySnapshot({ students: [remote] }));
    expect((await db.students.get('alice'))?.displayName).toBe('Local New');
  });

  it('does not replace a valid local revision with an invalid remote timestamp', async () => {
    const local = makeProfile({ id: 'alice', displayName: 'Local Valid', updatedAt: '2026-07-10T00:00:00Z' });
    const remote = makeProfile({ id: 'alice', displayName: 'Remote Invalid', updatedAt: 'not-a-date' });
    await db.students.put(local);
    await mergeSnapshot(emptySnapshot({ students: [remote] }));
    expect((await db.students.get('alice'))?.displayName).toBe('Local Valid');
  });

  it('uses a deterministic metadata fingerprint when timestamps tie', () => {
    const a = makeProfile({ id: 'alice', displayName: 'A', updatedAt: '2026-07-10T00:00:00Z' });
    const b = makeProfile({ id: 'alice', displayName: 'B', updatedAt: '2026-07-10T00:00:00Z' });
    expect(mergeProfilesByExactId([a], [b])).toEqual(mergeProfilesByExactId([b], [a]));
  });
});

describe('mergeSnapshot learnerKey deduplication', () => {
  it('does not create a second profile when local and remote share a learnerKey', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    await db.students.put(local);

    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key', displayName: 'Alex' });
    await mergeSnapshot(emptySnapshot({ students: [remote] }));

    const all = await db.students.toArray();
    const matching = all.filter(p => p.learnerKey === 'shared-key');
    expect(matching).toHaveLength(1);
  });

  it('keeps two different learner keys with identical names separate', async () => {
    const localA = makeProfile({ id: 'a', learnerKey: 'key-a', displayName: 'Alex' });
    const localB = makeProfile({ id: 'b', learnerKey: 'key-b', displayName: 'Alex' });
    await db.students.bulkPut([localA, localB]);

    await mergeSnapshot(emptySnapshot({ students: [localA, localB] }));

    const all = await db.students.toArray();
    expect(all.map(p => p.id).sort()).toEqual(['a', 'b']);
  });

  it('never applies learnerKey dedup to two legacy profiles without one', async () => {
    const localLegacy = makeProfile({ id: 'legacy-local', displayName: 'Alex' });
    await db.students.put(localLegacy);

    const remoteLegacy = makeProfile({ id: 'legacy-remote', displayName: 'Alex' });
    await mergeSnapshot(emptySnapshot({ students: [remoteLegacy] }));

    const all = await db.students.toArray();
    expect(all.map(p => p.id).sort()).toEqual(['legacy-local', 'legacy-remote']);
  });

  it('resolves to the profile id with more merged answer events', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    await db.students.put(local);

    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    const event: MathAnswerEvent = {
      id: 'ev1',
      studentId: 'remote-id',
      sessionId: 's1',
      mode: 'practice',
      itemId: 'MUL_7x8',
      promptShown: '7x8',
      correctAnswer: 56,
      studentAnswer: 56,
      isCorrect: true,
      isRetry: false,
      hintUsed: false,
      latencyMs: 1000,
      reviewGrade: 'good',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await mergeSnapshot(emptySnapshot({ students: [remote], mathAnswerEvents: [event] }));

    const all = await db.students.toArray();
    const matching = all.filter(p => p.learnerKey === 'shared-key');
    expect(matching).toHaveLength(1);
    expect(matching[0].id).toBe('remote-id');
  });

  it('re-keys every learner-owned remote table when the local id wins', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    await db.mathAnswerEvents.bulkPut([
      eventFor('local-1', 'local-id'), eventFor('local-2', 'local-id'),
    ]);
    const snapshot = emptySnapshot({
      students: [remote],
      mathAnswerEvents: [eventFor('remote-1', 'remote-id')],
      attempts: [{ id: 'a1', studentId: 'remote-id', itemId: 'MUL_7x8', skillId: 'mul', sessionId: 's1', promptShown: '7x8', correctAnswer: 56, studentAnswer: 56, isCorrect: true, latencyMs: 1000, reviewGrade: 'good', createdAt: '2026-01-01T00:00:00Z' }],
      sessions: [{ id: 's1', studentId: 'remote-id', startedAt: '2026-01-01T00:00:00Z', mode: 'multiplication', plannedQuestionCount: 1, completedQuestionCount: 1, correctCount: 1, averageLatencyMs: 1000 }],
      itemStates: [{ studentId: 'remote-id', cardKey: 'fact:mul:7x8', lastItemId: 'MUL_7x8', skillId: 'mul', attemptCount: 1, correctCount: 1, lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1000, ease: 2.5, stabilityDays: 1, difficulty: .2, masteryLevel: 'learning', mistakePatterns: [] }],
      multFactStats: [{ studentId: 'remote-id', key: '7x8', left: 7, right: 8, answer: 56, totalAttempts: 1, correctAttempts: 1, incorrectAttempts: 0, accuracy: 1, averageResponseTimeMs: 1000, lastResponseTimeMs: 1000, lastPracticedAt: '2026-01-01T00:00:00Z', lastQuizAt: null, masteryScore: 10, masteryState: 'learning', streakCorrect: 1, streakIncorrect: 0, everTested: true }],
      quizSessions: [{ id: 'q1', studentId: 'remote-id', category: 'multiplication', quizLength: 1, startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', answerLogs: [], correctCount: 1, incorrectCount: 0, accuracy: 1, averageResponseTimeMs: 1000, weakFactsDiscovered: [], strongFactsConfirmed: [], forgottenFactsDiscovered: [], untestedFactsCovered: [], recommendedPracticeFacts: [] }],
      learningGoals: [{ id: 'g1', studentId: 'remote-id', title: 'Goal', source: 'manual', status: 'active', durationDays: 7, startDate: '2026-01-01', targetDate: '2026-01-08', targets: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
      goalEvents: [{ id: 'ge1', studentId: 'remote-id', goalId: 'g1', type: 'created', createdAt: '2026-01-01T00:00:00Z' }],
      goalEvaluations: [{ id: 'gv1', studentId: 'remote-id', status: 'in_progress', source: 'manual', answers: [], currentQuestionIndex: 0, plannedQuestionCount: 0, itemIds: [], targetSkillIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
    });
    await mergeSnapshot(snapshot);
    expect((await db.students.toArray()).map(row => row.id)).toEqual(['local-id']);
    for (const table of [db.mathAnswerEvents, db.attempts, db.sessions, db.itemStates, db.multFactStats, db.quizSessions, db.learningGoals, db.goalEvents, db.goalEvaluations]) {
      expect((await table.toArray()).every(row => row.studentId === 'local-id')).toBe(true);
    }
    expect((await db.mathAnswerEvents.toArray()).map(row => row.id).sort()).toEqual(['local-1', 'local-2', 'remote-1']);
    expect(await findOrphanedStudentReferences()).toEqual({ orphanCount: 0, byTable: {} });
  });

  it('re-keys nested answer events in goal evaluations', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    await db.mathAnswerEvents.bulkPut([eventFor('local-1', 'local-id'), eventFor('local-2', 'local-id')]);
    await mergeSnapshot(emptySnapshot({
      students: [remote],
      mathAnswerEvents: [eventFor('remote-1', 'remote-id')],
      goalEvaluations: [{
        id: 'evaluation', studentId: 'remote-id', status: 'in_progress', source: 'manual', answers: [],
        answerEvents: [eventFor('nested', 'remote-id')], currentQuestionIndex: 0, plannedQuestionCount: 1,
        itemIds: ['MUL_7x8'], targetSkillIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }],
    }));
    const evaluation = await db.goalEvaluations.get('evaluation');
    expect(evaluation?.studentId).toBe('local-id');
    expect(evaluation?.answerEvents?.[0].studentId).toBe('local-id');
  });

  it('canonicalizes daily lesson ownership, semantic identity, and every lesson reference', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    const localPlanId = 'plan:local-id:2026-01-01:r1';
    await db.mathAnswerEvents.bulkPut([
      { ...eventFor('local-1', 'local-id'), lessonPlanId: localPlanId }, eventFor('local-2', 'local-id'),
    ]);
    const oldPlanId = 'plan:remote-id:2026-01-01:r1';
    const plan: PersistedDailyLessonPlan = {
      id: oldPlanId, studentId: 'remote-id', localDate: '2026-01-01', timezone: 'UTC', plannerVersion: 'test', revision: 1,
      generatedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', status: 'planned', estimatedMinutes: 5,
      items: [{ item: { id: 'MUL_7x8', skillId: 'mul', itemType: 'multiplication_fact', prompt: '7x8', answer: 56, tags: [], difficulty: 1 }, cardKey: 'fact:mul:7x8', segment: 'focus', rationale: 'test', schedulingEligible: true,
        selection: { origin: 'focus_skill', rationaleCodes: ['test'], lessonPlanId: oldPlanId } }],
      completedItemInstanceIds: ['remote-done'], warnings: [], semanticKey: 'remote-id|2026-01-01|1',
    };
    await db.dailyLessonPlans.put({
      ...plan, id: localPlanId, studentId: 'local-id', status: 'in_progress', completedItemInstanceIds: ['local-done'],
      semanticKey: 'local-id|2026-01-01|1', items: plan.items.map(item => ({ ...item, selection: { ...item.selection!, lessonPlanId: localPlanId } })),
    });
    const event = { ...eventFor('remote-1', 'remote-id'), lessonPlanId: oldPlanId };
    await mergeSnapshot(emptySnapshot({
      students: [remote], mathAnswerEvents: [event], dailyLessonPlans: [plan],
      attempts: [{ id: 'attempt', studentId: 'remote-id', itemId: 'MUL_7x8', skillId: 'mul', sessionId: 'session', promptShown: '7x8', correctAnswer: 56, studentAnswer: 56, isCorrect: true, latencyMs: 1000, reviewGrade: 'good', lessonPlanId: oldPlanId, createdAt: '2026-01-01T00:00:00Z' }],
      sessions: [{ id: 'session', studentId: 'remote-id', startedAt: '2026-01-01T00:00:00Z', mode: 'multiplication', plannedQuestionCount: 1, completedQuestionCount: 1, correctCount: 1, averageLatencyMs: 1000, lessonPlanId: oldPlanId }],
    }));
    const expectedPlanId = canonicalDailyLessonPlanId('local-id', '2026-01-01', 1);
    expect(await db.dailyLessonPlans.get(oldPlanId)).toBeUndefined();
    expect(await db.dailyLessonPlans.get(expectedPlanId)).toMatchObject({ studentId: 'local-id', semanticKey: 'local-id|2026-01-01|1', completedItemInstanceIds: ['local-done', 'remote-done'] });
    expect((await db.dailyLessonPlans.get(expectedPlanId))?.items[0].selection?.lessonPlanId).toBe(expectedPlanId);
    expect((await db.mathAnswerEvents.get('local-1'))?.lessonPlanId).toBe(expectedPlanId);
    expect((await db.mathAnswerEvents.get('remote-1'))?.lessonPlanId).toBe(expectedPlanId);
    expect((await db.attempts.get('attempt'))?.lessonPlanId).toBe(expectedPlanId);
    expect((await db.sessions.get('session'))?.lessonPlanId).toBe(expectedPlanId);
    expect(await findOrphanedStudentReferences()).toEqual({ orphanCount: 0, byTable: {} });
  });

  it('preserves divergent same-day lesson contents while canonicalizing aliased owners', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    await db.mathAnswerEvents.bulkPut([eventFor('local-1', 'local-id'), eventFor('local-2', 'local-id')]);
    const basePlan: PersistedDailyLessonPlan = {
      id: 'local-plan', studentId: 'local-id', localDate: '2026-01-01', timezone: 'UTC', plannerVersion: 'test', revision: 1,
      generatedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T01:00:00Z', status: 'in_progress', estimatedMinutes: 5,
      items: [{ item: { id: 'MUL_7x8', skillId: 'mul', itemType: 'multiplication_fact', prompt: '7x8', answer: 56, tags: [], difficulty: 1 }, cardKey: 'fact:mul:7x8', segment: 'focus', rationale: 'local', schedulingEligible: true }],
      completedItemInstanceIds: ['local-progress'], warnings: [],
    };
    await db.dailyLessonPlans.put(basePlan);
    const remotePlan: PersistedDailyLessonPlan = {
      ...basePlan, id: 'remote-plan', studentId: 'remote-id', status: 'planned', completedItemInstanceIds: ['remote-progress'],
      items: [{ item: { id: 'MUL_6x9', skillId: 'mul', itemType: 'multiplication_fact', prompt: '6x9', answer: 54, tags: [], difficulty: 1 }, cardKey: 'fact:mul:6x9', segment: 'focus', rationale: 'remote', schedulingEligible: true }],
    };
    await mergeSnapshot(emptySnapshot({ students: [remote], mathAnswerEvents: [eventFor('remote-1', 'remote-id')], dailyLessonPlans: [remotePlan] }));
    const plans = await db.dailyLessonPlans.toArray();
    expect(plans).toHaveLength(2);
    expect(plans.map(plan => plan.items[0].item.id).sort()).toEqual(['MUL_6x9', 'MUL_7x8']);
    expect(plans.filter(plan => plan.status === 'in_progress')).toHaveLength(1);
    expect(plans.filter(plan => plan.status === 'replaced')).toHaveLength(1);
    expect(plans.every(plan => plan.studentId === 'local-id' && plan.semanticKey === 'local-id|2026-01-01|1')).toBe(true);
  });

  it('re-keys existing local children when the remote id wins', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    await db.mathAnswerEvents.put(eventFor('local-event', 'local-id'));
    await db.attempts.put({ id: 'local-attempt', studentId: 'local-id', itemId: 'MUL_7x8', skillId: 'mul', sessionId: 'local-session', promptShown: '7x8', correctAnswer: 56, studentAnswer: 56, isCorrect: true, latencyMs: 1000, reviewGrade: 'good', createdAt: '2026-01-01T00:00:00Z' });
    await db.sessions.put({ id: 'local-session', studentId: 'local-id', startedAt: '2026-01-01T00:00:00Z', mode: 'multiplication', plannedQuestionCount: 1, completedQuestionCount: 0, correctCount: 0, averageLatencyMs: 0 });
    await db.itemStates.put({ studentId: 'local-id', cardKey: 'fact:mul:7x8', lastItemId: 'MUL_7x8', skillId: 'mul', attemptCount: 1, correctCount: 1, lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1000, ease: 2.5, stabilityDays: 1, difficulty: .2, masteryLevel: 'learning', mistakePatterns: [] });
    await db.multFactStats.put({ studentId: 'local-id', key: '7x8', left: 7, right: 8, answer: 56, totalAttempts: 1, correctAttempts: 1, incorrectAttempts: 0, accuracy: 1, averageResponseTimeMs: 1000, lastResponseTimeMs: 1000, lastPracticedAt: '2026-01-01T00:00:00Z', lastQuizAt: null, masteryScore: 10, masteryState: 'learning', streakCorrect: 1, streakIncorrect: 0, everTested: true });
    await db.quizSessions.put({ id: 'local-quiz', studentId: 'local-id', category: 'multiplication', quizLength: 1, startedAt: '2026-01-01T00:00:00Z', completedAt: null, answerLogs: [], correctCount: 0, incorrectCount: 0, accuracy: 0, averageResponseTimeMs: null, weakFactsDiscovered: [], strongFactsConfirmed: [], forgottenFactsDiscovered: [], untestedFactsCovered: [], recommendedPracticeFacts: [] });
    await db.learningGoals.put({ id: 'local-goal', studentId: 'local-id', title: 'Goal', source: 'manual', status: 'active', durationDays: 7, startDate: '2026-01-01', targetDate: '2026-01-08', targets: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
    await db.goalEvents.put({ id: 'local-goal-event', studentId: 'local-id', goalId: 'local-goal', type: 'created', createdAt: '2026-01-01T00:00:00Z' });
    await db.goalEvaluations.put({ id: 'local-evaluation', studentId: 'local-id', status: 'in_progress', source: 'manual', answers: [], answerEvents: [eventFor('nested-local', 'local-id')], currentQuestionIndex: 0, plannedQuestionCount: 1, itemIds: [], targetSkillIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
    await mergeSnapshot(emptySnapshot({ students: [remote], mathAnswerEvents: [eventFor('r1', 'remote-id'), eventFor('r2', 'remote-id')] }));
    expect((await db.students.toArray()).map(row => row.id)).toEqual(['remote-id']);
    for (const table of [db.mathAnswerEvents, db.attempts, db.sessions, db.itemStates, db.multFactStats, db.quizSessions, db.learningGoals, db.goalEvents, db.goalEvaluations]) {
      expect((await table.toArray()).every(row => row.studentId === 'remote-id')).toBe(true);
    }
    expect((await db.goalEvaluations.get('local-evaluation'))?.answerEvents?.[0].studentId).toBe('remote-id');
    expect((await db.itemStates.get(['remote-id', 'fact:mul:7x8']))?.reps).toBe(3);
    expect(await findOrphanedStudentReferences()).toEqual({ orphanCount: 0, byTable: {} });
  });

  it('updates a legacy active-profile id selection to the canonical profile', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    saveActiveProfileSelection({ ...local, learnerKey: undefined });

    await mergeSnapshot(emptySnapshot({
      students: [remote],
      mathAnswerEvents: [eventFor('r1', 'remote-id'), eventFor('r2', 'remote-id')],
    }));

    expect(loadActiveProfileSelection()).toEqual({ learnerKey: 'shared-key' });
  });

  it('rolls back profile and child rewrites when the transaction fails', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    await db.sessions.put({ id: 'local-session', studentId: 'local-id', startedAt: '2026-01-01T00:00:00Z', mode: 'multiplication', plannedQuestionCount: 1, completedQuestionCount: 0, correctCount: 0, averageLatencyMs: 0 });
    const write = vi.spyOn(db.mathAnswerEvents, 'bulkPut').mockRejectedValueOnce(new Error('forced write failure'));

    await expect(mergeSnapshot(emptySnapshot({ students: [remote], mathAnswerEvents: [eventFor('r1', 'remote-id')] })))
      .rejects.toThrow(/forced write failure/);

    expect((await db.students.toArray()).map(profile => profile.id)).toEqual(['local-id']);
    expect(await db.mathAnswerEvents.count()).toBe(0);
    expect((await db.sessions.get('local-session'))?.studentId).toBe('local-id');
    write.mockRestore();
  });

  it('rejects an unrelated pre-existing orphan and rolls back all sync writes', async () => {
    const local = makeProfile({ id: 'local-id' });
    await db.students.put(local);
    await db.attempts.put({ id: 'orphan', studentId: 'missing-id', itemId: 'MUL_7x8', skillId: 'mul', sessionId: 's', promptShown: '7x8', correctAnswer: 56, studentAnswer: 56, isCorrect: true, latencyMs: 1000, reviewGrade: 'good', createdAt: '2026-01-01T00:00:00Z' });
    const beforeStudents = await db.students.toArray();
    const beforeAttempts = await db.attempts.toArray();
    await expect(mergeSnapshot(emptySnapshot({ students: [makeProfile({ id: 'remote-id' })] })))
      .rejects.toBeInstanceOf(SnapshotMergeError);
    expect(await db.students.toArray()).toEqual(beforeStudents);
    expect(await db.attempts.toArray()).toEqual(beforeAttempts);
  });

  it('rolls back every registered table when lesson-reference validation fails', async () => {
    const local = makeProfile({ id: 'local-id', displayName: 'Before', updatedAt: '2026-01-01T00:00:00Z' });
    await db.students.put(local);
    await db.mathAnswerEvents.put({ ...eventFor('local-event', 'local-id'), lessonPlanId: 'missing-plan' });
    const before = Object.fromEntries(await Promise.all(Object.entries(LEARNER_OWNED_TABLES)
      .map(async ([name, table]) => [name, await table.toArray()])));

    await expect(mergeSnapshot(emptySnapshot({ students: [{ ...local, displayName: 'After', updatedAt: '2026-02-01T00:00:00Z' }] })))
      .rejects.toMatchObject({ code: 'orphaned_student_references' });

    expect(await db.students.get('local-id')).toEqual(local);
    const after = Object.fromEntries(await Promise.all(Object.entries(LEARNER_OWNED_TABLES)
      .map(async ([name, table]) => [name, await table.toArray()])));
    expect(after).toEqual(before);
  });

  it('registers every learner-owned table in one ownership registry', () => {
    expect(Object.keys(LEARNER_OWNED_TABLES).sort()).toEqual([
      'attempts', 'dailyLessonPlans', 'goalEvaluations', 'goalEvents', 'itemStates', 'learningGoals',
      'mathAnswerEvents', 'multFactStats', 'quizSessions', 'sessions',
    ]);
  });
});

function eventFor(id: string, studentId: string): MathAnswerEvent {
  return { id, studentId, sessionId: `s-${id}`, mode: 'practice', itemId: 'MUL_7x8', promptShown: '7x8', correctAnswer: 56, studentAnswer: 56, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000, reviewGrade: 'good', createdAt: `2026-01-0${id.endsWith('2') ? 2 : 1}T00:00:00.000Z` };
}

describe('snapshot round-trip', () => {
  it('preserves learnerKey and identityVersion through buildSnapshot', async () => {
    const profile = makeProfile({ id: 'p1', learnerKey: 'k1', identityVersion: 1 });
    await db.students.put(profile);

    const snapshot = await buildSnapshot();
    const saved = snapshot.students.find(p => p.id === 'p1');
    expect(saved?.learnerKey).toBe('k1');
    expect(saved?.identityVersion).toBe(1);
  });
});
