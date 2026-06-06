import type { PracticeItem } from '../../types/math';

const SKILL_PATTERN = 'SKILL_ARITHMETIC_PATTERN';

/**
 * ID: APAT_${start}_${step}_${terms}
 *
 * Shows `terms` terms of the sequence (start, start+step, …, start+(terms-1)*step)
 * and asks for the next term.
 *
 * Answer = start + terms * step
 */
export function apatId(start: number, step: number, terms: number): string {
  return `APAT_${start}_${step}_${terms}`;
}

export function makeArithmeticPatternItem(
  start: number, step: number, terms: number,
): PracticeItem {
  const shown: number[] = [];
  for (let i = 0; i < terms; i++) shown.push(start + i * step);
  const answer = start + terms * step;
  const shownStr = shown.join(', ');
  return {
    id: apatId(start, step, terms),
    skillId: SKILL_PATTERN,
    itemType: 'arithmetic_pattern',
    prompt: `What number comes next? ${shownStr}, ___`,
    answer,
    answerInput: 'numeric',
    tags: ['pattern', 'arithmetic_sequence', `step_${step}`],
    difficulty: step <= 5 ? 0.35 : 0.5,
    factA: step,
    factB: start,
  };
}
