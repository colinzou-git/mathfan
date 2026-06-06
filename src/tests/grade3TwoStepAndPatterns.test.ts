/**
 * Tests for two new Grade 3 mastery skills:
 *   g3-word-two-step   — two-step word problems (3.OA.D.8)
 *   g3-patterns-arithmetic — arithmetic patterns  (3.OA.D.9)
 */

import { describe, it, expect } from 'vitest';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { GRADE3_MASTERY_MAP } from '../features/mastery/grade3MasteryMap';
import { checkAnswer } from '../features/practice/answerChecker';

const SKILLS = ['g3-word-two-step', 'g3-patterns-arithmetic'] as const;

// ── Presence in mastery map ───────────────────────────────────────────────────

describe('new skills: present in GRADE3_MASTERY_MAP', () => {
  for (const skillId of SKILLS) {
    it(`${skillId} exists in the map`, () => {
      expect(GRADE3_MASTERY_MAP.find(n => n.id === skillId)).toBeDefined();
    });

    it(`${skillId} has at least one californiaStandardId`, () => {
      const node = GRADE3_MASTERY_MAP.find(n => n.id === skillId)!;
      expect(node.californiaStandardIds.length).toBeGreaterThan(0);
    });
  }
});

// ── Non-empty specificItemIds ─────────────────────────────────────────────────

describe('new skills: non-empty specificItemIds', () => {
  for (const skillId of SKILLS) {
    it(`${skillId} has non-empty specificItemIds`, () => {
      const cfg = planPracticeForSkill(skillId);
      expect(cfg.specificItemIds).toBeDefined();
      expect(cfg.specificItemIds!.length).toBeGreaterThan(0);
    });
  }
});

// ── Reconstruction ────────────────────────────────────────────────────────────

describe('new skills: every item ID reconstructs to a non-null item', () => {
  for (const skillId of SKILLS) {
    it(`${skillId}: all specificItemIds reconstruct`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        expect(makeItemFromId(id), `"${id}" should reconstruct`).not.toBeNull();
      }
    });
  }
});

// ── Finite answers ────────────────────────────────────────────────────────────

describe('new skills: every item has a valid finite numeric answer', () => {
  for (const skillId of SKILLS) {
    it(`${skillId}: no NaN or Infinity answers`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id)!;
        expect(item).not.toBeNull();
        const ans = item.answer;
        expect(typeof ans).toBe('number');
        expect(Number.isFinite(ans as number), `"${id}" answer should be finite`).toBe(true);
      }
    });
  }
});

// ── Skill crediting ───────────────────────────────────────────────────────────

describe('new skills: every item infers back to its own skill', () => {
  for (const skillId of SKILLS) {
    it(`${skillId}: all items infer to ${skillId}`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id)!;
        expect(item).not.toBeNull();
        expect(
          inferGrade3SkillId(item),
          `"${id}" should credit to ${skillId}`,
        ).toBe(skillId);
      }
    });
  }
});

// ── Two-step structural checks ────────────────────────────────────────────────

describe('g3-word-two-step: item IDs and answer correctness', () => {
  it('all IDs start with WRD2_', () => {
    for (const id of planPracticeForSkill('g3-word-two-step').specificItemIds ?? []) {
      expect(id.startsWith('WRD2_'), `"${id}" should start with WRD2_`).toBe(true);
    }
  });

  it('muls answer = a×b − c', () => {
    const item = makeItemFromId('WRD2_muls_4_5_8')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(4 * 5 - 8); // 12
  });

  it('mula answer = a×b + c', () => {
    const item = makeItemFromId('WRD2_mula_3_4_8')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(3 * 4 + 8); // 20
  });

  it('diva answer = a÷b + c', () => {
    const item = makeItemFromId('WRD2_diva_12_3_5')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(12 / 3 + 5); // 9
  });

  it('divs answer = a÷b − c', () => {
    const item = makeItemFromId('WRD2_divs_24_4_3')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(24 / 4 - 3); // 3
  });

  it('all answers are positive integers', () => {
    for (const id of planPracticeForSkill('g3-word-two-step').specificItemIds ?? []) {
      const item = makeItemFromId(id)!;
      expect(item.answer as number).toBeGreaterThan(0);
      expect(Number.isInteger(item.answer)).toBe(true);
    }
  });

  it('all divs and diva answers are exact (no fractional results)', () => {
    for (const id of planPracticeForSkill('g3-word-two-step').specificItemIds ?? []) {
      if (!id.startsWith('WRD2_div')) continue;
      const item = makeItemFromId(id)!;
      expect(Number.isInteger(item.answer), `"${id}" should have integer answer`).toBe(true);
    }
  });

  it('tags include two_step', () => {
    const item = makeItemFromId('WRD2_muls_4_5_8')!;
    expect(item.tags).toContain('two_step');
  });

  it('itemType is word_problem', () => {
    const item = makeItemFromId('WRD2_muls_4_5_8')!;
    expect(item.itemType).toBe('word_problem');
  });

  it('does not infer to g3-mul-meaning or g3-div-meaning', () => {
    for (const id of planPracticeForSkill('g3-word-two-step').specificItemIds ?? []) {
      const item = makeItemFromId(id)!;
      const skill = inferGrade3SkillId(item);
      expect(skill).not.toBe('g3-mul-meaning');
      expect(skill).not.toBe('g3-div-meaning');
    }
  });
});

