import { db } from '../../db/dexie';
import type { MathAnswerEvent } from './learningEvents';
import type { StudentItemState, AttemptLog } from '../../types/math';
import type { QuizSession, MultiplicationFactStats } from '../multiplication/types';
import { mathAnswerEventRepo, itemStateRepo, attemptRepo } from '../../db/repositories';

/** One indirect FSRS nudge to an embedded calculation fact (no attempt log). */
export interface RelatedEvidenceWrite {
  event: MathAnswerEvent;
  state: StudentItemState;
}

export interface PracticeAnswerPayload {
  event: MathAnswerEvent;
  /** Absent for retry events — the itemState is not modified on a retry. */
  updatedState?: StudentItemState;
  attempt: AttemptLog;
  /**
   * Mild cross-skill nudges to the embedded calculation facts (see
   * features/adaptive/relatedEvidence). Each writes a marked mathAnswerEvent and
   * its updated itemState, but NO attempt log — so the nudge is durable through
   * an event-log rebuild yet stays out of the accuracy/speed stats.
   */
  relatedEvidence?: RelatedEvidenceWrite[];
}

/** Write a practice answer atomically: event + (if first attempt) derived itemState + attempt log. */
export async function recordPracticeAnswer(payload: PracticeAnswerPayload): Promise<void> {
  await db.transaction('rw', db.mathAnswerEvents, db.itemStates, db.attempts, async () => {
    await mathAnswerEventRepo.save(payload.event);
    if (payload.updatedState) await itemStateRepo.save(payload.updatedState);
    await attemptRepo.save(payload.attempt);
    for (const re of payload.relatedEvidence ?? []) {
      await mathAnswerEventRepo.save(re.event);
      await itemStateRepo.save(re.state);
    }
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
