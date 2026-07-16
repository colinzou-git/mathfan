import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot } from '../features/sync/snapshot';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../features/goals/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { AttemptLog, PracticeSession, StudentProfile } from '../types/math';

type KeyFn<T> = (row: T) => unknown;

const mockDb = vi.hoisted(() => {
  class MemoryTable<T> {
    rows: T[] = [];
    private keyFn: KeyFn<T>;

    constructor(keyFn: KeyFn<T>) {
      this.keyFn = keyFn;
    }

    async toArray(): Promise<T[]> {
      return [...this.rows];
    }

    async add(row: T): Promise<void> {
      const key = this.keyFn(row);
      if (this.rows.some(r => this.keyFn(r) === key)) throw new Error('ConstraintError');
      this.rows.push(row);
    }

    async put(row: T): Promise<void> {
      const key = this.keyFn(row);
      const idx = this.rows.findIndex(r => this.keyFn(r) === key);
      if (idx >= 0) this.rows[idx] = row;
      else this.rows.push(row);
    }

    async bulkPut(rows: T[]): Promise<void> {
      for (const row of rows) await this.put(row);
    }

    async get(key: unknown): Promise<T | undefined> {
      const normalized = Array.isArray(key) ? key.join('|') : key;
      return this.rows.find(r => this.keyFn(r) === normalized);
    }
  }

  const byId = <T extends { id: string }>(row: T) => row.id;
  return {
    students: new MemoryTable<{ id: string }>(byId),
    itemStates: new MemoryTable<{ studentId: string; itemId: string; attemptCount: number }>(
      row => `${row.studentId}|${row.itemId}`,
    ),
    attempts: new MemoryTable<{ id: string }>(byId),
    sessions: new MemoryTable<{ id: string }>(byId),
    multFactStats: new MemoryTable<{ studentId: string; key: string; totalAttempts: number }>(
      row => `${row.studentId}|${row.key}`,
    ),
    quizSessions: new MemoryTable<{ id: string }>(byId),
    mathAnswerEvents: new MemoryTable<MathAnswerEvent>(byId),
    learningGoals: new MemoryTable<LearningGoal>(byId),
    goalEvents: new MemoryTable<GoalEvent>(byId),
    goalEvaluations: new MemoryTable<GoalEvaluation>(byId),
    dailyLessonPlans: new MemoryTable<{ id: string; studentId: string }>(byId),
    async transaction<T>(_mode: string, _tables: unknown[], callback: () => Promise<T>): Promise<T> {
      return callback();
    },
  };
});

const rebuilds = vi.hoisted(() => ({
  rebuildMultFactStatsFromEvents: vi.fn(),
  rebuildItemStatesFromEvents: vi.fn(),
}));

vi.mock('../db/dexie', () => ({ db: mockDb }));
vi.mock('../features/learning/eventRebuild', () => rebuilds);

import { buildSnapshot, mergeSnapshot, validateSnapshot } from '../features/sync/snapshot';

function baseSnapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    appId: 'mathfan',
    snapshotVersion: 2,
    snapshotAt: '2026-06-01T00:00:00.000Z',
    students: [student()],
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

function student(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: 'student-1',
    displayName: 'Alex',
    gradeLevel: 3,
    timezone: 'America/Los_Angeles',
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: {
      audioEnabled: false,
      speechRate: 1,
      dailyGoalMinutes: 10,
      sessionLength: 10,
      autoAdvance: true,
      theme: 'indigo',
      allowTimedMode: false,
      competitionModeEnabled: false,
      parentModeEnabled: false,
    },
    ...overrides,
  };
}

