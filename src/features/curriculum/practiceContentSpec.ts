import {
  PRACTICE_CONTENT_SPEC_VERSION,
  type ItemType,
  type PracticeContentSpec,
  type PracticeItem,
} from '../../types/math';
import { FOUNDATION_FORMS, getCurriculumSkill } from './curriculumRegistry';

export { PRACTICE_CONTENT_SPEC_VERSION };

export interface PracticeItemValidationProblem {
  code: string;
  path: string;
  message: string;
}

export type LegacyPrimaryContentField = 'fractionSpec' | 'arithmeticSpec' | 'divisionSpec'
  | 'measurementSpec' | 'wordProblemSpec' | 'reasoningSpec';
type LegacySpec = { domain: PracticeContentSpec['domain']; data: PracticeContentSpec['data']; path: LegacyPrimaryContentField };
const LEGACY_COMPATIBILITY_PROJECTION = Symbol('legacyCompatibilityProjection');

export interface RawPracticeContentInspection {
  canonical?: PracticeContentSpec;
  legacy: LegacySpec[];
  problems: PracticeItemValidationProblem[];
}

export type PracticeItemNormalizationResult =
  | { ok: true; item: PracticeItem; source: 'canonical' | 'legacy' | 'none'; warnings: PracticeItemValidationProblem[] }
  | { ok: false; problems: PracticeItemValidationProblem[] };

function legacySpecs(item: PracticeItem): LegacySpec[] {
  const specs: LegacySpec[] = [];
  if (item.fractionSpec !== undefined) specs.push({ domain: 'fraction', data: item.fractionSpec, path: 'fractionSpec' });
  if (item.arithmeticSpec !== undefined) specs.push({ domain: 'arithmetic', data: item.arithmeticSpec, path: 'arithmeticSpec' });
  if (item.divisionSpec !== undefined) specs.push({ domain: 'division', data: item.divisionSpec, path: 'divisionSpec' });
  if (item.measurementSpec !== undefined) specs.push({ domain: 'measurement_data', data: item.measurementSpec, path: 'measurementSpec' });
  if (item.wordProblemSpec !== undefined) specs.push({ domain: 'word_problem', data: item.wordProblemSpec, path: 'wordProblemSpec' });
  if (item.reasoningSpec !== undefined) specs.push({ domain: 'area_perimeter', data: item.reasoningSpec, path: 'reasoningSpec' });
  return specs;
}

export function legacyPrimaryContentFields(value: unknown): LegacyPrimaryContentField[] {
  if (!value || typeof value !== 'object') return [];
  return legacySpecs(value as PracticeItem).map(spec => spec.path);
}

/** Inspects the unmodified input so contradictory fields cannot be erased first. */
export function inspectRawPracticeItemContent(value: unknown): RawPracticeContentInspection {
  if (!value || typeof value !== 'object') return {
    legacy: [], problems: [{ code: 'practice_item_not_object', path: '$', message: 'Practice item must be an object.' }],
  };
  const item = value as PracticeItem;
  const legacy = legacySpecs(item);
  const canonical = item.contentSpec;
  const problems: PracticeItemValidationProblem[] = [];
  const controlledProjection = Boolean((item as PracticeItem & { [LEGACY_COMPATIBILITY_PROJECTION]?: boolean })[LEGACY_COMPATIBILITY_PROJECTION]);
  if (canonical && legacy.length && !controlledProjection) problems.push({
    code: 'canonical_and_legacy_primary_specs', path: 'contentSpec',
    message: `contentSpec cannot coexist with legacy primary fields: ${legacy.map(spec => spec.path).join(', ')}.`,
  });
  if (!canonical && legacy.length > 1) problems.push({
    code: 'multiple_primary_legacy_specs', path: legacy.map(spec => spec.path).join(','),
    message: `Expected at most one legacy primary field; found ${legacy.map(spec => spec.path).join(', ')}.`,
  });
  if (canonical && canonical.version !== PRACTICE_CONTENT_SPEC_VERSION) problems.push({
    code: 'unsupported_content_spec_version', path: 'contentSpec.version',
    message: `Supported content-spec version is ${PRACTICE_CONTENT_SPEC_VERSION}.`,
  });
  if (canonical && (!canonical.domain || canonical.data === undefined)) problems.push({
    code: 'malformed_content_spec', path: 'contentSpec', message: 'contentSpec requires a supported domain and data payload.',
  });
  return { canonical, legacy, problems };
}

