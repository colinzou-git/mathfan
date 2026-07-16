import Dexie, { type Table } from 'dexie';
import type {
  StudentProfile,
  StudentItemState,
  AttemptLog,
  PracticeSession,
  PersistedDailyLessonPlan,
} from '../types/math';
import type { MultiplicationFactStats, QuizSession } from '../features/multiplication/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../features/goals/types';
import type { DataMigrationRun, MigrationBackup } from '../features/migrations/migrationTypes';

export class MathFanDB extends Dexie {
  students!: Table<StudentProfile>;
  itemStates!: Table<StudentItemState>;
  attempts!: Table<AttemptLog>;
  sessions!: Table<PracticeSession>;
  multFactStats!: Table<MultiplicationFactStats>;
  quizSessions!: Table<QuizSession>;
  mathAnswerEvents!: Table<MathAnswerEvent>;
  learningGoals!: Table<LearningGoal>;
  goalEvents!: Table<GoalEvent>;
  goalEvaluations!: Table<GoalEvaluation>;
  migrationBackups!: Table<MigrationBackup>;
  dataMigrationRuns!: Table<DataMigrationRun>;
  dailyLessonPlans!: Table<PersistedDailyLessonPlan>;

  constructor() {
    super('mathfan');
    this.version(1).stores({
      students: 'id, displayName',
      itemStates: '[studentId+itemId], studentId, skillId, nextDueAt, masteryLevel',
      attempts: 'id, studentId, itemId, sessionId, createdAt',
      sessions: 'id, studentId, startedAt, mode',
    });
    // Version 2: add compound index for efficient date-range stats queries
    this.version(2).stores({
      attempts: 'id, studentId, itemId, sessionId, createdAt, [studentId+createdAt]',
    });
    // Version 3: multiplication quiz system
    this.version(3).stores({
      multFactStats: '[studentId+key], studentId',
      quizSessions: 'id, studentId, startedAt',
    });
    // Version 4: canonical answer event log
    this.version(4).stores({
      mathAnswerEvents: 'id, studentId, sessionId, mode, createdAt, [studentId+createdAt]',
    });
    // Version 5: goals and adaptive goal evaluations
    this.version(5).stores({
      learningGoals: 'id, studentId, status, targetDate, updatedAt, [studentId+status]',
      goalEvents: 'id, studentId, goalId, type, createdAt, [studentId+createdAt]',
      goalEvaluations: 'id, studentId, status, updatedAt',
    });
    // Version 6: durable learner identity (schema-only — does not backfill existing rows)
    this.version(6).stores({
      students: 'id, learnerKey, displayName',
    });
    // Version 7: hybrid card model, phase 1 — Dexie does not support changing an
    // object store's primary key in place, so the old itemId-keyed itemStates
    // store must be deleted and recreated. Before deletion, its rows are copied
    // into migrationBackups so the pre-migration state is never silently lost —
    // see features/migrations/cardStateMigration.ts, which replays mathAnswerEvents
    // (unaffected by this schema change) to repopulate itemStates by cardKey.
    this.version(7)
      .stores({
        itemStates: null,
        migrationBackups: 'id, migrationRunId, createdAt',
        dataMigrationRuns: 'id, kind, status, startedAt',
      })
      .upgrade(async tx => {
        const legacyItemStates = await tx.table('itemStates').toArray();
        if (legacyItemStates.length > 0) {
          await tx.table('migrationBackups').put({
            id: 'schema-v7-pre-cardkey-backup',
            migrationRunId: 'schema-v7-auto-backup',
            createdAt: new Date().toISOString(),
            itemStates: legacyItemStates,
          });
        }
      });
    // Version 8: hybrid card model, phase 2 — itemStates recreated with the new
    // card-owned primary key. Starts empty; cardStateMigration.ts populates it
    // from mathAnswerEvents on next app boot.
    this.version(8).stores({
      itemStates: '[studentId+cardKey], studentId, cardKey, skillId, nextDueAt, masteryLevel',
    });
    this.version(9).stores({
      dailyLessonPlans: 'id, [studentId+localDate], studentId, status, generatedAt',
    });
  }
}

export const db = new MathFanDB();
