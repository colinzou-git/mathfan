import Dexie, { type Table } from 'dexie';
import type {
  StudentProfile,
  StudentItemState,
  AttemptLog,
  PracticeSession,
} from '../types/math';
import type { MultiplicationFactStats, QuizSession } from '../features/multiplication/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../features/goals/types';

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
  }
}

export const db = new MathFanDB();
