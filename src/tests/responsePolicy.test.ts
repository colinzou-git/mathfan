import { describe, expect, it } from 'vitest';
import { policyForItem, policyForCard, DEFAULT_FLUENCY_EASY_MS, DEFAULT_FLUENCY_HARD_MS } from '../features/scheduler/responsePolicy';
import { describeLearningCard } from '../features/scheduler/cardModel';
import type { PracticeItem } from '../types/math';

function item(overrides: Partial<PracticeItem>): PracticeItem {
  return {
    id: 'X', skillId: 'sk', itemType: 'word_problem', prompt: 'p', answer: 1,
    tags: [], difficulty: 0.5,
    ...overrides,
  };
}

describe('policyForItem', () => {
  it('classifies multiplication facts as atomic_fluency', () => {
    const p = policyForItem(item({ id: 'MUL_7x8', itemType: 'multiplication_fact' }));
    expect(p.kind).toBe('atomic_fluency');
    expect(p.useLatencyForFsrs).toBe(true);
    expect(p.easyMs).toBe(DEFAULT_FLUENCY_EASY_MS);
    expect(p.hardMs).toBe(DEFAULT_FLUENCY_HARD_MS);
  });

  it('classifies division facts as atomic_fluency', () => {
    expect(policyForItem(item({ id: 'DIV_56d7', itemType: 'division_fact' })).kind).toBe('atomic_fluency');
  });

  it('classifies basic addition/subtraction facts as procedural', () => {
    expect(policyForItem(item({ id: 'ADD_5p7', itemType: 'addition_fact' })).kind).toBe('procedural');
    expect(policyForItem(item({ id: 'SUB_9m4', itemType: 'subtraction_fact' })).kind).toBe('procedural');
  });

  it('classifies two-step word problems as multi_step', () => {
    expect(policyForItem(item({ id: 'WRD2_muls_5_6_10', itemType: 'word_problem' })).kind).toBe('multi_step');
  });

  it('classifies visual/graph/clock/number-line items as visual_interpretation', () => {
    expect(policyForItem(item({ id: 'CLCK_3_15', itemType: 'time_to_minute' })).kind).toBe('visual_interpretation');
    expect(policyForItem(item({ id: 'ETIME_3_15_5_0', itemType: 'elapsed_time' })).kind).toBe('visual_interpretation');
    expect(policyForItem(item({ id: 'BARG_2_5', itemType: 'bar_graph_read' })).kind).toBe('visual_interpretation');
    expect(policyForItem(item({ id: 'LPLOT_1_2_3_4', itemType: 'line_plot_read' })).kind).toBe('visual_interpretation');
    expect(policyForItem(item({ id: 'FNL_1_3', itemType: 'fraction_number_line' })).kind).toBe('visual_interpretation');
  });

  it('falls back to conceptual for everything else (area, fractions, measurement, etc.)', () => {
    expect(policyForItem(item({ id: 'AREA_RECT_3x4', itemType: 'area_rectangle' })).kind).toBe('conceptual');
    expect(policyForItem(item({ id: 'FEQ_1_2_4', itemType: 'fraction_equivalent' })).kind).toBe('conceptual');
    expect(policyForItem(item({ id: 'PERIM_UNKSIDE_20_5-5-5', itemType: 'perimeter_unknown_side' })).kind).toBe('conceptual');
  });

  it('non-atomic policies do not use latency for FSRS', () => {
    expect(policyForItem(item({ id: 'AREA_RECT_3x4', itemType: 'area_rectangle' })).useLatencyForFsrs).toBe(false);
  });
});

describe('policyForCard', () => {
  it('mirrors policyForItem for atomic_fact cards', () => {
    const card = describeLearningCard(item({ id: 'MUL_7x8', itemType: 'multiplication_fact' }));
    expect(policyForCard(card).kind).toBe('atomic_fluency');
  });

  it('defaults template cards to conceptual (card descriptor alone lacks itemType detail)', () => {
    const card = describeLearningCard(item({ id: 'ADD_5p7', itemType: 'addition_fact' }));
    expect(policyForCard(card).kind).toBe('conceptual');
  });
});
