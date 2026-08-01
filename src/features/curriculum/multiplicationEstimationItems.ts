import type { PracticeItem } from '../../types/math';
import { assertValidPracticeItem, contentDataForDomain } from './practiceContentSpec';
import type { Rng } from '../../utils/rng';

export const MULTIPLICATION_ESTIMATION_TEMPLATE_VERSION = 1 as const;

export type MultiplicationEstimationSchema =
  | 'purpose'
  | 'magnitude'
  | 'bounds'
  | 'nearest_ten'
  | 'direction'
  | 'reasonableness'
  | 'context'
  | 'strategy_compare';

export type MultiplicationEstimateDirection = 'low' | 'high' | 'exact';
export type MultiplicationEstimationRepresentation = 'symbolic' | 'number_line' | 'context';
export type MultiplicationEstimationMethod = 'nearest estimate' | 'lower bound' | 'upper bound' | 'exact answer';

export interface MultiplicationEstimationQuestionSpec {
  templateVersion: typeof MULTIPLICATION_ESTIMATION_TEMPLATE_VERSION;
  schema: MultiplicationEstimationSchema;
  variant: string;
  twoDigit: number;
  oneDigit: number;
  exactProduct: number;
  lowerTen: number;
  upperTen: number;
  lowerProduct: number;
  upperProduct: number;
  nearestTen: number;
  nearestEstimate: number;
  nearestDirection: MultiplicationEstimateDirection;
  representation: MultiplicationEstimationRepresentation;
  methodConstraint: 'open' | 'nearest_ten' | 'lower_bound' | 'upper_bound' | 'exact';
  allegedProduct?: number;
  contextMethod?: MultiplicationEstimationMethod;
}

const SCHEMA_CODES: Record<MultiplicationEstimationSchema, string> = {
  purpose: 'PUR',
  magnitude: 'MAG',
  bounds: 'BND',
  nearest_ten: 'RND',
  direction: 'DIR',
  reasonableness: 'REA',
  context: 'CTX',
  strategy_compare: 'CMP',
};

const CODE_SCHEMAS = Object.fromEntries(
  Object.entries(SCHEMA_CODES).map(([schema, code]) => [code, schema]),
) as Record<string, MultiplicationEstimationSchema>;

const SKILL_IDS: Record<MultiplicationEstimationSchema, string> = {
  purpose: 'g3s-mul-est-purpose',
  magnitude: 'g3s-mul-est-magnitude-2x1',
  bounds: 'g3s-mul-est-bounds-2x1',
  nearest_ten: 'g3s-mul-est-round-2x1',
  direction: 'g3s-mul-est-direction-2x1',
  reasonableness: 'g3s-mul-est-reasonable-2x1',
  context: 'g3s-mul-est-context-2x1',
  strategy_compare: 'g3s-mul-est-friendly-compare',
};

const CARD_KEYS: Record<MultiplicationEstimationSchema, string> = {
  purpose: 'template:g3s:mul-est:purpose',
  magnitude: 'template:g3s:mul-est:magnitude-2x1',
  bounds: 'template:g3s:mul-est:bounds-2x1',
  nearest_ten: 'template:g3s:mul-est:round-2x1',
  direction: 'template:g3s:mul-est:direction-2x1',
  reasonableness: 'template:g3s:mul-est:reasonable-2x1',
  context: 'template:g3s:mul-est:context-2x1',
  strategy_compare: 'template:g3s:mul-est:friendly-compare',
};

const FACTOR_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [43, 6], [47, 6], [32, 9], [68, 7], [52, 8], [87, 4], [73, 6],
  [78, 4], [62, 7], [39, 8], [84, 9], [91, 5], [26, 4], [58, 7],
  [64, 8], [76, 9], [35, 6], [45, 7], [60, 7], [80, 4],
] as const;

const VARIANTS: Record<MultiplicationEstimationSchema, readonly string[]> = {
  purpose: ['estimate', 'exact'],
  magnitude: ['core'],
  bounds: ['core'],
  nearest_ten: ['core'],
  direction: ['core'],
  reasonableness: ['plausible', 'x10low', 'x10high'],
  context: ['nearest', 'lower', 'upper', 'exact'],
  strategy_compare: ['closer'],
};

export function roundHalfUpToTen(value: number): number {
  return Math.floor((value + 5) / 10) * 10;
}

export function multiplicationEstimationSkillIdForSchema(schema: MultiplicationEstimationSchema): string {
  return SKILL_IDS[schema];
}

