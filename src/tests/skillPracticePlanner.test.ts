import { describe, it, expect } from 'vitest';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';

// Supported skill IDs from the Phase 9 spec
const SUPPORTED_SKILLS = [
  'G3_OA_MUL_FACTS_0_2_5_10',
  'G3_OA_MUL_FACTS_3_4',
  'G3_OA_MUL_FACTS_6_9',
  'G3_OA_DIV_UNKNOWN_FACTOR',
  'G3_NF_EQUIVALENT_FRACTIONS',
  'G3_NF_COMPARE_FRACTIONS',
  'G3_OA_WORD_EQUAL_GROUPS',
];

describe('planPracticeForSkill — each supported skill returns a valid SessionConfig', () => {
  for (const skillId of SUPPORTED_SKILLS) {
    it(`${skillId} returns a config with positive sessionLength`, () => {
      const config = planPracticeForSkill(skillId);
      expect(config).toBeDefined();
      expect(config.sessionLength).toBeGreaterThan(0);
      expect(typeof config.mode).toBe('string');
    });

    it(`${skillId} respects custom sessionLength`, () => {
      const config = planPracticeForSkill(skillId, { sessionLength: 20 });
      expect(config.sessionLength).toBe(20);
    });
  }
});

describe('planPracticeForSkill — multiplication skills', () => {
  it('G3_OA_MUL_FACTS_0_2_5_10 uses multiplication mode', () => {
    const cfg = planPracticeForSkill('G3_OA_MUL_FACTS_0_2_5_10');
    expect(cfg.mode).toBe('multiplication');
  });

  it('G3_OA_MUL_FACTS_0_2_5_10 specificItemIds contains 0-table and 2-table items', () => {
    const cfg = planPracticeForSkill('G3_OA_MUL_FACTS_0_2_5_10');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_0x'))).toBe(true);
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_2x'))).toBe(true);
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_5x'))).toBe(true);
  });

  it('G3_OA_MUL_FACTS_3_4 specificItemIds only contains 3-table and 4-table items', () => {
    const cfg = planPracticeForSkill('G3_OA_MUL_FACTS_3_4');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_3x') || id.startsWith('MUL_4x'))).toBe(true);
    // Should NOT include 6-table items
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_6x'))).toBe(false);
  });

  it('G3_OA_MUL_FACTS_6_9 specificItemIds includes 6–9 table items', () => {
    const cfg = planPracticeForSkill('G3_OA_MUL_FACTS_6_9');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_6x'))).toBe(true);
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_9x'))).toBe(true);
  });
});

describe('planPracticeForSkill — division skill', () => {
  it('G3_OA_DIV_UNKNOWN_FACTOR uses division mode', () => {
    const cfg = planPracticeForSkill('G3_OA_DIV_UNKNOWN_FACTOR');
    expect(cfg.mode).toBe('division');
  });

  it('G3_OA_DIV_UNKNOWN_FACTOR specificItemIds includes DIV and UNK items', () => {
    const cfg = planPracticeForSkill('G3_OA_DIV_UNKNOWN_FACTOR');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.some(id => id.startsWith('DIV_'))).toBe(true);
    expect(cfg.specificItemIds!.some(id => id.startsWith('UNK_'))).toBe(true);
  });
});

describe('planPracticeForSkill — fraction skills', () => {
  it('G3_NF_EQUIVALENT_FRACTIONS uses fraction mode with equivalent fractionMode', () => {
    const cfg = planPracticeForSkill('G3_NF_EQUIVALENT_FRACTIONS');
    expect(cfg.mode).toBe('fraction');
    expect(cfg.fractionMode).toBe('equivalent');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.some(id => id.startsWith('FEQ_'))).toBe(true);
  });

  it('G3_NF_COMPARE_FRACTIONS uses fraction mode with compare fractionMode', () => {
    const cfg = planPracticeForSkill('G3_NF_COMPARE_FRACTIONS');
    expect(cfg.mode).toBe('fraction');
    expect(cfg.fractionMode).toBe('compare');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.some(id => id.startsWith('FCMP_'))).toBe(true);
  });
});

describe('planPracticeForSkill — word problem skill', () => {
  it('G3_OA_WORD_EQUAL_GROUPS uses word_problem mode', () => {
    const cfg = planPracticeForSkill('G3_OA_WORD_EQUAL_GROUPS');
    expect(cfg.mode).toBe('word_problem');
    expect(cfg.grade).toBe(3);
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.some(id => id.startsWith('WORD_eg_'))).toBe(true);
  });
});

describe('planPracticeForSkill — mastery map skill IDs', () => {
  it('g3-mul-tables-basic maps to multiplication config', () => {
    const cfg = planPracticeForSkill('g3-mul-tables-basic');
    expect(cfg.mode).toBe('multiplication');
    expect(cfg.specificItemIds).toBeDefined();
  });

  it('g3-mul-tables-advanced maps to multiplication config', () => {
    const cfg = planPracticeForSkill('g3-mul-tables-advanced');
    expect(cfg.mode).toBe('multiplication');
    expect(cfg.specificItemIds).toBeDefined();
  });

  it('g3-frac-equivalent maps to equivalent fraction config', () => {
    const cfg = planPracticeForSkill('g3-frac-equivalent');
    expect(cfg.mode).toBe('fraction');
    expect(cfg.fractionMode).toBe('equivalent');
  });

  it('g3-frac-compare maps to compare fraction config', () => {
    const cfg = planPracticeForSkill('g3-frac-compare');
    expect(cfg.mode).toBe('fraction');
    expect(cfg.fractionMode).toBe('compare');
  });

  it('g3-mul-meaning maps to word_problem config', () => {
    const cfg = planPracticeForSkill('g3-mul-meaning');
    expect(cfg.mode).toBe('word_problem');
  });
});

