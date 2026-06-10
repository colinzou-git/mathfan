/**
 * Tests for cross-skill FSRS-informed item selection:
 *   - relatedItemMapping: higher-level items → embedded calculation IDs
 *   - adaptiveItemSelector: ranking/selection by item-state history
 */
import { describe, it, expect } from 'vitest';
import type { MasteryLevel, PracticeItem, StudentItemState } from '../types/math';
import {
  getRelatedItemIds, getRelatedSkillIds, enrichRelatedMetadata,
} from '../features/adaptive/relatedItemMapping';
import {
  rankCandidateItems, selectAdaptiveItems,
} from '../features/adaptive/adaptiveItemSelector';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';

const NOW = new Date('2026-06-09T00:00:00Z');
const PAST = '2026-06-01T00:00:00Z';   // already due
const FUTURE = '2026-12-01T00:00:00Z'; // not yet due

/** Build a StudentItemState for an item id. */
function state(
  itemId: string,
  mastery: MasteryLevel,
  opts: { due?: string; attempts?: number; correct?: number } = {},
): StudentItemState {
  const attempts = opts.attempts ?? 4;
  const correct = opts.correct ?? attempts;
  return {
    studentId: 's', itemId, skillId: '',
    attemptCount: attempts, correctCount: correct,
    lastCorrect: true, lastLatencyMs: 0, medianLatencyMs: 0,
    ease: 2.5, stabilityDays: 0, difficulty: 0,
    masteryLevel: mastery, nextDueAt: opts.due, mistakePatterns: [],
  };
}

function mapOf(...states: StudentItemState[]): Map<string, StudentItemState> {
  return new Map(states.map(s => [s.itemId, s]));
}

function item(id: string): PracticeItem {
  const it = makeItemFromId(id);
  if (!it) throw new Error(`cannot build item ${id}`);
  return it;
}

// ── relatedItemMapping ──────────────────────────────────────────────────────────

describe('getRelatedItemIds — calculation embedding', () => {
  it('AREA_RECT_8x7 → MUL_8x7', () => {
    expect(getRelatedItemIds(item('AREA_RECT_8x7'))).toEqual(['MUL_8x7']);
  });

  it('AREA_SQ_3x4 → MUL_3x4', () => {
    expect(getRelatedItemIds(item('AREA_SQ_3x4'))).toEqual(['MUL_3x4']);
  });

  it('BARG_5_8 → MUL_5x8', () => {
    expect(getRelatedItemIds(item('BARG_5_8'))).toEqual(['MUL_5x8']);
  });

  it('WORD_eg_6_7 → MUL_6x7', () => {
    expect(getRelatedItemIds(item('WORD_eg_6_7'))).toEqual(['MUL_6x7']);
  });

  it('WORD_dv_7_8 → DIV_56d7', () => {
    expect(getRelatedItemIds(item('WORD_dv_7_8'))).toEqual(['DIV_56d7']);
  });

  it('MWRD_addg_250_150 → an addition-related item', () => {
    const rel = getRelatedItemIds(item('MWRD_addg_250_150'));
    expect(rel).toContain('ADD_250p150');
    expect(rel.every(id => id.startsWith('ADD_'))).toBe(true);
  });

  it('MWRD_subg_500_150 → a subtraction-related item', () => {
    const rel = getRelatedItemIds(item('MWRD_subg_500_150'));
    expect(rel).toContain('SUB_500m150');
    expect(rel.every(id => id.startsWith('SUB_'))).toBe(true);
  });

  it('RECTI_3x4_2x2 → both products and their sum', () => {
    expect(getRelatedItemIds(item('RECTI_3x4_2x2'))).toEqual(['MUL_3x4', 'MUL_2x2', 'ADD_12p4']);
  });

  it('PERIM_RECT_8x9 → side sum then doubling', () => {
    expect(getRelatedItemIds(item('PERIM_RECT_8x9'))).toEqual(['ADD_8p9', 'ADD_17p17']);
  });

  it('PERIM_UNKSIDE_12_3-4 → subtraction of known sides from total', () => {
    expect(getRelatedItemIds(item('PERIM_UNKSIDE_12_3-4'))).toEqual(['SUB_12m7']);
  });

  it('LPLOT_1_2_3_4 → an addition chain', () => {
    expect(getRelatedItemIds(item('LPLOT_1_2_3_4'))).toEqual(['ADD_1p2', 'ADD_3p3', 'ADD_6p4']);
  });

  it('FACT_3_12 → DIV_12d3 (divisible); FACT_5_12 → none', () => {
    expect(getRelatedItemIds(item('FACT_3_12'))).toEqual(['DIV_12d3']);
    expect(getRelatedItemIds(item('FACT_5_12'))).toEqual([]);
  });

  it('APAT_2_3_4 → skip-count addition and step×terms product', () => {
    // sequence 2,5,8,11 → next adds step 3 to last term 11; run is 3×4
    expect(getRelatedItemIds(item('APAT_2_3_4'))).toEqual(['ADD_11p3', 'MUL_3x4']);
  });

  it('GEO_SIDES_triangle → no arithmetic-related item IDs', () => {
    expect(getRelatedItemIds(item('GEO_SIDES_triangle'))).toEqual([]);
  });

  it('PRIME_7 → no arithmetic-related item IDs', () => {
    expect(getRelatedItemIds(item('PRIME_7'))).toEqual([]);
  });
});

describe('getRelatedSkillIds', () => {
  it('AREA_RECT_8x7 relates to an advanced multiplication skill', () => {
    expect(getRelatedSkillIds(item('AREA_RECT_8x7'))).toContain('g3-mul-tables-advanced');
  });

  it('GEO_SIDES_triangle relates to no calculation skill', () => {
    expect(getRelatedSkillIds(item('GEO_SIDES_triangle'))).toEqual([]);
  });
});

