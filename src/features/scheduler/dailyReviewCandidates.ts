import type { PracticeItem, StudentItemState } from '../../types/math';
import { db } from '../../db/dexie';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { deriveCardKey } from './cardModel';

export interface CanonicalReviewCard {
  cardKey: string;
  itemId: string;
  state: StudentItemState;
  sourceRowCount: number;
}

export interface CanonicalReviewResolution {
  cards: CanonicalReviewCard[];
  unresolvedRows: StudentItemState[];
  aliasRowCount: number;
}

export interface CanonicalItemStateRepairResult {
  beforeCount: number;
  afterCount: number;
  aliasRowsRemoved: number;
  unresolvedRowsRemoved: number;
  changed: boolean;
}

interface ResolvedStateRow {
  state: StudentItemState;
  item: PracticeItem;
  itemId: string;
  canonicalCardKey: string;
  alreadyCanonical: boolean;
}

function fallbackItemIdFromCardKey(cardKey: string): string | null {
  let match: RegExpMatchArray | null;

  if ((match = cardKey.match(/^fact:mul:(\d+)x(\d+)$/))) {
    return `MUL_${match[1]}x${match[2]}`;
  }
  if ((match = cardKey.match(/^fact:div:(\d+)\/(\d+)$/))) {
    return `DIV_${match[1]}d${match[2]}`;
  }
  if (cardKey.startsWith('template:')) {
    return cardKey.slice('template:'.length);
  }
  return cardKey || null;
}

function reconstructStateItem(state: StudentItemState): { item: PracticeItem; itemId: string } | null {
  const candidates = [state.lastItemId, fallbackItemIdFromCardKey(state.cardKey)];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    const item = makeItemFromId(candidate);
    if (item) return { item, itemId: item.id };
  }
  return null;
}

function validTime(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function compareAuthority(a: ResolvedStateRow, b: ResolvedStateRow): number {
  if (a.alreadyCanonical !== b.alreadyCanonical) return a.alreadyCanonical ? -1 : 1;

  const seenDelta = validTime(b.state.lastSeenAt) - validTime(a.state.lastSeenAt);
  if (seenDelta !== 0) return seenDelta;

  const repsDelta = (b.state.reps ?? 0) - (a.state.reps ?? 0);
  if (repsDelta !== 0) return repsDelta;

  const attemptsDelta = b.state.attemptCount - a.state.attemptCount;
  if (attemptsDelta !== 0) return attemptsDelta;

  return a.state.cardKey.localeCompare(b.state.cardKey);
}

function mergeRows(cardKey: string, rows: ResolvedStateRow[]): CanonicalReviewCard {
  const ordered = [...rows].sort(compareAuthority);
  const authoritative = ordered[0];
  const attemptCount = Math.max(...rows.map(row => row.state.attemptCount));
  const correctCount = Math.min(
    attemptCount,
    Math.max(...rows.map(row => row.state.correctCount)),
  );

  const state: StudentItemState = {
    ...authoritative.state,
    cardKey,
    lastItemId: authoritative.itemId,
    attemptCount,
    correctCount,
    reps: Math.max(...rows.map(row => row.state.reps ?? 0)),
    lapses: Math.max(...rows.map(row => row.state.lapses ?? 0)),
    mistakePatterns: Array.from(new Set(rows.flatMap(row => row.state.mistakePatterns ?? []))),
  };

  return {
    cardKey,
    itemId: authoritative.itemId,
    state,
    sourceRowCount: rows.length,
  };
}

/**
 * Resolves the derived item-state cache through the current learning-card model.
 * The result contains exactly one row per learner and reconstructable canonical card.
 */
export function resolveCanonicalReviewCards(states: StudentItemState[]): CanonicalReviewResolution {
  const grouped = new Map<string, ResolvedStateRow[]>();
  const unresolvedRows: StudentItemState[] = [];
  let reconstructableRowCount = 0;

  for (const state of states) {
    const reconstructed = reconstructStateItem(state);
    if (!reconstructed) {
      unresolvedRows.push(state);
      continue;
    }

    reconstructableRowCount++;
    const canonicalCardKey = deriveCardKey(reconstructed.item);
    const row: ResolvedStateRow = {
      state,
      item: reconstructed.item,
      itemId: reconstructed.itemId,
      canonicalCardKey,
      alreadyCanonical: state.cardKey === canonicalCardKey,
    };
    const learnerCardKey = `${state.studentId}\u0000${canonicalCardKey}`;
    const rows = grouped.get(learnerCardKey) ?? [];
    rows.push(row);
    grouped.set(learnerCardKey, rows);
  }

  const cards = [...grouped.values()]
    .map(rows => mergeRows(rows[0].canonicalCardKey, rows))
    .sort((a, b) => {
      const studentDelta = a.state.studentId.localeCompare(b.state.studentId);
      return studentDelta || a.cardKey.localeCompare(b.cardKey);
    });

  return {
    cards,
    unresolvedRows,
    aliasRowCount: Math.max(0, reconstructableRowCount - cards.length),
  };
}

export function resolveDueReviewCards(states: StudentItemState[], now: Date): CanonicalReviewCard[] {
  const nowStr = now.toISOString();
  return resolveCanonicalReviewCards(states).cards.filter(
    card => !!card.state.nextDueAt && card.state.nextDueAt <= nowStr,
  );
}

function stableStateJson(states: StudentItemState[]): string {
  return JSON.stringify(
    [...states]
      .sort((a, b) => `${a.studentId}:${a.cardKey}`.localeCompare(`${b.studentId}:${b.cardKey}`)),
  );
}

/**
 * Repairs the itemStates derived cache after card-taxonomy changes or sync with
 * an older device. Unresolvable cache rows are removed because they cannot be
 * launched and the canonical event log remains the source of truth.
 */
export async function repairCanonicalItemStateCache(): Promise<CanonicalItemStateRepairResult> {
  const before = await db.itemStates.toArray();
  const resolution = resolveCanonicalReviewCards(before);
  const repaired = resolution.cards.map(card => card.state);
  const changed = stableStateJson(before) !== stableStateJson(repaired);

  if (changed) {
    await db.transaction('rw', db.itemStates, async () => {
      await db.itemStates.clear();
      if (repaired.length) await db.itemStates.bulkPut(repaired);
    });
  }

  return {
    beforeCount: before.length,
    afterCount: repaired.length,
    aliasRowsRemoved: resolution.aliasRowCount,
    unresolvedRowsRemoved: resolution.unresolvedRows.length,
    changed,
  };
}
