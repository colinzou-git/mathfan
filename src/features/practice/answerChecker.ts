import type { PracticeItem, ReviewGrade } from '../../types/math';

const FAST_MS = 1500;
const NORMAL_MS = 4000;
const TIMEOUT_MS = 10000;

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
  const studentAnswer = parseFloat(normalizedInput);
  const correctAnswer = item.answer;
  const isCorrect =
    !isNaN(studentAnswer) &&
    Math.abs(studentAnswer - Number(correctAnswer)) < 0.001;

  const grade = classifyResponse(isCorrect, latencyMs);

  return { isCorrect, reviewGrade: grade, latencyMs, correctAnswer, studentAnswer };
}

export function classifyResponse(isCorrect: boolean, latencyMs: number): ReviewGrade {
  if (!isCorrect) return 'again';
  if (latencyMs >= TIMEOUT_MS) return 'again';
  if (latencyMs > NORMAL_MS) return 'hard';
  if (latencyMs <= FAST_MS) return 'easy';
  return 'good';
}
