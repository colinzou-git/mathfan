import type { PracticeItem } from '../../types/math';
import type { Rng } from '../../utils/rng';
import { assertValidPracticeItem, contentDataForDomain } from './practiceContentSpec';

export const DIVISION_ESTIMATION_TEMPLATE_VERSION = 1 as const;

export type DivisionEstimationSchema =
  | 'purpose'
  | 'magnitude'
  | 'bounds'
  | 'compatible'
  | 'direction'
  | 'reasonableness'
  | 'context'
  | 'strategy_compare';

export type DivisionEstimateDirection = 'low' | 'high' | 'exact';
export type DivisionEstimationRepresentation = 'symbolic' | 'number_line' | 'context';
export type DivisionEstimationMethod = 'compatible estimate' | 'lower bound' | 'upper bound' | 'exact answer';

export interface DivisionEstimationQuestionSpec {
  templateVersion: typeof DIVISION_ESTIMATION_TEMPLATE_VERSION;
  schema: DivisionEstimationSchema;
  variant: string;
  dividend: number;
  divisor: number;
  exactQuotient: number;
  lowerCompatibleDividend: number;
  upperCompatibleDividend: number;
  lowerEstimate: number;
  upperEstimate: number;
  compatibleDividend: number;
  compatibleEstimate: number;
  compatibleDirection: DivisionEstimateDirection;
  representation: DivisionEstimationRepresentation;
  methodConstraint: 'open' | 'compatible' | 'lower_bound' | 'upper_bound' | 'exact';
  allegedQuotient?: number;
  contextMethod?: DivisionEstimationMethod;
}

const SCHEMA_CODES: Record<DivisionEstimationSchema, string> = {
  purpose: 'PUR',
  magnitude: 'MAG',
  bounds: 'BND',
  compatible: 'COM',
  direction: 'DIR',
  reasonableness: 'REA',
  context: 'CTX',
  strategy_compare: 'CMP',
};

const CODE_SCHEMAS = Object.fromEntries(
  Object.entries(SCHEMA_CODES).map(([schema, code]) => [code, schema]),
) as Record<string, DivisionEstimationSchema>;

const SKILL_IDS: Record<DivisionEstimationSchema, string> = {
  purpose: 'g3s-div-est-purpose',
  magnitude: 'g3s-div-est-magnitude-2x1',
  bounds: 'g3s-div-est-bounds-2x1',
  compatible: 'g3s-div-est-compatible-2x1',
  direction: 'g3s-div-est-direction-2x1',
  reasonableness: 'g3s-div-est-reasonable-2x1',
  context: 'g3s-div-est-context-2x1',
  strategy_compare: 'g3s-div-est-friendly-compare',
};

const CARD_KEYS: Record<DivisionEstimationSchema, string> = {
  purpose: 'template:g3s:div-est:purpose',
  magnitude: 'template:g3s:div-est:magnitude-2x1',
  bounds: 'template:g3s:div-est:bounds-2x1',
  compatible: 'template:g3s:div-est:compatible-2x1',
  direction: 'template:g3s:div-est:direction-2x1',
  reasonableness: 'template:g3s:div-est:reasonable-2x1',
  context: 'template:g3s:div-est:context-2x1',
  strategy_compare: 'template:g3s:div-est:friendly-compare',
};

/**
 * Non-exact quotients dominate the pool so estimation remains purposeful.
 * Exact friendly dividends are retained sparingly for direction and boundary cases.
 */
const DIVISION_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [58, 6], [74, 7], [86, 3], [39, 4], [82, 4], [67, 3], [91, 5],
  [47, 3], [69, 8], [53, 5], [78, 4], [44, 6], [25, 4], [92, 9],
  [63, 8], [71, 6], [34, 3], [88, 7], [49, 5], [76, 8], [60, 6], [80, 4],
] as const;

const VARIANTS: Record<DivisionEstimationSchema, readonly string[]> = {
  purpose: ['estimate', 'exact'],
  magnitude: ['core'],
  bounds: ['core'],
  compatible: ['core'],
  direction: ['core'],
  reasonableness: ['plausible', 'x10low', 'x10high'],
  context: ['compatible', 'lower', 'upper', 'exact'],
  strategy_compare: ['closer'],
};

export function divisionEstimationSkillIdForSchema(schema: DivisionEstimationSchema): string {
  return SKILL_IDS[schema];
}

export function divisionEstimationSchemaForSkillId(skillId: string): DivisionEstimationSchema | null {
  return (Object.keys(SKILL_IDS) as DivisionEstimationSchema[]).find(schema => SKILL_IDS[schema] === skillId) ?? null;
}

