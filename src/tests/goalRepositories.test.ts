import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../features/goals/types';

const mockDb = vi.hoisted(() => {
  class MemoryTable<T extends { id: string; studentId?: string; status?: string }> {
    rows: T[] = [];

    async add(row: T): Promise<void> {
      if (this.rows.some(r => r.id === row.id)) throw new Error('ConstraintError');
      this.rows.push(row);
    }

    async put(row: T): Promise<void> {
      const idx = this.rows.findIndex(r => r.id === row.id);
      if (idx >= 0) this.rows[idx] = row;
      else this.rows.push(row);
    }

    async get(key: unknown): Promise<T | undefined> {
      return this.rows.find(r => r.id === key);
    }

    where(index: string) {
      const matches = (row: T, value: unknown) => {
        if (index === '[studentId+status]') {
          return Array.isArray(value) && row.studentId === value[0] && row.status === value[1];
        }
        return row[index as keyof T] === value;
      };
      return {
        equals: (value: unknown) => {
          let filtered = this.rows.filter(row => matches(row, value));
          return {
            and(predicate: (row: T) => boolean) {
              filtered = filtered.filter(predicate);
              return this;
            },
            async toArray() {
              return filtered;
            },
          };
        },
      };
    }
  }

  return {
    learningGoals: new MemoryTable<LearningGoal>(),
    goalEvents: new MemoryTable<GoalEvent>(),
    goalEvaluations: new MemoryTable<GoalEvaluation>(),
  };
});

vi.mock('../db/dexie', () => ({ db: mockDb }));

import { goalEvaluationRepo, goalEventRepo, learningGoalRepo } from '../db/repositories';

function goal(overrides: Partial<LearningGoal> = {}): LearningGoal {
  return {
    id: 'goal-1',
    studentId: 'student-1',
    title: 'Fractions focus',
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

function event(overrides: Partial<GoalEvent> = {}): GoalEvent {
  return {
    id: 'event-1',
    studentId: 'student-1',
    goalId: 'goal-1',
    type: 'created',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function evaluation(overrides: Partial<GoalEvaluation> = {}): GoalEvaluation {
  return {
    id: 'eval-1',
    studentId: 'student-1',
    status: 'not_started',
    source: 'evaluation',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    currentQuestionIndex: 0,
    plannedQuestionCount: 30,
    itemIds: [],
    targetSkillIds: [],
    answers: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockDb.learningGoals.rows = [];
  mockDb.goalEvents.rows = [];
  mockDb.goalEvaluations.rows = [];
});

describe('learningGoalRepo', () => {
  it('creates, lists, and transitions goals with updatedAt changes', async () => {
    await learningGoalRepo.create(goal(), '2026-06-01T01:00:00.000Z');

    expect(await learningGoalRepo.listActive('student-1')).toHaveLength(1);

    const paused = await learningGoalRepo.pause('goal-1', '2026-06-02T00:00:00.000Z');
    expect(paused?.status).toBe('paused');
    expect(paused?.updatedAt).toBe('2026-06-02T00:00:00.000Z');
    expect(await learningGoalRepo.listPaused('student-1')).toHaveLength(1);

    const completed = await learningGoalRepo.complete('goal-1', '2026-06-03T00:00:00.000Z');
    expect(completed?.status).toBe('completed');
    expect(completed?.completedAt).toBe('2026-06-03T00:00:00.000Z');
    expect(await learningGoalRepo.listHistorical('student-1')).toHaveLength(1);
  });

  it('supports end and cancel lifecycle transitions', async () => {
    await learningGoalRepo.create(goal(), '2026-06-01T01:00:00.000Z');
    expect((await learningGoalRepo.end('goal-1', '2026-06-04T00:00:00.000Z'))?.status).toBe('ended');

    await learningGoalRepo.create(goal({ id: 'goal-2' }), '2026-06-01T01:00:00.000Z');
    expect((await learningGoalRepo.cancel('goal-2', '2026-06-05T00:00:00.000Z'))?.status).toBe('cancelled');
  });
});

describe('goalEventRepo', () => {
  it('appends immutable events and rejects duplicate IDs', async () => {
    await goalEventRepo.append(event());
    await expect(goalEventRepo.append(event({ type: 'paused' }))).rejects.toThrow('ConstraintError');
    expect(await goalEventRepo.getForGoal('goal-1')).toHaveLength(1);
  });
});

describe('goalEvaluationRepo', () => {
  it('saves, resumes, completes, and cancels evaluations with updatedAt changes', async () => {
    await goalEvaluationRepo.save(evaluation(), '2026-06-01T01:00:00.000Z');

    const resumed = await goalEvaluationRepo.resume('eval-1', '2026-06-02T00:00:00.000Z');
    expect(resumed?.status).toBe('in_progress');
    expect(resumed?.startedAt).toBe('2026-06-02T00:00:00.000Z');

    const completed = await goalEvaluationRepo.complete(
      'eval-1',
      { currentQuestionIndex: 30, resultGoalId: 'goal-1' },
      '2026-06-03T00:00:00.000Z',
    );
    expect(completed?.status).toBe('completed');
    expect(completed?.updatedAt).toBe('2026-06-03T00:00:00.000Z');
    expect(completed?.resultGoalId).toBe('goal-1');

    await goalEvaluationRepo.save(evaluation({ id: 'eval-2' }), '2026-06-01T01:00:00.000Z');
    const cancelled = await goalEvaluationRepo.cancel('eval-2', '2026-06-04T00:00:00.000Z');
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.cancelledAt).toBe('2026-06-04T00:00:00.000Z');
  });
});
