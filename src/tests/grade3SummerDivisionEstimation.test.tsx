import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentItemState } from '../types/math';
import {
  divisionEstimationCardKey,
  divisionEstimationItemIdsForSchema,
  divisionEstimationSkillIdForSchema,
  freshDivisionEstimationReviewItemId,
  validateDivisionEstimationItem,
  type DivisionEstimationSchema,
} from '../features/curriculum/divisionEstimationItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { contentDataForDomain, validatePracticeItem } from '../features/curriculum/practiceContentSpec';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { checkAnswer } from '../features/practice/answerChecker';
import { detectMistakes, itemTargetsMisconception } from '../features/mastery/misconceptionEngine';
import { getHint } from '../features/practice/hintEngine';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { buildDailyReviewQueue } from '../features/scheduler/dailyReviewQueue';
import { resolveCanonicalReviewCards } from '../features/scheduler/dailyReviewCandidates';
import { deriveGrade3SkillSummaries } from '../features/mastery/skillMasteryEngine';
import { VisualModel } from '../features/visuals/VisualModel';
import { normalizeMathForSpeech } from '../features/audio/mathSpeech';
import { GRADE3_MASTERY_MAP } from '../features/mastery/grade3MasteryMap';

const SCHEMAS: DivisionEstimationSchema[] = [
  'purpose', 'magnitude', 'bounds', 'compatible', 'direction', 'reasonableness', 'context', 'strategy_compare',
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
    id: `div-event-${index}`, studentId: 'student', sessionId: `session-${day}`, itemId,
    cardKey: item.cardKey, schemaId: item.schemaId, mode: 'practice', promptShown: item.prompt,
    correctAnswer: item.answer, studentAnswer: correct ? item.answer : 'wrong', isCorrect: correct,
    isRetry: false, hintUsed: false, latencyMs: 5000, reviewGrade: correct ? 'good' : 'again',
    createdAt: `2026-07-0${day}T12:00:0${index}.000Z`,
  };
}