function stripLegacyPrimaryFields(item: PracticeItem): PracticeItem {
  const clean = { ...item };
  delete clean.fractionSpec;
  delete clean.arithmeticSpec;
  delete clean.divisionSpec;
  delete clean.measurementSpec;
  delete clean.wordProblemSpec;
  delete clean.reasoningSpec;
  return clean;
}

export function withPracticeContentSpec(item: PracticeItem, contentSpec: PracticeContentSpec | undefined): PracticeItem {
  const clean = stripLegacyPrimaryFields(item);
  if (!contentSpec) { delete clean.contentSpec; return clean; }
  return { ...clean, contentSpec };
}

export function normalizePracticeItemContent(item: PracticeItem): PracticeItemNormalizationResult {
  const inspection = inspectRawPracticeItemContent(item);
  if (inspection.problems.length) return { ok: false, problems: inspection.problems };
  if (inspection.canonical) return { ok: true, item: withPracticeContentSpec(item, inspection.canonical), source: 'canonical', warnings: [] };
  const legacy = inspection.legacy[0];
  if (!legacy) return { ok: true, item: withPracticeContentSpec(item, undefined), source: 'none', warnings: [] };
  const contentSpec = { domain: legacy.domain, version: PRACTICE_CONTENT_SPEC_VERSION, data: legacy.data } as PracticeContentSpec;
  return { ok: true, item: withPracticeContentSpec(item, contentSpec), source: 'legacy', warnings: [{
    code: 'legacy_primary_spec_converted', path: legacy.path, message: `${legacy.path} was converted to contentSpec version 1.`,
  }] };
}

/**
 * VisualSpec is presentation-only: it may illustrate any primary domain and is
 * deliberately excluded from the competing-domain count.
 */
export function contentSpecForItem(item: PracticeItem): PracticeContentSpec | undefined {
  const normalized = normalizePracticeItemContent(item);
  if (!normalized.ok) throw new PracticeItemValidationError(normalized.problems);
  return normalized.item.contentSpec;
}

type ContentDataForDomain<D extends PracticeContentSpec['domain']> = PracticeContentSpec extends infer Spec
  ? Spec extends { domain: D; data: infer Data } ? Data : never
  : never;

export function contentDataForDomain<D extends PracticeContentSpec['domain']>(
  item: PracticeItem,
  domain: D,
): ContentDataForDomain<D> | undefined {
  const spec = contentSpecForItem(item);
  return spec?.domain === domain
    ? spec.data as ContentDataForDomain<D>
    : undefined;
}

export class PracticeItemValidationError extends Error {
  readonly problems: PracticeItemValidationProblem[];
  constructor(problems: PracticeItemValidationProblem[]) {
    super(problems.map(problem => `${problem.path}: ${problem.message}`).join('; '));
    this.problems = problems;
    this.name = 'PracticeItemValidationError';
  }
}

/** Controlled read-only bridge for legacy consumers; never use on uninspected external input. */
export function projectLegacyCompatibilityFields(item: PracticeItem): PracticeItem {
  const spec = contentSpecForItem(item);
  if (!spec) return item;
  const shared: PracticeItem = { ...item };
  delete shared.fractionSpec;
  delete shared.arithmeticSpec;
  delete shared.divisionSpec;
  delete shared.measurementSpec;
  delete shared.wordProblemSpec;
  delete shared.reasoningSpec;
  const projected = (() => {
    switch (spec.domain) {
      case 'foundation': return { ...shared, contentSpec: spec };
      case 'fraction': return { ...shared, contentSpec: spec, fractionSpec: spec.data };
      case 'arithmetic': return { ...shared, contentSpec: spec, arithmeticSpec: spec.data };
      case 'division': return { ...shared, contentSpec: spec, divisionSpec: spec.data };
      case 'measurement_data': return { ...shared, contentSpec: spec, measurementSpec: spec.data };
      case 'word_problem': return { ...shared, contentSpec: spec, wordProblemSpec: spec.data };
      case 'area_perimeter': return { ...shared, contentSpec: spec, reasoningSpec: spec.data };
      case 'multiplication_estimation': return { ...shared, contentSpec: spec };
      case 'division_estimation': return { ...shared, contentSpec: spec };
    }
  })();
  Object.defineProperty(projected, LEGACY_COMPATIBILITY_PROJECTION, { value: true, enumerable: false });
  return projected;
}

