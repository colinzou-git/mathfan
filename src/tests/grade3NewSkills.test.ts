/**
 * Tests for the seven new Grade 3 mastery skills:
 *   g3-round-nearest-10-100, g3-mul-multiple-of-10,
 *   g3-time-to-minute, g3-elapsed-time,
 *   g3-volume-mass-word-problems, g3-scaled-bar-graphs, g3-line-plots
 */

import { describe, it, expect } from 'vitest';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { GRADE3_MASTERY_MAP } from '../features/mastery/grade3MasteryMap';

const NEW_SKILLS = [
  'g3-round-nearest-10-100',
  'g3-mul-multiple-of-10',
  'g3-time-to-minute',
  'g3-elapsed-time',
  'g3-volume-mass-word-problems',
  'g3-scaled-bar-graphs',
  'g3-line-plots',
] as const;

// ── 1. All new skills exist in GRADE3_MASTERY_MAP ─────────────────────────────

describe('new Grade 3 skills: present in GRADE3_MASTERY_MAP', () => {
  for (const skillId of NEW_SKILLS) {
    it(`${skillId} is in the map`, () => {
      expect(GRADE3_MASTERY_MAP.find(n => n.id === skillId)).toBeDefined();
    });
  }
});

// ── 2. Non-empty specificItemIds ──────────────────────────────────────────────

describe('new Grade 3 skills: non-empty specificItemIds', () => {
  for (const skillId of NEW_SKILLS) {
    it(`${skillId} has non-empty specificItemIds`, () => {
      const cfg = planPracticeForSkill(skillId);
      expect(cfg.specificItemIds).toBeDefined();
      expect(cfg.specificItemIds!.length).toBeGreaterThan(0);
    });
  }
});

// ── 3. All item IDs reconstruct ───────────────────────────────────────────────

describe('new Grade 3 skills: every item ID reconstructs', () => {
  for (const skillId of NEW_SKILLS) {
    it(`${skillId}: all specificItemIds reconstruct to non-null items`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        expect(makeItemFromId(id), `"${id}" should reconstruct`).not.toBeNull();
      }
    });
  }
});

// ── 4. All items have finite answers ─────────────────────────────────────────

describe('new Grade 3 skills: every item has a valid answer', () => {
  for (const skillId of NEW_SKILLS) {
    it(`${skillId}: no NaN or Infinity numeric answers`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id);
        expect(item).not.toBeNull();
        if (typeof item!.answer === 'number') {
          expect(Number.isFinite(item!.answer), `"${id}" answer should be finite`).toBe(true);
        } else {
          // String answers (e.g. time items) must be non-empty
          expect(String(item!.answer).length).toBeGreaterThan(0);
        }
      }
    });
  }
});

// ── 5. Every item infers back to the correct skill ───────────────────────────

describe('new Grade 3 skills: every item infers back to its own skill', () => {
  for (const skillId of NEW_SKILLS) {
    it(`${skillId}: all items infer to ${skillId}`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id);
        expect(item, `"${id}" should reconstruct`).not.toBeNull();
        expect(
          inferGrade3SkillId(item!),
          `"${id}" should infer to ${skillId}`,
        ).toBe(skillId);
      }
    });
  }
});

// ── 6. Skill-specific structural checks ──────────────────────────────────────

describe('g3-round-nearest-10-100: items use ROUND_ prefix with place 10 or 100', () => {
  it('all item IDs start with ROUND_', () => {
    const cfg = planPracticeForSkill('g3-round-nearest-10-100');
    for (const id of cfg.specificItemIds ?? []) {
      expect(id.startsWith('ROUND_'), `"${id}" should be a ROUND_ item`).toBe(true);
    }
  });

  it('all items have place value 10 or 100', () => {
    const cfg = planPracticeForSkill('g3-round-nearest-10-100');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      expect([10, 100]).toContain(item!.factB);
    }
  });
});

describe('g3-mul-multiple-of-10: items are MUL_ with one factor in 20-90', () => {
  it('all item IDs start with MUL_', () => {
    const cfg = planPracticeForSkill('g3-mul-multiple-of-10');
    for (const id of cfg.specificItemIds ?? []) {
      expect(id.startsWith('MUL_'), `"${id}" should be a MUL_ item`).toBe(true);
    }
  });

  it('all items have one factor in 20-90 (multiple of 10) and other in 2-9', () => {
    const cfg = planPracticeForSkill('g3-mul-multiple-of-10');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      const a = item!.factA ?? 0;
      const b = item!.factB ?? 0;
      const isMultOf10 = (n: number) => n >= 20 && n <= 90 && n % 10 === 0;
      const isSingle = (n: number) => n >= 2 && n <= 9;
      expect(
        (isMultOf10(a) && isSingle(b)) || (isMultOf10(b) && isSingle(a)),
        `"${id}": one of (${a},${b}) should be in 20–90 multiple of 10 and other 2–9`,
      ).toBe(true);
    }
  });
});