// ── Pattern structural checks ─────────────────────────────────────────────────

describe('g3-patterns-arithmetic: item IDs and answer correctness', () => {
  it('all IDs start with APAT_', () => {
    for (const id of planPracticeForSkill('g3-patterns-arithmetic').specificItemIds ?? []) {
      expect(id.startsWith('APAT_'), `"${id}" should start with APAT_`).toBe(true);
    }
  });

  it('APAT_2_2_4 answer = 10 (next in 2,4,6,8)', () => {
    const item = makeItemFromId('APAT_2_2_4')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(10);
  });

  it('APAT_3_3_4 answer = 15 (next in 3,6,9,12)', () => {
    const item = makeItemFromId('APAT_3_3_4')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(15);
  });

  it('APAT_0_3_5 answer = 15 (next in 0,3,6,9,12)', () => {
    const item = makeItemFromId('APAT_0_3_5')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(15);
  });

  it('APAT_1_3_4 answer = 13 (next in 1,4,7,10)', () => {
    const item = makeItemFromId('APAT_1_3_4')!;
    expect(item).not.toBeNull();
    expect(item.answer).toBe(13);
  });

  it('answer = start + terms × step for all items', () => {
    for (const id of planPracticeForSkill('g3-patterns-arithmetic').specificItemIds ?? []) {
      const m = id.match(/^APAT_(\d+)_(\d+)_(\d+)$/);
      expect(m, `"${id}" should match APAT pattern`).not.toBeNull();
      const [start, step, terms] = [+m![1], +m![2], +m![3]];
      const item = makeItemFromId(id)!;
      expect(item.answer).toBe(start + terms * step);
    }
  });

  it('itemType is arithmetic_pattern', () => {
    const item = makeItemFromId('APAT_3_3_4')!;
    expect(item.itemType).toBe('arithmetic_pattern');
  });

  it('all answers are positive integers', () => {
    for (const id of planPracticeForSkill('g3-patterns-arithmetic').specificItemIds ?? []) {
      const item = makeItemFromId(id)!;
      expect(item.answer as number).toBeGreaterThan(0);
      expect(Number.isInteger(item.answer)).toBe(true);
    }
  });
});

// ── Answer checking (retry-first behavior) ────────────────────────────────────

describe('answer checking: retry-first behavior (no answer reveal on wrong)', () => {
  it('wrong two-step answer grades as "again"', () => {
    const item = makeItemFromId('WRD2_muls_4_5_8')!; // answer = 12
    const result = checkAnswer(item, '99', 2000);
    expect(result.isCorrect).toBe(false);
    expect(result.reviewGrade).toBe('again');
  });

  it('correct two-step answer grades as "good"', () => {
    const item = makeItemFromId('WRD2_muls_4_5_8')!; // answer = 12
    const result = checkAnswer(item, '12', 2000);
    expect(result.isCorrect).toBe(true);
    expect(result.reviewGrade).toBe('good');
  });

  it('wrong pattern answer grades as "again"', () => {
    const item = makeItemFromId('APAT_3_3_4')!; // answer = 15
    const result = checkAnswer(item, '14', 1000);
    expect(result.isCorrect).toBe(false);
    expect(result.reviewGrade).toBe('again');
  });

  it('correct pattern answer grades as "good"', () => {
    const item = makeItemFromId('APAT_3_3_4')!; // answer = 15
    const result = checkAnswer(item, '15', 2000);
    expect(result.isCorrect).toBe(true);
  });

  it('fast correct pattern answer grades as "easy"', () => {
    const item = makeItemFromId('APAT_2_2_4')!; // answer = 10
    const result = checkAnswer(item, '10', 500); // under FAST_MS = 1500
    expect(result.isCorrect).toBe(true);
    expect(result.reviewGrade).toBe('easy');
  });
});

// ── Existing single-step word problem mapping is unaffected ──────────────────

describe('existing single-step word problems still map correctly', () => {
  it('WORD_eg_3_4 → g3-mul-meaning (not two-step)', () => {
    const item = makeItemFromId('WORD_eg_3_4')!;
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item)).toBe('g3-mul-meaning');
  });

  it('WORD_dv_4_3 → g3-div-meaning (not two-step)', () => {
    const item = makeItemFromId('WORD_dv_4_3')!;
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item)).toBe('g3-div-meaning');
  });
});
