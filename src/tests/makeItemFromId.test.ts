/**
 * Direct unit tests for makeItemFromId.
 *
 * Invariants checked per pattern:
 *   - Returns a non-null PracticeItem
 *   - .id round-trips (item.id === the input id)
 *   - .itemType matches the expected type for that format
 *   - .answer is correct for deterministic items
 */

import { describe, it, expect, vi } from 'vitest';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';

// ── arithmetic ─────────────────────────────────────────────────────────────────

describe('makeItemFromId — multiplication', () => {
  it('MUL_7x8 → multiplication_fact, answer 56', () => {
    const item = makeItemFromId('MUL_7x8');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('MUL_7x8');
    expect(item!.itemType).toBe('multiplication_fact');
    expect(item!.answer).toBe(56);
  });

  it('MUL_0x5 → answer 0', () => {
    const item = makeItemFromId('MUL_0x5');
    expect(item!.answer).toBe(0);
  });
});

describe('makeItemFromId — addition', () => {
  it('ADD_3p5 → addition_fact, answer 8', () => {
    const item = makeItemFromId('ADD_3p5');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('ADD_3p5');
    expect(item!.itemType).toBe('addition_fact');
    expect(item!.answer).toBe(8);
  });
});

describe('makeItemFromId — subtraction', () => {
  it('SUB_10m3 → subtraction_fact, answer 7', () => {
    const item = makeItemFromId('SUB_10m3');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('SUB_10m3');
    expect(item!.itemType).toBe('subtraction_fact');
    expect(item!.answer).toBe(7);
  });
});

describe('makeItemFromId — division', () => {
  it('DIV_12d3 → division_fact, answer 4', () => {
    const item = makeItemFromId('DIV_12d3');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('DIV_12d3');
    expect(item!.itemType).toBe('division_fact');
    expect(item!.answer).toBe(4);
  });
});

// ── fractions ──────────────────────────────────────────────────────────────────

