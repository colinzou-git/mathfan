import type { GradeLevel } from '../../types/math';
import { GRADE3_MASTERY_MAP, type MasterySkillNode } from '../mastery/grade3MasteryMap';
import type { FoundationForm } from './foundationTypes';

export interface EvidenceProfile {
  version: 1;
  kind: 'concept' | 'procedure' | 'application';
  recentWindow: number;
  minIndependent: number;
  minDistinct: number;
  minRepresentations: number;
  minSchemas: number;
  minSessions: number;
  minDelayedDays: number;
  minAccuracy: number;
  minBands: number;
  minContextFamilies: number;
  requiredForms: FoundationForm[];
}
export interface CurriculumSkill extends MasterySkillNode {
  gradeLevel: GradeLevel;
  unitId: string;
  evidenceProfile?: EvidenceProfile;
  blueprintForms?: readonly FoundationForm[];
  misconceptions?: string[];
  transferSkillIds?: string[];
  instruction?: { activate: string; model: string; connect: string; guided: string; reflection: string };
  partialStandardIds?: string[];
}
export interface CurriculumUnit { id: string; title: string; skillIds: string[] }
export interface Curriculum { id: string; version: number; gradeLevel: GradeLevel; skills: readonly CurriculumSkill[]; units: CurriculumUnit[] }
export const FOUNDATION_FORMS: readonly FoundationForm[] = ['model', 'symbolic', 'explain', 'check', 'transfer', 'verify'];
export const CURRICULUM_MISCONCEPTION_LABELS: Record<string, string> = {
  'foundation:factors_vs_multiples': 'Factors and multiples', 'foundation:omitted_pair': 'Finding every factor pair',
  'foundation:reversed_pair': 'Counting each factor pair once', 'foundation:one_is_prime': 'Why 1 is neither prime nor composite',
  'foundation:odd_is_prime': 'Checking factors of odd numbers', 'foundation:factor_count': 'Counting distinct factors',
  'foundation:rule_vs_feature': 'Pattern rules and features', 'foundation:add_ten_instead': 'Ten times a place value',
  'foundation:internal_zero': 'Keeping zero placeholders', 'foundation:later_digit_first': 'Comparing from the greatest place',
  'foundation:wrong_place': 'Choosing the rounding place', 'foundation:wrong_bound': 'Using bounding multiples',
  'foundation:lost_carry': 'Recording regrouped units', 'foundation:place_misalignment': 'Aligning equal places',
  'foundation:smaller_from_larger': 'Subtraction with renamed units', 'foundation:across_zero': 'Regrouping across zeros',
  'foundation:estimate_is_exact': 'Estimates and exact results', 'foundation:impossible_magnitude': 'Checking reasonable sizes',
};
const evidence = (kind: EvidenceProfile['kind']): EvidenceProfile => ({
  version: 1, kind, recentWindow: 12, minIndependent: 8, minDistinct: 6,
  minRepresentations: 2, minSchemas: 3, minSessions: 3, minDelayedDays: 2,
  minAccuracy: .875, minBands: kind === 'procedure' ? 3 : 1, minContextFamilies: kind === 'application' ? 2 : 0,
  requiredForms: ['explain', 'check', 'transfer', 'verify'],
});
type Row = [string, string, string, string[], string[], EvidenceProfile['kind'], string, string, string[]];
const rows: Row[] = [
  ['g4-oa-factor-meaning', 'Factors as Rectangle Sides', 'A factor is a whole-number side length of a rectangle made from equal squares.', ['g3-mul-meaning', 'g3-area-formula'], ['4.OA.4'], 'concept', 'Arrange counters into equal rows. What do the side lengths tell you?', 'Connect the two side lengths to a multiplication equation.', ['factors_vs_multiples']],
  ['g4-oa-factor-pairs', 'Find Every Factor Pair', 'Find all factor pairs for numbers from 1 through 100 using an organized search.', ['g4-oa-factor-meaning', 'g3-mul-tables-advanced'], ['4.OA.4'], 'procedure', 'Try side lengths in order. Stop when the pairs start to repeat.', 'Write each small factor beside its partner, and count a square pair once.', ['omitted_pair', 'reversed_pair']],
  ['g4-oa-multiples', 'Multiples and Equal Jumps', 'Generate multiples and recognize whether a number within 100 is a multiple of a one-digit number.', ['g4-oa-factor-meaning'], ['4.OA.4'], 'concept', 'Take equal jumps on a number line, starting at zero.', 'Connect jump size × jump count to the landing number.', ['factors_vs_multiples']],
  ['g4-oa-prime-composite', 'Prime, Composite, or Neither', 'Classify numbers through 100 by their factors. One is neither prime nor composite.', ['g4-oa-factor-pairs'], ['4.OA.4'], 'concept', 'Look for whole-number rectangles. Can you make more than a single row?', 'Prime numbers have exactly two different factors; composite numbers have more.', ['one_is_prime', 'odd_is_prime', 'factor_count']],
  ['g4-oa-pattern-rule', 'Number and Shape Pattern Rules', 'Generate number and shape patterns from a starting value and a rule.', ['g3-patterns-arithmetic'], ['4.OA.5'], 'procedure', 'Build the first few terms and apply the same rule each time.', 'Use a table to connect the position, rule, and number of shapes.', ['rule_vs_feature']],
  ['g4-oa-pattern-features', 'Explain Pattern Features', 'Explain features of a pattern that are not stated in its rule.', ['g4-oa-pattern-rule'], ['4.OA.5'], 'application', 'Notice what stays the same and what changes.', 'Explain why a rule creates an odd/even pattern or another predictable feature.', ['rule_vs_feature']],
  ['g4-nbt-ten-times', 'Ten Times the Place Value', 'A digit has ten times the value when it is one place to the left.', ['g3-round-nearest-10-100'], ['4.NBT.1'], 'concept', 'Exchange ten units for one unit of the next place.', 'Compare the values of the same digit in neighboring places.', ['add_ten_instead']],
  ['g4-nbt-read-write', 'Read, Write, and Expand Numbers', 'Connect numerals, number names, and expanded forms through 1,000,000, including internal zeros.', ['g4-nbt-ten-times'], ['4.NBT.2'], 'procedure', 'Name each column of a place-value chart, including empty columns.', 'A zero holds a place even when that place contributes nothing to expanded form.', ['internal_zero']],
  ['g4-nbt-compare-order', 'Compare and Order Large Numbers', 'Compare numbers through 1,000,000 using the first differing place.', ['g4-nbt-read-write'], ['4.NBT.2'], 'concept', 'Align the places and look from the largest place to the smallest.', 'The first differing place decides the comparison.', ['later_digit_first']],
  ['g4-nbt-round-any-place', 'Round to Any Place', 'Use bounding multiples and a midpoint to round whole numbers through 1,000,000.', ['g4-nbt-read-write', 'g3-round-nearest-10-100'], ['4.NBT.3'], 'concept', 'Find the two neighboring multiples of the rounding place.', 'Choose the closer bound. At the midpoint, choose the upper bound.', ['wrong_place', 'wrong_bound']],
  ['g4-nbt-add-standard', 'Multi-Digit Addition', 'Connect place-value reasoning and partial sums to the standard addition algorithm.', ['g4-nbt-read-write', 'g3-add-3digit-regrouping'], ['4.NBT.4'], 'procedure', 'Align equal places and add from the ones.', 'Ten units in a column exchange for one unit in the next column.', ['lost_carry', 'place_misalignment']],
  ['g4-nbt-sub-standard', 'Multi-Digit Subtraction', 'Record place-value decomposition and regrouping, including across zeros.', ['g4-nbt-read-write', 'g3-sub-across-zero'], ['4.NBT.4'], 'procedure', 'Align places, and exchange a larger unit when a column needs more units.', 'Across zeros, rename one larger unit across each intervening place.', ['smaller_from_larger', 'across_zero', 'place_misalignment']],
  ['g4-nbt-estimate-check', 'Estimate and Check Results', 'Use useful estimates and inverse checks to judge addition/subtraction results in context.', ['g4-nbt-round-any-place', 'g4-nbt-add-standard', 'g4-nbt-sub-standard'], ['4.OA.3', '4.NBT.3', '4.NBT.4'], 'application', 'Choose a rounding place that is useful for the situation.', 'Label an estimate as approximate and use an inverse calculation for an exact check.', ['estimate_is_exact', 'impossible_magnitude']],
];
export const GRADE4_SKILLS: readonly CurriculumSkill[] = rows.map(([id, title, description, prerequisites, standards, kind, model, connect, codes], index) => ({
  id, title, description, prerequisites, californiaStandardIds: standards, gradeLevel: 4,
  domain: index < 6 ? 'multiplication' : 'addition_subtraction', unitId: index < 6 ? 'g4-u1' : 'g4-u2',
  evidenceProfile: evidence(kind), blueprintForms: FOUNDATION_FORMS,
  misconceptions: codes.map(code => `foundation:${code}`), transferSkillIds: [id, ...prerequisites.filter(prerequisite => prerequisite.startsWith('g4-'))],
  instruction: { activate: index < 6 ? 'What do you remember about equal groups and patterns?' : 'What do you remember about tens, hundreds, and regrouping?', model, connect,
    guided: 'Try a model first. Explain the strategy, then work independently with different numbers.',
    reflection: 'Which model or check helped you? Explain one relationship you noticed.' },
  ...(id === 'g4-nbt-estimate-check' ? { partialStandardIds: ['4.OA.3'] } : {}),
}));
const grade3: Curriculum = { id: 'california-g3', version: 1, gradeLevel: 3,
  skills: GRADE3_MASTERY_MAP.map(skill => ({ ...skill, gradeLevel: 3, unitId: `g3-${skill.domain}` })),
  units: [...new Set(GRADE3_MASTERY_MAP.map(skill => skill.domain))].map(domain => ({ id: `g3-${domain}`, title: domain, skillIds: GRADE3_MASTERY_MAP.filter(skill => skill.domain === domain).map(skill => skill.id) })) };
