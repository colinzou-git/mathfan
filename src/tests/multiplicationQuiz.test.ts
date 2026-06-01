import { describe, it, expect } from 'vitest';
import {
  getAllFactKeys,
  getRelatedFacts,
  createInitialFactStats,
  factKey,
  parseFactKey,
  ALL_FACT_KEYS,
  FACT_MIN,
  FACT_MAX,
} from '../features/multiplication/multiplicationFacts';
import {
  scoreDelta,
  computeMasteryState,
  applyAnswerToStats,
  FAST_MS,
  SLOW_MS,
  NORMAL_MS,
} from '../features/multiplication/masteryEngine';
import { selectQuizQuestions } from '../features/multiplication/quizQuestionSelector';
import { generateRecommendations } from '../features/multiplication/practiceRecommendation';
import type { MultiplicationFactStats, MultiplicationFactKey, QuizAnswerLog } from '../features/multiplication/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SID = 'student-test';

function makeStats(
  left: number, right: number,
  overrides: Partial<MultiplicationFactStats> = {},
): MultiplicationFactStats {
  return { ...createInitialFactStats(SID, left, right), ...overrides };
}

function makeLog(
  left: number, right: number,
  isCorrect: boolean,
  responseTimeMs = 2000,
  newMasteryState: MultiplicationFactStats['masteryState'] = 'learning',
): QuizAnswerLog {
  const key = factKey(left, right);
  return {
    quizId: 'q1',
    factKey: key,
    left, right,
    correctAnswer: left * right,
    studentAnswer: isCorrect ? left * right : (left * right) + 1,
    isCorrect,
    responseTimeMs,
    answeredAt: new Date().toISOString(),
    previousMasteryScore: 50,
    newMasteryScore: isCorrect ? 62 : 35,
    previousMasteryState: 'learning',
    newMasteryState,
  };
}

// ── Facts generation ──────────────────────────────────────────────────────────