export function multiplicationEstimationSchemaForSkillId(skillId: string): MultiplicationEstimationSchema | null {
  return (Object.keys(SKILL_IDS) as MultiplicationEstimationSchema[]).find(schema => SKILL_IDS[schema] === skillId) ?? null;
}

export function multiplicationEstimationCardKey(schema: MultiplicationEstimationSchema): string {
  return CARD_KEYS[schema];
}

function directionFor(estimate: number, exact: number): MultiplicationEstimateDirection {
  return estimate < exact ? 'low' : estimate > exact ? 'high' : 'exact';
}

function representationFor(schema: MultiplicationEstimationSchema, twoDigit: number): MultiplicationEstimationRepresentation {
  if (schema === 'purpose' || schema === 'context') return 'context';
  if (schema === 'strategy_compare') return 'symbolic';
  return twoDigit % 2 === 0 ? 'symbolic' : 'number_line';
}

function methodForSchema(schema: MultiplicationEstimationSchema, variant: string): MultiplicationEstimationQuestionSpec['methodConstraint'] {
  if (schema === 'nearest_ten' || schema === 'direction' || schema === 'magnitude') return 'nearest_ten';
  if (schema === 'bounds' || schema === 'reasonableness') return 'open';
  if (schema === 'context') {
    if (variant === 'lower') return 'lower_bound';
    if (variant === 'upper') return 'upper_bound';
    if (variant === 'exact') return 'exact';
    return 'nearest_ten';
  }
  return 'open';
}

function buildSpec(
  schema: MultiplicationEstimationSchema,
  variant: string,
  twoDigit: number,
  oneDigit: number,
): MultiplicationEstimationQuestionSpec {
  const exactProduct = twoDigit * oneDigit;
  const lowerTen = Math.floor(twoDigit / 10) * 10;
  const upperTen = Math.ceil(twoDigit / 10) * 10;
  const nearestTen = roundHalfUpToTen(twoDigit);
  const nearestEstimate = nearestTen * oneDigit;
  const spec: MultiplicationEstimationQuestionSpec = {
    templateVersion: MULTIPLICATION_ESTIMATION_TEMPLATE_VERSION,
    schema,
    variant,
    twoDigit,
    oneDigit,
    exactProduct,
    lowerTen,
    upperTen,
    lowerProduct: lowerTen * oneDigit,
    upperProduct: upperTen * oneDigit,
    nearestTen,
    nearestEstimate,
    nearestDirection: directionFor(nearestEstimate, exactProduct),
    representation: representationFor(schema, twoDigit),
    methodConstraint: methodForSchema(schema, variant),
  };
  if (schema === 'reasonableness') {
    spec.allegedProduct = variant === 'plausible'
      ? spec.lowerProduct + Math.floor((spec.upperProduct - spec.lowerProduct) / 2)
      : variant === 'x10low'
        ? Math.round(exactProduct / 10)
        : exactProduct * 10;
  }
  if (schema === 'context') {
    spec.contextMethod = variant === 'lower' ? 'lower bound'
      : variant === 'upper' ? 'upper bound'
        : variant === 'exact' ? 'exact answer'
          : 'nearest estimate';
  }
  return spec;
}

function itemId(schema: MultiplicationEstimationSchema, variant: string, twoDigit: number, oneDigit: number): string {
  return `MEST${MULTIPLICATION_ESTIMATION_TEMPLATE_VERSION}_${SCHEMA_CODES[schema]}_${variant}_${twoDigit}x${oneDigit}`;
}

export interface ParsedMultiplicationEstimationItemId {
  schema: MultiplicationEstimationSchema;
  variant: string;
  twoDigit: number;
  oneDigit: number;
}

export function parseMultiplicationEstimationItemId(id: string): ParsedMultiplicationEstimationItemId | null {
  const match = id.match(/^MEST1_(PUR|MAG|BND|RND|DIR|REA|CTX|CMP)_([a-z0-9]+)_(\d+)x(\d+)$/);
  if (!match) return null;
  const schema = CODE_SCHEMAS[match[1]];
  const twoDigit = Number(match[3]);
  const oneDigit = Number(match[4]);
  if (!schema || !VARIANTS[schema].includes(match[2]) || !Number.isInteger(twoDigit) || !Number.isInteger(oneDigit)) return null;
  return { schema, variant: match[2], twoDigit, oneDigit };
}

function magnitudeChoice(exactProduct: number): number {
  return Math.max(100, Math.round(exactProduct / 100) * 100);
}

