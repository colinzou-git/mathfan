import { describe, expect, it } from 'vitest';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { deriveLearningUnitProgress, remainingLearningUnitEvidence } from '../features/learning/learningUnitProgress';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { deriveCardKey } from '../features/scheduler/cardModel';
import type { PracticeItem, StudentItemState } from '../types/math';
import { planLearningUnitsForSkill } from '../features/mastery/skillPracticePlanner';

function item(id: string): PracticeItem {
  const resolved = makeItemFromId(id);
  if (!resolved) throw new Error(`Missing test item ${id}`);
  return resolved;
}

function state(current: PracticeItem, overrides: Partial<StudentItemState> = {}): StudentItemState {
  return {
    studentId: 's', cardKey: deriveCardKey(current), lastItemId: current.id, skillId: current.skillId,
    attemptCount: 1, correctCount: 1, lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1000,
    ease: 2.5, stabilityDays: 10, difficulty: .2, masteryLevel: 'mastered', mistakePatterns: [],
    ...overrides,
  };
}

function event(current: PracticeItem, id: string, sessionId: string, representationId?: string): MathAnswerEvent {
  return {
    id, studentId: 's', sessionId, itemId: current.id, cardKey: deriveCardKey(current), schemaId: current.schemaId,
    mode: 'practice', promptShown: current.prompt, correctAnswer: current.answer, studentAnswer: current.answer,
    isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000, createdAt: `2026-06-0${id.length}T00:00:00.000Z`,
    schedulingTelemetry: representationId ? {
      version: 1, cardKey: deriveCardKey(current), cardKind: 'template', schemaId: current.schemaId ?? current.itemType,
      itemInstanceId: current.id, presentationIndex: 1, attemptNo: 1, schedulingEligible: true,
      evidenceKind: 'direct', supportLevel: 'independent', selection: { origin: 'manual', rationaleCodes: [] },
      rating: { reviewGrade: 'good' }, instance: { difficulty: current.difficulty, representationId },
    } : undefined,
  };
}

describe('learning-unit progress', () => {
  it('treats perimeter dimensions as evidence for one template instead of separate new cards', () => {
    const items = ['PERIM_RECT_3x4', 'PERIM_RECT_5x7', 'PERIM_RECT_8x9'].map(item);
    const progress = deriveLearningUnitProgress({ items, events: [], states: [state(items[0])] });
    expect(progress).toHaveLength(1);
    const unit = [...progress.values()][0];
    expect(unit.status).toBe('introduced');
    expect(remainingLearningUnitEvidence(unit)).toBe(2);
  });

  it('requires fraction instance and representation diversity before maintenance', () => {
    const items = ['FCMP_1_4_3_4', 'FCMP_1_3_2_3', 'FCMP_2_5_4_5'].map(item);
    const oneRepresentation = items.map((current, index) => event(current, `e${index}`, `session-${index}`, 'fraction_bar'));
    const learning = deriveLearningUnitProgress({ items, events: oneRepresentation, states: [state(items[2], { attemptCount: 3 })] });
    expect([...learning.values()][0].status).toBe('learning');
    const diverse = [...oneRepresentation];
    diverse[2] = event(items[2], 'e22', 'session-2', 'number_line');
    const maintained = deriveLearningUnitProgress({ items, events: diverse, states: [state(items[2], { attemptCount: 3 })] });
    expect([...maintained.values()][0].status).toBe('maintenance');
  });

  it('keeps multiplication facts independent while folding commutative orientations', () => {
    const items = ['MUL_7x8', 'MUL_8x7', 'MUL_6x8'].map(item);
    const progress = deriveLearningUnitProgress({ items, events: [], states: [] });
    expect(progress).toHaveLength(2);
    expect(deriveCardKey(items[0])).toBe(deriveCardKey(items[1]));
    expect(deriveCardKey(items[2])).not.toBe(deriveCardKey(items[0]));
  });

  it('classifies rebuilt state the same as live state', () => {
    const items = ['PERIM_RECT_3x4', 'PERIM_RECT_5x7', 'PERIM_RECT_8x9'].map(item);
    const events = items.map((current, index) => event(current, `event-${index}`, `session-${index}`));
    const live = deriveLearningUnitProgress({ items, events, states: [state(items[2], { attemptCount: 3 })] });
    const rebuilt = deriveLearningUnitProgress({ items, events, states: [state(items[2], { attemptCount: events.length })] });
    expect(rebuilt).toEqual(live);
  });

  it('keeps fresh template instances available in the manual practice catalogue', () => {
    const plan = planLearningUnitsForSkill('g3-perimeter', { events: [], states: [] });
    expect(plan.items.length).toBeGreaterThan(plan.progress.size);
    expect(plan.config.specificItemIds).toHaveLength(plan.items.length);
  });
});
