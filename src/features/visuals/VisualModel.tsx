/**
 * VisualModel — given a PracticeItem, renders the most appropriate visual model.
 *
 * Supported item types:
 * - multiplication_fact / unknown_factor → ArrayModel (dot grid)
 * - word_problem with 'eg' schema → EqualGroupsModel
 * - fraction_number_line → FractionNumberLine
 * - fraction_equivalent / fraction_compare → FractionBar
 * - area_unit_squares → AreaGrid (unit square grid)
 * - area_rectangle → AreaGrid (labeled rectangle)
 * - perimeter_rectangle → AreaGrid (labeled outline)
 * - geometry_vocabulary → ShapeModel (SVG polygon)
 *
 * Returns null for item types with no suitable visual.
 * Use hasVisualModel() (from visualModelUtils) to check ahead of time.
 */

import type { PracticeItem } from '../../types/math';
import { ArrayModel } from './ArrayModel';
import { EqualGroupsModel } from './EqualGroupsModel';
import { FractionBar } from './FractionBar';
import { FractionNumberLine } from './FractionNumberLine';
import { AreaGrid } from './AreaGrid';
import { ShapeModel } from './ShapeModel';
import { ClockModel } from './ClockModel';
import { parseFractionFromPrompt, geoShapeFromItemId } from './visualModelUtils';
import { RectilinearAreaModel } from './RectilinearAreaModel';
import { PerimeterPathModel } from './PerimeterPathModel';
import { RectangleMeasureModel } from './RectangleMeasureModel';
import { AreaPerimeterCompareModel } from './AreaPerimeterCompareModel';
import { FractionEquivalenceModel } from './FractionEquivalenceModel';
import { FractionComparisonModel } from './FractionComparisonModel';

interface Props {
  item: PracticeItem;
  /** Optional color override passed to the chosen visual. */
  color?: string;
  /** Explicit explanation/review mode can reveal the marked answer. */
  revealAnswer?: boolean;
}

function parseEqualGroupsFromId(itemId: string): { groups: number; perGroup: number } | null {
  const m = itemId.match(/^WORD_eg_(\d+)_(\d+)$/);
  if (!m) return null;
  return { groups: parseInt(m[1], 10), perGroup: parseInt(m[2], 10) };
}

