import type { MisconceptionEvidence, PracticeItem, StudentItemState } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { inferGrade3SkillId } from './skillMapping';
import { hasUnresolvedMisconceptionForSkill } from './misconceptionEngine';
import { deriveConfiguredSkillSummary } from './curriculumEvidence';
import { GRADE4_SKILLS } from '../curriculum/curriculumRegistry';

export type SkillSummaryStatus = 'new' | 'needs_practice' | 'review_due' | 'strong' | 'mastered';

export interface StudentSkillSummary {
  learningState?: Exclude<SkillSummaryStatus, 'review_due'>;
  reviewState?: 'unintroduced' | 'scheduled' | 'due';
  recommendationState?: 'start' | 'continue' | 'review' | 'remediate' | 'transfer';
  lifetimeAccuracy?: number;
  evidenceGaps?: string[];
  provisionalPlacement?: boolean;
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
  hasRequiredRepresentationDiversity = true,
  hasRequiredDelayedEvidence = true,
  hasUnresolvedMisconception = false,
): SkillSummaryStatus {
  if (attemptCount === 0) return 'new';
  if (dueItemCount > 0) return 'review_due';
  if (accuracy < ACCURACY_NEEDS_PRACTICE) return 'needs_practice';
  if (
    accuracy >= ACCURACY_MASTERED &&
    attemptCount >= ATTEMPTS_MASTERED &&
    itemCount >= MIN_ITEMS_MASTERED &&
    hasRequiredRepresentationDiversity &&
    hasRequiredDelayedEvidence &&
    !hasUnresolvedMisconception
  ) return 'mastered';
  return 'strong';
}

function classifySummerEstimationStatus(args: {
  events: MathAnswerEvent[];
  dueItemCount: number;
  representationCount: number;
  allowsSingleRepresentation: boolean;
  hasUnresolvedMisconception: boolean;
}): SkillSummaryStatus {
  const { events, dueItemCount, representationCount, allowsSingleRepresentation, hasUnresolvedMisconception } = args;
  if (events.length === 0) return 'new';
  if (dueItemCount > 0) return 'review_due';
  const accuracy = events.filter(event => event.isCorrect).length / events.length;
  if (accuracy < ACCURACY_NEEDS_PRACTICE) return 'needs_practice';

  const recent = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-5);
  const lastThree = recent.slice(-3);
  const recentFourOfFive = recent.length >= 5 && recent.filter(event => event.isCorrect).length >= 4;
  const lastThreeCorrect = lastThree.length === 3 && lastThree.every(event => event.isCorrect);
  const eventDays = new Set(events.map(event => event.createdAt.slice(0, 10)));
  const delayedAcrossDays = eventDays.size >= 2;
  const multipleSessions = new Set(events.map(event => event.sessionId)).size >= 2;
  const transferEvidence = allowsSingleRepresentation || representationCount >= 2;

  if (recentFourOfFive && lastThreeCorrect && delayedAcrossDays && multipleSessions
    && transferEvidence && !hasUnresolvedMisconception) return 'mastered';
  return 'strong';
}

