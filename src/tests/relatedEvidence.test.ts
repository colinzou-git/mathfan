/**
 * Tests for Priority 2 — conservative cross-skill (related-calculation) evidence.
 *
 *   - computeRelatedEvidence: reinforce-only, commutative, FSRS-only (no stats change)
 *   - todayAchievement: related-evidence events never appear as questions
 *
 * The event-rebuild replay behaviour (reinforce-only + FSRS-only through a sync
 * rebuild) is covered in eventRebuild.test.ts.
 */
import { describe, it, expect } from 'vitest';
import type { MasteryLevel, StudentItemState, PracticeSession } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { computeRelatedEvidence } from '../features/adaptive/relatedEvidence';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { computeTodayAchievement } from '../features/stats/todayAchievement';

const NOW = new Date('2026-06-09T00:00:00Z');

function state(
  itemId: string,
  mastery: MasteryLevel,
  opts: { attempts?: number; correct?: number; reps?: number; stability?: number } = {},
): StudentItemState {
  const attempts = opts.attempts ?? 4;
  const correct = opts.correct ?? attempts;
  return {
    studentId: 's', itemId, skillId: '',
    attemptCount: attempts, correctCount: correct,
    lastCorrect: true, lastLatencyMs: 1200, medianLatencyMs: 1200, personalBestMs: 900,
    ease: 2.5, stabilityDays: opts.stability ?? 5, fsrsDifficulty: 5, difficulty: 0,
    reps: opts.reps ?? 3, lapses: 0,
    lastSeenAt: '2026-06-01T00:00:00Z', nextDueAt: '2026-06-04T00:00:00Z',
    masteryLevel: mastery, mistakePatterns: [],
  };
}

function item(id: string) {
  const it = makeItemFromId(id);
  if (!it) throw new Error(`cannot build item ${id}`);
  return it;
}

describe('computeRelatedEvidence — reinforce-only', () => {
  it('returns nothing when the embedded fact has no state', () => {
    expect(computeRelatedEvidence(item('AREA_RECT_8x7'), new Map(), NOW)).toEqual([]);
  });

  it('nudges an embedded fact that already has a state', () => {
    const map = new Map([['MUL_8x7', state('MUL_8x7', 'developing')]]);
    const updates = computeRelatedEvidence(item('AREA_RECT_8x7'), map, NOW);
    expect(updates).toHaveLength(1);
    expect(updates[0].itemId).toBe('MUL_8x7');
  });

  it('uses commutative state: AREA_RECT_8x7 reinforces an existing MUL_7x8', () => {
    const map = new Map([['MUL_7x8', state('MUL_7x8', 'developing')]]);
    const updates = computeRelatedEvidence(item('AREA_RECT_8x7'), map, NOW);
    expect(updates).toHaveLength(1);
    expect(updates[0].itemId).toBe('MUL_7x8'); // reinforces the id that actually has history
  });
});

describe('computeRelatedEvidence — FSRS-only (stats untouched)', () => {
  it('advances FSRS scheduling but leaves attempt/correct/latency counts unchanged', () => {
    const before = state('MUL_8x7', 'developing', { attempts: 4, correct: 3, reps: 3, stability: 5 });
    const map = new Map([['MUL_8x7', before]]);
    const { after } = computeRelatedEvidence(item('AREA_RECT_8x7'), map, NOW)[0];

    // FSRS moved forward …
    expect(after.reps!).toBeGreaterThan(before.reps!);
    expect(after.lastSeenAt).toBe(NOW.toISOString());
    // … but the displayed accuracy/speed are exactly the direct-practice values.
    expect(after.attemptCount).toBe(before.attemptCount);
    expect(after.correctCount).toBe(before.correctCount);
    expect(after.medianLatencyMs).toBe(before.medianLatencyMs);
    expect(after.personalBestMs).toBe(before.personalBestMs);
  });

  it('reinforces each embedded fact at most once (RECTI with repeated facts)', () => {
    // RECTI_3x3_3x3 embeds MUL_3x3 twice plus ADD_9p9.
    const map = new Map([
      ['MUL_3x3', state('MUL_3x3', 'developing')],
      ['ADD_9p9', state('ADD_9p9', 'developing')],
    ]);
    const updates = computeRelatedEvidence(item('RECTI_3x3_3x3'), map, NOW);
    const mulHits = updates.filter(u => u.itemId === 'MUL_3x3');
    expect(mulHits).toHaveLength(1);
  });
});

describe('todayAchievement — excludes related-evidence events', () => {
  function ev(overrides: Partial<MathAnswerEvent>): MathAnswerEvent {
    return {
      id: Math.random().toString(36).slice(2),
      studentId: 's', sessionId: 'sess1', itemId: 'AREA_RECT_8x7',
      mode: 'practice', promptShown: 'p', correctAnswer: 56, studentAnswer: 56,
      isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000,
      createdAt: '2026-06-09T10:00:00.000Z', ...overrides,
    };
  }
  const session: PracticeSession = {
    id: 'sess1', studentId: 's', startedAt: '2026-06-09T10:00:00.000Z',
    mode: 'area', plannedQuestionCount: 1, completedQuestionCount: 1,
    correctCount: 1, averageLatencyMs: 1000,
  };

  it('a related-evidence event is not counted as a question', () => {
    const direct = ev({ itemId: 'AREA_RECT_8x7' });
    const related = ev({ itemId: 'MUL_8x7', relatedEvidence: true, evidenceSourceItemId: 'AREA_RECT_8x7', studentAnswer: null });
    const data = computeTodayAchievement([direct, related], [], [session]);
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].itemId).toBe('AREA_RECT_8x7');
    expect(data.total.count).toBe(1);
  });
});
