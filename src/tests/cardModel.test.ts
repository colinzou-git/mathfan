import { describe, expect, it } from 'vitest';
import {
  deriveCardKeyFromItemId,
  deriveCardKey,
  deriveCardKeyFromEvent,
  isAtomicFactCard,
  isTemplateCard,
  describeLearningCard,
  stateForItem,
} from '../features/scheduler/cardModel';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import type { StudentItemState } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

describe('deriveCardKeyFromItemId — atomic multiplication facts', () => {
  it('canonicalizes commutative orientation', () => {
    expect(deriveCardKeyFromItemId('MUL_7x8')).toBe('fact:mul:7x8');
    expect(deriveCardKeyFromItemId('MUL_8x7')).toBe('fact:mul:7x8');
  });

  it('produces the same key regardless of which operand is larger', () => {
    expect(deriveCardKeyFromItemId('MUL_3x9')).toBe(deriveCardKeyFromItemId('MUL_9x3'));
  });
});

describe('deriveCardKeyFromItemId — division facts', () => {
  it('is kept separate from multiplication', () => {
    const div = deriveCardKeyFromItemId('DIV_56d7');
    expect(div).toBe('fact:div:56/7');
    expect(div).not.toBe(deriveCardKeyFromItemId('MUL_7x8'));
  });

  it('does not canonicalize by sorting operands', () => {
    expect(deriveCardKeyFromItemId('DIV_56d7')).not.toBe(deriveCardKeyFromItemId('DIV_7d56'));
  });
});

describe('deriveCardKeyFromItemId — rectangle area/perimeter templates (issue #30)', () => {
  it('canonicalizes area-by-formula rectangle orientation', () => {
    expect(deriveCardKeyFromItemId('AREA_RECT_3x4')).toBe(deriveCardKeyFromItemId('AREA_RECT_4x3'));
  });
  it('canonicalizes unit-square counting rectangle orientation', () => {
    expect(deriveCardKeyFromItemId('AREA_SQ_3x4')).toBe(deriveCardKeyFromItemId('AREA_SQ_4x3'));
  });
  it('canonicalizes rectangle perimeter orientation', () => {
    expect(deriveCardKeyFromItemId('PERIM_RECT_3x4')).toBe(deriveCardKeyFromItemId('PERIM_RECT_4x3'));
  });
  it('area, unit-square, and perimeter templates remain distinct cards from each other', () => {
    const area = deriveCardKeyFromItemId('AREA_RECT_3x4');
    const sq = deriveCardKeyFromItemId('AREA_SQ_3x4');
    const perim = deriveCardKeyFromItemId('PERIM_RECT_3x4');
    expect(new Set([area, sq, perim]).size).toBe(3);
  });
});

describe('deriveCardKeyFromItemId — everything else', () => {
  it('falls back to a 1:1 template key', () => {
    expect(deriveCardKeyFromItemId('ADD_5p7')).toBe('template:ADD_5p7');
    expect(deriveCardKeyFromItemId('AREA_RECT_3x4')).toBe('template:g3-area-perimeter:area_rows_columns');
  });

  it('does not canonicalize subtraction by sorting operands', () => {
    expect(deriveCardKeyFromItemId('SUB_9m4')).toBe('template:SUB_9m4');
  });
});

describe('isAtomicFactCard / isTemplateCard', () => {
  it('classifies fact: keys as atomic', () => {
    expect(isAtomicFactCard('fact:mul:7x8')).toBe(true);
    expect(isTemplateCard('fact:mul:7x8')).toBe(false);
  });

  it('classifies template: keys as template', () => {
    expect(isTemplateCard('template:ADD_5p7')).toBe(true);
    expect(isAtomicFactCard('template:ADD_5p7')).toBe(false);
  });
});

describe('deriveCardKey', () => {
  it('prefers a structured item.cardKey when present', () => {
    const item = makeItemFromId('MUL_7x8')!;
    expect(deriveCardKey({ ...item, cardKey: 'custom:override' })).toBe('custom:override');
  });

  it('falls back to id parsing when item.cardKey is absent', () => {
    const item = makeItemFromId('MUL_8x7')!;
    expect(deriveCardKey(item)).toBe('fact:mul:7x8');
  });
});

describe('deriveCardKeyFromEvent', () => {
  function baseEvent(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
    return {
      id: 'e1', studentId: 's', sessionId: 'sess', itemId: 'MUL_7x8',
      mode: 'practice', promptShown: '7x8', correctAnswer: 56, studentAnswer: 56,
      isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('prefers a structured event.cardKey when present', () => {
    expect(deriveCardKeyFromEvent(baseEvent({ cardKey: 'custom:override' }))).toBe('custom:override');
  });

  it('falls back to parsing event.itemId', () => {
    expect(deriveCardKeyFromEvent(baseEvent())).toBe('fact:mul:7x8');
  });

  it('returns null for an event with no usable item id', () => {
    expect(deriveCardKeyFromEvent(baseEvent({ itemId: '' }))).toBeNull();
  });
});

describe('describeLearningCard', () => {
  it('classifies a multiplication fact as atomic_fact', () => {
    const item = makeItemFromId('MUL_7x8')!;
    const card = describeLearningCard(item);
    expect(card.kind).toBe('atomic_fact');
    expect(card.cardKey).toBe('fact:mul:7x8');
    expect(card.gradeLevel).toBe(3);
  });

  it('classifies an unregistered item type as template', () => {
    const item = makeItemFromId('ADD_5p7')!;
    const card = describeLearningCard(item);
    expect(card.kind).toBe('template');
    expect(card.cardKey).toBe('template:ADD_5p7');
  });
});

describe('stateForItem', () => {
  function makeState(cardKey: string): StudentItemState {
    return {
      studentId: 's', cardKey, lastItemId: 'x', skillId: '',
      attemptCount: 1, correctCount: 1, lastCorrect: true,
      lastLatencyMs: 0, medianLatencyMs: 0, ease: 2.5, stabilityDays: 1,
      difficulty: 0, masteryLevel: 'learning', mistakePatterns: [],
    };
  }

  it('looks up a state by the item\'s canonical card key', () => {
    const item7x8 = makeItemFromId('MUL_7x8')!;
    const item8x7 = makeItemFromId('MUL_8x7')!;
    const states = new Map([['fact:mul:7x8', makeState('fact:mul:7x8')]]);
    expect(stateForItem(item7x8, states)).toBeDefined();
    expect(stateForItem(item8x7, states)).toBe(stateForItem(item7x8, states));
  });

  it('returns undefined when no state exists for the card', () => {
    const item = makeItemFromId('MUL_2x2')!;
    expect(stateForItem(item, new Map())).toBeUndefined();
  });
});
