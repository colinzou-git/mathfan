import type { PracticeItem, GradeLevel } from '../../types/math';

const SKILL_ROUND = 'SKILL_ROUNDING';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function roundId(n: number, place: number): string {
  return `ROUND_${n}_${place}`;
}

export function roundToNearest(n: number, place: number): number {
  return Math.round(n / place) * place;
}

export function makeRoundingItem(n: number, place: number): PracticeItem {
  const placeWord = place === 10 ? 'ten' : place === 100 ? 'hundred' : 'thousand';
  return {
    id: roundId(n, place),
    skillId: SKILL_ROUND,
    itemType: 'rounding',
    prompt: `Round ${n} to the nearest ${placeWord}.`,
    answer: roundToNearest(n, place),
    answerInput: 'numeric',
    tags: ['rounding', `nearest_${place}`],
    difficulty: place >= 1000 ? 0.6 : 0.45,
    factA: n,
    factB: place,
  };
}

/** Place values practiced per grade. */
function placesFor(grade: GradeLevel): number[] {
  if (grade === 3) return [10, 100];
  if (grade === 4) return [10, 100, 1000];
  return [100, 1000];
}
function rangeFor(grade: GradeLevel): [number, number] {
  if (grade === 3) return [11, 999];
  if (grade === 4) return [11, 9999];
  return [101, 99999];
}

export function generateRoundingItems(
  grade: GradeLevel, count: number, rangeMin?: number, rangeMax?: number,
): PracticeItem[] {
  const [defLo, defHi] = rangeFor(grade);
  const hi = Math.max(11, Math.floor(rangeMax ?? defHi));
  const lo = Math.max(11, Math.min(hi, Math.floor(rangeMin ?? defLo)));
  // Only round to places at or below the largest number, else answers are all 0.
  const allPlaces = placesFor(grade);
  const places = allPlaces.filter(p => p <= hi);
  if (places.length === 0) places.push(allPlaces[0]);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const place = places[randInt(0, places.length - 1)];
    const n = randInt(lo, hi);
    // Avoid trivial already-round numbers
    if (n % place === 0) continue;
    const item = makeRoundingItem(n, place);
    if (seen.has(item.id) && items.length < count) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
