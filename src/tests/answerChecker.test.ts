import { describe, it, expect } from 'vitest';
import { checkAnswer, classifyResponse, legacyClassifyByLatency } from '../features/practice/answerChecker';
import type { StudentFluencyBaseline } from '../features/fluency/fluencyEngine';
import type { PracticeItem } from '../types/math';

const item: PracticeItem = {
  id: 'MUL_8x9',
  skillId: 'SKILL_MUL_FACTS',
  itemType: 'multiplication_fact',
  prompt: '8 × 9',
  answer: 72,
  tags: ['multiplication'],
  difficulty: 0.8,
};

describe('checkAnswer', () => {
  it('correct exact answer → isCorrect true', () => {
    const r = checkAnswer(item, '72', 1200);
    expect(r.isCorrect).toBe(true);
  });

  it('correct answer with whitespace → isCorrect true', () => {
    const r = checkAnswer(item, '  72  ', 1200);
    expect(r.isCorrect).toBe(true);
  });

  it('wrong answer → isCorrect false', () => {
    const r = checkAnswer(item, '63', 1200);
    expect(r.isCorrect).toBe(false);
  });

  it('empty input → isCorrect false', () => {
    const r = checkAnswer(item, '', 1200);
    expect(r.isCorrect).toBe(false);
  });

  // parseFloat silently truncates trailing non-numeric chars — strict validation must reject these
  it('trailing letters "72abc" → isCorrect false', () => {
    expect(checkAnswer(item, '72abc', 1200).isCorrect).toBe(false);
  });

  it('double decimal "1.2.3" → isCorrect false', () => {
    const decItem: PracticeItem = { ...item, itemType: 'decimal_add', answer: 1.2 };
    expect(checkAnswer(decItem, '1.2.3', 1200).isCorrect).toBe(false);
  });

  it('decimal input rejected for integer answer', () => {
    // 7.2 is not a valid answer for an integer-answer item even if close
    expect(checkAnswer(item, '7.2', 1200).isCorrect).toBe(false);
  });

  it('decimal input accepted when answer is a decimal', () => {
    const decItem: PracticeItem = { ...item, itemType: 'decimal_add', answer: 4.6 };
    expect(checkAnswer(decItem, '4.6', 1200).isCorrect).toBe(true);
  });

  it('leading-dot decimal ".5" accepted when answer is decimal', () => {
    const decItem: PracticeItem = { ...item, itemType: 'decimal_add', answer: 0.5 };
    expect(checkAnswer(decItem, '.5', 1200).isCorrect).toBe(true);
  });
});

const choiceItem: PracticeItem = {
  id: 'FCMP_1_3_1_2',
  skillId: 'SKILL_FRACTIONS',
  itemType: 'fraction_compare',
  prompt: '1/3 ▢ 1/2',
  answer: '<',
  answerInput: 'choice',
  choices: ['<', '=', '>'],
  tags: ['fractions'],
  difficulty: 0.5,
};

describe('checkAnswer — choice/string answers', () => {
  it('matching choice → correct', () => {
    expect(checkAnswer(choiceItem, '<', 900).isCorrect).toBe(true);
  });
  it('wrong choice → incorrect', () => {
    expect(checkAnswer(choiceItem, '>', 900).isCorrect).toBe(false);
  });
  it('whitespace around choice still matches', () => {
    expect(checkAnswer(choiceItem, ' < ', 900).isCorrect).toBe(true);
  });
  it('numeric input against a string answer → incorrect', () => {
    expect(checkAnswer(choiceItem, '5', 900).isCorrect).toBe(false);
  });
  it('matches a multi-word choice after symmetric whitespace normalization', () => {
    const explanation = { ...choiceItem, answer: 'Compare equal-sized pieces first.' };
    expect(checkAnswer(explanation, 'Compare equal-sized pieces first.', 900).isCorrect).toBe(true);
  });
  it('matches equation choices containing spaces', () => {
    const equation = { ...choiceItem, answer: '4 + 7 + 5 + x = 22' };
    expect(checkAnswer(equation, '4 + 7 + 5 + x = 22', 900).isCorrect).toBe(true);
  });
});

// ── Task-aware classification (issue #27) ──────────────────────────────────────

const mulFact: PracticeItem = { ...item, id: 'MUL_7x8', prompt: '7 × 8', answer: 56 };
const subItem: PracticeItem = {
  id: 'SUB_532m174', skillId: 'SKILL_SUB', itemType: 'subtraction_fact',
  prompt: '532 − 174', answer: 358, tags: [], difficulty: 0.6,
};
const elapsedTimeItem: PracticeItem = {
  id: 'ETIME_3_15_5_0', skillId: 'SKILL_TIME', itemType: 'elapsed_time',
  prompt: 'Elapsed time?', answer: 105, tags: [], difficulty: 0.5,
};
const twoStepItem: PracticeItem = {
  id: 'WRD2_muls_5_6_10', skillId: 'SKILL_WORD2', itemType: 'word_problem',
  prompt: 'Two-step word problem', answer: 20, tags: [], difficulty: 0.7,
};

function noHint(isCorrect: boolean, latencyMs: number, studentFluency?: StudentFluencyBaseline | null) {
  return { isCorrect, latencyMs, hintUsed: false, studentFluency };
}

