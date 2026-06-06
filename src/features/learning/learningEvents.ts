import type { ReviewGrade, MasteryLevel } from '../../types/math';
import type { MasteryState } from '../multiplication/types';
import { db } from '../../db/dexie';

export type MathEventMode = 'quiz' | 'practice' | 'diagnostic';

export type MathFactStatus =
  | 'new'
  | 'weak'
  | 'learning'
  | 'developing'
  | 'strong'
  | 'mastered'
  | 'forgotten';

export interface MathAnswerEvent {
  id: string;
  studentId: string;
  sessionId: string;
  itemId: string;
  mode: MathEventMode;
  promptShown: string;
  correctAnswer: string | number;
  studentAnswer: string | number | null;
  isCorrect: boolean;
  /** True when the student is retrying after a wrong first attempt. */
  isRetry: boolean;
  hintUsed: boolean;
  latencyMs: number;
  reviewGrade?: ReviewGrade;
  factStatusBefore?: MathFactStatus;
  factStatusAfter?: MathFactStatus;
  createdAt: string;
}

export async function recordAnswerEvent(event: MathAnswerEvent): Promise<void> {
  await db.mathAnswerEvents.put(event);
}

// ── Status type conversions ───────────────────────────────────────────────────
// MathFactStatus is the canonical status, a superset of both MasteryLevel (practice/FSRS)
// and MasteryState (quiz mastery score). Use these functions when crossing system boundaries.

/**
 * Convert quiz MasteryState to canonical MathFactStatus.
 * MasteryState ⊆ MathFactStatus, so this is a safe widening.
 */
export function multiplicationStateToCanonicalStatus(state: MasteryState): MathFactStatus {
  return state; // MasteryState values are all valid MathFactStatus values
}

/**
 * Convert canonical MathFactStatus to quiz MasteryState.
 * 'developing' exists in MathFactStatus but not in MasteryState — maps to 'learning'.
 */
export function canonicalStatusToMultiplicationState(status: MathFactStatus): MasteryState {
  if (status === 'developing') return 'learning';
  return status as MasteryState;
}

/**
 * Convert canonical MathFactStatus to legacy practice MasteryLevel.
 * 'weak' and 'forgotten' exist in MathFactStatus but not in MasteryLevel — both map to 'learning'.
 */
export function canonicalStatusToLegacyMasteryLevel(status: MathFactStatus): MasteryLevel {
  if (status === 'weak' || status === 'forgotten') return 'learning';
  return status as MasteryLevel;
}
