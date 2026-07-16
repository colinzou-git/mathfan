import type { ItemType, PracticeItem } from '../../types/math';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { contentSpecForItem } from '../curriculum/practiceContentSpec';

/**
 * Maps a higher-level practice item to the underlying calculation item IDs it
 * embeds, so the adaptive selector can consult the student's existing FSRS /
 * item-state history for those calculations (Add, Subtract, Multiply, Divide).
 *
 * All related IDs are deterministic calculation IDs (MUL_/ADD_/SUB_/DIV_) that
 * reconstruct via makeItemFromId, so they can be looked up directly in a
 * StudentItemState map. The mapping is derived purely from the item's
 * deterministic ID (plus factA/factB for the area/perimeter-compare items whose
 * ID does not encode the operands), so it works without reconstructing items
 * and never introduces an import cycle with the curriculum makers.
 */

// ── Calculation ID builders (canonical forms) ──────────────────────────────────

function mulId(a: number, b: number): string { return `MUL_${a}x${b}`; }
function addId(a: number, b: number): string { return `ADD_${a}p${b}`; }
function divId(dividend: number, divisor: number): string { return `DIV_${dividend}d${divisor}`; }
/** Subtraction IDs are canonicalised larger − smaller (see makeSubtractionItem). */
function subId(a: number, b: number): string {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return `SUB_${hi}m${lo}`;
}

/** Running-sum addition chain: [a,b,c,d] → ADD_apb, ADD_(a+b)pc, ADD_(a+b+c)pd. */
function additionChain(values: number[]): string[] {
  const ids: string[] = [];
  let running = values[0] ?? 0;
  for (let i = 1; i < values.length; i++) {
    ids.push(addId(running, values[i]));
    running += values[i];
  }
  return ids;
}

// ── Related calculation IDs ────────────────────────────────────────────────────

/** The underlying calculation item IDs an item embeds (empty for vocabulary-only items). */
export function getRelatedItemIds(item: PracticeItem): string[] {
  if (item.relatedItemIds) return item.relatedItemIds;
  return computeRelatedItemIds(item);
}

function computeRelatedItemIds(item: PracticeItem): string[] {
  const id = item.id;
  let m: RegExpMatchArray | null;

  const contentSpec = contentSpecForItem(item);
  if (contentSpec?.domain === 'division') {
    const spec = contentSpec.data;
    const embedded = spec.decomposition?.map(part => divId(part.dividendPart, spec.divisor)) ?? [];
    if (spec.context) embedded.unshift(divId(spec.dividend, spec.divisor));
    return [...embedded, mulId(spec.divisor, spec.quotient)];
  }

  // Single-step word problems: WORD_{schema}_{a}_{b}
  if ((m = id.match(/^WORD_([a-z]+)_(\d+)_(\d+)$/))) {
    const schema = m[1], a = +m[2], b = +m[3];
    // dv: (a*b) shared into a groups → b each, i.e. (a*b) ÷ a
    if (schema === 'dv') return [divId(a * b, a), mulId(a, b)];
    return [mulId(a, b)];
  }

  // Two-step word problems: WRD2_{schema}_{a}_{b}_{c}
  if ((m = id.match(/^WRD2_([a-z]+)_(\d+)_(\d+)_(\d+)$/))) {
    const schema = m[1], a = +m[2], b = +m[3], c = +m[4];
    if (schema === 'muls') return [mulId(a, b), subId(a * b, c)];       // (a×b) − c
    if (schema === 'mula') return [mulId(a, b), addId(a * b, c)];       // (a×b) + c
    if (schema === 'diva') return b ? [divId(a, b), addId(a / b, c)] : []; // (a÷b) + c
    if (schema === 'divs') return b ? [divId(a, b), subId(a / b, c)] : []; // (a÷b) − c
    return [];
  }

  // Area by unit squares / rectangle formula: AREA_SQ_{r}x{c} | AREA_RECT_{r}x{c}
  if ((m = id.match(/^AREA_(?:SQ|RECT)_(\d+)x(\d+)$/))) {
    return [mulId(+m[1], +m[2])];
  }

  // Rectilinear area: RECTI_{a1}x{b1}_{a2}x{b2} → two products + their sum
  if ((m = id.match(/^RECTI_(\d+)x(\d+)_(\d+)x(\d+)$/))) {
    const a1 = +m[1], b1 = +m[2], a2 = +m[3], b2 = +m[4];
    return [mulId(a1, b1), mulId(a2, b2), addId(a1 * b1, a2 * b2)];
  }

  // Rectangle perimeter: PERIM_RECT_{l}x{w} → add the sides, then double
  if ((m = id.match(/^PERIM_RECT_(\d+)x(\d+)$/))) {
    const l = +m[1], w = +m[2];
    return [addId(l, w), addId(l + w, l + w)];
  }

  // Polygon perimeter: PERIM_POLY_{s1}-{s2}-... → chained additions
  if ((m = id.match(/^PERIM_POLY_(\d+(?:-\d+)*)$/))) {
    return additionChain(m[1].split('-').map(Number));
  }

  // Perimeter with unknown side: PERIM_UNKSIDE_{total}_{s1}-{s2}-... → total − Σknown
  if ((m = id.match(/^PERIM_UNKSIDE_(\d+)_(\d+(?:-\d+)*)$/))) {
    const total = +m[1];
    const sumKnown = m[2].split('-').map(Number).reduce((s, n) => s + n, 0);
    return [subId(total, sumKnown)];
  }

  // Area / perimeter comparison: ID does not encode operands — use factA/factB,
  // which the maker sets to the rectangle whose area/perimeter is being asked.
  if (id.startsWith('AREA_PERIM_CMP_')) {
    if (item.factA != null && item.factB != null) {
      return [mulId(item.factA, item.factB), addId(item.factA, item.factB)];
    }
    return [];
  }

  // Scaled bar graph: BARG_{scale}_{bars} → scale × bars
  if ((m = id.match(/^BARG_(\d+)_(\d+)$/))) {
    return [mulId(+m[1], +m[2])];
  }

  // Line plot total: LPLOT_{v1}_{v2}_{v3}_{v4} → chained additions
  if ((m = id.match(/^LPLOT_(\d+)_(\d+)_(\d+)_(\d+)$/))) {
    return additionChain([+m[1], +m[2], +m[3], +m[4]]);
  }

  // Measurement word problem: MWRD_{schema}_{a}_{b}
  if ((m = id.match(/^MWRD_([a-z]+)_(\d+)_(\d+)$/))) {
    const schema = m[1], a = +m[2], b = +m[3];
    if (schema.startsWith('add')) return [addId(a, b)];
    if (schema.startsWith('sub')) return [subId(a, b)];
    return [];
  }

  // Factor check: FACT_{x}_{y} → only when y is divisible by x (a safe relation)
  if ((m = id.match(/^FACT_(\d+)_(\d+)$/))) {
    const x = +m[1], y = +m[2];
    return x > 0 && y % x === 0 ? [divId(y, x)] : [];
  }

  // Arithmetic pattern: APAT_{start}_{step}_{terms}
  // The "next term" skill is adding the step to the last shown term; the run of
  // terms is also a skip-count (step × terms).
  if ((m = id.match(/^APAT_(\d+)_(\d+)_(\d+)$/))) {
    const start = +m[1], step = +m[2], terms = +m[3];
    const last = start + (terms - 1) * step;
    const rel = [addId(last, step)];
    if (step >= 2 && terms >= 2) rel.push(mulId(step, terms));
    return rel;
  }

  // PRIME_*, GEO_*, and pure-calculation / vocabulary items have no safe
  // arithmetic relation to attach.
  return [];
}