describe('planPracticeForSkill — fallback for unknown skill', () => {
  it('unknown skill ID returns a valid daily_review fallback', () => {
    const cfg = planPracticeForSkill('TOTALLY_UNKNOWN_SKILL');
    expect(cfg.mode).toBe('daily_review');
    expect(cfg.sessionLength).toBeGreaterThan(0);
  });
});

describe('planPracticeForSkill — area skills return AREA_ items, not MUL_', () => {
  it('G3_MD_AREA_ARRAYS uses area mode with AREA_SQ_ items', () => {
    const cfg = planPracticeForSkill('G3_MD_AREA_ARRAYS');
    expect(cfg.mode).toBe('area');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.every(id => id.startsWith('AREA_SQ_'))).toBe(true);
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_'))).toBe(false);
  });

  it('g3-area-concept uses area mode with AREA_SQ_ items', () => {
    const cfg = planPracticeForSkill('g3-area-concept');
    expect(cfg.mode).toBe('area');
    expect(cfg.specificItemIds!.every(id => id.startsWith('AREA_SQ_'))).toBe(true);
  });

  it('g3-area-formula uses area mode with AREA_RECT_ items', () => {
    const cfg = planPracticeForSkill('g3-area-formula');
    expect(cfg.mode).toBe('area');
    expect(cfg.specificItemIds!.every(id => id.startsWith('AREA_RECT_'))).toBe(true);
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_'))).toBe(false);
  });

  it('G3_MD_PERIMETER uses area mode with PERIM_RECT_ items', () => {
    const cfg = planPracticeForSkill('G3_MD_PERIMETER');
    expect(cfg.mode).toBe('area');
    expect(cfg.specificItemIds!.every(id => id.startsWith('PERIM_RECT_'))).toBe(true);
  });

  it('g3-perimeter uses area mode with PERIM_RECT_ items', () => {
    const cfg = planPracticeForSkill('g3-perimeter');
    expect(cfg.mode).toBe('area');
    expect(cfg.specificItemIds!.every(id => id.startsWith('PERIM_RECT_'))).toBe(true);
  });
});

describe('planPracticeForSkill — geometry skills return GEO_ items, not MUL_', () => {
  it('G3_G_SHAPES_ATTRIBUTES uses geometry mode with GEO_ items', () => {
    const cfg = planPracticeForSkill('G3_G_SHAPES_ATTRIBUTES');
    expect(cfg.mode).toBe('geometry');
    expect(cfg.specificItemIds).toBeDefined();
    expect(cfg.specificItemIds!.every(id => id.startsWith('GEO_'))).toBe(true);
    expect(cfg.specificItemIds!.some(id => id.startsWith('MUL_'))).toBe(false);
  });

  it('g3-geo-categories uses geometry mode with GEO_ items', () => {
    const cfg = planPracticeForSkill('g3-geo-categories');
    expect(cfg.mode).toBe('geometry');
    expect(cfg.specificItemIds!.every(id => id.startsWith('GEO_'))).toBe(true);
  });
});

describe('makeItemFromId — area and geometry reconstruction', () => {
  it('reconstructs AREA_RECT_3x4', () => {
    const item = makeItemFromId('AREA_RECT_3x4');
    expect(item).not.toBeNull();
    expect(item!.id).toBe('AREA_RECT_3x4');
    expect(item!.itemType).toBe('area_rectangle');
    expect(item!.answer).toBe(12);
    expect(item!.prompt).toMatch(/area/i);
    expect(item!.prompt).toMatch(/rectangle/i);
    expect(item!.prompt).not.toMatch(/^.*\d+\s*×\s*\d+\s*$/);
  });

  it('reconstructs AREA_SQ_4x5', () => {
    const item = makeItemFromId('AREA_SQ_4x5');
    expect(item).not.toBeNull();
    expect(item!.itemType).toBe('area_unit_squares');
    expect(item!.answer).toBe(20);
    expect(item!.prompt).toMatch(/unit square/i);
  });

  it('reconstructs PERIM_RECT_3x5', () => {
    const item = makeItemFromId('PERIM_RECT_3x5');
    expect(item).not.toBeNull();
    expect(item!.itemType).toBe('perimeter_rectangle');
    expect(item!.answer).toBe(16);
    expect(item!.prompt).toMatch(/perimeter/i);
  });

  it('reconstructs GEO_SIDES_triangle', () => {
    const item = makeItemFromId('GEO_SIDES_triangle');
    expect(item).not.toBeNull();
    expect(item!.itemType).toBe('geometry_vocabulary');
    expect(item!.answer).toBe(3);
    expect(item!.prompt).toMatch(/triangle/i);
  });

  it('reconstructs GEO_NAME_3 with choices', () => {
    const item = makeItemFromId('GEO_NAME_3');
    expect(item).not.toBeNull();
    expect(item!.itemType).toBe('geometry_vocabulary');
    expect(item!.answer).toBe('triangle');
    expect(item!.choices).toBeDefined();
    expect(item!.choices!.length).toBeGreaterThan(1);
  });

  it('reconstructs GEO_ATTR_square_is_rect with True/False choices', () => {
    const item = makeItemFromId('GEO_ATTR_square_is_rect');
    expect(item).not.toBeNull();
    expect(item!.answer).toBe('True');
    expect(item!.choices).toContain('True');
    expect(item!.choices).toContain('False');
  });
});
