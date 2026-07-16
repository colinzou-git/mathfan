import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { buildSnapshot, findOrphanedStudentReferences, mergeSnapshot, type AppSnapshot } from '../features/sync/snapshot';
import { remapStudentId, resolveCanonicalStudentIds, resolveLearnerKeyDuplicate } from '../features/sync/learnerKeyMerge';
import type { StudentProfile } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

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
    ...overrides,
  };
}

async function clearAll() {
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

  it('re-keys existing local children when the remote id wins', async () => {
    const local = makeProfile({ id: 'local-id', learnerKey: 'shared-key' });
    const remote = makeProfile({ id: 'remote-id', learnerKey: 'shared-key' });
    await db.students.put(local);
    await db.sessions.put({ id: 'local-session', studentId: 'local-id', startedAt: '2026-01-01T00:00:00Z', mode: 'multiplication', plannedQuestionCount: 1, completedQuestionCount: 0, correctCount: 0, averageLatencyMs: 0 });
    await mergeSnapshot(emptySnapshot({ students: [remote], mathAnswerEvents: [eventFor('r1', 'remote-id'), eventFor('r2', 'remote-id')] }));
    expect((await db.students.toArray()).map(row => row.id)).toEqual(['remote-id']);
    expect((await db.sessions.get('local-session'))?.studentId).toBe('remote-id');
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