describe('getAllFactKeys', () => {
  it('produces 169 facts for 0–12', () => {
    const keys = getAllFactKeys();
    expect(keys).toHaveLength((FACT_MAX - FACT_MIN + 1) ** 2); // 13*13 = 169
  });

  it('includes 0×0 and 12×12', () => {
    const keys = getAllFactKeys();
    expect(keys).toContain('0x0');
    expect(keys).toContain('12x12');
  });

  it('does not produce duplicates', () => {
    const keys = getAllFactKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('parseFactKey', () => {
  it('correctly parses key and computes answer', () => {
    expect(parseFactKey('7x8')).toEqual({ left: 7, right: 8, answer: 56 });
    expect(parseFactKey('0x5')).toEqual({ left: 0, right: 5, answer: 0 });
    expect(parseFactKey('12x12')).toEqual({ left: 12, right: 12, answer: 144 });
  });
});

describe('getRelatedFacts', () => {
  it('includes the reversed fact', () => {
    const related = getRelatedFacts('7x8');
    expect(related).toContain('8x7');
  });

  it('includes neighboring factor facts', () => {
    const related = getRelatedFacts('7x8');
    expect(related).toContain('6x8');
    expect(related).toContain('8x8');
    expect(related).toContain('7x7');
    expect(related).toContain('7x9');
  });

  it('does not include the original fact', () => {
    const related = getRelatedFacts('7x8');
    expect(related).not.toContain('7x8');
  });

  it('respects FACT_MIN boundary', () => {
    const related = getRelatedFacts('0x3');
    // left-1 would be -1x3, should not be included
    for (const k of related) {
      const { left, right } = parseFactKey(k);
      expect(left).toBeGreaterThanOrEqual(FACT_MIN);
      expect(right).toBeGreaterThanOrEqual(FACT_MIN);
    }
  });
});

// ── Mastery engine ────────────────────────────────────────────────────────────

describe('scoreDelta', () => {
  it('gives largest bonus for fast correct answer', () => {
    expect(scoreDelta(true, FAST_MS)).toBeGreaterThan(scoreDelta(true, NORMAL_MS));
  });

  it('gives penalty for wrong answer', () => {
    expect(scoreDelta(false, 2000)).toBeLessThan(0);
  });

  it('gives larger penalty for very slow wrong answer', () => {
    expect(scoreDelta(false, SLOW_MS + 1)).toBeLessThan(scoreDelta(false, 2000));
  });
});

describe('computeMasteryState', () => {
  it('returns "weak" for low score', () => {
    expect(computeMasteryState(20, 'new', true, 2000)).toBe('weak');
  });

  it('returns "learning" for mid-range score', () => {
    expect(computeMasteryState(50, 'learning', true, 2000)).toBe('learning');
  });

  it('returns "strong" for score in 60–79', () => {
    expect(computeMasteryState(70, 'learning', true, 2000)).toBe('strong');
  });

  it('returns "mastered" for score >= 80', () => {
    expect(computeMasteryState(85, 'strong', true, 2000)).toBe('mastered');
  });

  it('marks "forgotten" when previously strong and now wrong', () => {
    expect(computeMasteryState(65, 'strong', false, 2000)).toBe('forgotten');
  });

  it('marks "forgotten" when previously mastered and now wrong', () => {
    expect(computeMasteryState(65, 'mastered', false, 2000)).toBe('forgotten');
  });

  it('marks "forgotten" when previously mastered and very slow', () => {
    expect(computeMasteryState(79, 'mastered', true, SLOW_MS + 1)).toBe('forgotten');
  });

  it('stays "forgotten" when still wrong', () => {
    expect(computeMasteryState(30, 'forgotten', false, 2000)).toBe('forgotten');
  });
});

describe('applyAnswerToStats', () => {
  const now = new Date().toISOString();

  it('increases score for fast correct answer', () => {
    const stats = makeStats(7, 8, { masteryScore: 50 });
    const { updated } = applyAnswerToStats(stats, true, FAST_MS - 100, now);
    expect(updated.masteryScore).toBeGreaterThan(50);
  });

  it('decreases score for wrong answer', () => {
    const stats = makeStats(7, 8, { masteryScore: 50 });
    const { updated } = applyAnswerToStats(stats, false, 2000, now);
    expect(updated.masteryScore).toBeLessThan(50);
  });

  it('increments totalAttempts', () => {
    const stats = makeStats(7, 8, { totalAttempts: 5 });
    const { updated } = applyAnswerToStats(stats, true, 2000, now);
    expect(updated.totalAttempts).toBe(6);
  });

  it('sets everTested to true', () => {
    const stats = makeStats(7, 8);
    expect(stats.everTested).toBe(false);
    const { updated } = applyAnswerToStats(stats, true, 2000, now);
    expect(updated.everTested).toBe(true);
  });

  it('resets streakCorrect on wrong answer', () => {
    const stats = makeStats(7, 8, { streakCorrect: 3 });
    const { updated } = applyAnswerToStats(stats, false, 2000, now);
    expect(updated.streakCorrect).toBe(0);
    expect(updated.streakIncorrect).toBe(1);
  });

  it('transitions strong→forgotten on wrong answer', () => {
    const stats = makeStats(7, 8, { masteryScore: 75, masteryState: 'strong' });
    const { updated } = applyAnswerToStats(stats, false, 2000, now);
    expect(updated.masteryState).toBe('forgotten');
  });

  it('score is clamped to 0–100', () => {
    const stats = makeStats(0, 0, { masteryScore: 2 });
    const { updated } = applyAnswerToStats(stats, false, SLOW_MS + 1, now);
    expect(updated.masteryScore).toBeGreaterThanOrEqual(0);
  });
});

// ── Question selector ─────────────────────────────────────────────────────────

describe('selectQuizQuestions', () => {
  it('returns the requested count', () => {
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>();
    const result = selectQuizQuestions(SID, map, 20);
    expect(result).toHaveLength(20);
  });

  it('returns no duplicates when pool is large enough', () => {
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>();
    const result = selectQuizQuestions(SID, map, 20);
    expect(new Set(result).size).toBe(result.length);
  });

  it('prioritises weak facts when present', () => {
    // Mark 10 facts as weak with many tested facts (avoid cold-start path)
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>();
    const ago8days = new Date(Date.now() - 8 * 86_400_000).toISOString();

    // Fill most facts as strong/recently tested to avoid cold-start threshold
    for (const key of ALL_FACT_KEYS) {
      const { left, right } = parseFactKey(key);
      map.set(key, makeStats(left, right, {
        masteryState: 'strong',
        everTested: true,
        lastQuizAt: ago8days,
        masteryScore: 70,
        totalAttempts: 5,
      }));
    }

    // Mark 10 as weak
    const weakKeys: MultiplicationFactKey[] = ['3x7', '4x8', '6x7', '7x8', '8x9', '9x6', '6x8', '7x9', '8x6', '9x7'];
    for (const key of weakKeys) {
      const { left, right } = parseFactKey(key as MultiplicationFactKey);
      map.set(key as MultiplicationFactKey, makeStats(left, right, {
        masteryState: 'weak',
        everTested: true,
        masteryScore: 20,
        totalAttempts: 5,
        lastQuizAt: ago8days,
      }));
    }

    const result = selectQuizQuestions(SID, map, 20);
    const weakInResult = result.filter(k => weakKeys.includes(k));
    // With 40% target for weak, expect most of the 10 weak facts to appear
    expect(weakInResult.length).toBeGreaterThanOrEqual(5);
  });

  it('handles counts larger than 20', () => {
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>();
    expect(() => selectQuizQuestions(SID, map, 50)).not.toThrow();
    expect(selectQuizQuestions(SID, map, 50)).toHaveLength(50);
  });
});

// ── Practice recommendations ──────────────────────────────────────────────────

describe('generateRecommendations', () => {
  it('includes facts answered wrongly', () => {
    const logs = [makeLog(7, 8, false, 3000, 'weak')];
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>();
    const rec = generateRecommendations(logs, map);
    expect(rec).toContain('7x8');
  });

  it('includes related facts around missed facts', () => {
    const logs = [makeLog(7, 8, false, 3000, 'weak')];
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>();
    const rec = generateRecommendations(logs, map);
    // 8x7 is the reverse and should be recommended
    expect(rec).toContain('8x7');
  });

  it('does not recommend well-mastered fast facts', () => {
    const masterKey: MultiplicationFactKey = '2x2';
    const { left, right } = parseFactKey(masterKey);
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>([
      [masterKey, makeStats(left, right, {
        masteryState: 'mastered',
        masteryScore: 95,
        lastResponseTimeMs: 1000,
        streakCorrect: 5,
      })],
    ]);
    // Quiz with no wrong answers
    const rec = generateRecommendations([], map);
    expect(rec).not.toContain(masterKey);
  });

  it('returns no more than 12 recommendations', () => {
    // Create many wrong answers
    const logs: QuizAnswerLog[] = [];
    for (let a = 1; a <= 5; a++) {
      for (let b = 1; b <= 5; b++) {
        logs.push(makeLog(a, b, false, 3000, 'weak'));
      }
    }
    const map = new Map<MultiplicationFactKey, MultiplicationFactStats>();
    const rec = generateRecommendations(logs, map);
    expect(rec.length).toBeLessThanOrEqual(12);
  });
});

// ── Mastery grid coverage ─────────────────────────────────────────────────────

describe('ALL_FACT_KEYS grid coverage', () => {
  it('covers the full 13×13 grid', () => {
    for (let a = 0; a <= 12; a++) {
      for (let b = 0; b <= 12; b++) {
        expect(ALL_FACT_KEYS).toContain(factKey(a, b));
      }
    }
  });
});