export function deriveGrade3SkillSummaries(
  args: DeriveGrade3SkillSummariesArgs,
): StudentSkillSummary[] {
  const { studentId, items, mathAnswerEvents, itemStates, now } = args;

  // Exclude indirect related-evidence events — they nudge FSRS scheduling only
  // and must not count toward a fact's attempt/accuracy in the mastery view.
  const studentEvents = mathAnswerEvents.filter(e => e.studentId === studentId && !e.relatedEvidence);
  const studentStates = itemStates.filter(s => s.studentId === studentId);

  // Collect all item IDs seen in this student's events and states
  const allItemIds = new Set<string>();
  for (const e of studentEvents) allItemIds.add(e.itemId);
  for (const s of studentStates) allItemIds.add(s.lastItemId ?? s.cardKey);

  // Build itemId → Grade 3 skillId map
  const itemSkillMap = new Map<string, string>();
  const itemRepresentationMap = new Map<string, string>();
  const recordItem = (item: PracticeItem) => {
    if (item.gradeLevel === 4) return;
    const skillId = inferGrade3SkillId(item);
    if (skillId) itemSkillMap.set(item.id, skillId);
    const comparison = item.visualSpec?.kind === 'area_perimeter_compare' ? item.visualSpec.comparison : undefined;
    itemRepresentationMap.set(item.id, comparison ?? item.visualSpec?.kind ?? item.schemaId ?? item.itemType);
  };
  if (Array.isArray(items)) {
    for (const item of items) {
      recordItem(item);
    }
  } else {
    for (const itemId of allItemIds) {
      const item = items(itemId);
      if (item) {
        recordItem(item);
      }
    }
  }

  // Group first-attempt events by skillId (events are source of truth for attempts)
  const eventsBySkill = new Map<string, MathAnswerEvent[]>();
  for (const event of studentEvents) {
    if (event.isRetry || event.schedulingKind === 'relearning_step') continue;
    const skillId = itemSkillMap.get(event.itemId);
    if (!skillId) continue;
    const arr = eventsBySkill.get(skillId) ?? [];
    arr.push(event);
    eventsBySkill.set(skillId, arr);
  }

  // Group item states by skillId (states provide dueItemCount and mistakePatterns)
  const statesBySkill = new Map<string, StudentItemState[]>();
  for (const state of studentStates) {
    const skillId = itemSkillMap.get(state.lastItemId ?? state.cardKey);
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
    const misconceptionEvidence = states.flatMap(state => state.misconceptionEvidence
      ?? state.mistakePatterns.map(code => ({
        code, firstSeenAt: '', lastSeenAt: '', occurrenceCount: 1,
        sourceItemIds: [], status: 'active' as const,
      } satisfies MisconceptionEvidence)));

    const skillItemIds = new Set([
      ...events.map(e => e.itemId),
      ...states.map(s => s.lastItemId ?? s.cardKey),
    ]);
    const representationCount = new Set(
      [...skillItemIds].map(id => itemRepresentationMap.get(id)).filter(Boolean),
    ).size;
    // Broad perimeter/comparison mastery needs transfer across at least two
    // representations; repeated dimension variants of one schema are not enough.
    const needsDiversity = skillId === 'g3-perimeter' || skillId === 'g3-area-perimeter-compare' || skillId === 'g3-frac-compare'
      || skillId === 'g3-scaled-bar-graphs' || skillId === 'g3-line-plots' || skillId === 'g3-elapsed-time';
    const isRegroupingSkill = (/^g3-(add|sub)-/.test(skillId) && skillId.includes('regrouping')) || skillId === 'g3-sub-across-zero';
    const isStructuredProcedure = isRegroupingSkill || skillId === 'g3-div-decomposition';
    const needsDelayedEvidence = skillId === 'g3-frac-compare' || skillId === 'g3-scaled-bar-graphs' || skillId === 'g3-line-plots' || skillId === 'g3-elapsed-time';
    const eventDays = new Set(events.map(event => event.createdAt.slice(0, 10)));
    const hasDelayedEvidence = eventDays.size >= 2 || states.some(state => (state.reps ?? 0) >= 2);
    const hasMultipleSessions = new Set(events.map(event => event.sessionId)).size >= 2;
    const hasUnresolvedMisconception = hasUnresolvedMisconceptionForSkill(misconceptionEvidence, skillId);
    const isSummerEstimation = skillId.startsWith('g3s-mul-est-') || skillId.startsWith('g3s-div-est-');
    const status = isSummerEstimation
      ? classifySummerEstimationStatus({
          events,
          dueItemCount,
          representationCount,
          allowsSingleRepresentation: skillId === 'g3s-mul-est-purpose' || skillId === 'g3s-mul-est-context-2x1'
            || skillId === 'g3s-div-est-purpose' || skillId === 'g3s-div-est-context-2x1',
          hasUnresolvedMisconception,
        })
      : classifyStatus(
          attemptCount,
          accuracy,
          dueItemCount,
          skillItemIds.size,
          (!needsDiversity && !isStructuredProcedure) || representationCount >= 2,
          (!needsDelayedEvidence || hasDelayedEvidence) && (!isStructuredProcedure || hasMultipleSessions),
          hasUnresolvedMisconception,
        );

    return {
      skillId,
      studentId,
      status,
      attemptCount,
      correctCount,
      accuracy,
      dueItemCount,
      itemCount: skillItemIds.size,
      mistakePatterns,
    };
  });
}

/** Grade 3 compatibility adapter plus data-configured curriculum evidence. */
export function deriveCurriculumSkillSummaries(args: DeriveGrade3SkillSummariesArgs & { timezone?: string }): StudentSkillSummary[] {
  const legacy = deriveGrade3SkillSummaries(args);
  const withoutDue = new Map(deriveGrade3SkillSummaries({ ...args, itemStates: args.itemStates.map(state => ({ ...state, nextDueAt: undefined })) }).map(summary => [summary.skillId, summary]));
  const ids = new Set([...args.mathAnswerEvents.map(event => event.itemId), ...args.itemStates.map(state => state.lastItemId ?? state.cardKey)]);
  const items = new Map<string, PracticeItem>();
  const resolver = args.items;
  if (Array.isArray(resolver)) resolver.forEach(item => items.set(item.id, item));
  else ids.forEach(id => { const item = resolver(id); if (item) items.set(id, item); });
  return [...legacy.map(summary => ({ ...summary, learningState: withoutDue.get(summary.skillId)?.status as Exclude<SkillSummaryStatus, 'review_due'>,
    reviewState: summary.dueItemCount ? 'due' as const : 'scheduled' as const })),
    ...GRADE4_SKILLS.map(skill => deriveConfiguredSkillSummary({ skillId: skill.id, studentId: args.studentId,
      events: args.mathAnswerEvents, items, states: args.itemStates, now: args.now, timezone: args.timezone ?? 'UTC' }))];
}