export function VisualModel({ item, color, revealAnswer = false }: Props) {
  const { itemType, factA, factB, id, prompt, visualSpec } = item;

  if (item.fractionSpec) {
    const spec = item.fractionSpec;
    if (spec.kind === 'equivalent_visual') {
      return <FractionEquivalenceModel left={spec.left} right={spec.right} revealAnswer={revealAnswer} color={color} />;
    }
    if (spec.kind === 'compare') {
      return <FractionComparisonModel left={spec.left} right={spec.right} strategy={spec.strategy} revealAnswer={revealAnswer} color={color} />;
    }
    if (spec.kind === 'locate_number_line') {
      return <FractionNumberLine denominator={spec.subdivisions} numerator={revealAnswer ? spec.value.numerator : undefined} showLabel={revealAnswer} />;
    }
    if (spec.kind === 'unit_fraction_model') {
      return <FractionBar numerator={spec.value.numerator} denominator={spec.value.denominator} fillColor={color} />;
    }
  }

  // ── Structured visual spec (issue #30) — preferred over id/type parsing ───
  if (visualSpec) {
    switch (visualSpec.kind) {
      case 'area_grid':
        return (
          <AreaGrid
            rows={visualSpec.rows} cols={visualSpec.cols}
            mode={visualSpec.showTiles ? 'unit_squares' : 'rectangle'}
            color={color} revealAnswer={revealAnswer}
          />
        );
      case 'perimeter_path':
        return (
          <PerimeterPathModel
            vertices={visualSpec.vertices} sideLabels={visualSpec.sideLabels}
            color={color} revealAnswer={revealAnswer}
            missingSideAnswer={typeof item.answer === 'number' ? item.answer : undefined}
          />
        );
      case 'rectangle_measure':
        return (
          <RectangleMeasureModel
            length={visualSpec.length} width={visualSpec.width}
            emphasize={visualSpec.emphasize} color={color} revealAnswer={revealAnswer}
          />
        );
      case 'rectilinear_area':
        if (visualSpec.rectangles.length === 2) {
          const [r1, r2] = visualSpec.rectangles;
          return (
            <RectilinearAreaModel
              a1={r1.length} b1={r1.width} a2={r2.length} b2={r2.width}
              color={color} revealAnswer={revealAnswer}
            />
          );
        }
        break;
      case 'area_perimeter_compare':
        return (
          <AreaPerimeterCompareModel
            rectangles={visualSpec.rectangles} comparison={visualSpec.comparison}
            color={color} revealAnswer={revealAnswer}
          />
        );
    }
  }

  // ── Multiplication array ──────────────────────────────────────────────────
  if (
    (itemType === 'multiplication_fact' || itemType === 'unknown_factor') &&
    factA != null && factB != null &&
    factA >= 1 && factA <= 10 && factB >= 1 && factB <= 10
  ) {
    return (
      <ArrayModel
        rows={factA}
        cols={factB}
        color={color}
        ariaLabel={
          revealAnswer
            ? `Array showing ${factA} rows and ${factB} columns of dots, ${factA * factB} total`
            : `Array showing ${factA} rows and ${factB} columns of dots`
        }
      />
    );
  }

  // ── Equal-groups word problem ─────────────────────────────────────────────
  if (itemType === 'word_problem') {
    const parsed = parseEqualGroupsFromId(id);
    if (parsed) {
      return (
        <EqualGroupsModel
          groups={parsed.groups}
          itemsPerGroup={parsed.perGroup}
          revealAnswer={revealAnswer}
        />
      );
    }
  }

  // ── Fraction number line ──────────────────────────────────────────────────
  if (itemType === 'fraction_number_line') {
    const n = factA ?? parseFractionFromPrompt(prompt)?.n ?? null;
    const d = factB ?? parseFractionFromPrompt(prompt)?.d ?? null;
    if (d != null && d >= 1) {
      return (
        <FractionNumberLine
          denominator={d}
          numerator={revealAnswer ? n ?? undefined : undefined}
          showLabel={revealAnswer}
        />
      );
    }
  }

  // ── Fraction bar ─────────────────────────────────────────────────────────
  if (
    itemType === 'fraction_equivalent' ||
    itemType === 'fraction_compare'
  ) {
    const frac = parseFractionFromPrompt(prompt);
    if (frac) {
      return (
        <FractionBar
          numerator={frac.n}
          denominator={frac.d}
          fillColor={color}
        />
      );
    }
  }

  // ── Area model ───────────────────────────────────────────────────────────
  if (itemType === 'area_unit_squares' && factA != null && factB != null) {
    return <AreaGrid rows={factA} cols={factB} mode="unit_squares" color={color} revealAnswer={revealAnswer} />;
  }

  if (itemType === 'area_rectangle' && factA != null && factB != null) {
    return <AreaGrid rows={factA} cols={factB} mode="rectangle" color={color} revealAnswer={revealAnswer} />;
  }

  if (itemType === 'perimeter_rectangle' && factA != null && factB != null) {
    return <AreaGrid rows={factA} cols={factB} mode="perimeter" color={color} revealAnswer={revealAnswer} />;
  }

  // ── Rectilinear (L-shaped) area ───────────────────────────────────────────
  if (itemType === 'rectilinear_area') {
    const rm = id.match(/^RECTI_(\d+)x(\d+)_(\d+)x(\d+)$/);
    if (rm) {
      return (
        <RectilinearAreaModel
          a1={+rm[1]} b1={+rm[2]} a2={+rm[3]} b2={+rm[4]}
          color={color}
          revealAnswer={revealAnswer}
        />
      );
    }
  }

  // ── Geometry shape ────────────────────────────────────────────────────────
  if (itemType === 'geometry_vocabulary') {
    const shape = geoShapeFromItemId(id);
    if (shape) return <ShapeModel shape={shape} color={color} />;
  }

  // ── Analog clock (time to minute) ─────────────────────────────────────────
  if (itemType === 'time_to_minute' && factA != null && factB != null) {
    return <ClockModel hour={factA} minute={factB} />;
  }

  // No visual available for this item type
  return null;
}
