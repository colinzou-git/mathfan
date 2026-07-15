import type { PracticeItem, GradeLevel } from '../../types/math';
import type { DivisionQuestionSpec } from './divisionItems';

const SKILL_WORD = 'SKILL_WORD_PROBLEMS';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/** Max factor by grade — keeps mental-math answers reasonable. */
function factorMax(grade: GradeLevel): number {
  if (grade === 3) return 10;
  if (grade === 4) return 12;
  return 12;
}

// Stable ID per (schema, a, b) — the noun is cosmetic and not encoded.
export function wordId(schema: string, a: number, b: number): string {
  return `WORD_${schema}_${a}_${b}`;
}

export type Schema = 'eg' | 'ar' | 'cmp' | 'dv';
export type WordProblemOperation = 'add' | 'subtract' | 'multiply' | 'divide';
export type UnknownPosition = 'result' | 'change' | 'start' | 'group_size' | 'group_count';
export interface WordProblemSpec {
  steps: Array<{ operation: WordProblemOperation; a: number; b: number; result: number }>;
  unknownPosition: UnknownPosition;
  contextSchema: string;
  quantities: Array<{ label: string; value?: number; unit?: string }>;
  suggestedModel?: 'bar' | 'array' | 'equal_groups' | 'number_line' | 'none';
}

const NOUNS = ['apples', 'stickers', 'marbles', 'crayons', 'cookies', 'pencils', 'shells', 'cards'];
const CONTAINERS = ['bags', 'boxes', 'baskets', 'jars', 'shelves', 'bins'];
const NAMES = ['Sam', 'Mia', 'Leo', 'Ava', 'Max', 'Zoe', 'Ben', 'Lily'];

export function makeWordProblem(schema: Schema, a: number, b: number): PracticeItem {
  let prompt: string;
  let answer: number;
  let divisionSpec: DivisionQuestionSpec | undefined;
  let wordProblemSpec: WordProblemSpec;

  if (schema === 'eg') {
    const c = pick(CONTAINERS), n = pick(NOUNS);
    prompt = `There are ${a} ${c}. Each one has ${b} ${n}. How many ${n} in all?`;
    answer = a * b;
    wordProblemSpec = { steps: [{ operation: 'multiply', a, b, result: answer }], unknownPosition: 'result', contextSchema: 'equal_groups', quantities: [{ label: 'groups', value: a }, { label: 'in each group', value: b }], suggestedModel: 'equal_groups' };
  } else if (schema === 'ar') {
    const n = pick(['chairs', 'tiles', 'stamps', 'seats', 'windows']);
    prompt = `A grid has ${a} rows of ${b} ${n}. How many ${n} are there?`;
    answer = a * b;
    wordProblemSpec = { steps: [{ operation: 'multiply', a, b, result: answer }], unknownPosition: 'result', contextSchema: 'array', quantities: [{ label: 'rows', value: a }, { label: 'in each row', value: b }], suggestedModel: 'array' };
  } else if (schema === 'cmp') {
    const n1 = pick(NAMES), n2 = pick(NAMES.filter(x => x !== n1)), n = pick(NOUNS);
    prompt = `${n1} has ${b} ${n}. ${n2} has ${a} times as many. How many does ${n2} have?`;
    answer = a * b;
    wordProblemSpec = { steps: [{ operation: 'multiply', a, b, result: answer }], unknownPosition: 'result', contextSchema: 'multiplicative_compare', quantities: [{ label: 'times as many', value: a }, { label: 'starting amount', value: b }], suggestedModel: 'bar' };
  } else {
    // division: p shared into a groups → b each
    const p = a * b, c = pick(CONTAINERS), n = pick(NOUNS);
    prompt = `${p} ${n} are shared equally into ${a} ${c}. How many ${n} per ${c.replace(/s$/, '')}?`;
    answer = b;
    divisionSpec = {
      schema: 'equal_sharing', dividend: p, divisor: a, quotient: b,
      context: { interpretation: 'sharing', noun: n, groupNoun: c }, unknownPosition: 'group_size',
    };
    wordProblemSpec = { steps: [{ operation: 'divide', a: p, b: a, result: answer }], unknownPosition: 'group_size', contextSchema: 'equal_sharing', quantities: [{ label: n, value: p }, { label: c, value: a }], suggestedModel: 'equal_groups' };
  }

  return {
    id: wordId(schema, a, b),
    skillId: SKILL_WORD,
    itemType: 'word_problem',
    prompt,
    answer,
    answerInput: 'numeric',
    tags: ['word_problem', schema],
    difficulty: schema === 'dv' ? 0.6 : 0.5,
    factA: a,
    factB: b,
    divisionSpec,
    wordProblemSpec,
  };
}

const SCHEMAS: Schema[] = ['eg', 'ar', 'cmp', 'dv'];

export function generateWordProblemItems(
  grade: GradeLevel, count: number, rangeMin?: number, rangeMax?: number,
): PracticeItem[] {
  const max = Math.max(0, Math.floor(rangeMax ?? factorMax(grade)));
  const min = Math.max(0, Math.min(max, Math.floor(rangeMin ?? (grade === 3 ? 2 : 3))));
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const schema = pick(SCHEMAS);
    const a = randInt(min, max);
    const b = randInt(min, max);
    if (schema === 'dv' && a < 1) continue; // can't divide into 0 groups
    const item = makeWordProblem(schema, a, b);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