const grade4: Curriculum = { id: 'california-g4-foundation', version: 1, gradeLevel: 4, skills: GRADE4_SKILLS,
  units: [{ id: 'g4-u1', title: 'Unit 1 · Factors and Patterns', skillIds: GRADE4_SKILLS.slice(0, 6).map(skill => skill.id) },
    { id: 'g4-u2', title: 'Unit 2 · Place Value, Addition and Subtraction', skillIds: GRADE4_SKILLS.slice(6).map(skill => skill.id) }] };
export const CURRICULA: readonly Curriculum[] = [grade3, grade4];
export const ALL_CURRICULUM_SKILLS = CURRICULA.flatMap(curriculum => curriculum.skills);
/** Explicit legacy aliases, used only when reading prerequisite references. Historical IDs stay intact. */
export const PREREQUISITE_ALIASES: Record<string, string> = { 'g3-rounding': 'g3-round-nearest-10-100', 'g3-arithmetic-patterns': 'g3-patterns-arithmetic' };
export function getCurriculum(grade: GradeLevel): Curriculum | undefined { return CURRICULA.find(curriculum => curriculum.gradeLevel === grade); }
export function getCurriculumSkill(id: string): CurriculumSkill | undefined { return ALL_CURRICULUM_SKILLS.find(skill => skill.id === (PREREQUISITE_ALIASES[id] ?? id)); }
export function validateCurriculumRegistry(curricula: readonly Curriculum[] = CURRICULA): string[] {
  const errors: string[] = [], skills = curricula.flatMap(curriculum => curriculum.skills), byId = new Map(skills.map(skill => [skill.id, skill]));
  if (skills.length !== byId.size) errors.push('Duplicate skill IDs');
  const visited = new Set<string>(), visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { errors.push(`Prerequisite cycle: ${id}`); return; }
    if (visited.has(id)) return;
    const node = byId.get(id); if (!node) { errors.push(`Unresolved skill: ${id}`); return; }
    visiting.add(id);
    for (const prerequisite of node.prerequisites) visit(PREREQUISITE_ALIASES[prerequisite] ?? prerequisite);
    for (const transfer of node.transferSkillIds ?? []) if (!byId.has(transfer)) errors.push(`Unresolved transfer: ${transfer}`);
    if (node.evidenceProfile && (!node.blueprintForms?.length || !node.misconceptions?.length)) errors.push(`Missing content registration: ${id}`);
    if (node.blueprintForms?.some(form => !FOUNDATION_FORMS.includes(form))) errors.push(`Unresolved blueprint: ${id}`);
    if (node.misconceptions?.some(code => !CURRICULUM_MISCONCEPTION_LABELS[code])) errors.push(`Unresolved misconception: ${id}`);
    if (node.partialStandardIds?.some(standard => !node.californiaStandardIds.includes(standard))) errors.push(`Unresolved partial standard: ${id}`);
    visiting.delete(id); visited.add(id);
  };
  for (const node of skills) visit(node.id);
  for (const curriculum of curricula) {
    const units = new Set(curriculum.units.map(unit => unit.id));
    for (const skill of curriculum.skills) if (!units.has(skill.unitId)) errors.push(`Unresolved unit: ${skill.unitId}`);
    for (const unit of curriculum.units) for (const id of unit.skillIds) if (!curriculum.skills.some(skill => skill.id === id)) errors.push(`Unresolved unit skill: ${id}`);
  }
  return [...new Set(errors)];
}