export function divisionEstimationCardKey(schema: DivisionEstimationSchema): string {
  return CARD_KEYS[schema];
}

function directionFor(compatibleDividend: number, dividend: number): DivisionEstimateDirection {
  return compatibleDividend < dividend ? 'low' : compatibleDividend > dividend ? 'high' : 'exact';
}

function representationFor(schema: DivisionEstimationSchema, dividend: number): DivisionEstimationRepresentation {
  if (schema === 'purpose' || schema === 'context') return 'context';
  if (schema === 'strategy_compare') return 'symbolic';
  return dividend % 2 === 0 ? 'symbolic' : 'number_line';
}

function methodForSchema(schema: DivisionEstimationSchema, variant: string): DivisionEstimationQuestionSpec['methodConstraint'] {
  if (schema === 'compatible' || schema === 'direction' || schema === 'magnitude') return 'compatible';
  if (schema === 'bounds' || schema === 'reasonableness') return 'open';
  if (schema === 'context') {
    if (variant === 'lower') return 'lower_bound';
    if (variant === 'upper') return 'upper_bound';
    if (variant === 'exact') return 'exact';
    return 'compatible';
  }
  return 'open';
}

function buildSpec(
  schema: DivisionEstimationSchema,
  variant: string,
  dividend: number,
  divisor: number,
): DivisionEstimationQuestionSpec {
  const exactQuotient = dividend / divisor;
  const lowerEstimate = Math.floor(exactQuotient / 5) * 5;
  const upperEstimate = Math.ceil(exactQuotient / 5) * 5;
  const lowerCompatibleDividend = lowerEstimate * divisor;
  const upperCompatibleDividend = upperEstimate * divisor;
  const lowerDistance = dividend - lowerCompatibleDividend;
  const upperDistance = upperCompatibleDividend - dividend;
  const compatibleEstimate = lowerDistance < upperDistance ? lowerEstimate : upperEstimate;
  const compatibleDividend = compatibleEstimate * divisor;
  const spec: DivisionEstimationQuestionSpec = {
    templateVersion: DIVISION_ESTIMATION_TEMPLATE_VERSION,
    schema,
    variant,
    dividend,
    divisor,
    exactQuotient,
    lowerCompatibleDividend,
    upperCompatibleDividend,
    lowerEstimate,
    upperEstimate,
    compatibleDividend,
    compatibleEstimate,
    compatibleDirection: directionFor(compatibleDividend, dividend),
    representation: representationFor(schema, dividend),
    methodConstraint: methodForSchema(schema, variant),
  };
  if (schema === 'reasonableness') {
    spec.allegedQuotient = variant === 'plausible'
      ? lowerEstimate + Math.floor((upperEstimate - lowerEstimate) / 2)
      : variant === 'x10low'
        ? Math.max(1, Math.round(exactQuotient / 10))
        : Math.round(exactQuotient * 10);
  }
  if (schema === 'context') {
    spec.contextMethod = variant === 'lower' ? 'lower bound'
      : variant === 'upper' ? 'upper bound'
        : variant === 'exact' ? 'exact answer'
          : 'compatible estimate';
  }
  return spec;
}

function itemId(schema: DivisionEstimationSchema, variant: string, dividend: number, divisor: number): string {
  return `DEST${DIVISION_ESTIMATION_TEMPLATE_VERSION}_${SCHEMA_CODES[schema]}_${variant}_${dividend}d${divisor}`;
}

export interface ParsedDivisionEstimationItemId {
  schema: DivisionEstimationSchema;
  variant: string;
  dividend: number;
  divisor: number;
}

export function parseDivisionEstimationItemId(id: string): ParsedDivisionEstimationItemId | null {
  const match = id.match(/^DEST1_(PUR|MAG|BND|COM|DIR|REA|CTX|CMP)_([a-z0-9]+)_(\d+)d(\d+)$/);
  if (!match) return null;
  const schema = CODE_SCHEMAS[match[1]];
  const dividend = Number(match[3]);
  const divisor = Number(match[4]);
  if (!schema || !VARIANTS[schema].includes(match[2]) || !Number.isInteger(dividend) || !Number.isInteger(divisor)) return null;
  return { schema, variant: match[2], dividend, divisor };
}

function rotatedChoices<T>(choices: T[], seed: number): T[] {
  const shift = seed % choices.length;
  return [...choices.slice(shift), ...choices.slice(0, shift)];
}

