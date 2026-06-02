import type { PracticeItem, ReviewGrade } from '../../types/math';

export const FAST_MS = 1500;
export const NORMAL_MS = 4000;

// Strict patterns — reject trailing/embedded junk that parseFloat silently ignores.
// integerPattern: whole numbers only (positive or negative).
// decimalPattern: integers or a single decimal point with digits on at least one side.
const integerPattern = /^-?\d+$/;
const decimalPattern = /^-?(?:\d+|\d*\.\d+)$/;

export interface CheckResult {
  isCorrect: boolean;
  reviewGrade: ReviewGrade;
  latencyMs: number;
  correctAnswer: string | number;
  studentAnswer: string | number;
}

export function checkAnswer(
  item: PracticeItem,
  rawInput: string,
  latencyMs: number
): CheckResult {
  const normalizedInput = rawInput.trim().replace(/\s+/g, '');
  const correctAnswer = item.answer;

  let isCorrect: boolean;
  let studentAnswer: string | number;

  if (item.answerInput === 'choice' || typeof correctAnswer === 'string') {
    // String/choice comparison (e.g. fraction compare: '<', '=', '>')
    studentAnswer = normalizedInput;
    isCorrect = normalizedInput === String(correctAnswer).trim();
  } else {
    // Numeric comparison — validate format before parsing to reject "12abc", "1.2.3", etc.
    const expected = Number(correctAnswer);
    const pattern = Number.isInteger(expected) ? integerPattern : decimalPattern;
    if (!pattern.test(normalizedInput)) {
      studentAnswer = normalizedInput;
      isCorrect = false;
    } else {
      const parsed = parseFloat(normalizedInput);
      studentAnswer = parsed;
      isCorrect = Math.abs(parsed - expected) < 0.001;
    }
  }

  const grade = classifyResponse(isCorrect, latencyMs);

  return { isCorrect, reviewGrade: grade, latencyMs, correctAnswer, studentAnswer };
}

/**
 * Map (isCorrect, latency) to a ReviewGrade for FSRS scheduling.
 *
 * Policy:
 *   - Wrong answer → 'again' (FSRS lapse / retry immediately)
 *   - Correct but slow (> NORMAL_MS) → 'hard' (not 'again')
 *   - Correct and fast (≤ FAST_MS) → 'easy'
 *   - Correct at normal speed → 'good'
 *
 * A correct answer is never graded 'again', regardless of latency.
 * This prevents a slow-but-correct answer from being counted as an FSRS failure.
 */
export function classifyResponse(isCorrect: boolean, latencyMs: number): ReviewGrade {
  if (!isCorrect) return 'again';
  if (latencyMs > NORMAL_MS) return 'hard';
  if (latencyMs <= FAST_MS) return 'easy';
  return 'good';
}
