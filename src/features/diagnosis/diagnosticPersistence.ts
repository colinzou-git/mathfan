import { db } from '../../db/dexie';
import type { AttemptLog, StudentItemState } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';

export interface DiagnosticStateRevision {
  cardKey: string;
  lastSeenAt?: string;
  reps: number;
  lapses: number;
  attemptCount: number;
  correctCount: number;
}

export interface DiagnosticAnswerProposal {
  event: MathAnswerEvent;
  attempt: AttemptLog;
  stateBefore: StudentItemState;
  stateAfter?: StudentItemState;
  expectedStateRevision: DiagnosticStateRevision;
  schedulingApplied: boolean;
}

export interface DiagnosticWriteJob {
  id: string;
  proposal: DiagnosticAnswerProposal;
  status: 'pending' | 'saving' | 'saved' | 'failed';
  lastError?: string;
}

export class DiagnosticIdempotencyConflictError extends Error {
  constructor(eventId: string) {
    super(`Conflicting diagnostic event identity: ${eventId}`);
    this.name = 'DiagnosticIdempotencyConflictError';
  }
}

export class DiagnosticStateConflictError extends Error {
  readonly cardKey: string;

  constructor(cardKey: string) {
    super(`Diagnostic card state changed before save: ${cardKey}`);
    this.name = 'DiagnosticStateConflictError';
    this.cardKey = cardKey;
  }
}

export function diagnosticStateRevision(state: StudentItemState): DiagnosticStateRevision {
  return {
    cardKey: state.cardKey,
    lastSeenAt: state.lastSeenAt,
    reps: state.reps ?? 0,
    lapses: state.lapses ?? 0,
    attemptCount: state.attemptCount,
    correctCount: state.correctCount,
  };
}

function sameDiagnosticStateRevision(current: StudentItemState, expected: DiagnosticStateRevision): boolean {
  const actual = diagnosticStateRevision(current);
  return actual.cardKey === expected.cardKey
    && actual.lastSeenAt === expected.lastSeenAt
    && actual.reps === expected.reps
    && actual.lapses === expected.lapses
    && actual.attemptCount === expected.attemptCount
    && actual.correctCount === expected.correctCount;
}

function diagnosticFingerprint(event: MathAnswerEvent): string {
  return JSON.stringify({
    studentId: event.studentId,
    sessionId: event.sessionId,
    itemId: event.itemId,
    cardKey: event.cardKey,
    studentAnswer: event.studentAnswer,
    correctAnswer: event.correctAnswer,
    isCorrect: event.isCorrect,
    isRetry: event.isRetry,
    hintUsed: event.hintUsed,
    latencyMs: event.latencyMs,
    reviewGrade: event.reviewGrade,
    gradingContext: event.gradingContext,
    schedulingEligible: event.schedulingEligible,
    schedulingApplied: event.schedulingApplied,
    schedulerErrorCode: event.schedulerErrorCode,
    createdAt: event.createdAt,
  });
}

export async function persistDiagnosticAnswerProposal(proposal: DiagnosticAnswerProposal): Promise<void> {
  await db.transaction('rw', db.mathAnswerEvents, db.attempts, db.itemStates, async () => {
    const existingEvent = await db.mathAnswerEvents.get(proposal.event.id);
    if (existingEvent) {
      if (diagnosticFingerprint(existingEvent) !== diagnosticFingerprint(proposal.event)) {
        throw new DiagnosticIdempotencyConflictError(proposal.event.id);
      }
      return;
    }

    const current = await db.itemStates.get([
      proposal.event.studentId,
      proposal.expectedStateRevision.cardKey,
    ]) ?? proposal.stateBefore;
    if (proposal.schedulingApplied && !sameDiagnosticStateRevision(current, proposal.expectedStateRevision)) {
      throw new DiagnosticStateConflictError(proposal.expectedStateRevision.cardKey);
    }

    await db.mathAnswerEvents.put(proposal.event);
    await db.attempts.put(proposal.attempt);
    if (proposal.schedulingApplied && proposal.stateAfter) await db.itemStates.put(proposal.stateAfter);
  });
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown save error';
}

export function countUnsavedDiagnosticJobs(jobs: readonly DiagnosticWriteJob[]): number {
  return jobs.filter(job => job.status !== 'saved').length;
}

export async function retryDiagnosticWriteJob(job: DiagnosticWriteJob): Promise<void> {
  if (job.status === 'saved' || job.status === 'saving') return;
  job.status = 'saving';
  try {
    await persistDiagnosticAnswerProposal(job.proposal);
    job.status = 'saved';
    job.lastError = undefined;
  } catch (error) {
    job.status = 'failed';
    job.lastError = safeMessage(error);
    throw error;
  }
}

export async function flushDiagnosticWriteJobs(jobs: DiagnosticWriteJob[]): Promise<number> {
  for (const job of jobs) {
    if (job.status === 'saved') continue;
    try {
      await retryDiagnosticWriteJob(job);
    } catch {
      // The individual job retains its precise failure state and message.
    }
  }
  return countUnsavedDiagnosticJobs(jobs);
}