function makePromptAndAnswer(spec: DivisionEstimationQuestionSpec): Pick<PracticeItem, 'prompt' | 'answer' | 'choices' | 'answerInput' | 'explanation'> {
  const { schema, variant, dividend, divisor } = spec;
  if (schema === 'purpose') {
    if (variant === 'exact') return {
      prompt: `${dividend} art supplies are packed into groups of ${divisor}. The teacher must record every full group and any leftovers. What kind of answer is needed?`,
      answer: 'An exact answer', choices: rotatedChoices(['An estimate', 'An exact answer', 'A guess'], dividend + divisor), answerInput: 'choice',
      explanation: 'Recording every group and leftover requires an exact division result.',
    };
    return {
      prompt: `${dividend} pencils will be shared among ${divisor} tables. To plan about how many pencils each table gets, what kind of answer can you use?`,
      answer: 'An estimate', choices: rotatedChoices(['An estimate', 'An exact answer', 'A guess'], dividend + divisor), answerInput: 'choice',
      explanation: 'The question asks about how many, so a reasoned estimate is useful.',
    };
  }
  if (schema === 'magnitude') return {
    prompt: `${dividend} ÷ ${divisor} is about which number?`,
    answer: 10, choices: rotatedChoices([1, 10, 100], dividend + divisor), answerInput: 'choice',
    explanation: `${divisor} × 10 = ${divisor * 10}, which is in the same two-digit neighborhood as ${dividend}. The quotient is in the tens, not the ones or hundreds.`,
  };
  if (schema === 'bounds') {
    const answer = `${spec.lowerEstimate} to ${spec.upperEstimate}`;
    return {
      prompt: `Which interval traps ${dividend} ÷ ${divisor}?`, answer,
      choices: rotatedChoices([
        `${Math.max(0, spec.lowerEstimate - 5)} to ${spec.lowerEstimate}`,
        answer,
        `${spec.upperEstimate} to ${spec.upperEstimate + 5}`,
      ], dividend + divisor),
      answerInput: 'choice',
      explanation: `${divisor} × ${spec.lowerEstimate} = ${spec.lowerCompatibleDividend} and ${divisor} × ${spec.upperEstimate} = ${spec.upperCompatibleDividend}. Since ${dividend} is between those products, the quotient is between ${spec.lowerEstimate} and ${spec.upperEstimate}.`,
    };
  }
  if (schema === 'compatible') return {
    prompt: `Estimate ${dividend} ÷ ${divisor} using the nearby compatible number ${spec.compatibleDividend}. ${dividend} ÷ ${divisor} ≈ ?`,
    answer: spec.compatibleEstimate, answerInput: 'numeric',
    explanation: `${spec.compatibleDividend} is close to ${dividend} and divides evenly: ${spec.compatibleDividend} ÷ ${divisor} = ${spec.compatibleEstimate}.`,
  };
  if (schema === 'direction') return {
    prompt: `${dividend} ÷ ${divisor} ≈ ${spec.compatibleEstimate}, using ${spec.compatibleDividend} ÷ ${divisor}. Is this estimate low, high, or exact?`,
    answer: spec.compatibleDirection === 'low' ? 'Low' : spec.compatibleDirection === 'high' ? 'High' : 'Exact',
    choices: rotatedChoices(['Low', 'High', 'Exact'], dividend + divisor), answerInput: 'choice',
    explanation: spec.compatibleDirection === 'exact'
      ? `${spec.compatibleDividend} is the original dividend, so the quotient did not change.`
      : `${spec.compatibleDividend} is ${spec.compatibleDividend < dividend ? 'less than' : 'greater than'} ${dividend}. The positive divisor stayed fixed, so the estimate is ${spec.compatibleDirection}.`,
  };
  if (schema === 'reasonableness') {
    const alleged = spec.allegedQuotient!;
    const plausible = alleged >= spec.lowerEstimate && alleged <= spec.upperEstimate;
    return {
      prompt: `${dividend} ÷ ${divisor} is between ${spec.lowerEstimate} and ${spec.upperEstimate}. A student says it is about ${alleged}. Is that reasonable?`,
      answer: plausible ? 'Could be reasonable' : 'Impossible',
      choices: rotatedChoices(['Could be reasonable', 'Impossible'], dividend + divisor), answerInput: 'choice',
      explanation: plausible
        ? `${alleged} lies inside the bounds, so it could be a reasonable estimate. Bounds do not prove it is the closest estimate.`
        : `${alleged} lies outside ${spec.lowerEstimate} to ${spec.upperEstimate}, so it is impossible.`,
    };
  }
  if (schema === 'context') {
    const choices: DivisionEstimationMethod[] = ['compatible estimate', 'lower bound', 'upper bound', 'exact answer'];
    if (variant === 'lower') return {
      prompt: `${dividend} students ride in vans holding ${divisor} students each. Which tool proves that at least ${spec.lowerEstimate} vans could be filled?`,
      answer: 'lower bound', choices: rotatedChoices(choices, dividend + divisor), answerInput: 'choice',
      explanation: `${divisor} × ${spec.lowerEstimate} = ${spec.lowerCompatibleDividend}, which is no more than ${dividend}. The lower bound proves at least ${spec.lowerEstimate} full van-loads are possible.`,
    };
    if (variant === 'upper') return {
      prompt: `${dividend} cards are shared among ${divisor} teams. Which tool proves that no team can receive more than ${spec.upperEstimate} cards?`,
      answer: 'upper bound', choices: rotatedChoices(choices, dividend + divisor), answerInput: 'choice',
      explanation: `${divisor} × ${spec.upperEstimate} = ${spec.upperCompatibleDividend}, which is at least ${dividend}. The upper bound proves the share cannot exceed ${spec.upperEstimate}.`,
    };
    if (variant === 'exact') return {
      prompt: `${dividend} tickets are packed in bundles of ${divisor}. Every full bundle and leftover ticket must be recorded. Which kind of answer is needed?`,
      answer: 'exact answer', choices: rotatedChoices(choices, dividend + divisor), answerInput: 'choice',
      explanation: 'Counting every full bundle and leftover requires an exact answer.',
    };
    return {
      prompt: `${dividend} beads are shared among ${divisor} children. Which tool gives about how many beads each child gets?`,
      answer: 'compatible estimate', choices: rotatedChoices(choices, dividend + divisor), answerInput: 'choice',
      explanation: 'The question asks about how many, so a nearby compatible dividend gives an efficient estimate.',
    };
  }

  const lowerExpression = `${spec.lowerCompatibleDividend} ÷ ${divisor} = ${spec.lowerEstimate}`;
  const upperExpression = `${spec.upperCompatibleDividend} ÷ ${divisor} = ${spec.upperEstimate}`;
  const lowerError = dividend - spec.lowerCompatibleDividend;
  const upperError = spec.upperCompatibleDividend - dividend;
  const answer = lowerError < upperError ? lowerExpression : upperExpression;
  return {
    prompt: `Both estimates for ${dividend} ÷ ${divisor} are valid. Which one is closer?`,
    answer, choices: rotatedChoices([lowerExpression, upperExpression], dividend + divisor), answerInput: 'choice',
    explanation: `${dividend} is closer to ${lowerError < upperError ? spec.lowerCompatibleDividend : spec.upperCompatibleDividend}, so ${answer} is the closer estimate.`,
  };
}

