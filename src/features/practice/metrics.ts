import type { AttemptLog } from '../../types/math';

// Practice fluency metrics. Every answer attempt at an item is logged (wrong ones too),
// so for each *presentation* of an item the number of attempts up to and including the
// correct one tells us how it was solved:
//   1      -> first-try fluency
//   2      -> corrected after one round of feedback
//   >= 3   -> repeated mistake (needed several tries)
// This distinguishes real fluency from "eventually correct under retry-to-mastery", which
// previously looked identical (10/10, 100%).

export type AttemptOutcome = 'first-try' | 'corrected' | 'repeated';

/** Classify a solved presentation by how many attempts it took. */
export function classifyAttempts(attempts: number): AttemptOutcome {
  if (attempts <= 1) return 'first-try';
  if (attempts === 2) return 'corrected';
  return 'repeated';
}

export interface PracticeMetrics {
  /** Presentations solved (== correct answers under retry-to-mastery). */
  completedItemCount: number;
  firstTryCount: number;
  correctedCount: number;
  repeatedCount: number;
  /** First-try solves that were correct but slow (graded 'hard') — known, not yet automatic. */
  slowFirstTryCount: number;
  /** Total answer submissions. */
  attemptCount: number;
  /** Submissions that were wrong. */
  wrongAttemptCount: number;
  /** firstTryCount / completedItemCount, 0..1 (0 when nothing completed). */
  firstTryAccuracy: number;
}

// Derive metrics from a session's raw attempt log. Handles repeated item ids within a
// session (e.g. table drills can queue the same fact twice): attempts are segmented per
// presentation, a presentation ending at each correct answer. Trailing wrong answers with
// no correct (an item quit mid-way) are not counted as completed.
export function derivePracticeMetrics(attempts: AttemptLog[]): PracticeMetrics {
  const byItem = new Map<string, AttemptLog[]>();
  for (const a of attempts) {
    const arr = byItem.get(a.itemId);
    if (arr) arr.push(a);
    else byItem.set(a.itemId, [a]);
  }

  let completedItemCount = 0;
  let firstTryCount = 0;
  let correctedCount = 0;
  let repeatedCount = 0;
  let slowFirstTryCount = 0;

  for (const list of byItem.values()) {
    const ordered = [...list].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    let run = 0;
    for (const a of ordered) {
      run += 1;
      if (!a.isCorrect) continue;
      completedItemCount += 1;
      const outcome = classifyAttempts(run);
      if (outcome === 'first-try') {
        firstTryCount += 1;
        if (a.reviewGrade === 'hard') slowFirstTryCount += 1;
      } else if (outcome === 'corrected') {
        correctedCount += 1;
      } else {
        repeatedCount += 1;
      }
      run = 0; // next presentation of this item starts fresh
    }
  }

  const attemptCount = attempts.length;
  const wrongAttemptCount = attempts.reduce((n, a) => n + (a.isCorrect ? 0 : 1), 0);
  const firstTryAccuracy =
    completedItemCount > 0 ? firstTryCount / completedItemCount : 0;

  return {
    completedItemCount,
    firstTryCount,
    correctedCount,
    repeatedCount,
    slowFirstTryCount,
    attemptCount,
    wrongAttemptCount,
    firstTryAccuracy,
  };
}
