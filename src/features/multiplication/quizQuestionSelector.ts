import type { MultiplicationFactStats, MultiplicationFactKey } from './types';
import { ALL_FACT_KEYS, createInitialFactStats, parseFactKey } from './multiplicationFacts';

const REVIEW_INTERVAL_DAYS = 3;
const STALE_DAYS = 7;
const COLD_START_THRESHOLD = 0.15; // < 15% tested → use balanced sample

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

function isWeak(s: MultiplicationFactStats): boolean {
  return s.masteryState === 'weak' || s.masteryState === 'forgotten' || s.streakIncorrect > 0;
}

function isDueForReview(s: MultiplicationFactStats): boolean {
  return s.everTested && daysSince(s.lastQuizAt) >= REVIEW_INTERVAL_DAYS;
}

function isStaleOrNew(s: MultiplicationFactStats): boolean {
  return !s.everTested || daysSince(s.lastQuizAt) > STALE_DAYS;
}

function isMaintenance(s: MultiplicationFactStats): boolean {
  return s.masteryState === 'mastered' || s.masteryState === 'strong';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks `count` items spread evenly across left-factor rows.
function balancedSample(keys: MultiplicationFactKey[], count: number): MultiplicationFactKey[] {
  if (keys.length <= count) return shuffle(keys);

  const byLeft = new Map<number, MultiplicationFactKey[]>();
  for (const key of keys) {
    const { left } = parseFactKey(key);
    if (!byLeft.has(left)) byLeft.set(left, []);
    byLeft.get(left)!.push(key);
  }
  for (const [k, v] of byLeft) byLeft.set(k, shuffle(v));

  const groups = [...byLeft.values()];
  const result: MultiplicationFactKey[] = [];
  let i = 0;
  while (result.length < count && groups.some(g => g.length > 0)) {
    const group = groups[i % groups.length];
    if (group.length > 0) result.push(group.shift()!);
    i++;
  }
  return shuffle(result).slice(0, count);
}

export function selectQuizQuestions(
  studentId: string,
  statsMap: Map<MultiplicationFactKey, MultiplicationFactStats>,
  count: number,
): MultiplicationFactKey[] {
  const allStats = ALL_FACT_KEYS.map(key => {
    if (statsMap.has(key)) return statsMap.get(key)!;
    const { left, right } = parseFactKey(key);
    return createInitialFactStats(studentId, left, right);
  });

  const testedCount = allStats.filter(s => s.everTested).length;
  if (testedCount < ALL_FACT_KEYS.length * COLD_START_THRESHOLD) {
    return balancedSample(ALL_FACT_KEYS, count);
  }

  const weak: MultiplicationFactKey[] = [];
  const review: MultiplicationFactKey[] = [];
  const stale: MultiplicationFactKey[] = [];
  const maintenance: MultiplicationFactKey[] = [];

  for (const s of allStats) {
    if (isWeak(s)) weak.push(s.key);
    else if (isDueForReview(s)) review.push(s.key);
    else if (isStaleOrNew(s)) stale.push(s.key);
    else if (isMaintenance(s)) maintenance.push(s.key);
  }

  // Target mix: 40% weak, 25% review, 25% stale/new, 10% maintenance
  const tWeak  = Math.round(count * 0.40);
  const tRev   = Math.round(count * 0.25);
  const tStale = Math.round(count * 0.25);
  const tMaint = count - tWeak - tRev - tStale;

  const used = new Set<MultiplicationFactKey>();
  const selected: MultiplicationFactKey[] = [];

  function take(pool: MultiplicationFactKey[], n: number) {
    const shuffled = shuffle(pool);
    let taken = 0;
    for (const key of shuffled) {
      if (taken >= n) break;
      if (!used.has(key)) {
        selected.push(key);
        used.add(key);
        taken++;
      }
    }
  }

  take(weak,        tWeak);
  take(review,      tRev);
  take(stale,       tStale);
  take(maintenance, tMaint);

  // Fill remaining slots from anything not yet used
  if (selected.length < count) {
    const overflow = shuffle(allStats.map(s => s.key).filter(k => !used.has(k)));
    take(overflow, count - selected.length);
  }

  return shuffle(selected).slice(0, count);
}
