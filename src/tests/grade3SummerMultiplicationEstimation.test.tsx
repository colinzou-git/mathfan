import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentItemState } from '../types/math';
import {
  freshMultiplicationEstimationReviewItemId,
  multiplicationEstimationCardKey,
  multiplicationEstimationItemIdsForSchema,
  multiplicationEstimationSkillIdForSchema,
  roundHalfUpToTen,
  validateMultiplicationEstimationItem,
  type MultiplicationEstimationSchema,
} from '../features/curriculum/multiplicationEstimationItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { contentDataForDomain, validatePracticeItem } from '../features/curriculum/practiceContentSpec';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { checkAnswer } from '../features/practice/answerChecker';
import { detectMistakes } from '../features/mastery/misconceptionEngine';
import { getHint } from '../features/practice/hintEngine';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { buildDailyReviewQueue } from '../features/scheduler/dailyReviewQueue';
import { resolveCanonicalReviewCards } from '../features/scheduler/dailyReviewCandidates';
import { deriveGrade3SkillSummaries } from '../features/mastery/skillMasteryEngine';
import { VisualModel } from '../features/visuals/VisualModel';
import { normalizeMathForSpeech } from '../features/audio/mathSpeech';
import { GRADE3_MASTERY_MAP } from '../features/mastery/grade3MasteryMap';

const SCHEMAS: MultiplicationEstimationSchema[] = [
  'purpose', 'magnitude', 'bounds', 'nearest_ten', 'direction', 'reasonableness', 'context', 'strategy_compare',
];

function state(itemId: string, overrides: Partial<StudentItemState> = {}): StudentItemState {
  const item = makeItemFromId(itemId)!;
  return {
    studentId: 'student', cardKey: deriveCardKey(item), lastItemId: item.id, skillId: item.skillId,
    attemptCount: 2, correctCount: 2, lastCorrect: true, lastLatencyMs: 4000, medianLatencyMs: 4000,
    ease: 2.5, stabilityDays: 2, difficulty: item.difficulty, reps: 2, masteryLevel: 'developing',
    mistakePatterns: [], ...overrides,
  };
}

function event(itemId: string, index: number, correct: boolean, day: 1 | 2): MathAnswerEvent {
  const item = makeItemFromId(itemId)!;
  return {
    id: `event-${index}`, studentId: 'student', sessionId: `session-${day}`, itemId,
    cardKey: item.cardKey, schemaId: item.schemaId, mode: 'practice', promptShown: item.prompt,
    correctAnswer: item.answer, studentAnswer: correct ? item.answer : 'wrong', isCorrect: correct,
    isRetry: false, hintUsed: false, latencyMs: 5000, reviewGrade: correct ? 'good' : 'again',
    createdAt: `2026-07-0${day}T12:00:0${index}.000Z`,
  };
}

