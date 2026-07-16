import {
  PRACTICE_CONTENT_SPEC_VERSION,
  type ItemType,
  type PracticeContentSpec,
  type PracticeItem,
} from '../../types/math';

export { PRACTICE_CONTENT_SPEC_VERSION };

export interface PracticeItemValidationProblem {
  code: string;
  path: string;
  message: string;
}

type LegacySpec = { domain: PracticeContentSpec['domain']; data: PracticeContentSpec['data']; path: string };

function legacySpecs(item: PracticeItem): LegacySpec[] {
  const specs: LegacySpec[] = [];
  if (item.fractionSpec) specs.push({ domain: 'fraction', data: item.fractionSpec, path: 'fractionSpec' });
  if (item.arithmeticSpec) specs.push({ domain: 'arithmetic', data: item.arithmeticSpec, path: 'arithmeticSpec' });
  if (item.divisionSpec) specs.push({ domain: 'division', data: item.divisionSpec, path: 'divisionSpec' });
  if (item.measurementSpec) specs.push({ domain: 'measurement_data', data: item.measurementSpec, path: 'measurementSpec' });
  if (item.wordProblemSpec) specs.push({ domain: 'word_problem', data: item.wordProblemSpec, path: 'wordProblemSpec' });
  if (item.reasoningSpec) specs.push({ domain: 'area_perimeter', data: item.reasoningSpec, path: 'reasoningSpec' });
  return specs;
}

/**
 * VisualSpec is presentation-only: it may illustrate any primary domain and is
 * deliberately excluded from the competing-domain count.
 */
export function contentSpecForItem(item: PracticeItem): PracticeContentSpec | undefined {
  if (item.contentSpec) {
    if (item.contentSpec.version !== PRACTICE_CONTENT_SPEC_VERSION) return undefined;
    return item.contentSpec;
  }
  const legacy = legacySpecs(item);
  if (legacy.length !== 1) return undefined;
  return {
    domain: legacy[0].domain,
    version: PRACTICE_CONTENT_SPEC_VERSION,
    data: legacy[0].data,
  } as PracticeContentSpec;
}

/** Projects the canonical contract onto one legacy field for staged consumers, removing stale peers. */
export function withLegacyContentSpec(item: PracticeItem): PracticeItem {
  const spec = contentSpecForItem(item);
  if (!spec) return item;
  const shared: PracticeItem = { ...item };
  delete shared.fractionSpec;
  delete shared.arithmeticSpec;
  delete shared.divisionSpec;
  delete shared.measurementSpec;
  delete shared.wordProblemSpec;
  delete shared.reasoningSpec;
  switch (spec.domain) {
    case 'fraction': return { ...shared, contentSpec: spec, fractionSpec: spec.data };
    case 'arithmetic': return { ...shared, contentSpec: spec, arithmeticSpec: spec.data };
    case 'division': return { ...shared, contentSpec: spec, divisionSpec: spec.data };
    case 'measurement_data': return { ...shared, contentSpec: spec, measurementSpec: spec.data };
    case 'word_problem': return { ...shared, contentSpec: spec, wordProblemSpec: spec.data };
    case 'area_perimeter': return { ...shared, contentSpec: spec, reasoningSpec: spec.data };
  }
}

const DOMAIN_ITEM_TYPES: Record<PracticeContentSpec['domain'], ReadonlySet<ItemType>> = {
  fraction: new Set(['fraction_equivalent', 'fraction_compare', 'fraction_number_line']),
  arithmetic: new Set(['addition_fact', 'subtraction_fact']),
  division: new Set(['division_fact', 'unknown_factor', 'word_problem']),
  measurement_data: new Set(['time_to_minute', 'elapsed_time', 'measurement_word', 'bar_graph_read', 'line_plot_read']),
  word_problem: new Set(['word_problem']),
  area_perimeter: new Set(['perimeter_unknown_side']),
};

export function validatePracticeItem(item: PracticeItem): PracticeItemValidationProblem[] {
  const problems: PracticeItemValidationProblem[] = [];
  const legacy = legacySpecs(item);
  if (legacy.length > 1) {
    problems.push({
      code: 'multiple_primary_legacy_specs',
      path: legacy.map(value => value.path).join(','),
      message: 'A practice item may contain only one primary legacy content specification.',
    });
  }
  const raw = item.contentSpec as { domain?: string; version?: number; data?: unknown } | undefined;
  if (raw && raw.version !== PRACTICE_CONTENT_SPEC_VERSION) {
    problems.push({
      code: 'unsupported_content_spec_version',
      path: 'contentSpec.version',
      message: `Supported content-spec version is ${PRACTICE_CONTENT_SPEC_VERSION}.`,
    });
  }
  if (raw && legacy.length && legacy.some(value => value.domain !== raw.domain)) {
    problems.push({
      code: 'content_spec_legacy_conflict',
      path: 'contentSpec.domain',
      message: 'The versioned content domain conflicts with a retained legacy specification.',
    });
  }
  const spec = contentSpecForItem(item);
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
  if (item.schemaId === '') {
    problems.push({ code: 'empty_schema_id', path: 'schemaId', message: 'schemaId must be omitted or non-empty.' });
  }
  if (item.cardKey === '') {
    problems.push({ code: 'empty_card_key', path: 'cardKey', message: 'cardKey must be omitted or non-empty.' });
  }
  return problems;
}

export function assertValidPracticeItem(item: PracticeItem): PracticeItem {
  const problems = validatePracticeItem(item);
  if (problems.length) {
    throw new Error(`Invalid practice item ${item.id}: ${problems.map(problem => `${problem.path}: ${problem.message}`).join('; ')}`);
  }
  return item;
}