function rotatedChoices<T>(choices: T[], seed: number): T[] {
  const shift = seed % choices.length;
  return [...choices.slice(shift), ...choices.slice(0, shift)];
}

function makePromptAndAnswer(spec: MultiplicationEstimationQuestionSpec): Pick<PracticeItem, 'prompt' | 'answer' | 'choices' | 'answerInput' | 'explanation'> {
  const { schema, variant, twoDigit: a, oneDigit: b } = spec;
  if (schema === 'purpose') {
    if (variant === 'exact') return {
      prompt: `A printer needs one ticket for every child in ${b} groups of ${a}. What kind of answer is needed?`,
      answer: 'An exact answer', choices: rotatedChoices(['An estimate', 'An exact answer', 'A guess'], a + b), answerInput: 'choice',
      explanation: 'Every child needs a ticket, so the number to print must be exact.',
    };
    return {
      prompt: `There are ${b} boxes with ${a} pencils each. To decide whether ${spec.upperProduct} pencils are enough, what kind of answer can you use?`,
      answer: 'An estimate', choices: rotatedChoices(['An estimate', 'An exact answer', 'A guess'], a + b), answerInput: 'choice',
      explanation: `An estimate is enough for this decision because ${a} × ${b} is no greater than the upper bound ${spec.upperProduct}.`,
    };
  }
  if (schema === 'magnitude') {
    const answer = magnitudeChoice(spec.exactProduct);
    const anchor = spec.lowerTen === spec.upperTen
      ? `${a} is already the friendly ten ${spec.lowerTen}`
      : `${a} is between ${spec.lowerTen} and ${spec.upperTen}`;
    return {
      prompt: `${a} × ${b} is about which number?`, answer,
      choices: rotatedChoices([answer / 10, answer, answer * 10], a + b), answerInput: 'choice',
      explanation: `${anchor}, so the product is in the hundreds.`,
    };
  }
  if (schema === 'bounds') {
    const answer = `${spec.lowerProduct} to ${spec.upperProduct}`;
    return {
      prompt: `Which interval traps ${a} × ${b}?`, answer,
      choices: rotatedChoices([
        `${spec.lowerProduct / 10} to ${spec.upperProduct / 10}`,
        answer,
        `${spec.lowerProduct * 10} to ${spec.upperProduct * 10}`,
      ], a + b),
      answerInput: 'choice',
      explanation: `${spec.lowerTen} × ${b} < ${a} × ${b} < ${spec.upperTen} × ${b}, so the product is between ${spec.lowerProduct} and ${spec.upperProduct}.`,
    };
  }
  if (schema === 'nearest_ten') return {
    prompt: `Estimate ${a} × ${b} by rounding ${a} to the nearest ten. ${a} × ${b} ≈ ?`,
    answer: spec.nearestEstimate, answerInput: 'numeric',
    explanation: `${a} rounds to ${spec.nearestTen}. ${spec.nearestTen} × ${b} = ${spec.nearestEstimate}, so ${a} × ${b} is about ${spec.nearestEstimate}.`,
  };
  if (schema === 'direction') return {
    prompt: `${a} × ${b} ≈ ${spec.nearestEstimate}. Is this estimate low, high, or exact?`,
    answer: spec.nearestDirection === 'low' ? 'Low' : spec.nearestDirection === 'high' ? 'High' : 'Exact',
    choices: rotatedChoices(['Low', 'High', 'Exact'], a + b), answerInput: 'choice',
    explanation: spec.nearestDirection === 'exact'
      ? `${a} is already a friendly ten, so the product did not change.`
      : `${spec.nearestTen} is ${spec.nearestTen < a ? 'less than' : 'greater than'} ${a}, so the positive product is ${spec.nearestDirection}.`,
  };
  if (schema === 'reasonableness') {
    const alleged = spec.allegedProduct!;
    const plausible = alleged >= spec.lowerProduct && alleged <= spec.upperProduct;
    return {
      prompt: `${a} × ${b} is between ${spec.lowerProduct} and ${spec.upperProduct}. Could ${alleged} be the exact answer?`,
      answer: plausible ? 'Could be right' : 'Impossible', choices: rotatedChoices(['Could be right', 'Impossible'], a + b), answerInput: 'choice',
      explanation: plausible
        ? `${alleged} lies inside the bounds, so it could be right. Bounds alone do not prove it is exact.`
        : `${alleged} lies outside ${spec.lowerProduct} to ${spec.upperProduct}, so it is impossible.`,
    };
  }
  if (schema === 'context') {
    const choices: MultiplicationEstimationMethod[] = ['nearest estimate', 'lower bound', 'upper bound', 'exact answer'];
    if (variant === 'lower') return {
      prompt: `${b} classes each need ${a} stickers. There are only ${Math.max(0, spec.lowerProduct - 10)} stickers. Which tool proves whether there are enough?`,
      answer: 'lower bound', choices: rotatedChoices(choices, a + b), answerInput: 'choice',
      explanation: `${spec.lowerTen} × ${b} = ${spec.lowerProduct}, already more than the supply. The lower bound proves there are not enough.`,
    };
    if (variant === 'upper') return {
      prompt: `${b} teams each need ${a} cards. There are ${spec.upperProduct} cards. Which tool proves whether there are enough?`,
      answer: 'upper bound', choices: rotatedChoices(choices, a + b), answerInput: 'choice',
      explanation: `${spec.upperTen} × ${b} = ${spec.upperProduct}. The exact need is no greater than this upper bound, so there are enough.`,
    };
    if (variant === 'exact') return {
      prompt: `A printer must make one ticket for every child in ${b} groups of ${a}. Which kind of answer is needed?`,
      answer: 'exact answer', choices: rotatedChoices(choices, a + b), answerInput: 'choice',
      explanation: 'Printing one ticket per child requires the exact total.',
    };
    return {
      prompt: `There are ${b} rows with about ${a} seats in each row. Which tool gives about how many seats there are?`,
      answer: 'nearest estimate', choices: rotatedChoices(choices, a + b), answerInput: 'choice',
      explanation: 'The question asks about how many, so a nearest estimate fits the purpose.',
    };
  }

  const lowerExpression = `${spec.lowerTen} × ${b} = ${spec.lowerProduct}`;
  const upperExpression = `${spec.upperTen} × ${b} = ${spec.upperProduct}`;
  const lowerError = Math.abs(spec.exactProduct - spec.lowerProduct);
  const upperError = Math.abs(spec.upperProduct - spec.exactProduct);
  const answer = lowerError < upperError ? lowerExpression : upperExpression;
  return {
    prompt: `Both estimates for ${a} × ${b} are valid. Which one is closer?`,
    answer, choices: rotatedChoices([lowerExpression, upperExpression], a + b), answerInput: 'choice',
    explanation: `${a} is closer to ${lowerError < upperError ? spec.lowerTen : spec.upperTen}, so ${answer} is the closer estimate.`,
  };
}