describe('makeItemFromId — fraction equivalent', () => {
  it('FEQ_1_2_4 → fraction_equivalent, answer 2 (1/2 = 2/4)', () => {
    // mult = targetDen / d = 4 / 2 = 2 → answer = n * mult = 1 * 2 = 2
    const item = makeItemFromId('FEQ_1_2_4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('FEQ_1_2_4');
    expect(item!.itemType).toBe('fraction_equivalent');
    expect(item!.answer).toBe(2);
  });

  it('FEQ_2_3_6 → answer 4 (2/3 = 4/6)', () => {
    const item = makeItemFromId('FEQ_2_3_6');
    expect(item!.answer).toBe(4);
  });
});

describe('makeItemFromId — fraction compare', () => {
  it('FCMP_1_3_1_2 → fraction_compare, answer "<"', () => {
    const item = makeItemFromId('FCMP_1_3_1_2');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('FCMP_1_3_1_2');
    expect(item!.itemType).toBe('fraction_compare');
    expect(item!.answer).toBe('<');
  });

  it('FCMP_3_4_1_2 → answer ">"', () => {
    const item = makeItemFromId('FCMP_3_4_1_2');
    expect(item!.answer).toBe('>');
  });
});

describe('makeItemFromId — fraction number line', () => {
  it('FNL_3_4 → fraction_number_line, answer 3', () => {
    const item = makeItemFromId('FNL_3_4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('FNL_3_4');
    expect(item!.itemType).toBe('fraction_number_line');
    expect(item!.answer).toBe(3);
  });
});

// ── rounding / number theory / decimals ────────────────────────────────────────

describe('makeItemFromId — rounding', () => {
  it('ROUND_47_10 → rounding, answer 50', () => {
    const item = makeItemFromId('ROUND_47_10');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('ROUND_47_10');
    expect(item!.itemType).toBe('rounding');
    expect(item!.answer).toBe(50);
  });
});

describe('makeItemFromId — prime/composite', () => {
  it('PRIME_7 → prime_composite, answer "prime"', () => {
    const item = makeItemFromId('PRIME_7');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('PRIME_7');
    expect(item!.itemType).toBe('prime_composite');
    expect(item!.answer).toBe('prime');
  });

  it('PRIME_4 → answer "composite"', () => {
    expect(makeItemFromId('PRIME_4')!.answer).toBe('composite');
  });
});

describe('makeItemFromId — factor check', () => {
  it('FACT_3_12 → factor_check, answer "yes"', () => {
    const item = makeItemFromId('FACT_3_12');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('FACT_3_12');
    expect(item!.itemType).toBe('factor_check');
    expect(item!.answer).toBe('yes'); // 12 % 3 === 0
  });

  it('FACT_5_12 → answer "no"', () => {
    expect(makeItemFromId('FACT_5_12')!.answer).toBe('no'); // 12 % 5 !== 0
  });
});

describe('makeItemFromId — decimal add', () => {
  it('DADD_1p5_2p5 → decimal_add, answer 4', () => {
    const item = makeItemFromId('DADD_1p5_2p5');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('DADD_1p5_2p5');
    expect(item!.itemType).toBe('decimal_add');
    expect(item!.answer).toBeCloseTo(4.0);
  });
});

describe('makeItemFromId — decimal subtract', () => {
  it('DSUB_3_1p5 → decimal_sub, answer 1.5', () => {
    // canonical id: tok(300)="3", tok(150)="1p5" → "DSUB_3_1p5"
    const item = makeItemFromId('DSUB_3_1p5');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('DSUB_3_1p5');
    expect(item!.itemType).toBe('decimal_sub');
    expect(item!.answer).toBeCloseTo(1.5);
  });
});

// ── word problems ──────────────────────────────────────────────────────────────

describe('makeItemFromId — word problem', () => {
  it('WORD_eg_6_8 → word_problem, answer 48', () => {
    const item = makeItemFromId('WORD_eg_6_8');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('WORD_eg_6_8');
    expect(item!.itemType).toBe('word_problem');
    expect(item!.answer).toBe(48);
  });

  it('reconstructs every schema deterministically without consulting Math.random', () => {
    for (const id of ['WORD_eg_4_6', 'WORD_ar_4_6', 'WORD_cmp_4_6', 'WORD_dv_4_6']) {
      const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999);
      const first = makeItemFromId(id);
      const second = makeItemFromId(id);
      expect(second).toEqual(first);
      expect(first?.contentSpec).toMatchObject({ domain: 'word_problem', version: 1 });
      random.mockRestore();
    }
  });
});

// ── area / perimeter ───────────────────────────────────────────────────────────

describe('makeItemFromId — area unit squares', () => {
  it('AREA_SQ_3x4 → area_unit_squares, answer 12', () => {
    const item = makeItemFromId('AREA_SQ_3x4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('AREA_SQ_3x4');
    expect(item!.itemType).toBe('area_unit_squares');
    expect(item!.answer).toBe(12);
  });
});

describe('makeItemFromId — area rectangle', () => {
  it('AREA_RECT_5x6 → area_rectangle, answer 30', () => {
    const item = makeItemFromId('AREA_RECT_5x6');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('AREA_RECT_5x6');
    expect(item!.itemType).toBe('area_rectangle');
    expect(item!.answer).toBe(30);
  });
});

describe('makeItemFromId — perimeter rectangle', () => {
  it('PERIM_RECT_3x4 → perimeter_rectangle, answer 14', () => {
    const item = makeItemFromId('PERIM_RECT_3x4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('PERIM_RECT_3x4');
    expect(item!.itemType).toBe('perimeter_rectangle');
    expect(item!.answer).toBe(14);
  });
});

describe('makeItemFromId — rectilinear area', () => {
  it('RECTI_3x4_2x2 → rectilinear_area, answer 16', () => {
    const item = makeItemFromId('RECTI_3x4_2x2');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('RECTI_3x4_2x2');
    expect(item!.itemType).toBe('rectilinear_area');
    expect(item!.answer).toBe(16); // 3*4 + 2*2
  });
});

describe('makeItemFromId — perimeter polygon', () => {
  it('PERIM_POLY_3-4-5 → perimeter_polygon, answer 12', () => {
    const item = makeItemFromId('PERIM_POLY_3-4-5');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('PERIM_POLY_3-4-5');
    expect(item!.itemType).toBe('perimeter_polygon');
    expect(item!.answer).toBe(12);
  });
});

describe('makeItemFromId — perimeter unknown side', () => {
  it('PERIM_UNKSIDE_12_3-4 → perimeter_unknown_side, answer 5', () => {
    const item = makeItemFromId('PERIM_UNKSIDE_12_3-4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('PERIM_UNKSIDE_12_3-4');
    expect(item!.itemType).toBe('perimeter_unknown_side');
    expect(item!.answer).toBe(5); // 12 - (3+4)
  });
});

describe('makeItemFromId — area/perimeter compare', () => {
  it('AREA_PERIM_CMP_sadp_0 → area_perimeter_compare, non-null', () => {
    const item = makeItemFromId('AREA_PERIM_CMP_sadp_0');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('AREA_PERIM_CMP_sadp_0');
    expect(item!.itemType).toBe('area_perimeter_compare');
  });

  it('AREA_PERIM_CMP_spad_1 → area_perimeter_compare, non-null', () => {
    const item = makeItemFromId('AREA_PERIM_CMP_spad_1');
    expect(item).not.toBeNull();
    expect(item!.itemType).toBe('area_perimeter_compare');
  });

  it('AREA_PERIM_CMP_sadp_99 → null (out of range)', () => {
    expect(makeItemFromId('AREA_PERIM_CMP_sadp_99')).toBeNull();
  });
});

// ── multiplication properties ──────────────────────────────────────────────────

describe('makeItemFromId — multiplication properties', () => {
  it('PROP_CMT_3x4 → multiplication_properties, answer 3 (commutative)', () => {
    const item = makeItemFromId('PROP_CMT_3x4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('PROP_CMT_3x4');
    expect(item!.itemType).toBe('multiplication_properties');
    expect(item!.answer).toBe(3); // 3 × 4 = 4 × __
  });

  it('PROP_IDT_5 → answer 5 (identity: 5 × 1 = __)', () => {
    const item = makeItemFromId('PROP_IDT_5');
    expect(item!.id).toBe('PROP_IDT_5');
    expect(item!.answer).toBe(5);
  });

  it('PROP_ZERO_7 → answer 0 (zero: 7 × 0 = __)', () => {
    const item = makeItemFromId('PROP_ZERO_7');
    expect(item!.id).toBe('PROP_ZERO_7');
    expect(item!.answer).toBe(0);
  });

  it('PROP_ASC_2x3x4 → answer 4 (associative: (2×3)×4 = 2×(3×__))', () => {
    const item = makeItemFromId('PROP_ASC_2x3x4');
    expect(item!.id).toBe('PROP_ASC_2x3x4');
    expect(item!.answer).toBe(4);
  });

  it('PROP_DIST_3x4p5 → answer 5 (distributive: 3×(4+5) = (3×4)+(3×__))', () => {
    const item = makeItemFromId('PROP_DIST_3x4p5');
    expect(item!.id).toBe('PROP_DIST_3x4p5');
    expect(item!.answer).toBe(5);
  });
});

// ── measurement ────────────────────────────────────────────────────────────────

describe('makeItemFromId — time to minute', () => {
  it('CLCK_3_15 → time_to_minute, answer "3:15"', () => {
    const item = makeItemFromId('CLCK_3_15');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('CLCK_3_15');
    expect(item!.itemType).toBe('time_to_minute');
    expect(item!.answer).toBe('3:15');
  });
});

describe('makeItemFromId — elapsed time', () => {
  it('ETIME_9_0_10_30 → elapsed_time, answer 90 minutes', () => {
    const item = makeItemFromId('ETIME_9_0_10_30');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('ETIME_9_0_10_30');
    expect(item!.itemType).toBe('elapsed_time');
    expect(item!.answer).toBe(90); // (10*60+30) - (9*60+0)
  });
});

describe('makeItemFromId — bar graph', () => {
  it('BARG_5_3 → bar_graph_read, answer 15', () => {
    const item = makeItemFromId('BARG_5_3');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('BARG_5_3');
    expect(item!.itemType).toBe('bar_graph_read');
    expect(item!.answer).toBe(15); // scale * bars
  });
});

describe('makeItemFromId — line plot', () => {
  it('LPLOT_1_2_3_4 → line_plot_read, answer 10', () => {
    const item = makeItemFromId('LPLOT_1_2_3_4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('LPLOT_1_2_3_4');
    expect(item!.itemType).toBe('line_plot_read');
    expect(item!.answer).toBe(10); // 1+2+3+4
  });
});

describe('makeItemFromId — measurement word problem', () => {
  it('MWRD_addg_5_3 → measurement_word, answer 8', () => {
    const item = makeItemFromId('MWRD_addg_5_3');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('MWRD_addg_5_3');
    expect(item!.itemType).toBe('measurement_word');
    expect(item!.answer).toBe(8); // 5 + 3
  });

  it('MWRD_subg_9_4 → answer 5', () => {
    expect(makeItemFromId('MWRD_subg_9_4')!.answer).toBe(5);
  });
});

// ── two-step / patterns ────────────────────────────────────────────────────────

describe('makeItemFromId — two-step word problem', () => {
  it('WRD2_muls_4_5_2 → word_problem, answer 18', () => {
    const item = makeItemFromId('WRD2_muls_4_5_2');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('WRD2_muls_4_5_2');
    expect(item!.itemType).toBe('word_problem');
    expect(item!.answer).toBe(18); // (4*5) - 2
  });

  it('WRD2_mula_3_4_5 → answer 17', () => {
    expect(makeItemFromId('WRD2_mula_3_4_5')!.answer).toBe(17); // (3*4) + 5
  });
});

describe('makeItemFromId — arithmetic pattern', () => {
  it('APAT_2_3_5 → arithmetic_pattern, answer 17', () => {
    // sequence: 2, 5, 8, 11, 14 (start=2, step=3, terms=5), next = 2 + 5*3 = 17
    const item = makeItemFromId('APAT_2_3_5');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('APAT_2_3_5');
    expect(item!.itemType).toBe('arithmetic_pattern');
    expect(item!.answer).toBe(17);
  });

  it('APAT_1_2_4 → answer 9', () => {
    // sequence: 1, 3, 5, 7 (start=1, step=2, terms=4), next = 1 + 4*2 = 9
    expect(makeItemFromId('APAT_1_2_4')!.answer).toBe(9);
  });
});

// ── unknown / null cases ───────────────────────────────────────────────────────

describe('makeItemFromId — unknown IDs', () => {
  it('returns null for completely unknown prefix', () => {
    expect(makeItemFromId('UNKNOWN_99')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(makeItemFromId('')).toBeNull();
  });

  it('returns null for partial MUL format (missing factor)', () => {
    expect(makeItemFromId('MUL_7')).toBeNull();
  });

  it('returns null for out-of-range area/perimeter compare index', () => {
    expect(makeItemFromId('AREA_PERIM_CMP_spad_99')).toBeNull();
  });
});
