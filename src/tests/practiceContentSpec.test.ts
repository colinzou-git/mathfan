import { describe, expect, it } from 'vitest';
import type { PracticeContentSpec, PracticeItem } from '../types/math';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import {
  contentSpecForItem,
  inspectRawPracticeItemContent,
  normalizePracticeItemContent,
  PRACTICE_CONTENT_SPEC_VERSION,
  PracticeItemValidationError,
  validatePracticeItem,
  withPracticeContentSpec,
} from '../features/curriculum/practiceContentSpec';
import { telemetryForItem } from '../features/learning/schedulingTelemetry';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { hasVisualModel } from '../features/visuals/visualModelUtils';

const IDS = [
  'FEQ_1_2_4',
  'ADD_47p28',
  'DIVQ_decompose_tens_ones_84_3',
  'ETIME_10_50_12_15',
  'WORD_eg_3_4',
  'PERIM_UNKSIDE_12_3-4',
];

describe('versioned practice content contract', () => {
  it('adapts and validates one representative from every structured domain', () => {
    const domains = IDS.map(id => {
      const item = makeItemFromId(id)!;
      expect(validatePracticeItem(item), id).toEqual([]);
      expect(item.contentSpec?.version).toBe(PRACTICE_CONTENT_SPEC_VERSION);
      return item.contentSpec?.domain;
    });
    expect(domains).toEqual([
      'fraction', 'arithmetic', 'division', 'measurement_data', 'word_problem', 'area_perimeter',
    ]);
  });

  it('reports incompatible domains and multiple legacy primaries with precise paths', () => {
    const fraction = makeItemFromId('FEQ_1_2_4')!;
    const arithmetic = makeItemFromId('ADD_47p28')!;
    const incompatible = { ...fraction, itemType: 'division_fact' as const };
    expect(validatePracticeItem(incompatible)).toContainEqual(expect.objectContaining({
      code: 'incompatible_item_type', path: 'itemType',
    }));
    const contradictory = {
      ...fraction, contentSpec: undefined,
      fractionSpec: fraction.contentSpec!.data as never,
      arithmeticSpec: arithmetic.contentSpec!.data as never,
    };
    expect(() => contentSpecForItem(contradictory)).toThrow(PracticeItemValidationError);
    expect(validatePracticeItem(contradictory)).toContainEqual(expect.objectContaining({
      code: 'multiple_primary_legacy_specs', path: 'fractionSpec,arithmeticSpec',
    }));
  });

  it('uses the same content-only contract for telemetry, visuals, and skill mapping', () => {
    const reconstructed = makeItemFromId('ADD_47p28')!;
    const contentOnly: PracticeItem = {
      ...reconstructed,
      arithmeticSpec: undefined,
      contentSpec: reconstructed.contentSpec,
    };
    expect(telemetryForItem(contentOnly).parameters).toMatchObject({ operation: 'addition', a: 47, b: 28 });
    expect(hasVisualModel(contentOnly)).toBe(true);
    expect(inferGrade3SkillId(contentOnly)).toBe('g3-add-2digit-regrouping');
  });

  it('serializes, reconstructs, and validates deterministic items without stale peer fields', () => {
    for (const id of IDS) {
      const original = makeItemFromId(id)!;
      const serialized = JSON.parse(JSON.stringify(original)) as PracticeItem;
      expect(validatePracticeItem(serialized), id).toEqual([]);
      const reconstructed = makeItemFromId(serialized.id)!;
      expect(reconstructed.contentSpec).toEqual(original.contentSpec);
      const projected = withPracticeContentSpec({
        ...reconstructed,
        fractionSpec: makeItemFromId('FEQ_1_2_4')!.contentSpec!.data as never,
      }, reconstructed.contentSpec);
      expect(validatePracticeItem(projected), id).toEqual([]);
      const primaryFields = [
        projected.fractionSpec, projected.arithmeticSpec, projected.divisionSpec,
        projected.measurementSpec, projected.wordProblemSpec, projected.reasoningSpec,
      ].filter(Boolean);
      expect(primaryFields).toHaveLength(0);
    }
  });

  it('handles an unknown future content version safely', () => {
    const item = makeItemFromId('FEQ_1_2_4')!;
    const future = {
      ...item,
      fractionSpec: undefined,
      contentSpec: { ...item.contentSpec!, version: 99 } as unknown as PracticeContentSpec,
    };
    expect(() => contentSpecForItem(future)).toThrow(PracticeItemValidationError);
    expect(validatePracticeItem(future)).toContainEqual(expect.objectContaining({
      code: 'unsupported_content_spec_version', path: 'contentSpec.version',
    }));
  });

  it('keeps old single-spec fixtures readable through the explicit adapter', () => {
    const current = makeItemFromId('FEQ_1_2_4')!;
    const legacy = { ...current, contentSpec: undefined, fractionSpec: current.contentSpec!.data as never };
    expect(contentSpecForItem(legacy)).toEqual({
      domain: 'fraction', version: 1, data: legacy.fractionSpec,
    });
  });

  it('rejects canonical plus legacy before normalization can strip either field', () => {
    const item = makeItemFromId('ADD_47p28')!;
    const raw = { ...item, arithmeticSpec: item.contentSpec!.data as never };
    expect(inspectRawPracticeItemContent(raw).problems).toContainEqual(expect.objectContaining({
      code: 'canonical_and_legacy_primary_specs', path: 'contentSpec',
    }));
    expect(normalizePracticeItemContent(raw)).toMatchObject({ ok: false });
    expect(validatePracticeItem(raw)).toEqual(inspectRawPracticeItemContent(raw).problems);
  });
});
