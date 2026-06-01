import type { MultiplicationFactStats, MultiplicationFactKey, QuizAnswerLog } from './types';
import { getRelatedFacts } from './multiplicationFacts';
import { FAST_MS, SLOW_MS } from './masteryEngine';

const MAX_RECOMMENDATIONS = 12;
const MIN_RECOMMENDATIONS = 5;

export function generateRecommendations(
  answerLogs: QuizAnswerLog[],
  statsMap: Map<MultiplicationFactKey, MultiplicationFactStats>,
): MultiplicationFactKey[] {
  const recommended = new Set<MultiplicationFactKey>();

  const wrong        = answerLogs.filter(l => !l.isCorrect).map(l => l.factKey);
  const slowCorrect  = answerLogs.filter(l => l.isCorrect && l.responseTimeMs > SLOW_MS).map(l => l.factKey);
  const forgotten    = answerLogs.filter(l => l.newMasteryState === 'forgotten').map(l => l.factKey);

  // Priority 1: wrong answers
  for (const k of wrong) recommended.add(k);

  // Priority 2: correct but slow
  for (const k of slowCorrect) {
    if (recommended.size >= MAX_RECOMMENDATIONS) break;
    recommended.add(k);
  }

  // Priority 3: forgotten facts
  for (const k of forgotten) {
    if (recommended.size >= MAX_RECOMMENDATIONS) break;
    recommended.add(k);
  }

  // Priority 4: related facts around weak/forgotten facts
  for (const key of [...wrong, ...forgotten]) {
    if (recommended.size >= MAX_RECOMMENDATIONS) break;
    for (const rel of getRelatedFacts(key)) {
      if (recommended.size >= MAX_RECOMMENDATIONS) break;
      const stats = statsMap.get(rel);
      // Skip only if truly mastered AND recently answered fast
      if (
        stats &&
        stats.masteryState === 'mastered' &&
        stats.lastResponseTimeMs !== null &&
        stats.lastResponseTimeMs <= FAST_MS &&
        stats.streakCorrect >= 3
      ) continue;
      recommended.add(rel);
    }
  }

  // Priority 5: any remaining weak/forgotten in overall stats
  if (recommended.size < MIN_RECOMMENDATIONS) {
    for (const [key, stats] of statsMap) {
      if (recommended.size >= MAX_RECOMMENDATIONS) break;
      if (stats.masteryState === 'weak' || stats.masteryState === 'forgotten') {
        recommended.add(key);
      }
    }
  }

  // Filter out well-mastered facts that weren't directly wrong/forgotten this quiz
  const wrongOrForgotten = new Set([...wrong, ...forgotten]);
  return [...recommended].filter(key => {
    if (wrongOrForgotten.has(key)) return true;
    const stats = statsMap.get(key);
    return !(
      stats &&
      stats.masteryState === 'mastered' &&
      stats.lastResponseTimeMs !== null &&
      stats.lastResponseTimeMs <= FAST_MS &&
      stats.streakCorrect >= 3
    );
  }).slice(0, MAX_RECOMMENDATIONS);
}
