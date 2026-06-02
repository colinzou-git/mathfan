import { db } from '../../db/dexie';
import type { MathAnswerEvent } from './learningEvents';
import type { StudentItemState, AttemptLog } from '../../types/math';
import type { QuizSession, MultiplicationFactStats } from '../multiplication/types';
import { mathAnswerEventRepo, itemStateRepo, attemptRepo } from '../../db/repositories';

export interface PracticeAnswerPayload {
  event: MathAnswerEvent;
  /** Absent for retry events — the itemState is not modified on a retry. */
  updatedState?: StudentItemState;
  attempt: AttemptLog;
}

/** Write a practice answer atomically: event + (if first attempt) derived itemState + attempt log. */
export async function recordPracticeAnswer(payload: PracticeAnswerPayload): Promise<void> {
  await db.transaction('rw', db.mathAnswerEvents, db.itemStates, db.attempts, async () => {
    await mathAnswerEventRepo.save(payload.event);
    if (payload.updatedState) await itemStateRepo.save(payload.updatedState);
    await attemptRepo.save(payload.attempt);
  });
}

/** Write a quiz first-attempt event (mastery update applied; stats flushed at session end). */
export async function recordQuizFirstAttempt(event: MathAnswerEvent): Promise<void> {
  await db.mathAnswerEvents.put(event);
}

/** Write a quiz retry event (no mastery change; factStatus unchanged). */
export async function recordQuizRetry(event: MathAnswerEvent): Promise<void> {
  await db.mathAnswerEvents.put(event);
}

export interface FinalizeQuizPayload {
  session: QuizSession;
  factStats: MultiplicationFactStats[];
}

/** Persist the completed quiz session and its derived stat cache atomically. */
export async function finalizeQuizSession(payload: FinalizeQuizPayload): Promise<void> {
  await db.transaction('rw', db.quizSessions, db.multFactStats, async () => {
    await db.quizSessions.put(payload.session);
    await db.multFactStats.bulkPut(payload.factStats);
  });
}