describe('Grade 3 summer multiplication estimation content', () => {
  it('rounds halves up and computes valid mathematical invariants for every schema pool', () => {
    expect(roundHalfUpToTen(44)).toBe(40);
    expect(roundHalfUpToTen(45)).toBe(50);
    expect(roundHalfUpToTen(95)).toBe(100);

    for (const schema of SCHEMAS) {
      const ids = multiplicationEstimationItemIdsForSchema(schema);
      expect(ids.length, schema).toBeGreaterThanOrEqual(16);
      for (const id of ids) {
        const item = makeItemFromId(id)!;
        const spec = contentDataForDomain(item, 'multiplication_estimation')!;
        expect(item, id).not.toBeNull();
        expect(validatePracticeItem(item), id).toEqual([]);
        expect(validateMultiplicationEstimationItem(item), id).toEqual([]);
        expect(spec.exactProduct).toBe(spec.twoDigit * spec.oneDigit);
        expect(spec.lowerProduct).toBeLessThanOrEqual(spec.exactProduct);
        expect(spec.upperProduct).toBeGreaterThanOrEqual(spec.exactProduct);
        expect(spec.nearestEstimate).toBe(spec.nearestTen * spec.oneDigit);
        expect(inferGrade3SkillId(item)).toBe(multiplicationEstimationSkillIdForSchema(schema));
        expect(deriveCardKey(item)).toBe(multiplicationEstimationCardKey(schema));
        if (schema === 'bounds') expect(spec.lowerTen).not.toBe(spec.upperTen);
      }
    }
  });

  it('balances low/high rounding direction while keeping ties and already-friendly tens rare', () => {
    const specs = multiplicationEstimationItemIdsForSchema('nearest_ten')
      .map(id => contentDataForDomain(makeItemFromId(id)!, 'multiplication_estimation')!);
    const nonExact = specs.filter(spec => spec.nearestDirection !== 'exact');
    const lowShare = nonExact.filter(spec => spec.nearestDirection === 'low').length / nonExact.length;
    const tieShare = specs.filter(spec => spec.twoDigit % 10 === 5).length / specs.length;
    const exactShare = specs.filter(spec => spec.nearestDirection === 'exact').length / specs.length;
    expect(lowShare).toBeGreaterThanOrEqual(0.4);
    expect(lowShare).toBeLessThanOrEqual(0.6);
    expect(tieShare).toBeLessThanOrEqual(0.15);
    expect(exactShare).toBeLessThanOrEqual(0.1);
  });

  it('rotates choice positions so magnitude and bounds cannot be solved by button position', () => {
    for (const schema of ['magnitude', 'bounds'] as const) {
      const answerPositions = multiplicationEstimationItemIdsForSchema(schema).map(id => {
        const item = makeItemFromId(id)!;
        return item.choices!.findIndex(choice => String(choice) === String(item.answer));
      });
      expect(new Set(answerPositions), schema).toEqual(new Set([0, 1, 2]));
    }
  });

  it('plans every bridge node as reconstructable, conceptual practice with one stable card per node', () => {
    for (const schema of SCHEMAS) {
      const skillId = multiplicationEstimationSkillIdForSchema(schema);
      const config = planPracticeForSkill(skillId);
      expect(config.specificItemIds?.length).toBeGreaterThan(0);
      const items = config.specificItemIds!.map(id => makeItemFromId(id)!);
      expect(items.every(item => item && item.skillId === skillId)).toBe(true);
      expect(new Set(items.map(deriveCardKey))).toEqual(new Set([multiplicationEstimationCardKey(schema)]));
      const result = checkAnswer(items[0], String(items[0].answer), 60_000);
      expect(result).toMatchObject({ isCorrect: true, reviewGrade: 'good', policyKind: 'conceptual' });
    }
  });

  it('gives fresh due-review variants without changing the scheduled concept card', () => {
    const priorId = 'MEST1_RND_core_47x6';
    const priorState = state(priorId, { nextDueAt: '2026-07-01T00:00:00.000Z' });
    const queue = buildDailyReviewQueue({
      requestedItemIds: [priorId], states: new Map([[priorState.cardKey, priorState]]),
      sessionLength: 1, now: new Date('2026-07-02T00:00:00.000Z'), rng: () => 0,
    });
    expect(queue).toHaveLength(1);
    expect(queue[0].itemId).not.toBe(priorId);
    expect(deriveCardKey(makeItemFromId(queue[0].itemId)!)).toBe(priorState.cardKey);
    expect(freshMultiplicationEstimationReviewItemId(priorId, () => 0)).toBe(queue[0].itemId);
  });

  it('repairs a card whose last concrete variant is missing by using a valid default', () => {
    const cardKey = multiplicationEstimationCardKey('bounds');
    const row = { ...state('MEST1_BND_core_43x6'), cardKey, lastItemId: undefined };
    const resolved = resolveCanonicalReviewCards([row]);
    expect(resolved.unresolvedRows).toEqual([]);
    expect(resolved.cards).toHaveLength(1);
    expect(makeItemFromId(resolved.cards[0].itemId)).not.toBeNull();
    expect(resolved.cards[0].cardKey).toBe(cardKey);
  });

  it('diagnoses exact-instead, factor-of-ten, direction, and context errors', () => {
    const rounded = makeItemFromId('MEST1_RND_core_47x6')!;
    expect(detectMistakes(rounded, 282)).toContain('est:exact_instead');
    expect(detectMistakes(rounded, 30)).toContain('est:scale_x10_low');
    expect(detectMistakes(makeItemFromId('MEST1_DIR_core_47x6')!, 'Low')).toContain('est:direction_reversed');
    expect(detectMistakes(makeItemFromId('MEST1_CTX_lower_43x6')!, 'nearest estimate')).toContain('est:context_method');
  });

  it('uses estimation-specific hints, number-line visuals, and approximation speech', () => {
    const item = makeItemFromId('MEST1_BND_core_43x6')!;
    expect(getHint(item, 1)?.text).toContain('multiples of 10');
    expect(getHint(item, 2)?.text).toContain('40 — 43 — 50');
    render(<VisualModel item={item} />);
    expect(screen.getByLabelText(/43 lies between 40 and 50/i)).toBeInTheDocument();
    expect(normalizeMathForSpeech('47 × 6 ≈ 300')).toBe('47 times 6 is about 300');
  });

  it('requires recent success across delayed sessions and representations before summer mastery', () => {
    const ids = multiplicationEstimationItemIdsForSchema('magnitude').slice(0, 5);
    const events = ids.map((id, index) => event(id, index, index > 0, index < 2 ? 1 : 2));
    const summary = deriveGrade3SkillSummaries({
      studentId: 'student', items: id => makeItemFromId(id), mathAnswerEvents: events,
      itemStates: [state(ids[4], { masteryLevel: 'strong', reps: 2 })], now: '2026-07-03T00:00:00.000Z',
    }).find(value => value.skillId === 'g3s-mul-est-magnitude-2x1');
    expect(summary?.status).toBe('mastered');

    const sameDay = events.map(value => ({ ...value, sessionId: 'one-session', createdAt: value.createdAt.replace('2026-07-02', '2026-07-01') }));
    const premature = deriveGrade3SkillSummaries({
      studentId: 'student', items: id => makeItemFromId(id), mathAnswerEvents: sameDay,
      itemStates: [state(ids[4], { masteryLevel: 'strong', reps: 2 })], now: '2026-07-03T00:00:00.000Z',
    }).find(value => value.skillId === 'g3s-mul-est-magnitude-2x1');
    expect(premature?.status).toBe('strong');
  });

  it('keeps the module visibly separate from Grade 3 core and marks the challenge optional', () => {
    const bridge = GRADE3_MASTERY_MAP.filter(skill => skill.track === 'summer_bridge');
    expect(bridge).toHaveLength(8);
    expect(bridge.filter(skill => !skill.optionalExtension)).toHaveLength(7);
    expect(bridge.find(skill => skill.id === 'g3s-mul-est-friendly-compare')?.optionalExtension).toBe(true);
  });
});
