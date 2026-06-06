import type { PracticeItem, StudentItemState } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { inferGrade3SkillId } from './skillMapping';

export type SkillSummaryStatus = 'new' | 'needs_practice' | 'review_due' | 'strong' | 'mastered';

export interface StudentSkillSummary {
  skillId: string;
  studentId: string;
  status: SkillSummaryStatus;
  /** First-attempt event count (retries excluded). Events are the source of truth for attempts. */
  attemptCount: number;
  correctCount: number;
  /** 0–1. 0 when attemptCount === 0. */
  accuracy: number;
  /** Items whose nextDueAt is set and <= now. */
  dueItemCount: number;
  /** Distinct item IDs seen in events or states for this skill. */
  itemCount: number;
  /** Union of mistakePatterns from all item states for this skill. */
  mistakePatterns: string[];
}

export interface DeriveGrade3SkillSummariesArgs {
  studentId: string;
  /** All practice items (array) or a lazy per-ID resolver, used to infer skill IDs. */
  items: PracticeItem[] | ((itemId: string) => PracticeItem | null);
  mathAnswerEvents: MathAnswerEvent[];
  itemStates: StudentItemState[];
  /** ISO timestamp used to determine which items are due for review. */
  now: string;
}

// Status thresholds
const ACCURACY_NEEDS_PRACTICE = 0.60;
const ACCURACY_MASTERED = 0.90;
const ATTEMPTS_MASTERED = 5;
// Require at least 4 distinct items to prevent mastery from repeated single-item drilling.
const MIN_ITEMS_MASTERED = 4;

function classifyStatus(
  attemptCount: number,
  accuracy: number,
  dueItemCount: number,
  itemCount: number,
): SkillSummaryStatus {
  if (attemptCount === 0) return 'new';
  if (dueItemCount > 0) return 'review_due';
  if (accuracy < ACCURACY_NEEDS_PRACTICE) return 'needs_practice';
  if (
    accuracy >= ACCURACY_MASTERED &&
    attemptCount >= ATTEMPTS_MASTERED &&
    itemCount >= MIN_ITEMS_MASTERED
  ) return 'mastered';
  return 'strong';
}

export function deriveGrade3SkillSummaries(
  args: DeriveGrade3SkillSummariesArgs,
): StudentSkillSummary[] {
  const { studentId, items, mathAnswerEvents, itemStates, now } = args;

  const studentEvents = mathAnswerEvents.filter(e => e.studentId === studentId);
  const studentStates = itemStates.filter(s => s.studentId === studentId);

  // Collect all item IDs seen in this student's events and states
  const allItemIds = new Set<string>();
  for (const e of studentEvents) allItemIds.add(e.itemId);
  for (const s of studentStates) allItemIds.add(s.itemId);

  // Build itemId → Grade 3 skillId map
  const itemSkillMap = new Map<string, string>();
  if (Array.isArray(items)) {
    for (const item of items) {
      const skillId = inferGrade3SkillId(item);
      if (skillId) itemSkillMap.set(item.id, skillId);
    }
  } else {
    for (const itemId of allItemIds) {
      const item = items(itemId);
      if (item) {
        const skillId = inferGrade3SkillId(item);
        if (skillId) itemSkillMap.set(itemId, skillId);
      }
    }
  }

  // Group first-attempt events by skillId (events are source of truth for attempts)
  const eventsBySkill = new Map<string, MathAnswerEvent[]>();
  for (const event of studentEvents) {
    if (event.isRetry) continue;
    const skillId = itemSkillMap.get(event.itemId);
    if (!skillId) continue;
    const arr = eventsBySkill.get(skillId) ?? [];
    arr.push(event);
    eventsBySkill.set(skillId, arr);
  }

  // Group item states by skillId (states provide dueItemCount and mistakePatterns)
  const statesBySkill = new Map<string, StudentItemState[]>();
  for (const state of studentStates) {
    const skillId = itemSkillMap.get(state.itemId);
    if (!skillId) continue;
    const arr = statesBySkill.get(skillId) ?? [];
    arr.push(state);
    statesBySkill.set(skillId, arr);
  }

  const allSkillIds = new Set([...eventsBySkill.keys(), ...statesBySkill.keys()]);

  return Array.from(allSkillIds, skillId => {
    const events = eventsBySkill.get(skillId) ?? [];
    const states = statesBySkill.get(skillId) ?? [];

    const attemptCount = events.length;
    const correctCount = events.filter(e => e.isCorrect).length;
    const accuracy = attemptCount > 0 ? correctCount / attemptCount : 0;
    const dueItemCount = states.filter(s => s.nextDueAt != null && s.nextDueAt <= now).length;
    const mistakePatterns = [...new Set(states.flatMap(s => s.mistakePatterns))];

    const skillItemIds = new Set([
      ...events.map(e => e.itemId),
      ...states.map(s => s.itemId),
    ]);

    return {
      skillId,
      studentId,
      status: classifyStatus(attemptCount, accuracy, dueItemCount, skillItemIds.size),
      attemptCount,
      correctCount,
      accuracy,
      dueItemCount,
      itemCount: skillItemIds.size,
      mistakePatterns,
    };
  });
}