export function validateMultiplicationEstimationItem(item: PracticeItem): string[] {
  const spec = contentDataForDomain(item, 'multiplication_estimation');
  if (!spec) return ['missing multiplication-estimation content spec'];
  const errors: string[] = [];
  if (!Number.isInteger(spec.twoDigit) || spec.twoDigit < 10 || spec.twoDigit > 99) errors.push('two-digit factor out of range');
  if (!Number.isInteger(spec.oneDigit) || spec.oneDigit < 2 || spec.oneDigit > 9) errors.push('one-digit factor out of range');
  if (spec.exactProduct !== spec.twoDigit * spec.oneDigit) errors.push('exact product mismatch');
  if (spec.lowerTen !== Math.floor(spec.twoDigit / 10) * 10 || spec.upperTen !== Math.ceil(spec.twoDigit / 10) * 10) errors.push('nearby tens mismatch');
  if (spec.lowerProduct !== spec.lowerTen * spec.oneDigit || spec.upperProduct !== spec.upperTen * spec.oneDigit) errors.push('bound product mismatch');
  if (spec.nearestTen !== roundHalfUpToTen(spec.twoDigit) || spec.nearestEstimate !== spec.nearestTen * spec.oneDigit) errors.push('nearest-ten estimate mismatch');
  if (spec.nearestDirection !== directionFor(spec.nearestEstimate, spec.exactProduct)) errors.push('estimate direction mismatch');
  if (spec.schema === 'bounds' && spec.lowerTen === spec.upperTen) errors.push('strict bounds cannot use an already-friendly ten');
  if (item.skillId !== multiplicationEstimationSkillIdForSchema(spec.schema)) errors.push('skill/schema mismatch');
  if (item.cardKey !== multiplicationEstimationCardKey(spec.schema)) errors.push('card/schema mismatch');
  return errors;
}

