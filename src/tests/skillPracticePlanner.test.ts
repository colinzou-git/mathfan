import { describe, it, expect } from 'vitest';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';

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
