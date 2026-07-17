import type { PracticeItem, GradeLevel } from '../../types/math';

export type Rng = () => number;

function randInt(min: number, max: number, rng: Rng): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[], rng: Rng): T { return arr[Math.floor(rng() * arr.length)]; }

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
export type OneStepWordProblemSchema =
  | 'equal_groups_result'
  | 'array_result'
  | 'multiplicative_compare_result'
  | 'equal_sharing_group_size';
export type WordProblemOperation = 'add' | 'subtract' | 'multiply' | 'divide';
export type UnknownPosition = 'result' | 'change' | 'start' | 'group_size' | 'group_count';
export interface OneStepWordProblemDescriptor {
  legacyCode: Schema;
  schemaId: OneStepWordProblemSchema;
  cardKey: string;
  skillId: string;
  operation: 'multiply' | 'divide';
  unknownPosition: UnknownPosition;
}
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

const DESCRIPTORS: Record<Schema, OneStepWordProblemDescriptor> = {
  eg: { legacyCode: 'eg', schemaId: 'equal_groups_result', cardKey: 'template:g3-word:equal-groups-result', skillId: 'g3-mul-meaning', operation: 'multiply', unknownPosition: 'result' },
  ar: { legacyCode: 'ar', schemaId: 'array_result', cardKey: 'template:g3-word:array-result', skillId: 'g3-mul-meaning', operation: 'multiply', unknownPosition: 'result' },
  cmp: { legacyCode: 'cmp', schemaId: 'multiplicative_compare_result', cardKey: 'template:g3-word:multiplicative-compare-result', skillId: 'g3-mul-meaning', operation: 'multiply', unknownPosition: 'result' },
  dv: { legacyCode: 'dv', schemaId: 'equal_sharing_group_size', cardKey: 'template:g3-word:equal-sharing-group-size', skillId: 'g3-div-meaning', operation: 'divide', unknownPosition: 'group_size' },
};

export function oneStepWordProblemDescriptor(schema: Schema): OneStepWordProblemDescriptor {
  return DESCRIPTORS[schema];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function deterministicPick<T>(values: readonly T[], seed: number, salt: number): T {
  return values[hashString(`${seed}:${salt}`) % values.length];
}

export function makeWordProblem(schema: Schema, a: number, b: number): PracticeItem {
  const descriptor = oneStepWordProblemDescriptor(schema);
  const seed = hashString(`${schema}:${a}:${b}`);
  let prompt: string;
  let answer: number;
  let wordProblemSpec: WordProblemSpec;

  if (schema === 'eg') {
    const c = deterministicPick(CONTAINERS, seed, 1), n = deterministicPick(NOUNS, seed, 2);
    prompt = `There are ${a} ${c}. Each one has ${b} ${n}. How many ${n} in all?`;
    answer = a * b;
    wordProblemSpec = { steps: [{ operation: 'multiply', a, b, result: answer }], unknownPosition: 'result', contextSchema: 'equal_groups', quantities: [{ label: 'groups', value: a }, { label: 'in each group', value: b }], suggestedModel: 'equal_groups' };
  } else if (schema === 'ar') {
    const n = deterministicPick(['chairs', 'tiles', 'stamps', 'seats', 'windows'], seed, 3);
    prompt = `A grid has ${a} rows of ${b} ${n}. How many ${n} are there?`;
    answer = a * b;
    wordProblemSpec = { steps: [{ operation: 'multiply', a, b, result: answer }], unknownPosition: 'result', contextSchema: 'array', quantities: [{ label: 'rows', value: a }, { label: 'in each row', value: b }], suggestedModel: 'array' };
  } else if (schema === 'cmp') {
    const n1 = deterministicPick(NAMES, seed, 4), n2 = deterministicPick(NAMES.filter(x => x !== n1), seed, 5), n = deterministicPick(NOUNS, seed, 6);
    prompt = `${n1} has ${b} ${n}. ${n2} has ${a} times as many. How many does ${n2} have?`;
    answer = a * b;
    wordProblemSpec = { steps: [{ operation: 'multiply', a, b, result: answer }], unknownPosition: 'result', contextSchema: 'multiplicative_compare', quantities: [{ label: 'times as many', value: a }, { label: 'starting amount', value: b }], suggestedModel: 'bar' };
  } else {
    // division: p shared into a groups → b each
    const p = a * b, c = deterministicPick(CONTAINERS, seed, 7), n = deterministicPick(NOUNS, seed, 8);
    prompt = `${p} ${n} are shared equally into ${a} ${c}. How many ${n} per ${c.replace(/s$/, '')}?`;
    answer = b;
    wordProblemSpec = { steps: [{ operation: 'divide', a: p, b: a, result: answer }], unknownPosition: 'group_size', contextSchema: 'equal_sharing', quantities: [{ label: n, value: p }, { label: c, value: a }], suggestedModel: 'equal_groups' };
  }

  return {
    id: wordId(schema, a, b),
    skillId: descriptor.skillId,
    schemaId: descriptor.schemaId,
    cardKey: descriptor.cardKey,
    itemType: 'word_problem',
    prompt,
    answer,
    answerInput: 'numeric',
    tags: ['word_problem', schema],
    difficulty: schema === 'dv' ? 0.6 : 0.5,
    factA: a,
    factB: b,
    contentSpec: { domain: 'word_problem', version: 1, data: wordProblemSpec },
  };
}

const SCHEMAS: Schema[] = ['eg', 'ar', 'cmp', 'dv'];

export function generateWordProblemItems(
  grade: GradeLevel, count: number, rangeMin?: number, rangeMax?: number, rng: Rng = Math.random,
): PracticeItem[] {
  const max = Math.max(0, Math.floor(rangeMax ?? factorMax(grade)));
  const min = Math.max(0, Math.min(max, Math.floor(rangeMin ?? (grade === 3 ? 2 : 3))));
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const schema = pick(SCHEMAS, rng);
    const a = randInt(min, max, rng);
    const b = randInt(min, max, rng);
    if (schema === 'dv' && a < 1) continue; // can't divide into 0 groups
    const item = makeWordProblem(schema, a, b);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