export function makeMultiplicationEstimationItem(
  schema: MultiplicationEstimationSchema,
  variant: string,
  twoDigit: number,
  oneDigit: number,
): PracticeItem {
  if (!VARIANTS[schema].includes(variant)) throw new Error(`Unsupported ${schema} variant: ${variant}`);
  if (twoDigit < 10 || twoDigit > 99 || oneDigit < 2 || oneDigit > 9) throw new Error('Multiplication estimation factors are out of range');
  if (schema === 'bounds' && twoDigit % 10 === 0) throw new Error('A strict-bounds item cannot use a multiple of ten');
  if (schema === 'strategy_compare' && twoDigit % 5 === 0) throw new Error('A strategy comparison needs one strictly closer adjacent ten');
  const spec = buildSpec(schema, variant, twoDigit, oneDigit);
  const response = makePromptAndAnswer(spec);
  const relatedItemIds = schema === 'purpose' ? []
    : schema === 'nearest_ten' || schema === 'direction'
      ? [`MUL_${spec.nearestTen}x${oneDigit}`]
      : [...new Set([`MUL_${spec.lowerTen}x${oneDigit}`, `MUL_${spec.upperTen}x${oneDigit}`])];
  const item: PracticeItem = {
    id: itemId(schema, variant, twoDigit, oneDigit),
    skillId: multiplicationEstimationSkillIdForSchema(schema),
    itemType: 'multiplication_estimation',
    ...response,
    tags: ['multiplication', 'estimation', 'grade3-summer', schema, spec.representation],
    difficulty: schema === 'purpose' ? 0.35 : schema === 'strategy_compare' ? 0.8 : 0.6,
    factA: twoDigit,
    factB: oneDigit,
    relatedItemIds,
    relatedSkillIds: relatedItemIds.length ? ['g3-mul-multiple-of-10'] : [],
    schemaId: `mul_est_${schema}_${spec.representation}`,
    cardKey: multiplicationEstimationCardKey(schema),
    gradeLevel: 3,
    contentSpec: { domain: 'multiplication_estimation', version: 1, data: spec },
  };
  const errors = validateMultiplicationEstimationItem(item);
  if (errors.length) throw new Error(`Invalid multiplication estimation item ${item.id}: ${errors.join('; ')}`);
  return assertValidPracticeItem(item);
}

export function makeMultiplicationEstimationItemFromId(id: string): PracticeItem | null {
  const parsed = parseMultiplicationEstimationItemId(id);
  if (!parsed) return null;
  try {
    return makeMultiplicationEstimationItem(parsed.schema, parsed.variant, parsed.twoDigit, parsed.oneDigit);
  } catch {
    return null;
  }
}

export function multiplicationEstimationItemIdsForSchema(schema: MultiplicationEstimationSchema): string[] {
  const pairs = FACTOR_PAIRS.filter(([twoDigit]) => {
    if (schema === 'bounds') return twoDigit % 10 !== 0;
    if (schema === 'strategy_compare') return twoDigit % 5 !== 0;
    return true;
  });
  return pairs.map(([twoDigit, oneDigit], index) => {
    const variants = VARIANTS[schema];
    return itemId(schema, variants[index % variants.length], twoDigit, oneDigit);
  });
}

export function generateMultiplicationEstimationItem(
  schema: MultiplicationEstimationSchema,
  context: { rng?: Rng; recentItemIds?: string[] } = {},
): PracticeItem {
  const rng = context.rng ?? Math.random;
  const pool = multiplicationEstimationItemIdsForSchema(schema);
  const recent = new Set(context.recentItemIds ?? []);
  const available = pool.filter(id => !recent.has(id));
  const candidates = available.length ? available : pool;
  return makeMultiplicationEstimationItemFromId(candidates[Math.floor(rng() * candidates.length)])!;
}

/** Returns a different, reconstructable instance under the same stable concept card. */
export function freshMultiplicationEstimationReviewItemId(id: string, rng: Rng): string {
  const parsed = parseMultiplicationEstimationItemId(id);
  if (!parsed) return id;
  const pool = multiplicationEstimationItemIdsForSchema(parsed.schema).filter(candidate => candidate !== id);
  return pool.length ? pool[Math.floor(rng() * pool.length)] : id;
}

export function defaultMultiplicationEstimationItemIdForCardKey(cardKey: string): string | null {
  const schema = (Object.keys(CARD_KEYS) as MultiplicationEstimationSchema[]).find(key => CARD_KEYS[key] === cardKey);
  return schema ? multiplicationEstimationItemIdsForSchema(schema)[0] ?? null : null;
}