describe('enrichRelatedMetadata', () => {
  it('attaches metadata without changing the id, preserving reconstruction', () => {
    for (const id of ['AREA_RECT_8x7', 'WORD_dv_7_8', 'BARG_5_8', 'MWRD_subg_500_150', 'APAT_2_3_4', 'GEO_SIDES_triangle']) {
      const enriched = enrichRelatedMetadata(item(id));
      expect(enriched.id).toBe(id);
      expect(Array.isArray(enriched.relatedItemIds)).toBe(true);
      expect(enriched.schemaId).toBeDefined();
      // makeItemFromId still reconstructs the enriched item's id
      expect(makeItemFromId(enriched.id)).not.toBeNull();
    }
  });

  it('is idempotent and reuses precomputed relatedItemIds', () => {
    const once = enrichRelatedMetadata(item('AREA_RECT_8x7'));
    const twice = enrichRelatedMetadata(once);
    expect(getRelatedItemIds(twice)).toEqual(['MUL_8x7']);
  });
});

// ── adaptiveItemSelector ────────────────────────────────────────────────────────

describe('rankCandidateItems — weak/due embedded facts beat mastered non-due facts', () => {
  const opts = { jitter: 0 };

  it('multiplication-embedded: area, word, data, and pattern candidates', () => {
    const cases: [string, string, string, string][] = [
      // [weak candidate, its weak MUL fact, mastered candidate, its mastered MUL fact]
      ['AREA_RECT_8x7', 'MUL_8x7', 'AREA_RECT_2x2', 'MUL_2x2'],
      ['WORD_eg_6_7', 'MUL_6x7', 'WORD_eg_2_2', 'MUL_2x2'],
      ['BARG_5_8', 'MUL_5x8', 'BARG_2_2', 'MUL_2x2'],
      ['APAT_2_3_4', 'MUL_3x4', 'APAT_2_2_4', 'MUL_2x4'],
    ];
    for (const [weakId, weakFact, masteredId, masteredFact] of cases) {
      const stateMap = mapOf(
        state(weakFact, 'learning', { due: PAST, attempts: 4, correct: 1 }),
        state(masteredFact, 'mastered', { due: FUTURE, attempts: 10, correct: 10 }),
      );
      const ranked = rankCandidateItems([item(masteredId), item(weakId)], stateMap, NOW, opts);
      expect(ranked[0].id).toBe(weakId);
    }
  });

  it('add/sub-embedded: perimeter, measurement, and line-plot candidates', () => {
    const stateMap = mapOf(
      state('ADD_8p9', 'learning', { due: PAST, attempts: 4, correct: 1 }),
      state('ADD_2p2', 'mastered', { due: FUTURE }), state('ADD_4p4', 'mastered', { due: FUTURE }),
      state('SUB_9m4', 'learning', { due: PAST, attempts: 4, correct: 1 }),
      state('SUB_2m1', 'mastered', { due: FUTURE }),
      state('ADD_6p8', 'developing', { due: PAST, attempts: 4, correct: 2 }),
      state('ADD_1p1', 'mastered', { due: FUTURE }), state('ADD_2p1', 'mastered', { due: FUTURE }), state('ADD_3p1', 'mastered', { due: FUTURE }),
    );
    // perimeter
    expect(rankCandidateItems([item('PERIM_RECT_2x2'), item('PERIM_RECT_8x9')], stateMap, NOW, opts)[0].id)
      .toBe('PERIM_RECT_8x9');
    // measurement word problem
    expect(rankCandidateItems([item('MWRD_subg_2_1'), item('MWRD_subg_9_4')], stateMap, NOW, opts)[0].id)
      .toBe('MWRD_subg_9_4');
    // line plot
    expect(rankCandidateItems([item('LPLOT_1_1_1_1'), item('LPLOT_1_2_3_8')], stateMap, NOW, opts)[0].id)
      .toBe('LPLOT_1_2_3_8');
  });
});

describe('selectAdaptiveItems', () => {
  it('mastered non-due facts are deprioritized but still selectable when the pool is small', () => {
    const pool = [item('AREA_RECT_2x2'), item('AREA_RECT_3x3')];
    const stateMap = mapOf(
      state('MUL_2x2', 'mastered', { due: FUTURE }),
      state('MUL_3x3', 'mastered', { due: FUTURE }),
    );
    const queue = selectAdaptiveItems(pool, stateMap, NOW, 5, { jitter: 0 });
    expect(queue).toHaveLength(5);
    expect(new Set(queue)).toEqual(new Set(['AREA_RECT_2x2', 'AREA_RECT_3x3']));
  });

  it('takes the top `count` distinct candidates when the pool is large enough', () => {
    const pool = [item('AREA_RECT_8x7'), item('AREA_RECT_2x2'), item('AREA_RECT_3x3')];
    const stateMap = mapOf(
      state('MUL_8x7', 'learning', { due: PAST, attempts: 4, correct: 1 }),
      state('MUL_2x2', 'mastered', { due: FUTURE }),
      state('MUL_3x3', 'mastered', { due: FUTURE }),
    );
    const queue = selectAdaptiveItems(pool, stateMap, NOW, 2, { jitter: 0 });
    expect(queue).toHaveLength(2);
    // The weak/due candidate must be included; the mastered ones are deprioritized.
    expect(queue).toContain('AREA_RECT_8x7');
  });

  it('returns an empty queue for an empty pool', () => {
    expect(selectAdaptiveItems([], new Map(), NOW, 5)).toEqual([]);
  });
});
