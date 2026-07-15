/**
 * Tests for the Grade 3 area/perimeter expansion:
 *   - perimeter_polygon, perimeter_unknown_side, area_perimeter_compare items
 *   - makeItemFromId reconstruction for all new IDs
 *   - Finite answers with no NaN/Infinity
 *   - inferGrade3SkillId mapping
 *   - planPracticeForSkill coverage
 *   - RectilinearArea visual answer-leakage guard
 */

import { createElement } from 'react';
import { describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';

import {
  perimPolygonId, makePerimeterPolygonItem, perimeterPolygonItemIds,
  perimUnknownSideId, makePerimeterUnknownSideItem, perimeterUnknownSideItemIds,
  areaPerimCmpId, makeAreaPerimCompareItem, areaPerimCompareItemIds,
  makeRectilinearAreaItem,
} from '../features/curriculum/areaItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { isGrade3SkillId } from '../features/mastery/grade3MasteryMap';
import { hasVisualModel } from '../features/visuals/visualModelUtils';
import { VisualModel } from '../features/visuals/VisualModel';

afterEach(cleanup);

// ── perimPolygonId / makePerimeterPolygonItem ─────────────────────────────────

describe('perimPolygonId — ID format', () => {
  it('encodes sides with dashes', () => {
    expect(perimPolygonId([3, 4, 5])).toBe('PERIM_POLY_3-4-5');
    expect(perimPolygonId([2, 3, 4, 5])).toBe('PERIM_POLY_2-3-4-5');
  });
});

describe('makePerimeterPolygonItem', () => {
  it('sum of sides is the answer', () => {
    const item = makePerimeterPolygonItem([3, 4, 5]);
    expect(item.answer).toBe(12);
  });

  it('uses perimeter_polygon itemType', () => {
    expect(makePerimeterPolygonItem([3, 4, 5]).itemType).toBe('perimeter_polygon');
  });

  it('infers to g3-perimeter', () => {
    const item = makePerimeterPolygonItem([3, 4, 5]);
    expect(inferGrade3SkillId(item)).toBe('g3-perimeter');
  });

  it('reconstructs from ID', () => {
    const item = makePerimeterPolygonItem([4, 5, 6]);
    const rebuilt = makeItemFromId(item.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.answer).toBe(item.answer);
    expect(rebuilt!.prompt).toBe(item.prompt);
  });
});

describe('perimeterPolygonItemIds — all IDs reconstruct with finite answers', () => {
  it('every ID reconstructs to a non-null item with finite answer', () => {
    for (const id of perimeterPolygonItemIds()) {
      const item = makeItemFromId(id);
      expect(item, `"${id}" should reconstruct`).not.toBeNull();
      expect(Number.isFinite(item!.answer as number), `"${id}" answer should be finite`).toBe(true);
      expect(inferGrade3SkillId(item!)).toBe('g3-perimeter');
    }
  });
});

// ── perimUnknownSideId / makePerimeterUnknownSideItem ────────────────────────

describe('perimUnknownSideId — ID format', () => {
  it('encodes total and known sides', () => {
    expect(perimUnknownSideId(12, [3, 4])).toBe('PERIM_UNKSIDE_12_3-4');
    expect(perimUnknownSideId(16, [5, 3, 5])).toBe('PERIM_UNKSIDE_16_5-3-5');
  });
});

describe('makePerimeterUnknownSideItem', () => {
  it('missing side = total − sum of known sides', () => {
    expect(makePerimeterUnknownSideItem(12, [3, 4]).answer).toBe(5);
    expect(makePerimeterUnknownSideItem(16, [5, 3, 5]).answer).toBe(3);
    expect(makePerimeterUnknownSideItem(20, [4, 6, 5]).answer).toBe(5);
  });

  it('uses perimeter_unknown_side itemType', () => {
    expect(makePerimeterUnknownSideItem(12, [3, 4]).itemType).toBe('perimeter_unknown_side');
  });

  it('infers to the distinct missing-side skill', () => {
    const item = makePerimeterUnknownSideItem(12, [3, 4]);
    expect(inferGrade3SkillId(item)).toBe('g3-perimeter-missing-side');
  });

  it('reconstructs from ID', () => {
    const item = makePerimeterUnknownSideItem(15, [4, 5]);
    const rebuilt = makeItemFromId(item.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.answer).toBe(item.answer);
    expect(rebuilt!.prompt).toBe(item.prompt);
  });
});

describe('perimeterUnknownSideItemIds — all IDs reconstruct with positive finite answers', () => {
  it('every ID reconstructs with a positive finite answer', () => {
    for (const id of perimeterUnknownSideItemIds()) {
      const item = makeItemFromId(id);
      expect(item, `"${id}" should reconstruct`).not.toBeNull();
      const ans = item!.answer as number;
      expect(Number.isFinite(ans), `"${id}" answer should be finite`).toBe(true);
      expect(ans, `"${id}" answer should be positive`).toBeGreaterThan(0);
      expect(inferGrade3SkillId(item!)).toBe('g3-perimeter-missing-side');
    }
  });
});

// ── areaPerimCmpId / makeAreaPerimCompareItem ─────────────────────────────────

describe('areaPerimCmpId — ID format', () => {
  it('encodes variant and index', () => {
    expect(areaPerimCmpId('sadp', 0)).toBe('AREA_PERIM_CMP_sadp_0');
    expect(areaPerimCmpId('spad', 2)).toBe('AREA_PERIM_CMP_spad_2');
  });
});

describe('makeAreaPerimCompareItem — sadp', () => {
  it('answer is the perimeter of Rectangle A', () => {
    const item = makeAreaPerimCompareItem('sadp', 0)!;
    // r1=[2,12], perimA=2*(2+12)=28
    expect(item.answer).toBe(28);
  });

  it('uses area_perimeter_compare itemType', () => {
    expect(makeAreaPerimCompareItem('sadp', 0)!.itemType).toBe('area_perimeter_compare');
  });

  it('infers to g3-area-perimeter-compare', () => {
    const item = makeAreaPerimCompareItem('sadp', 0)!;
    expect(inferGrade3SkillId(item)).toBe('g3-area-perimeter-compare');
  });

  it('reconstructs from ID', () => {
    const item = makeAreaPerimCompareItem('sadp', 1)!;
    const rebuilt = makeItemFromId(item.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.answer).toBe(item.answer);
    expect(rebuilt!.prompt).toBe(item.prompt);
  });

  it('returns null for out-of-bounds index', () => {
    expect(makeAreaPerimCompareItem('sadp', 99)).toBeNull();
  });
});

describe('makeAreaPerimCompareItem — spad', () => {
  it('answer is the area of Rectangle B', () => {
    const item = makeAreaPerimCompareItem('spad', 0)!;
    // r2=[4,6], areaB=24
    expect(item.answer).toBe(24);
  });

  it('reconstructs from ID', () => {
    const item = makeAreaPerimCompareItem('spad', 2)!;
    const rebuilt = makeItemFromId(item.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt!.answer).toBe(item.answer);
  });
});

describe('areaPerimCompareItemIds — all IDs reconstruct with finite answers', () => {
  it('every ID reconstructs with a finite positive answer', () => {
    for (const id of areaPerimCompareItemIds()) {
      const item = makeItemFromId(id);
      expect(item, `"${id}" should reconstruct`).not.toBeNull();
      const ans = item!.answer as number;
      expect(Number.isFinite(ans), `"${id}" answer finite`).toBe(true);
      expect(ans, `"${id}" answer positive`).toBeGreaterThan(0);
      expect(inferGrade3SkillId(item!)).toBe('g3-area-perimeter-compare');
    }
  });
});

// ── grade3MasteryMap — new skill exists ───────────────────────────────────────

describe('grade3MasteryMap — g3-area-perimeter-compare', () => {
  it('is a registered skill ID', () => {
    expect(isGrade3SkillId('g3-area-perimeter-compare')).toBe(true);
  });
});

// ── planPracticeForSkill ──────────────────────────────────────────────────────

describe('planPracticeForSkill — g3-perimeter', () => {
  it('includes PERIM_POLY items', () => {
    const config = planPracticeForSkill('g3-perimeter');
    expect(config.specificItemIds!.some(id => id.startsWith('PERIM_POLY_'))).toBe(true);
  });

  it('keeps missing-side questions in their distinct skill', () => {
    const config = planPracticeForSkill('g3-perimeter');
    expect(config.specificItemIds!.some(id => id.startsWith('PERIM_UNKSIDE_'))).toBe(false);
    const missingSide = planPracticeForSkill('g3-perimeter-missing-side');
    expect(missingSide.specificItemIds!.some(id => id.startsWith('PERIM_UNKSIDE_'))).toBe(true);
  });

  it('still includes PERIM_RECT items', () => {
    const config = planPracticeForSkill('g3-perimeter');
    expect(config.specificItemIds!.some(id => id.startsWith('PERIM_RECT_'))).toBe(true);
  });

  it('every listed ID reconstructs', () => {
    const config = planPracticeForSkill('g3-perimeter');
    for (const id of config.specificItemIds!) {
      expect(makeItemFromId(id), `"${id}" should reconstruct`).not.toBeNull();
    }
  });
});

describe('planPracticeForSkill — g3-area-perimeter-compare', () => {
  it('returns AREA_PERIM_CMP items', () => {
    const config = planPracticeForSkill('g3-area-perimeter-compare');
    expect(config.specificItemIds!.length).toBeGreaterThan(0);
    expect(config.specificItemIds!.every(id => id.startsWith('AREA_PERIM_CMP_'))).toBe(true);
  });

  it('every listed ID reconstructs', () => {
    const config = planPracticeForSkill('g3-area-perimeter-compare');
    for (const id of config.specificItemIds!) {
      expect(makeItemFromId(id), `"${id}" should reconstruct`).not.toBeNull();
    }
  });
});

// ── RectilinearArea visual model ──────────────────────────────────────────────

describe('hasVisualModel — rectilinear_area', () => {
  it('returns true for RECTI items', () => {
    const item = makeRectilinearAreaItem(2, 3, 1, 2);
    expect(hasVisualModel(item)).toBe(true);
  });
});

describe('VisualModel — RectilinearAreaModel answer-leakage', () => {
  it('does not reveal total area in aria-label when revealAnswer=false', () => {
    const item = makeRectilinearAreaItem(2, 3, 1, 2); // areas 6+2=8
    render(createElement(VisualModel, { item, revealAnswer: false }));
    const img = screen.getByRole('img');
    const label = img.getAttribute('aria-label') ?? '';
    expect(label).not.toMatch(/total area/i);
    expect(label).not.toMatch(/\b8\b/);
  });

  it('reveals total area in aria-label when revealAnswer=true', () => {
    const item = makeRectilinearAreaItem(2, 3, 1, 2); // areas 6+2=8
    render(createElement(VisualModel, { item, revealAnswer: true }));
    const img = screen.getByRole('img');
    const label = img.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/total area/i);
    expect(label).toMatch(/8/);
  });

  it('shows dimension labels even without revealAnswer', () => {
    const item = makeRectilinearAreaItem(3, 4, 2, 2);
    render(createElement(VisualModel, { item, revealAnswer: false }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/3.*4|4.*3/);
  });
});
