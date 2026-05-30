import Dexie, { type Table } from 'dexie';
import type {
  StudentProfile,
  StudentItemState,
  AttemptLog,
  PracticeSession,
} from '../types/math';

export class MathFanDB extends Dexie {
  students!: Table<StudentProfile>;
  itemStates!: Table<StudentItemState>;
  attempts!: Table<AttemptLog>;
  sessions!: Table<PracticeSession>;

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
  }
}

export const db = new MathFanDB();