/** @deprecated Use strict normalization or projectLegacyCompatibilityFields explicitly. */
export const withLegacyContentSpec = projectLegacyCompatibilityFields;

const DOMAIN_ITEM_TYPES: Record<PracticeContentSpec['domain'], ReadonlySet<ItemType>> = {
  foundation: new Set(['foundation']),
  fraction: new Set(['fraction_equivalent', 'fraction_compare', 'fraction_number_line']),
  arithmetic: new Set(['addition_fact', 'subtraction_fact']),
  division: new Set(['division_fact', 'unknown_factor', 'word_problem']),
  measurement_data: new Set(['time_to_minute', 'elapsed_time', 'measurement_word', 'bar_graph_read', 'line_plot_read']),
  word_problem: new Set(['word_problem']),
  area_perimeter: new Set(['perimeter_unknown_side']),
  multiplication_estimation: new Set(['multiplication_estimation']),
  division_estimation: new Set(['division_estimation']),
};

export function validatePracticeItem(item: PracticeItem): PracticeItemValidationProblem[] {
  const inspection = inspectRawPracticeItemContent(item);
  if (inspection.problems.length) return inspection.problems;
  const problems: PracticeItemValidationProblem[] = [];
  const normalized = normalizePracticeItemContent(item);
  if (!normalized.ok) return normalized.problems;
  const spec = normalized.item.contentSpec;
  if (spec?.domain === 'foundation') {
    const data = spec.data;
    const node = getCurriculumSkill(item.skillId);
    if (item.gradeLevel !== 4 || data.skillId !== item.skillId || !item.standardIds?.length
      || data.generatorVersion !== item.generatorVersion || data.seed !== item.seed
      || node?.gradeLevel !== 4 || !FOUNDATION_FORMS.includes(data.form)
      || ![0, 1, 2].includes(data.band) || !Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff
      || item.schemaId !== `${data.skillId}:${data.form}:b${data.band}` || item.cardKey !== `template:${item.schemaId}`
      || data.representationId !== item.representationId || data.generatorVersion !== 1
      || !Array.isArray(data.solutionSteps) || !data.solutionSteps.length || !Array.isArray(data.hints) || data.hints.length < 3
      || item.standardIds?.some(id => !node?.californiaStandardIds.includes(id))) {
      problems.push({ code: 'invalid_foundation_contract', path: 'contentSpec.data', message: 'Foundation metadata and content must agree.' });
    }
    if (item.answerSpec?.value !== item.answer || (item.choices && (item.answerSpec?.kind !== 'single_choice'
      || JSON.stringify(item.answerSpec.options) !== JSON.stringify(item.choices) || new Set(item.choices).size !== item.choices.length))
      || (!item.choices && item.answerSpec?.kind !== 'number')) {
      problems.push({ code: 'invalid_foundation_answer', path: 'answerSpec', message: 'Tagged answer and unique choices must match the mathematical answer.' });
    }
  }
  if (spec && !DOMAIN_ITEM_TYPES[spec.domain].has(item.itemType)) {
    problems.push({
      code: 'incompatible_item_type',
      path: 'itemType',
      message: `${item.itemType} is incompatible with contentSpec.domain ${spec.domain}.`,
    });
  }
  if ((item.answerInput === 'choice' || item.choices) && (!item.choices?.length || !item.choices.includes(item.answer))) {
    problems.push({
      code: 'invalid_choice_contract',
      path: 'choices',
      message: 'Choice items must include the correct answer in a non-empty choices array.',
    });
  }
  if (spec?.domain === 'arithmetic') {
    const expected = spec.data.operation === 'addition' ? spec.data.a + spec.data.b : spec.data.a - spec.data.b;
    if (item.answer !== expected && spec.data.mode !== 'error_analysis') {
      problems.push({ code: 'answer_operand_mismatch', path: 'answer', message: 'Answer does not match arithmetic operands.' });
    }
  }
  if (spec?.domain === 'division' && spec.data.schema !== 'word_problem_choose_model'
    && typeof item.answer === 'number' && item.answer !== spec.data.quotient) {
    problems.push({ code: 'answer_operand_mismatch', path: 'answer', message: 'Answer does not match the division quotient.' });
  }
  if (spec?.domain === 'multiplication_estimation') {
    const data = spec.data;
    if (!Number.isInteger(data.twoDigit) || data.twoDigit < 10 || data.twoDigit > 99
      || !Number.isInteger(data.oneDigit) || data.oneDigit < 2 || data.oneDigit > 9) {
      problems.push({ code: 'invalid_estimation_factors', path: 'contentSpec.data', message: 'Estimation factors must be 10–99 and 2–9.' });
    }
    if (data.exactProduct !== data.twoDigit * data.oneDigit
      || data.lowerProduct !== data.lowerTen * data.oneDigit
      || data.upperProduct !== data.upperTen * data.oneDigit
      || data.nearestEstimate !== data.nearestTen * data.oneDigit) {
      problems.push({ code: 'estimation_product_mismatch', path: 'contentSpec.data', message: 'Estimation products do not match their factors.' });
    }
    if (data.schema === 'bounds' && data.lowerTen === data.upperTen) {
      problems.push({ code: 'invalid_strict_estimation_bounds', path: 'contentSpec.data.schema', message: 'Strict bounds cannot use an already-friendly multiple of ten.' });
    }
  }
  if (spec?.domain === 'division_estimation') {
    const data = spec.data;
    if (!Number.isInteger(data.dividend) || data.dividend < 10 || data.dividend > 99
      || !Number.isInteger(data.divisor) || data.divisor < 2 || data.divisor > 9) {
      problems.push({ code: 'invalid_division_estimation_operands', path: 'contentSpec.data', message: 'Estimation operands must be a 10–99 dividend and 2–9 divisor.' });
    }
    if (data.exactQuotient !== data.dividend / data.divisor
      || data.lowerCompatibleDividend !== data.lowerEstimate * data.divisor
      || data.upperCompatibleDividend !== data.upperEstimate * data.divisor
      || data.compatibleDividend !== data.compatibleEstimate * data.divisor) {
      problems.push({ code: 'division_estimation_quotient_mismatch', path: 'contentSpec.data', message: 'Division estimates do not match their compatible dividends and divisor.' });
    }
    if (data.lowerCompatibleDividend > data.dividend || data.upperCompatibleDividend < data.dividend) {
      problems.push({ code: 'invalid_division_estimation_bounds', path: 'contentSpec.data', message: 'Compatible dividends must bound the original dividend.' });
    }
    if (data.schema === 'bounds' && data.lowerEstimate === data.upperEstimate) {
      problems.push({ code: 'invalid_strict_division_estimation_bounds', path: 'contentSpec.data.schema', message: 'Strict bounds cannot use an already-compatible dividend.' });
    }
  }
  if (item.schemaId === '') {
    problems.push({ code: 'empty_schema_id', path: 'schemaId', message: 'schemaId must be omitted or non-empty.' });
  }
  if (item.cardKey === '') {
    problems.push({ code: 'empty_card_key', path: 'cardKey', message: 'cardKey must be omitted or non-empty.' });
  }
  return problems;
}

export function assertValidPracticeItem(item: PracticeItem): PracticeItem {
  const normalized = normalizePracticeItemContent(item);
  if (!normalized.ok) throw new PracticeItemValidationError(normalized.problems);
  const problems = validatePracticeItem(normalized.item);
  if (problems.length) {
    throw new PracticeItemValidationError(problems);
  }
  return normalized.item;
}