describe('Grade 3 summer division estimation content', () => {
  it('computes valid compatible-number invariants for every schema pool', () => {
    for (const schema of SCHEMAS) {
      const ids = divisionEstimationItemIdsForSchema(schema);
      expect(ids.length, schema).toBeGreaterThanOrEqual(20);
      for (const id of ids) {
        const item = makeItemFromId(id)!;
        const spec = contentDataForDomain(item, 'division_estimation')!;
        expect(item, id).not.toBeNull();
        expect(validatePracticeItem(item), id).toEqual([]);
        expect(validateDivisionEstimationItem(item), id).toEqual([]);
        expect(spec.exactQuotient).toBe(spec.dividend / spec.divisor);
        expect(spec.lowerCompatibleDividend).toBe(spec.lowerEstimate * spec.divisor);
        expect(spec.upperCompatibleDividend).toBe(spec.upperEstimate * spec.divisor);
        expect(spec.lowerCompatibleDividend).toBeLessThanOrEqual(spec.dividend);
        expect(spec.upperCompatibleDividend).toBeGreaterThanOrEqual(spec.dividend);
        expect(spec.compatibleDividend).toBe(spec.compatibleEstimate * spec.divisor);
        expect(inferGrade3SkillId(item)).toBe(divisionEstimationSkillIdForSchema(schema));
        expect(deriveCardKey(item)).toBe(divisionEstimationCardKey(schema));
        if (schema !== 'purpose') expect(item.relatedSkillIds).toEqual(['g3-div-mul-relationship']);
        if (schema === 'bounds') expect(spec.lowerEstimate).not.toBe(spec.upperEstimate);
      }
    }
  });

  it('balances low/high estimates while keeping already-compatible dividends rare', () => {
    const specs = divisionEstimationItemIdsForSchema('compatible')
      .map(id => contentDataForDomain(makeItemFromId(id)!, 'division_estimation')!);
    const nonExact = specs.filter(spec => spec.compatibleDirection !== 'exact');
    const lowShare = nonExact.filter(spec => spec.compatibleDirection === 'low').length / nonExact.length;
    const exactShare = specs.filter(spec => spec.compatibleDirection === 'exact').length / specs.length;
    expect(lowShare).toBeGreaterThanOrEqual(0.4);
    expect(lowShare).toBeLessThanOrEqual(0.6);
    expect(exactShare).toBeLessThanOrEqual(0.1);
  });

  it('rotates choice positions so magnitude and bounds cannot be solved by button position', () => {
    for (const schema of ['magnitude', 'bounds'] as const) {
      const answerPositions = divisionEstimationItemIdsForSchema(schema).map(id => {
        const item = makeItemFromId(id)!;
        return item.choices!.findIndex(choice => String(choice) === String(item.answer));
      });
      expect(new Set(answerPositions), schema).toEqual(new Set([0, 1, 2]));
    }
  });

  it('plans every bridge node as reconstructable conceptual practice with one stable card per node', () => {
    for (const schema of SCHEMAS) {
      const skillId = divisionEstimationSkillIdForSchema(schema);
      const config = planPracticeForSkill(skillId);
      expect(config.mode).toBe('division');
      expect(config.specificItemIds?.length).toBeGreaterThan(0);
      const items = config.specificItemIds!.map(id => makeItemFromId(id)!);
      expect(items.every(item => item && item.skillId === skillId)).toBe(true);
      expect(new Set(items.map(deriveCardKey))).toEqual(new Set([divisionEstimationCardKey(schema)]));
      const result = checkAnswer(items[0], String(items[0].answer), 60_000);
      expect(result).toMatchObject({ isCorrect: true, reviewGrade: 'good', policyKind: 'conceptual' });
    }
  });

  it('gives fresh due-review variants without changing the scheduled concept card', () => {
    const priorId = 'DEST1_COM_core_58d6';
    const priorState = state(priorId, { nextDueAt: '2026-07-01T00:00:00.000Z' });
    const queue = buildDailyReviewQueue({
      requestedItemIds: [priorId], states: new Map([[priorState.cardKey, priorState]]),
      sessionLength: 1, now: new Date('2026-07-02T00:00:00.000Z'), rng: () => 0,
    });
    expect(queue).toHaveLength(1);
    expect(queue[0].itemId).not.toBe(priorId);
    expect(deriveCardKey(makeItemFromId(queue[0].itemId)!)).toBe(priorState.cardKey);
    expect(freshDivisionEstimationReviewItemId(priorId, () => 0)).toBe(queue[0].itemId);
  });

  it('repairs a card whose last concrete variant is missing by using a valid default', () => {
    const cardKey = divisionEstimationCardKey('bounds');
    const row = { ...state('DEST1_BND_core_39d4'), cardKey, lastItemId: undefined };
    const resolved = resolveCanonicalReviewCards([row]);
    expect(resolved.unresolvedRows).toEqual([]);
    expect(resolved.cards).toHaveLength(1);
    expect(makeItemFromId(resolved.cards[0].itemId)).not.toBeNull();
    expect(resolved.cards[0].cardKey).toBe(cardKey);
  });

  it('diagnoses exact-instead, factor-of-ten, direction, and context errors without crossing operations', () => {
    const compatible = makeItemFromId('DEST1_COM_core_58d6')!;
    expect(detectMistakes(compatible, 58 / 6)).toContain('div_est:exact_instead');
    expect(detectMistakes(compatible, 1)).toContain('div_est:scale_x10_low');
    expect(detectMistakes(makeItemFromId('DEST1_DIR_core_58d6')!, 'Low')).toContain('div_est:direction_reversed');
    expect(detectMistakes(makeItemFromId('DEST1_CTX_lower_74d7')!, 'compatible estimate')).toContain('div_est:context_method');
    expect(itemTargetsMisconception(compatible, 'div_est:wrong_compatible')).toBe(true);
    expect(itemTargetsMisconception(makeItemFromId('MEST1_RND_core_47x6')!, 'div_est:wrong_compatible')).toBe(false);
  });

  it('uses division-specific hints, compatible-dividend visuals, and division speech', () => {
    const item = makeItemFromId('DEST1_BND_core_39d4')!;
    expect(getHint(item, 1)?.text).toContain('Keep 4 fixed');
    expect(getHint(item, 2)?.text).toContain('20 — 39 — 40');
    render(<VisualModel item={item} />);
    expect(screen.getByLabelText(/39 lies between compatible dividends 20 and 40/i)).toBeInTheDocument();
    expect(normalizeMathForSpeech('58 ÷ 6 ≈ 10')).toBe('58 divided by 6 is about 10');
  });

  it('requires recent success across delayed sessions and representations before summer mastery', () => {
    const ids = divisionEstimationItemIdsForSchema('magnitude').slice(0, 5);
    const events = ids.map((id, index) => event(id, index, index > 0, index < 2 ? 1 : 2));
    const summary = deriveGrade3SkillSummaries({
      studentId: 'student', items: id => makeItemFromId(id), mathAnswerEvents: events,
      itemStates: [state(ids[4], { masteryLevel: 'strong', reps: 2 })], now: '2026-07-03T00:00:00.000Z',
    }).find(value => value.skillId === 'g3s-div-est-magnitude-2x1');
    expect(summary?.status).toBe('mastered');

    const sameDay = events.map(value => ({ ...value, sessionId: 'one-session', createdAt: value.createdAt.replace('2026-07-02', '2026-07-01') }));
    const premature = deriveGrade3SkillSummaries({
      studentId: 'student', items: id => makeItemFromId(id), mathAnswerEvents: sameDay,
      itemStates: [state(ids[4], { masteryLevel: 'strong', reps: 2 })], now: '2026-07-03T00:00:00.000Z',
    }).find(value => value.skillId === 'g3s-div-est-magnitude-2x1');
    expect(premature?.status).toBe('strong');
  });

  it('keeps both summer modules separate from core and marks each challenge optional', () => {
    const bridge = GRADE3_MASTERY_MAP.filter(skill => skill.track === 'summer_bridge');
    expect(bridge).toHaveLength(16);
    expect(bridge.filter(skill => !skill.optionalExtension)).toHaveLength(14);
    expect(bridge.find(skill => skill.id === 'g3s-div-est-friendly-compare')?.optionalExtension).toBe(true);
  });
});