export function validateDivisionEstimationItem(item: PracticeItem): string[] {
  const spec = contentDataForDomain(item, 'division_estimation');
  if (!spec) return ['missing division-estimation content spec'];
  const errors: string[] = [];
  if (!Number.isInteger(spec.dividend) || spec.dividend < 10 || spec.dividend > 99) errors.push('dividend out of range');
  if (!Number.isInteger(spec.divisor) || spec.divisor < 2 || spec.divisor > 9) errors.push('divisor out of range');
  if (spec.exactQuotient !== spec.dividend / spec.divisor) errors.push('exact quotient mismatch');
  if (spec.lowerCompatibleDividend !== spec.lowerEstimate * spec.divisor
    || spec.upperCompatibleDividend !== spec.upperEstimate * spec.divisor) errors.push('compatible bound mismatch');
  if (spec.lowerCompatibleDividend > spec.dividend || spec.upperCompatibleDividend < spec.dividend) errors.push('dividend is outside compatible bounds');
  if (spec.compatibleDividend !== spec.compatibleEstimate * spec.divisor) errors.push('compatible estimate mismatch');
  if (spec.compatibleDirection !== directionFor(spec.compatibleDividend, spec.dividend)) errors.push('estimate direction mismatch');
  if (spec.schema === 'bounds' && spec.lowerEstimate === spec.upperEstimate) errors.push('strict bounds cannot use an already-compatible dividend');
  if (item.skillId !== divisionEstimationSkillIdForSchema(spec.schema)) errors.push('skill/schema mismatch');
  if (item.cardKey !== divisionEstimationCardKey(spec.schema)) errors.push('card/schema mismatch');
  return errors;
}

