import type { ReviewGrade } from '../../types/math';
import { db } from '../../db/dexie';

export type MathEventMode = 'quiz' | 'practice';

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
