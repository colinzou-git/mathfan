import { describe, it, expect } from 'vitest';
import { checkAnswer, classifyResponse } from '../features/practice/answerChecker';
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
});

describe('classifyResponse', () => {
  it('wrong → again', () => expect(classifyResponse(false, 1000)).toBe('again'));
  it('correct fast → easy', () => expect(classifyResponse(true, 1000)).toBe('easy'));
  it('correct normal → good', () => expect(classifyResponse(true, 2500)).toBe('good'));
  it('correct slow → hard', () => expect(classifyResponse(true, 5000)).toBe('hard'));
  it('correct timeout → again', () => expect(classifyResponse(true, 11000)).toBe('again'));
});
