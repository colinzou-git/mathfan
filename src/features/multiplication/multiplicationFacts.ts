import type { MultiplicationFactKey, MultiplicationFactStats, MasteryState } from './types';

export const FACT_MIN = 0;
export const FACT_MAX = 12;
// 169 total facts: 0×0 through 12×12

export function factKey(left: number, right: number): MultiplicationFactKey {
  return `${left}x${right}` as MultiplicationFactKey;
}

export function parseFactKey(key: MultiplicationFactKey): { left: number; right: number; answer: number } {
  const [l, r] = key.split('x').map(Number);
  return { left: l, right: r, answer: l * r };
}

export function getAllFactKeys(): MultiplicationFactKey[] {
  const keys: MultiplicationFactKey[] = [];
  for (let a = FACT_MIN; a <= FACT_MAX; a++) {
    for (let b = FACT_MIN; b <= FACT_MAX; b++) {
      keys.push(factKey(a, b));
    }
  }
  return keys;
}

export const ALL_FACT_KEYS: MultiplicationFactKey[] = getAllFactKeys();

export function createInitialFactStats(studentId: string, left: number, right: number): MultiplicationFactStats {
  return {
    studentId,
    key: factKey(left, right),
    left,
    right,
    answer: left * right,
    totalAttempts: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    accuracy: 0,
    averageResponseTimeMs: null,
    lastResponseTimeMs: null,
    lastPracticedAt: null,
    lastQuizAt: null,
    masteryScore: 30,
    masteryState: 'new' as MasteryState,
    streakCorrect: 0,
    streakIncorrect: 0,
    everTested: false,
  };
}

export function getRelatedFacts(key: MultiplicationFactKey): MultiplicationFactKey[] {
  const { left, right } = parseFactKey(key);
  const related = new Set<MultiplicationFactKey>();

  // Reversed fact
  if (left !== right) related.add(factKey(right, left));

  // Neighbors by left factor
  if (left > FACT_MIN) related.add(factKey(left - 1, right));
  if (left < FACT_MAX) related.add(factKey(left + 1, right));

  // Neighbors by right factor
  if (right > FACT_MIN) related.add(factKey(left, right - 1));
  if (right < FACT_MAX) related.add(factKey(left, right + 1));

  related.delete(key);
  return [...related];
}
