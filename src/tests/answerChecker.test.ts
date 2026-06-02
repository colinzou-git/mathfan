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
});

describe('classifyResponse', () => {
  it('wrong → again', () => expect(classifyResponse(false, 1000)).toBe('again'));
  it('correct fast → easy', () => expect(classifyResponse(true, 1000)).toBe('easy'));
  it('correct normal → good', () => expect(classifyResponse(true, 2500)).toBe('good'));
  it('correct slow → hard', () => expect(classifyResponse(true, 5000)).toBe('hard'));
  // Correct answers are never 'again', regardless of latency — slow-but-correct = 'hard'
  it('correct very slow → hard (not again)', () => expect(classifyResponse(true, 11000)).toBe('hard'));
  it('wrong slow → again', () => expect(classifyResponse(false, 11000)).toBe('again'));
});