function goal(overrides: Partial<LearningGoal> = {}): LearningGoal {
  return {
    id: 'goal-1',
    studentId: 'student-1',
    title: 'Goal',
    source: 'manual',
    status: 'active',
    durationDays: 14,
    startDate: '2026-06-01',
    targetDate: '2026-06-15',
    targets: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function evaluation(overrides: Partial<GoalEvaluation> = {}): GoalEvaluation {
  return {
    id: 'eval-1',
    studentId: 'student-1',
    status: 'in_progress',
    source: 'evaluation',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    currentQuestionIndex: 1,
    plannedQuestionCount: 30,
    itemIds: [],
    targetSkillIds: [],
    answers: [],
    ...overrides,
  };
}

function answerEvent(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: 'answer-1',
    studentId: 'student-1',
    sessionId: 'session-1',
    itemId: 'MUL_2x3',
    mode: 'practice',
    promptShown: '2 x 3',
    correctAnswer: 6,
    studentAnswer: 6,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 1000,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function practiceSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    id: 'session-1',
    studentId: 'student-1',
    startedAt: '2026-06-01T00:00:00.000Z',
    mode: 'daily_review',
    plannedQuestionCount: 5,
    completedQuestionCount: 0,
    correctCount: 0,
    averageLatencyMs: 0,
    ...overrides,
  };
}

function attempt(overrides: Partial<AttemptLog> = {}): AttemptLog {
  return {
    id: 'attempt-1',
    studentId: 'student-1',
    itemId: 'MUL_2x3',
    skillId: 'g3-mul-meaning',
    sessionId: 'session-1',
    promptShown: '2 x 3',
    correctAnswer: 6,
    studentAnswer: 6,
    isCorrect: true,
    latencyMs: 1000,
    reviewGrade: 'good',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  for (const table of [
    mockDb.students,
    mockDb.itemStates,
    mockDb.attempts,
    mockDb.sessions,
    mockDb.multFactStats,
    mockDb.quizSessions,
    mockDb.mathAnswerEvents,
    mockDb.learningGoals,
    mockDb.goalEvents,
    mockDb.goalEvaluations,
    mockDb.dailyLessonPlans,
  ]) {
    table.rows = [];
  }
  vi.clearAllMocks();
});

describe('goal snapshot v2', () => {
  it('performs zero database writes when any external row fails normalization', async () => {
    mockDb.students.rows = [{ id: 'local-student' }];
    mockDb.attempts.rows = [{ id: 'local-attempt' }];
    const before = Object.fromEntries(Object.entries(mockDb).filter(([, value]) => value && typeof value === 'object' && 'rows' in value).map(([name, table]) => [name, structuredClone((table as { rows: unknown[] }).rows)]));
    const malformed = baseSnapshot({ attempts: [{ id: 'broken-attempt', studentId: '', itemId: 'MUL_2x3' }] as never });

    await expect(mergeSnapshot(malformed)).rejects.toThrow(/normalization failed/i);

    const after = Object.fromEntries(Object.entries(mockDb).filter(([, value]) => value && typeof value === 'object' && 'rows' in value).map(([name, table]) => [name, (table as { rows: unknown[] }).rows]));
    expect(after).toEqual(before);
  });

  it('builds and validates a version-2 snapshot with goal arrays', async () => {
    mockDb.students.rows = [student()];
    mockDb.learningGoals.rows = [goal()];
    mockDb.goalEvents.rows = [{
      id: 'event-1',
      studentId: 'student-1',
      goalId: 'goal-1',
      type: 'created',
      createdAt: '2026-06-01T00:00:00.000Z',
    }];
    mockDb.goalEvaluations.rows = [evaluation()];

    const snapshot = await buildSnapshot();

    expect(snapshot.snapshotVersion).toBe(3);
    expect(snapshot.metadata).toMatchObject({ schemaVersion: 3, cardModelVersion: 'canonical-card-v1' });
    expect(snapshot.learningGoals).toHaveLength(1);
    expect(snapshot.goalEvents).toHaveLength(1);
    expect(snapshot.goalEvaluations).toHaveLength(1);
    expect(validateSnapshot(snapshot)).toBe(true);
  });

  it('merges goals and evaluations by latest valid updatedAt', async () => {
    mockDb.learningGoals.rows = [
      goal({ id: 'goal-1', title: 'Local old', updatedAt: '2026-06-01T00:00:00.000Z' }),
      goal({ id: 'goal-2', title: 'Local valid', updatedAt: '2026-06-10T00:00:00.000Z' }),
    ];
    mockDb.goalEvaluations.rows = [
      evaluation({ id: 'eval-1', currentQuestionIndex: 1, updatedAt: '2026-06-01T00:00:00.000Z' }),
      evaluation({ id: 'eval-2', currentQuestionIndex: 2, updatedAt: '2026-06-10T00:00:00.000Z' }),
    ];

    await mergeSnapshot(baseSnapshot({
      learningGoals: [
        goal({ id: 'goal-1', title: 'Remote newer', updatedAt: '2026-06-11T00:00:00.000Z' }),
        goal({ id: 'goal-2', title: 'Remote older', updatedAt: '2026-05-01T00:00:00.000Z' }),
      ],
      goalEvaluations: [
        evaluation({ id: 'eval-1', currentQuestionIndex: 9, updatedAt: '2026-06-11T00:00:00.000Z' }),
        evaluation({ id: 'eval-2', currentQuestionIndex: 99, updatedAt: '2026-05-01T00:00:00.000Z' }),
      ],
    }));

    expect((await mockDb.learningGoals.get('goal-1'))?.title).toBe('Remote newer');
    expect((await mockDb.learningGoals.get('goal-2'))?.title).toBe('Local valid');
    expect((await mockDb.goalEvaluations.get('eval-1'))?.currentQuestionIndex).toBe(9);
    expect((await mockDb.goalEvaluations.get('eval-2'))?.currentQuestionIndex).toBe(2);
  });

  it('does not overwrite an in-progress lesson revision item list during sync', async () => {
    const local = {
      id: 'lesson:s:2026-06-17:r1', studentId: 'student-1', localDate: '2026-06-17', timezone: 'UTC',
      plannerVersion: 'daily-lesson-v1', revision: 1, generatedAt: '2026-06-17T00:00:00.000Z', updatedAt: '2026-06-17T01:00:00.000Z',
      status: 'in_progress', estimatedMinutes: 5, completedItemInstanceIds: ['local-item'], warnings: [],
      items: [{ item: { id: 'local-item' }, cardKey: 'template:local', segment: 'focus', rationale: 'local', schedulingEligible: true }],
    };
    mockDb.dailyLessonPlans.rows = [local];
    await mergeSnapshot(baseSnapshot({ dailyLessonPlans: [{
      ...local, status: 'planned', updatedAt: '2026-06-17T02:00:00.000Z', completedItemInstanceIds: [],
      items: [{ item: { id: 'remote-item' }, cardKey: 'template:remote', segment: 'focus', rationale: 'remote', schedulingEligible: true }],
    }] as never }));
    expect((mockDb.dailyLessonPlans.rows[0] as never as { items: Array<{ item: { id: string } }> }).items[0].item.id).toBe('local-item');
  });

  it('unions goal events by ID without replacing existing local events', async () => {
    mockDb.goalEvents.rows = [{
      id: 'event-1',
      studentId: 'student-1',
      goalId: 'goal-1',
      type: 'created',
      createdAt: '2026-06-01T00:00:00.000Z',
    }];

    await mergeSnapshot(baseSnapshot({
      goalEvents: [
        {
          id: 'event-1',
          studentId: 'student-1',
          goalId: 'goal-1',
          type: 'paused',
          createdAt: '2026-06-02T00:00:00.000Z',
        },
        {
          id: 'event-2',
          studentId: 'student-1',
          goalId: 'goal-1',
          type: 'resumed',
          createdAt: '2026-06-03T00:00:00.000Z',
        },
      ],
    }));

    expect(mockDb.goalEvents.rows).toHaveLength(2);
    expect((await mockDb.goalEvents.get('event-1'))?.type).toBe('created');
    expect((await mockDb.goalEvents.get('event-2'))?.type).toBe('resumed');
  });

  it('preserves answer-event merge and derived-cache rebuild after snapshot merge', async () => {
    await mergeSnapshot(baseSnapshot({
      mathAnswerEvents: [answerEvent({ studentId: 'student-1' })],
    }));

    expect(mockDb.mathAnswerEvents.rows).toHaveLength(1);
    expect(rebuilds.rebuildMultFactStatsFromEvents).toHaveBeenCalledWith('student-1');
    expect(rebuilds.rebuildItemStatesFromEvents).toHaveBeenCalledWith('student-1');
  });

  it('loads a version-1 snapshot without goal arrays and keeps existing learning data', async () => {
    const legacySnapshot = {
      appId: 'mathfan',
      snapshotVersion: 1,
      snapshotAt: '2026-05-01T00:00:00.000Z',
      students: [student()],
      itemStates: [],
      attempts: [attempt({ id: 'legacy-attempt' })],
      sessions: [practiceSession({ id: 'legacy-session' })],
      mathAnswerEvents: [answerEvent({ id: 'legacy-event' })],
    } as unknown as AppSnapshot;

    expect(validateSnapshot(legacySnapshot)).toBe(true);
    await mergeSnapshot(legacySnapshot);

    expect(await mockDb.attempts.get('legacy-attempt')).toBeDefined();
    expect(await mockDb.sessions.get('legacy-session')).toBeDefined();
    expect(await mockDb.mathAnswerEvents.get('legacy-event')).toBeDefined();
    expect(mockDb.learningGoals.rows).toHaveLength(0);
    expect(rebuilds.rebuildItemStatesFromEvents).toHaveBeenCalledWith('student-1');
  });

  it('preserves new multi-goal attribution and legacy origin records through merge', async () => {
    await mergeSnapshot(baseSnapshot({
      sessions: [
        practiceSession({
          id: 'planned-session',
          origin: 'daily_new_for_goals',
          goalIds: ['goal-1', 'goal-2'],
          goalTargetIds: ['target-1', 'target-2'],
          goalLearningKind: 'planned',
        }),
        practiceSession({
          id: 'legacy-session',
          origin: 'daily_recommended_learning',
        }),
      ],
      attempts: [
        attempt({
          id: 'planned-attempt',
          sessionId: 'planned-session',
          origin: 'daily_new_for_goals',
          goalIds: ['goal-1', 'goal-2'],
          goalTargetIds: ['target-1', 'target-2'],
          goalLearningKind: 'planned',
        }),
      ],
      mathAnswerEvents: [
        answerEvent({
          id: 'planned-event',
          sessionId: 'planned-session',
          origin: 'daily_new_for_goals',
          goalIds: ['goal-1', 'goal-2'],
          goalTargetIds: ['target-1', 'target-2'],
          goalLearningKind: 'planned',
        }),
        answerEvent({
          id: 'legacy-event',
          sessionId: 'legacy-session',
          origin: 'daily_recommended_learning',
        }),
      ],
    }));

    expect(await mockDb.sessions.get('planned-session')).toEqual(expect.objectContaining({
      origin: 'daily_new_for_goals',
      goalIds: ['goal-1', 'goal-2'],
      goalTargetIds: ['target-1', 'target-2'],
      goalLearningKind: 'planned',
    }));
    expect(await mockDb.attempts.get('planned-attempt')).toEqual(expect.objectContaining({
      goalIds: ['goal-1', 'goal-2'],
      goalLearningKind: 'planned',
    }));
    expect(await mockDb.mathAnswerEvents.get('planned-event')).toEqual(expect.objectContaining({
      goalIds: ['goal-1', 'goal-2'],
      goalTargetIds: ['target-1', 'target-2'],
      goalLearningKind: 'planned',
    }));
    expect(await mockDb.sessions.get('legacy-session')).toEqual(expect.objectContaining({
      origin: 'daily_recommended_learning',
    }));
    expect(await mockDb.mathAnswerEvents.get('legacy-event')).toEqual(expect.objectContaining({
      origin: 'daily_recommended_learning',
    }));
  });
});