export function makeDivisionEstimationItem(
  schema: DivisionEstimationSchema,
  variant: string,
  dividend: number,
  divisor: number,
): PracticeItem {
  if (!VARIANTS[schema].includes(variant)) throw new Error(`Unsupported ${schema} variant: ${variant}`);
  if (dividend < 10 || dividend > 99 || divisor < 2 || divisor > 9) throw new Error('Division estimation operands are out of range');
  const spec = buildSpec(schema, variant, dividend, divisor);
  if (spec.lowerEstimate < 5) throw new Error('Division estimation quotient is too small for the benchmark progression');
  if (schema === 'bounds' && spec.lowerEstimate === spec.upperEstimate) throw new Error('A strict-bounds item cannot use an already-compatible dividend');
  if (schema === 'strategy_compare' && dividend - spec.lowerCompatibleDividend === spec.upperCompatibleDividend - dividend) {
    throw new Error('A strategy comparison needs one strictly closer compatible dividend');
  }
  const response = makePromptAndAnswer(spec);
  const relatedItemIds = schema === 'purpose' ? []
    : schema === 'compatible' || schema === 'direction'
      ? [`MUL_${divisor}x${spec.compatibleEstimate}`]
      : [...new Set([`MUL_${divisor}x${spec.lowerEstimate}`, `MUL_${divisor}x${spec.upperEstimate}`])];
  const item: PracticeItem = {
    id: itemId(schema, variant, dividend, divisor),
    skillId: divisionEstimationSkillIdForSchema(schema),
    itemType: 'division_estimation',
    ...response,
    tags: ['division', 'estimation', 'grade3-summer', schema, spec.representation],
    difficulty: schema === 'purpose' ? 0.35 : schema === 'strategy_compare' ? 0.8 : 0.6,
    factA: dividend,
    factB: divisor,
    relatedItemIds,
    relatedSkillIds: relatedItemIds.length ? ['g3-div-mul-relationship'] : [],
    schemaId: `div_est_${schema}_${spec.representation}`,
    cardKey: divisionEstimationCardKey(schema),
    gradeLevel: 3,
    contentSpec: { domain: 'division_estimation', version: 1, data: spec },
  };
  const errors = validateDivisionEstimationItem(item);
  if (errors.length) throw new Error(`Invalid division estimation item ${item.id}: ${errors.join('; ')}`);
  return assertValidPracticeItem(item);
}

export function makeDivisionEstimationItemFromId(id: string): PracticeItem | null {
  const parsed = parseDivisionEstimationItemId(id);
  if (!parsed) return null;
  try {
    return makeDivisionEstimationItem(parsed.schema, parsed.variant, parsed.dividend, parsed.divisor);
  } catch {
    return null;
  }
}

export function divisionEstimationItemIdsForSchema(schema: DivisionEstimationSchema): string[] {
  const pairs = DIVISION_PAIRS.filter(([dividend, divisor]) => {
    const spec = buildSpec(schema, VARIANTS[schema][0], dividend, divisor);
    if (schema === 'bounds') return spec.lowerEstimate !== spec.upperEstimate;
    if (schema === 'strategy_compare') {
      return dividend - spec.lowerCompatibleDividend !== spec.upperCompatibleDividend - dividend
        && spec.lowerEstimate !== spec.upperEstimate;
    }
    return true;
  });
  return pairs.map(([dividend, divisor], index) => {
    const variants = VARIANTS[schema];
    return itemId(schema, variants[index % variants.length], dividend, divisor);
  });
}

export function generateDivisionEstimationItem(
  schema: DivisionEstimationSchema,
  context: { rng?: Rng; recentItemIds?: string[] } = {},
): PracticeItem {
  const rng = context.rng ?? Math.random;
  const pool = divisionEstimationItemIdsForSchema(schema);
  const recent = new Set(context.recentItemIds ?? []);
  const available = pool.filter(id => !recent.has(id));
  const candidates = available.length ? available : pool;
  return makeDivisionEstimationItemFromId(candidates[Math.floor(rng() * candidates.length)])!;
}

/** Returns a different, reconstructable instance under the same stable concept card. */
export function freshDivisionEstimationReviewItemId(id: string, rng: Rng): string {
  const parsed = parseDivisionEstimationItemId(id);
  if (!parsed) return id;
  const pool = divisionEstimationItemIdsForSchema(parsed.schema).filter(candidate => candidate !== id);
  return pool.length ? pool[Math.floor(rng() * pool.length)] : id;
}

export function defaultDivisionEstimationItemIdForCardKey(cardKey: string): string | null {
  const schema = (Object.keys(CARD_KEYS) as DivisionEstimationSchema[]).find(key => CARD_KEYS[key] === cardKey);
  return schema ? divisionEstimationItemIdsForSchema(schema)[0] ?? null : null;
}
