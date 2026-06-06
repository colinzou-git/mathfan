import type { PracticeItem } from '../../types/math';

export function propCmtId(a: number, b: number): string {
  return `PROP_CMT_${a}x${b}`;
}

export function propIdtId(a: number): string {
  return `PROP_IDT_${a}`;
}

export function propZeroId(a: number): string {
  return `PROP_ZERO_${a}`;
}

export function propAscId(a: number, b: number, c: number): string {
  return `PROP_ASC_${a}x${b}x${c}`;
}

export function propDistId(a: number, b: number, c: number): string {
  return `PROP_DIST_${a}x${b}p${c}`;
}

/** Commutative property: a × b = b × __ → answer: a */
export function makePropCommutativityItem(a: number, b: number): PracticeItem {
  return {
    id: propCmtId(a, b),
    skillId: 'g3-mul-properties',
    itemType: 'multiplication_properties',
    prompt: `${a} × ${b} = ${b} × __`,
    answer: a,
    answerInput: 'numeric',
    explanation: `The Commutative Property: you can swap the order and the product stays the same. ${b} × ${a} = ${a} × ${b} = ${a * b}.`,
    tags: ['multiplication', 'commutative', 'properties'],
    difficulty: 0.4,
    factA: a,
    factB: b,
  };
}

/** Identity property: a × 1 = __ → answer: a */
export function makePropIdentityItem(a: number): PracticeItem {
  return {
    id: propIdtId(a),
    skillId: 'g3-mul-properties',
    itemType: 'multiplication_properties',
    prompt: `${a} × 1 = __`,
    answer: a,
    answerInput: 'numeric',
    explanation: `The Identity Property: any number times 1 equals itself. ${a} × 1 = ${a}.`,
    tags: ['multiplication', 'identity', 'properties'],
    difficulty: 0.3,
    factA: a,
    factB: 1,
  };
}

/** Zero property: a × 0 = __ → answer: 0 */
export function makePropZeroItem(a: number): PracticeItem {
  return {
    id: propZeroId(a),
    skillId: 'g3-mul-properties',
    itemType: 'multiplication_properties',
    prompt: `${a} × 0 = __`,
    answer: 0,
    answerInput: 'numeric',
    explanation: `The Zero Property: any number times 0 equals 0. ${a} × 0 = 0.`,
    tags: ['multiplication', 'zero', 'properties'],
    difficulty: 0.3,
    factA: a,
    factB: 0,
  };
}

/** Associative property: (a × b) × c = a × (b × __) → answer: c */
export function makePropAssociativeItem(a: number, b: number, c: number): PracticeItem {
  return {
    id: propAscId(a, b, c),
    skillId: 'g3-mul-properties',
    itemType: 'multiplication_properties',
    prompt: `(${a} × ${b}) × ${c} = ${a} × (${b} × __)`,
    answer: c,
    answerInput: 'numeric',
    explanation: `The Associative Property: you can regroup the factors and the product stays the same. (${a} × ${b}) × ${c} = ${a} × (${b} × ${c}) = ${a * b * c}.`,
    tags: ['multiplication', 'associative', 'properties'],
    difficulty: 0.5,
    factA: a,
    factB: b,
  };
}

/** Distributive property: a × (b + c) = (a × b) + (a × __) → answer: c */
export function makePropDistributiveItem(a: number, b: number, c: number): PracticeItem {
  return {
    id: propDistId(a, b, c),
    skillId: 'g3-mul-properties',
    itemType: 'multiplication_properties',
    prompt: `${a} × (${b} + ${c}) = (${a} × ${b}) + (${a} × __)`,
    answer: c,
    answerInput: 'numeric',
    explanation: `The Distributive Property: you can split one factor and multiply each part. ${a} × (${b} + ${c}) = (${a} × ${b}) + (${a} × ${c}) = ${a * b} + ${a * c} = ${a * b + a * c}.`,
    tags: ['multiplication', 'distributive', 'properties'],
    difficulty: 0.6,
    factA: a,
    factB: b + c,
  };
}

/** Item IDs for a multiplication properties practice set. */
export function mulPropertyItemIds(): string[] {
  const ids: string[] = [];
  // Commutative: a × b = b × __, pairs where a != b, range 2–9
  const pairs: [number, number][] = [
    [2, 3], [2, 4], [2, 5], [2, 6], [2, 7],
    [3, 4], [3, 5], [3, 6], [3, 7], [3, 8],
    [4, 5], [4, 6], [4, 7], [5, 6], [5, 7],
  ];
  for (const [a, b] of pairs) ids.push(propCmtId(a, b));
  // Identity: a × 1, a from 2–9
  for (let a = 2; a <= 9; a++) ids.push(propIdtId(a));
  // Zero property: a × 0, a from 2–9
  for (let a = 2; a <= 9; a++) ids.push(propZeroId(a));
  // Associative: (a × b) × c = a × (b × __) — Grade 3-safe triples (product ≤ 60)
  const ascTriples: [number, number, number][] = [
    [2, 3, 4], [2, 4, 3], [2, 5, 2], [3, 2, 4],
    [3, 4, 2], [4, 2, 3], [2, 2, 5], [3, 2, 5],
  ];
  for (const [a, b, c] of ascTriples) ids.push(propAscId(a, b, c));
  // Distributive: a × (b + c) = (a × b) + (a × __) — Grade 3-safe (factors ≤ 5, b+c ≤ 9)
  const distTriples: [number, number, number][] = [
    [3, 2, 4], [2, 3, 4], [4, 2, 3], [3, 4, 5],
    [5, 2, 3], [2, 5, 4], [4, 3, 2], [3, 3, 2],
  ];
  for (const [a, b, c] of distTriples) ids.push(propDistId(a, b, c));
  return ids;
}