describe('g3-time-to-minute: items are CLCK_ with valid hour/minute and include correct answer in choices', () => {
  it('all item IDs start with CLCK_', () => {
    const cfg = planPracticeForSkill('g3-time-to-minute');
    for (const id of cfg.specificItemIds ?? []) {
      expect(id.startsWith('CLCK_'), `"${id}" should be a CLCK_ item`).toBe(true);
    }
  });

  it('all time items include correct answer in choices', () => {
    const cfg = planPracticeForSkill('g3-time-to-minute');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      expect(item!.choices).toBeDefined();
      expect(item!.choices!.map(String)).toContain(String(item!.answer));
    }
  });

  it('all time items have answerInput choice', () => {
    const cfg = planPracticeForSkill('g3-time-to-minute');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item!.answerInput).toBe('choice');
    }
  });
});

describe('g3-elapsed-time: items are ETIME_ with positive numeric answers', () => {
  it('all item IDs start with ETIME_', () => {
    const cfg = planPracticeForSkill('g3-elapsed-time');
    for (const id of cfg.specificItemIds ?? []) {
      expect(id.startsWith('ETIME_'), `"${id}" should be an ETIME_ item`).toBe(true);
    }
  });

  it('all elapsed time answers are positive integers', () => {
    const cfg = planPracticeForSkill('g3-elapsed-time');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      expect(typeof item!.answer).toBe('number');
      expect(item!.answer as number).toBeGreaterThan(0);
      expect(Number.isInteger(item!.answer)).toBe(true);
    }
  });
});

describe('g3-volume-mass-word-problems: items are MWRD_ with positive answers', () => {
  it('all item IDs start with MWRD_', () => {
    const cfg = planPracticeForSkill('g3-volume-mass-word-problems');
    for (const id of cfg.specificItemIds ?? []) {
      expect(id.startsWith('MWRD_'), `"${id}" should be a MWRD_ item`).toBe(true);
    }
  });

  it('all measurement word problem answers are positive', () => {
    const cfg = planPracticeForSkill('g3-volume-mass-word-problems');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      expect(typeof item!.answer).toBe('number');
      expect(item!.answer as number).toBeGreaterThan(0);
    }
  });
});

describe('g3-scaled-bar-graphs: items are BARG_ with answer = scale × bars', () => {
  it('all item IDs start with BARG_', () => {
    const cfg = planPracticeForSkill('g3-scaled-bar-graphs');
    for (const id of cfg.specificItemIds ?? []) {
      expect(id.startsWith('BARG_'), `"${id}" should be a BARG_ item`).toBe(true);
    }
  });

  it('all bar graph answers equal scale × bars', () => {
    const cfg = planPracticeForSkill('g3-scaled-bar-graphs');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      const scale = item!.factA ?? 0;
      const bars = item!.factB ?? 0;
      expect(item!.answer).toBe(scale * bars);
    }
  });
});

describe('g3-line-plots: items are LPLOT_ with answer = sum of 4 values', () => {
  it('all item IDs start with LPLOT_', () => {
    const cfg = planPracticeForSkill('g3-line-plots');
    for (const id of cfg.specificItemIds ?? []) {
      expect(id.startsWith('LPLOT_'), `"${id}" should be a LPLOT_ item`).toBe(true);
    }
  });

  it('all line plot answers are positive integers', () => {
    const cfg = planPracticeForSkill('g3-line-plots');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      expect(typeof item!.answer).toBe('number');
      expect(item!.answer as number).toBeGreaterThan(0);
    }
  });
});

// ── 7. Existing multiplication skill mapping is unaffected ────────────────────

describe('existing skill mapping: mul-by-10 items (20–90) map to g3-mul-multiple-of-10', () => {
  it('MUL_3x20 → g3-mul-multiple-of-10', () => {
    const item = makeItemFromId('MUL_3x20');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBe('g3-mul-multiple-of-10');
  });

  it('MUL_4x50 → g3-mul-multiple-of-10', () => {
    const item = makeItemFromId('MUL_4x50');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBe('g3-mul-multiple-of-10');
  });

  it('MUL_3x10 still → g3-mul-tables-advanced (10 is the times-10 table)', () => {
    const item = makeItemFromId('MUL_3x10');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBe('g3-mul-tables-advanced');
  });
});

describe('existing skill mapping: rounding items map to g3-round-nearest-10-100', () => {
  it('ROUND_43_10 → g3-round-nearest-10-100', () => {
    const item = makeItemFromId('ROUND_43_10');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBe('g3-round-nearest-10-100');
  });

  it('ROUND_247_100 → g3-round-nearest-10-100', () => {
    const item = makeItemFromId('ROUND_247_100');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBe('g3-round-nearest-10-100');
  });
});
