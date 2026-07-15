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
  scoreCandidateItem, rankCandidateItems, selectAdaptiveItems,
} from '../features/adaptive/adaptiveItemSelector';
import { buildWordProblemCandidates, buildFactorCandidates } from '../features/adaptive/candidatePools';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { deriveCardKeyFromItemId } from '../features/scheduler/cardModel';
import { mulberry32 } from '../utils/rng';

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
    studentId: 's', cardKey: deriveCardKeyFromItemId(itemId), lastItemId: itemId, skillId: '',
    attemptCount: attempts, correctCount: correct,
    lastCorrect: true, lastLatencyMs: 0, medianLatencyMs: 0,
    ease: 2.5, stabilityDays: 0, difficulty: 0,
    masteryLevel: mastery, nextDueAt: opts.due, mistakePatterns: [],
  };
}

function mapOf(...states: StudentItemState[]): Map<string, StudentItemState> {
  return new Map(states.map(s => [s.cardKey, s]));
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
    expect(getRelatedItemIds(item('WORD_dv_7_8'))).toEqual(['DIV_56d7', 'MUL_7x8']);
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

describe('seeded selection — reproducibility (Priority 5)', () => {
  // A pool of unseen items all score the same, so the tie-break jitter (driven by
  // the injected rng) fully determines the ordering — ideal for testing seeding.
  const pool = ['AREA_RECT_8x7', 'AREA_RECT_2x2', 'AREA_RECT_3x3', 'WORD_eg_4_5', 'WORD_eg_6_7', 'BARG_5_8']
    .map(id => item(id));

  it('rankCandidateItems with the same seed yields identical ordering', () => {
    const a = rankCandidateItems(pool, new Map(), NOW, { rng: mulberry32(2026) }).map(i => i.id);
    const b = rankCandidateItems(pool, new Map(), NOW, { rng: mulberry32(2026) }).map(i => i.id);
    expect(a).toEqual(b);
  });

  it('selectAdaptiveItems with the same seed yields the identical queue', () => {
    const a = selectAdaptiveItems(pool, new Map(), NOW, 4, { rng: mulberry32(99) });
    const b = selectAdaptiveItems(pool, new Map(), NOW, 4, { rng: mulberry32(99) });
    expect(a).toEqual(b);
  });

  it('different seeds can produce different orderings (jitter is actually used)', () => {
    // Across several seeds, at least one must differ from the seed-1 ordering —
    // otherwise the jitter is not being driven by the rng at all.
    const base = rankCandidateItems(pool, new Map(), NOW, { rng: mulberry32(1) }).map(i => i.id);
    const anyDifferent = [2, 3, 4, 5, 6].some(
      s => rankCandidateItems(pool, new Map(), NOW, { rng: mulberry32(s) }).map(i => i.id).join() !== base.join(),
    );
    expect(anyDifferent).toBe(true);
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

  it('reserves a maintenance slot for mastered non-due facts when the pool is large', () => {
    const stateMap = mapOf(
      state('MUL_2x2', 'mastered', { due: FUTURE }),
      state('MUL_3x3', 'mastered', { due: FUTURE }),
    );
    const priorityItems: PracticeItem[] = [];
    for (const [a, b] of [[6, 7], [7, 8], [8, 9], [6, 8], [7, 9], [8, 7], [9, 6], [6, 9]] as const) {
      stateMap.set(`MUL_${a}x${b}`, state(`MUL_${a}x${b}`, 'learning', { due: PAST, attempts: 4, correct: 1 }));
      priorityItems.push(item(`WORD_eg_${a}_${b}`));
    }
    const pool = [...priorityItems, item('AREA_RECT_2x2'), item('AREA_RECT_3x3')];
    const queue = selectAdaptiveItems(pool, stateMap, NOW, 10, { jitter: 0 });
    expect(queue).toHaveLength(10);
    const maintained = queue.filter(id => id === 'AREA_RECT_2x2' || id === 'AREA_RECT_3x3');
    expect(maintained.length).toBeGreaterThanOrEqual(1);
  });
});

// ── scoreCandidateItem — fairness rules ─────────────────────────────────────────

describe('scoreCandidateItem', () => {
  it('uses commutative MUL state: MUL_7x8 history informs AREA_RECT_8x7', () => {
    // MUL_8x7 has no state; the commutative MUL_7x8 history must still count.
    const stateMap = mapOf(state('MUL_7x8', 'learning', { due: PAST, attempts: 4, correct: 1 }));
    const withHistory = scoreCandidateItem(item('AREA_RECT_8x7'), stateMap, NOW);
    const noHistory = scoreCandidateItem(item('AREA_RECT_8x7'), new Map(), NOW);
    expect(withHistory).toBeGreaterThan(noHistory + 100);
  });

  it('does not over-reward unseen related calculations for a new user', () => {
    // Clock (no related), measurement-word (1 related), and rectilinear (3 related)
    // must all score the same when the student has no history — embedding more
    // calculations must not inflate priority on its own.
    const empty = new Map();
    const clck = scoreCandidateItem(item('CLCK_3_15'), empty, NOW);
    const mwrd = scoreCandidateItem(item('MWRD_addg_5_3'), empty, NOW);
    const recti = scoreCandidateItem(item('RECTI_3x4_2x2'), empty, NOW);
    const area = scoreCandidateItem(item('AREA_RECT_8x7'), empty, NOW);
    expect(clck).toBe(mwrd);
    expect(recti).toBe(area);
    expect(clck).toBe(area);
  });
});

// ── candidatePools — state-first generation ─────────────────────────────────────

describe('buildWordProblemCandidates', () => {
  it('includes a word problem built around a weak/due MUL fact in range', () => {
    const stateMap = mapOf(state('MUL_8x7', 'learning', { due: PAST, attempts: 4, correct: 1 }));
    const pool = buildWordProblemCandidates(3, 10, stateMap, NOW, 2, 10);
    const hit = pool.find(it => getRelatedItemIds(it).includes('MUL_8x7'));
    expect(hit).toBeDefined();
    expect(hit!.factA === 8 && hit!.factB === 7).toBe(true);
  });

  it('targets a weak/due DIV fact with a sharing word problem', () => {
    const stateMap = mapOf(state('DIV_56d7', 'developing', { due: PAST, attempts: 4, correct: 2 }));
    const pool = buildWordProblemCandidates(3, 10, stateMap, NOW, 2, 10);
    expect(pool.some(it => getRelatedItemIds(it).includes('DIV_56d7'))).toBe(true);
  });

  it('still returns variety candidates when there is no history', () => {
    expect(buildWordProblemCandidates(3, 8, new Map(), NOW, 2, 10).length).toBeGreaterThan(0);
  });

  it('collects every in-range weak/due MUL fact, not just the first sessionLength', () => {
    const facts: [number, number][] = [[3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [2, 9], [9, 3]];
    const stateMap = new Map<string, StudentItemState>();
    for (const [a, b] of facts) {
      stateMap.set(`MUL_${a}x${b}`, state(`MUL_${a}x${b}`, 'learning', { due: PAST, attempts: 4, correct: 1 }));
    }
    // count 3 — far fewer than the 8 weak facts; all must still enter the pool.
    const pool = buildWordProblemCandidates(3, 3, stateMap, NOW, 2, 10);
    for (const [a, b] of facts) {
      expect(pool.some(it => getRelatedItemIds(it).includes(`MUL_${a}x${b}`))).toBe(true);
    }
  });

  it('includes a very urgent fact that appears last in stateMap order', () => {
    const stateMap = new Map<string, StudentItemState>();
    for (const [a, b] of [[2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]] as const) {
      stateMap.set(`MUL_${a}x${b}`, state(`MUL_${a}x${b}`, 'learning', { due: PAST, attempts: 4, correct: 3 }));
    }
    // Inserted LAST and most urgent (due, 0% accuracy). The old early-break logic
    // would never reach it with count 2.
    stateMap.set('MUL_9x8', state('MUL_9x8', 'learning', { due: PAST, attempts: 5, correct: 0 }));
    const pool = buildWordProblemCandidates(3, 2, stateMap, NOW, 2, 10);
    expect(pool.some(it => getRelatedItemIds(it).includes('MUL_9x8'))).toBe(true);
  });
});

describe('buildFactorCandidates', () => {
  it('builds a factor question from a weak/due DIV fact', () => {
    const stateMap = mapOf(state('DIV_12d3', 'learning', { due: PAST, attempts: 4, correct: 1 }));
    const pool = buildFactorCandidates(3, 10, stateMap, NOW, 2, 30);
    expect(pool.some(it => it.id === 'FACT_3_12')).toBe(true);
  });

  it('still returns variety candidates when there is no history', () => {
    expect(buildFactorCandidates(3, 8, new Map(), NOW, 2, 30).length).toBeGreaterThan(0);
  });

  it('collects every in-range weak/due DIV fact, not just the first sessionLength', () => {
    const divs: [number, number][] = [[6, 2], [8, 2], [9, 3], [10, 5], [12, 3], [15, 5], [20, 4], [24, 6]];
    const stateMap = new Map<string, StudentItemState>();
    for (const [dd, dv] of divs) {
      stateMap.set(`DIV_${dd}d${dv}`, state(`DIV_${dd}d${dv}`, 'learning', { due: PAST, attempts: 4, correct: 1 }));
    }
    const pool = buildFactorCandidates(3, 3, stateMap, NOW, 2, 30);
    for (const [dd, dv] of divs) {
      expect(pool.some(it => it.id === `FACT_${dv}_${dd}`)).toBe(true);
    }
  });

  it('includes a very urgent DIV fact that appears last in stateMap order', () => {
    const stateMap = new Map<string, StudentItemState>();
    for (const [dd, dv] of [[6, 2], [8, 2], [9, 3], [10, 2], [12, 3], [15, 3]] as const) {
      stateMap.set(`DIV_${dd}d${dv}`, state(`DIV_${dd}d${dv}`, 'learning', { due: PAST, attempts: 4, correct: 3 }));
    }
    stateMap.set('DIV_28d4', state('DIV_28d4', 'learning', { due: PAST, attempts: 5, correct: 0 }));
    const pool = buildFactorCandidates(3, 2, stateMap, NOW, 2, 30);
    expect(pool.some(it => it.id === 'FACT_4_28')).toBe(true);
  });
});