// ── Related skills ─────────────────────────────────────────────────────────────

/** Grade-3 mastery skill IDs for the embedded calculation facts (deduped). */
export function getRelatedSkillIds(item: PracticeItem): string[] {
  if (item.relatedSkillIds) return item.relatedSkillIds;
  const skills = new Set<string>();
  for (const rid of getRelatedItemIds(item)) {
    const skill = skillForCalcId(rid);
    if (skill) skills.add(skill);
  }
  return [...skills];
}

/** Build the smallest item shape inferGrade3SkillId needs, then infer the skill. */
function calcItem(id: string, itemType: ItemType, factA: number, factB: number): PracticeItem {
  return { id, skillId: '', itemType, prompt: '', answer: 0, tags: [], difficulty: 0, factA, factB };
}

function skillForCalcId(id: string): string | null {
  let m: RegExpMatchArray | null;
  if ((m = id.match(/^MUL_(\d+)x(\d+)$/))) return inferGrade3SkillId(calcItem(id, 'multiplication_fact', +m[1], +m[2]));
  if ((m = id.match(/^DIV_(\d+)d(\d+)$/))) return inferGrade3SkillId(calcItem(id, 'division_fact', +m[1], +m[2]));
  if ((m = id.match(/^ADD_(\d+)p(\d+)$/))) return inferGrade3SkillId(calcItem(id, 'addition_fact', +m[1], +m[2]));
  if ((m = id.match(/^SUB_(\d+)m(\d+)$/))) return inferGrade3SkillId(calcItem(id, 'subtraction_fact', +m[1], +m[2]));
  return null;
}

// ── Schema id ──────────────────────────────────────────────────────────────────

/** A coarse structural template id used to discourage over-repeating one schema. */
export function schemaIdFor(item: PracticeItem): string {
  if (item.schemaId) return item.schemaId;
  const id = item.id;
  let m: RegExpMatchArray | null;
  if ((m = id.match(/^WORD_([a-z]+)_/))) return `word_${m[1]}`;
  if ((m = id.match(/^WRD2_([a-z]+)_/))) return `word2_${m[1]}`;
  if ((m = id.match(/^MWRD_([a-z]+)_/))) return `meas_${m[1]}`;
  return item.itemType;
}

// ── Enrichment ─────────────────────────────────────────────────────────────────

/** Attach related-calculation metadata to an item (idempotent). */
export function enrichRelatedMetadata(item: PracticeItem): PracticeItem {
  if (item.relatedItemIds && item.relatedSkillIds && item.schemaId) return item;
  return {
    ...item,
    relatedItemIds: getRelatedItemIds(item),
    relatedSkillIds: getRelatedSkillIds(item),
    schemaId: schemaIdFor(item),
  };
}