describe('classifyResponse — atomic_fluency (multiplication/division facts)', () => {
  it('7×8 correct in 900ms with no baseline → good, not easy (unproven fluency)', () => {
    const r = classifyResponse(mulFact, noHint(true, 900));
    expect(r.reviewGrade).toBe('good');
    expect(r.fluencyBand).toBe('fast');
    expect(r.policyKind).toBe('atomic_fluency');
  });
  it('7×8 correct in 3s (expected range) → good', () => {
    expect(classifyResponse(mulFact, noHint(true, 3000)).reviewGrade).toBe('good');
  });
  it('7×8 correct in 8s (slow) → hard, not again', () => {
    const r = classifyResponse(mulFact, noHint(true, 8000));
    expect(r.reviewGrade).toBe('hard');
    expect(r.ratingReason).toBe('slow_fluent_correct');
  });
  it('awards easy only with an established personal baseline', () => {
    const baseline: StudentFluencyBaseline = { cardFamily: 'fact:mul:7x8', sampleCount: 10, medianMs: 1000, p25Ms: 700, p75Ms: 1400 };
    const r = classifyResponse(mulFact, noHint(true, 500, baseline));
    expect(r.reviewGrade).toBe('easy');
    expect(r.ratingReason).toBe('fast_fluent_correct');
    expect(r).toMatchObject({
      fluencyBaselineSource: 'student', fluencySampleCount: 10,
      fluencyFastCutoffMs: 700, fluencySlowCutoffMs: 1400,
    });
  });
  it('records policy-default cutoff telemetry when personal evidence is insufficient', () => {
    const r = classifyResponse(mulFact, noHint(true, 500));
    expect(r.reviewGrade).toBe('good');
    expect(r.fluencyBaselineSource).toBe('policy_default');
    expect(r.fluencySampleCount).toBe(0);
  });
  it('incorrect always produces again', () => {
    expect(classifyResponse(mulFact, noHint(false, 1000)).reviewGrade).toBe('again');
    expect(classifyResponse(mulFact, noHint(false, 1000)).ratingReason).toBe('incorrect');
  });
});

describe('classifyResponse — non-atomic policies never use the old universal 4s/1.5s cutoffs', () => {
  it('three-digit subtraction correct in 30s → good, not hard', () => {
    const r = classifyResponse(subItem, noHint(true, 30_000));
    expect(r.reviewGrade).toBe('good');
    expect(r.policyKind).not.toBe('atomic_fluency');
    expect(r.fluencyBaselineSource).toBe('not_applicable');
  });
  it('elapsed-time correct in 15s → good', () => {
    expect(classifyResponse(elapsedTimeItem, noHint(true, 15_000)).reviewGrade).toBe('good');
    expect(classifyResponse(elapsedTimeItem, noHint(true, 15_000)).policyKind).toBe('visual_interpretation');
  });
  it('two-step word problem correct in 40s → good', () => {
    expect(classifyResponse(twoStepItem, noHint(true, 40_000)).reviewGrade).toBe('good');
    expect(classifyResponse(twoStepItem, noHint(true, 40_000)).policyKind).toBe('multi_step');
  });
  it('incorrect on a non-atomic policy still produces again', () => {
    expect(classifyResponse(subItem, noHint(false, 30_000)).reviewGrade).toBe('again');
  });
});

describe('classifyResponse — supported/retry answers are non-scheduling evidence', () => {
  it('a hinted correct answer stays direct evidence but is not scheduling-eligible', () => {
    const r = classifyResponse(mulFact, { isCorrect: true, latencyMs: 1000, hintUsed: true });
    expect(r.isCorrect).toBe(true);
    expect(r.schedulingEligible).toBe(false);
    expect(r.ratingReason).toBe('supported_correct');
  });
  it('an unhinted correct answer is scheduling-eligible', () => {
    expect(classifyResponse(mulFact, noHint(true, 1000)).schedulingEligible).toBe(true);
  });
});

describe('checkAnswer — carries the full response evidence', () => {
  it('exposes ratingReason, fluencyBand, policyKind, and schedulingEligible', () => {
    const r = checkAnswer(mulFact, '56', 900);
    expect(r.ratingReason).toBeDefined();
    expect(r.fluencyBand).toBeDefined();
    expect(r.policyKind).toBe('atomic_fluency');
    expect(r.schedulingEligible).toBe(true);
  });
  it('passes hintUsed through to a non-scheduling-eligible grade', () => {
    const r = checkAnswer(mulFact, '56', 900, { hintUsed: true });
    expect(r.schedulingEligible).toBe(false);
  });
});

describe('legacyClassifyByLatency — exact pre-#27 behavior, for historical event replay only', () => {
  it('wrong → again', () => expect(legacyClassifyByLatency(false, 1000)).toBe('again'));
  it('correct fast → easy', () => expect(legacyClassifyByLatency(true, 1000)).toBe('easy'));
  it('correct normal → good', () => expect(legacyClassifyByLatency(true, 2500)).toBe('good'));
  it('correct slow → hard', () => expect(legacyClassifyByLatency(true, 5000)).toBe('hard'));
  it('correct very slow → hard (not again)', () => expect(legacyClassifyByLatency(true, 11000)).toBe('hard'));
  it('wrong slow → again', () => expect(legacyClassifyByLatency(false, 11000)).toBe('again'));
});
