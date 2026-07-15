import type { PracticeItem } from '../../types/math';
import type { WordProblemOperation, WordProblemSpec } from './wordProblemItems';

const SKILL_TWO_STEP = 'SKILL_TWO_STEP_WORD';

// Deterministic noun selection — varies the surface text without randomness so
// every reconstruction of WRD2_muls_4_5_8 always reads "cookies", never "marbles".
const NOUNS  = ['cookies', 'stickers', 'marbles', 'cards', 'pencils', 'shells'];
const PLACES = ['baskets', 'boxes', 'bags', 'jars', 'bins', 'shelves'];
function dn(arr: string[], seed: number): string { return arr[((seed % arr.length) + arr.length) % arr.length]; }

export type TwoStepSchema = 'muls' | 'mula' | 'diva' | 'divs';

export function wrd2Id(schema: TwoStepSchema, a: number, b: number, c: number): string {
  return `WRD2_${schema}_${a}_${b}_${c}`;
}

export function makeTwoStepWordProblem(
  schema: TwoStepSchema, a: number, b: number, c: number,
): PracticeItem {
  const seed = a + b * 7 + c * 13;
  const noun  = dn(NOUNS,  seed);
  const place = dn(PLACES, seed + 3);

  let prompt: string;
  let answer: number;
  let firstOperation: WordProblemOperation;
  let secondOperation: WordProblemOperation;
  let intermediate: number;

  if (schema === 'muls') {
    // (a × b) − c
    prompt = `Sam has ${a} ${place} with ${b} ${noun} each. He uses ${c} ${noun}. How many ${noun} are left?`;
    answer = a * b - c;
    firstOperation = 'multiply'; secondOperation = 'subtract'; intermediate = a * b;
  } else if (schema === 'mula') {
    // (a × b) + c
    prompt = `There are ${a} rows of ${b} chairs. Then ${c} more chairs are added. How many chairs in all?`;
    answer = a * b + c;
    firstOperation = 'multiply'; secondOperation = 'add'; intermediate = a * b;
  } else if (schema === 'diva') {
    // (a ÷ b) + c  — a must be divisible by b
    prompt = `${a} ${noun} are shared equally among ${b} friends. Then each friend gets ${c} more. How many does each friend have?`;
    answer = a / b + c;
    firstOperation = 'divide'; secondOperation = 'add'; intermediate = a / b;
  } else {
    // divs: (a ÷ b) − c  — a must be divisible by b, and a/b > c
    prompt = `${a} ${noun} are shared equally among ${b} children. Each child then gives away ${c}. How many does each child have left?`;
    answer = a / b - c;
    firstOperation = 'divide'; secondOperation = 'subtract'; intermediate = a / b;
  }

  const wordProblemSpec: WordProblemSpec = {
    steps: [{ operation: firstOperation, a, b, result: intermediate }, { operation: secondOperation, a: intermediate, b: c, result: answer }],
    unknownPosition: 'result', contextSchema: `two_step_${schema}`,
    quantities: [{ label: 'first amount', value: a }, { label: 'group or row size', value: b }, { label: 'change', value: c }, { label: 'result' }],
    suggestedModel: 'bar',
  };

  return {
    id: wrd2Id(schema, a, b, c),
    skillId: SKILL_TWO_STEP,
    itemType: 'word_problem',
    prompt,
    answer,
    answerInput: 'numeric',
    tags: ['word_problem', 'two_step', schema],
    difficulty: 0.65,
    factA: a,
    factB: b,
    wordProblemSpec,
    schemaId: `two_step_${schema}`,
    cardKey: `template:g3-word-problem:two-step-${schema}`,
  };
}
