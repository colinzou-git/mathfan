export type Grade3Domain =
  | 'multiplication'
  | 'division'
  | 'fractions'
  | 'area_perimeter'
  | 'geometry'
  | 'addition_subtraction'
  | 'measurement_data';

export type SkillStatus = 'locked' | 'available' | 'in_progress' | 'mastered';

export interface MasterySkillNode {
  id: string;
  domain: Grade3Domain;
  title: string;
  description: string;
  prerequisites: string[];
  californiaStandardIds: string[];
}

export const GRADE3_MASTERY_MAP: readonly MasterySkillNode[] = [
  // ── Multiplication ──────────────────────────────────────────────────────────
  {
    id: 'g3-mul-meaning',
    domain: 'multiplication',
    title: 'Meaning of Multiplication',
    description: 'Understand multiplication as equal groups or arrays.',
    prerequisites: [],
    californiaStandardIds: ['3.OA.A.1'],
  },
  {
    id: 'g3-mul-tables-basic',
    domain: 'multiplication',
    title: 'Times Tables 1–5',
    description: 'Fluently multiply within 25 using tables 1–5.',
    prerequisites: ['g3-mul-meaning'],
    californiaStandardIds: ['3.OA.C.7'],
  },
  {
    id: 'g3-mul-tables-advanced',
    domain: 'multiplication',
    title: 'Times Tables 6–10',
    description: 'Fluently multiply within 100 using tables 6–10.',
    prerequisites: ['g3-mul-tables-basic'],
    californiaStandardIds: ['3.OA.C.7'],
  },
  {
    id: 'g3-mul-properties',
    domain: 'multiplication',
    title: 'Properties of Multiplication',
    description: 'Apply commutative and associative properties to simplify multiplication.',
    prerequisites: ['g3-mul-meaning'],
    californiaStandardIds: ['3.OA.B.5'],
  },
  // ── Division ────────────────────────────────────────────────────────────────
  {
    id: 'g3-div-meaning',
    domain: 'division',
    title: 'Meaning of Division',
    description: 'Understand division as equal sharing or equal grouping.',
    prerequisites: ['g3-mul-meaning'],
    californiaStandardIds: ['3.OA.A.2'],
  },
  {
    id: 'g3-div-within-100',
    domain: 'division',
    title: 'Divide Within 100',
    description: 'Fluently divide within 100 using divisors 1–10.',
    prerequisites: ['g3-div-meaning', 'g3-mul-tables-basic'],
    californiaStandardIds: ['3.OA.C.7'],
  },
  {
    id: 'g3-div-mul-relationship',
    domain: 'division',
    title: 'Multiplication and Division Relationship',
    description: 'Use multiplication facts to solve related division problems.',
    prerequisites: ['g3-div-meaning', 'g3-mul-tables-advanced'],
    californiaStandardIds: ['3.OA.B.6'],
  },
  // ── Fractions ───────────────────────────────────────────────────────────────
  {
    id: 'g3-frac-unit',
    domain: 'fractions',
    title: 'Unit Fractions',
    description: 'Understand a fraction 1/b as one equal part of a whole divided into b parts.',
    prerequisites: [],
    californiaStandardIds: ['3.NF.A.1'],
  },
  {
    id: 'g3-frac-number-line',
    domain: 'fractions',
    title: 'Fractions on a Number Line',
    description: 'Represent fractions on a number line between 0 and 1.',
    prerequisites: ['g3-frac-unit'],
    californiaStandardIds: ['3.NF.A.2'],
  },
  {
    id: 'g3-frac-equivalent',
    domain: 'fractions',
    title: 'Equivalent Fractions',
    description: 'Recognize and generate equivalent fractions using visual models.',
    prerequisites: ['g3-frac-unit'],
    californiaStandardIds: ['3.NF.A.3'],
  },
  {
    id: 'g3-frac-compare',
    domain: 'fractions',
    title: 'Comparing Fractions',
    description: 'Compare fractions with the same numerator or denominator using <, =, >.',
    prerequisites: ['g3-frac-equivalent'],
    californiaStandardIds: ['3.NF.A.3'],
  },
  // ── Area and Perimeter ──────────────────────────────────────────────────────
  {
    id: 'g3-area-concept',
    domain: 'area_perimeter',
    title: 'Area as Unit Squares',
    description: 'Understand area as the number of unit squares covering a shape.',
    prerequisites: [],
    californiaStandardIds: ['3.MD.C.5', '3.MD.C.6'],
  },
  {
    id: 'g3-area-formula',
    domain: 'area_perimeter',
    title: 'Area by Multiplication',
    description: 'Find the area of a rectangle by multiplying side lengths.',
    prerequisites: ['g3-area-concept', 'g3-mul-tables-basic'],
    californiaStandardIds: ['3.MD.C.7'],
  },
  {
    id: 'g3-perimeter',
    domain: 'area_perimeter',
    title: 'Perimeter of Polygons',
    description: 'Find the perimeter of polygons by adding side lengths.',
    prerequisites: [],
    californiaStandardIds: ['3.MD.D.8'],
  },
  {
    id: 'g3-area-perimeter-compare',
    domain: 'area_perimeter',
    title: 'Compare Area and Perimeter',
    description: 'Understand that rectangles can have the same area but different perimeters, or the same perimeter but different areas.',
    prerequisites: ['g3-area-formula', 'g3-perimeter'],
    californiaStandardIds: ['3.MD.D.8'],
  },
  // ── Addition & Subtraction ──────────────────────────────────────────────────
  {
    id: 'g3-add-2digit-regrouping',
    domain: 'addition_subtraction',
    title: '2-Digit Addition with Regrouping',
    description: 'Add 2-digit numbers that require carrying/regrouping.',
    prerequisites: [],
    californiaStandardIds: ['3.NBT.A.2'],
  },
  {
    id: 'g3-add-3digit-regrouping',
    domain: 'addition_subtraction',
    title: '3-Digit Addition with Regrouping',
    description: 'Add 3-digit numbers that require carrying/regrouping in ones, tens, or both.',
    prerequisites: ['g3-add-2digit-regrouping'],
    californiaStandardIds: ['3.NBT.A.2'],
  },
  {
    id: 'g3-sub-2digit-regrouping',
    domain: 'addition_subtraction',
    title: '2-Digit Subtraction with Borrowing',
    description: 'Subtract 2-digit numbers that require borrowing/regrouping.',
    prerequisites: [],
    californiaStandardIds: ['3.NBT.A.2'],
  },
  {
    id: 'g3-sub-3digit-regrouping',
    domain: 'addition_subtraction',
    title: '3-Digit Subtraction with Borrowing',
    description: 'Subtract 3-digit numbers that require borrowing/regrouping across tens, hundreds, or zeros.',
    prerequisites: ['g3-sub-2digit-regrouping'],
    californiaStandardIds: ['3.NBT.A.2'],
  },
  // ── Geometry ────────────────────────────────────────────────────────────────
  {
    id: 'g3-geo-categories',
    domain: 'geometry',
    title: 'Categories of Shapes',
    description: 'Understand that shapes in different categories share attributes (e.g., quadrilaterals).',
    prerequisites: [],
    californiaStandardIds: ['3.G.A.1'],
  },
  {
    id: 'g3-geo-rectilinear-area',
    domain: 'geometry',
    title: 'Area of Rectilinear Figures',
    description: 'Decompose rectilinear figures into non-overlapping rectangles to find total area.',
    prerequisites: ['g3-area-formula', 'g3-geo-categories'],
    californiaStandardIds: ['3.MD.C.7d'],
  },
  // ── Rounding & Number Operations ────────────────────────────────────────────
  {
    id: 'g3-round-nearest-10-100',
    domain: 'addition_subtraction',
    title: 'Rounding to Nearest 10 or 100',
    description: 'Round whole numbers to the nearest 10 or 100.',
    prerequisites: [],
    californiaStandardIds: ['3.NBT.A.1'],
  },
  {
    id: 'g3-mul-multiple-of-10',
    domain: 'multiplication',
    title: 'Multiply by Multiples of 10',
    description: 'Multiply one-digit whole numbers by multiples of 10 (e.g., 4 × 30 = 120).',
    prerequisites: ['g3-mul-tables-basic'],
    californiaStandardIds: ['3.NBT.A.3'],
  },
  {
    id: 'g3-word-two-step',
    domain: 'multiplication',
    title: 'Two-Step Word Problems',
    description: 'Solve two-step word problems using the four operations (+, −, ×, ÷).',
    prerequisites: ['g3-mul-meaning', 'g3-div-meaning'],
    californiaStandardIds: ['3.OA.D.8'],
  },
  {
    id: 'g3-patterns-arithmetic',
    domain: 'multiplication',
    title: 'Arithmetic Patterns',
    description: 'Identify and extend arithmetic patterns in number sequences and multiplication tables.',
    prerequisites: ['g3-mul-tables-basic'],
    californiaStandardIds: ['3.OA.D.9'],
  },
  // ── Measurement & Data ───────────────────────────────────────────────────────
  {
    id: 'g3-time-to-minute',
    domain: 'measurement_data',
    title: 'Tell Time to the Minute',
    description: 'Tell and write time to the nearest minute using analog and digital clocks.',
    prerequisites: [],
    californiaStandardIds: ['3.MD.A.1'],
  },
  {
    id: 'g3-elapsed-time',
    domain: 'measurement_data',
    title: 'Elapsed Time',
    description: 'Solve word problems involving elapsed time in minutes.',
    prerequisites: ['g3-time-to-minute'],
    californiaStandardIds: ['3.MD.A.1'],
  },
  {
    id: 'g3-volume-mass-word-problems',
    domain: 'measurement_data',
    title: 'Mass and Liquid Volume',
    description: 'Solve word problems involving masses and liquid volumes using addition, subtraction, and multiplication.',
    prerequisites: [],
    californiaStandardIds: ['3.MD.A.2'],
  },
  {
    id: 'g3-scaled-bar-graphs',
    domain: 'measurement_data',
    title: 'Scaled Bar Graphs',
    description: 'Read and interpret scaled bar graphs where each unit represents more than 1.',
    prerequisites: [],
    californiaStandardIds: ['3.MD.B.3'],
  },
  {
    id: 'g3-line-plots',
    domain: 'measurement_data',
    title: 'Line Plots',
    description: 'Read line plots and solve problems using the data displayed.',
    prerequisites: [],
    californiaStandardIds: ['3.MD.B.4'],
  },
];

export function getGrade3Skill(skillId: string): MasterySkillNode | undefined {
  return GRADE3_MASTERY_MAP.find(s => s.id === skillId);
}

export function getGrade3SkillsByDomain(domain: Grade3Domain): MasterySkillNode[] {
  return GRADE3_MASTERY_MAP.filter(s => s.domain === domain);
}

export function isGrade3SkillId(skillId: string): boolean {
  return GRADE3_MASTERY_MAP.some(s => s.id === skillId);
}
