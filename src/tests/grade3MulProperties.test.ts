/**
 * Tests for the two new multiplication properties:
 *   Associative (PROP_ASC_) and Distributive (PROP_DIST_)
 *
 * Verifies: all IDs reconstruct, answers are finite, and all items credit to g3-mul-properties.
 */

import { describe, it, expect } from 'vitest';
import {
  mulPropertyItemIds,
  makePropAssociativeItem,
  makePropDistributiveItem,
  propAscId,
  propDistId,
} from '../features/curriculum/mulPropertiesItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';

// ── ID generators ──────────────────────────────────────────────────────────────

describe('propAscId / propDistId — ID format', () => {
  it('propAscId encodes three factors with x separators', () => {
    expect(propAscId(2, 3, 4)).toBe('PROP_ASC_2x3x4');
    expect(propAscId(3, 4, 2)).toBe('PROP_ASC_3x4x2');
  });

  it('propDistId encodes a, b, c as AxBpC', () => {
    expect(propDistId(3, 2, 4)).toBe('PROP_DIST_3x2p4');
    expect(propDistId(5, 2, 3)).toBe('PROP_DIST_5x2p3');
  });
});

// ── Item makers ────────────────────────────────────────────────────────────────

describe('makePropAssociativeItem', () => {
  it('answer is the third factor c', () => {
    expect(makePropAssociativeItem(2, 3, 4).answer).toBe(4);
    expect(makePropAssociativeItem(3, 2, 5).answer).toBe(5);
  });

  it('uses multiplication_properties itemType', () => {
    expect(makePropAssociativeItem(2, 3, 4).itemType).toBe('multiplication_properties');
  });

  it('infers to g3-mul-properties', () => {
    const item = makePropAssociativeItem(2, 3, 4);
    expect(inferGrade3SkillId(item)).toBe('g3-mul-properties');
  });

  it('reconstructs from ID via makeItemFromId', () => {
    const item = makePropAssociativeItem(2, 3, 4);
    const rebuilt = makeItemFromId(item.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.answer).toBe(item.answer);
    expect(rebuilt!.prompt).toBe(item.prompt);
  });

  it('answer is finite for all Grade 3 triples', () => {
    const triples: [number, number, number][] = [
      [2, 3, 4], [2, 4, 3], [2, 5, 2], [3, 2, 4],
      [3, 4, 2], [4, 2, 3], [2, 2, 5], [3, 2, 5],
    ];
    for (const [a, b, c] of triples) {
      const item = makePropAssociativeItem(a, b, c);
      expect(Number.isFinite(item.answer as number), `${item.id} answer finite`).toBe(true);
    }
  });
});

describe('makePropDistributiveItem', () => {
  it('answer is the third factor c', () => {
    expect(makePropDistributiveItem(3, 2, 4).answer).toBe(4);
    expect(makePropDistributiveItem(5, 2, 3).answer).toBe(3);
  });

  it('uses multiplication_properties itemType', () => {
    expect(makePropDistributiveItem(3, 2, 4).itemType).toBe('multiplication_properties');
  });

  it('infers to g3-mul-properties', () => {
    const item = makePropDistributiveItem(3, 2, 4);
    expect(inferGrade3SkillId(item)).toBe('g3-mul-properties');
  });

  it('reconstructs from ID via makeItemFromId', () => {
    const item = makePropDistributiveItem(3, 2, 4);
    const rebuilt = makeItemFromId(item.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.answer).toBe(item.answer);
    expect(rebuilt!.prompt).toBe(item.prompt);
  });

  it('answer is finite for all Grade 3 triples', () => {
    const triples: [number, number, number][] = [
      [3, 2, 4], [2, 3, 4], [4, 2, 3], [3, 4, 5],
      [5, 2, 3], [2, 5, 4], [4, 3, 2], [3, 3, 2],
    ];
    for (const [a, b, c] of triples) {
      const item = makePropDistributiveItem(a, b, c);
      expect(Number.isFinite(item.answer as number), `${item.id} answer finite`).toBe(true);
    }
  });
});

// ── mulPropertyItemIds completeness ───────────────────────────────────────────

describe('mulPropertyItemIds — contains new property types', () => {
  it('includes at least one PROP_ASC_ item', () => {
    expect(mulPropertyItemIds().some(id => id.startsWith('PROP_ASC_'))).toBe(true);
  });

  it('includes at least one PROP_DIST_ item', () => {
    expect(mulPropertyItemIds().some(id => id.startsWith('PROP_DIST_'))).toBe(true);
  });

  it('still includes existing PROP_CMT_, PROP_IDT_, PROP_ZERO_ items', () => {
    const ids = mulPropertyItemIds();
    expect(ids.some(id => id.startsWith('PROP_CMT_'))).toBe(true);
    expect(ids.some(id => id.startsWith('PROP_IDT_'))).toBe(true);
    expect(ids.some(id => id.startsWith('PROP_ZERO_'))).toBe(true);
  });
});

describe('mulPropertyItemIds — every ID reconstructs', () => {
  it('all IDs reconstruct to non-null items', () => {
    for (const id of mulPropertyItemIds()) {
      expect(makeItemFromId(id), `"${id}" should reconstruct`).not.toBeNull();
    }
  });
});

describe('mulPropertyItemIds — every item has a finite answer', () => {
  it('no NaN or Infinity numeric answers', () => {
    for (const id of mulPropertyItemIds()) {
      const item = makeItemFromId(id);
      expect(item, `"${id}" should reconstruct`).not.toBeNull();
      if (typeof item!.answer === 'number') {
        expect(Number.isFinite(item!.answer), `"${id}" answer should be finite`).toBe(true);
      }
    }
  });
});

describe('mulPropertyItemIds — every item credits to g3-mul-properties', () => {
  it('all items infer to g3-mul-properties', () => {
    for (const id of mulPropertyItemIds()) {
      const item = makeItemFromId(id);
      expect(item, `"${id}" should reconstruct`).not.toBeNull();
      expect(
        inferGrade3SkillId(item!),
        `"${id}" should infer to g3-mul-properties`,
      ).toBe('g3-mul-properties');
    }
  });
});
