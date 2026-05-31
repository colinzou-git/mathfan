import type { PracticeItem, GradeLevel } from '../../types/math';

const SKILL_NT = 'SKILL_NUMBER_THEORY';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

export function primeId(n: number): string { return `PRIME_${n}`; }
export function factorId(x: number, y: number): string { return `FACT_${x}_${y}`; }

export function makePrimeItem(n: number): PracticeItem {
  return {
    id: primeId(n),
    skillId: SKILL_NT,
    itemType: 'prime_composite',
    prompt: `Is ${n} prime or composite?`,
    answer: isPrime(n) ? 'prime' : 'composite',
    answerInput: 'choice',
    choices: ['prime', 'composite'],
    tags: ['number_theory', 'prime'],
    difficulty: 0.55,
    factA: n,
  };
}

export function makeFactorItem(x: number, y: number): PracticeItem {
  return {
    id: factorId(x, y),
    skillId: SKILL_NT,
    itemType: 'factor_check',
    prompt: `Is ${x} a factor of ${y}?`,
    answer: y % x === 0 ? 'yes' : 'no',
    answerInput: 'choice',
    choices: ['yes', 'no'],
    tags: ['number_theory', 'factor'],
    difficulty: 0.5,
    factA: x,
    factB: y,
  };
}

function maxN(grade: GradeLevel): number {
  if (grade === 3) return 30;
  if (grade === 4) return 60;
  return 100;
}

export function generateNumberTheoryItems(
  grade: GradeLevel, count: number, rangeMin?: number, rangeMax?: number,
): PracticeItem[] {
  const hi = Math.max(3, Math.floor(rangeMax ?? maxN(grade)));
  const lo = Math.max(2, Math.min(hi, Math.floor(rangeMin ?? 2)));
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    // ~60% prime/composite, ~40% factor-of
    if (Math.random() < 0.6) {
      const n = randInt(lo, hi);
      const item = makePrimeItem(n);
      if (seen.has(item.id) && items.length < count) continue;
      seen.add(item.id);
      items.push(item);
    } else {
      const x = randInt(2, Math.max(2, Math.min(12, hi)));
      const y = randInt(Math.max(x, lo), hi);
      const item = makeFactorItem(x, y);
      if (seen.has(item.id) && items.length < count) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}
