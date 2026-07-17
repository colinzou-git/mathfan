import type { MathAnswerEvent } from '../learning/learningEvents';
import { learnerLocalDateKey } from '../time/localDate';
import type { StudentSkillSummary, SkillSummaryStatus } from '../mastery/skillMasteryEngine';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import type { StudentItemState } from '../../types/math';
import type {
  GoalBaseline,
  GoalEvent,
  GoalEventType,
  GoalSkillTarget,
  GoalTargetReason,
  LearningGoal,
} from './types';

export type SkillIdResolver = (itemId: string) => string | null;

export interface GoalEvidenceInput {
  studentId: string;
  events: MathAnswerEvent[];
  itemStates: StudentItemState[];
  skillSummaries: StudentSkillSummary[];
  now: string;
  timezone: string;
  resolveSkillId?: SkillIdResolver;
}

export interface TargetGateStatus {
  accuracy: boolean;
  firstAttempts: boolean;
  distinctItems: boolean;
  activeDays: boolean;
  hintRate: boolean;
  misconceptions: boolean;
  skillStatus: boolean;
  sufficientPostBaselineEvidence: boolean;
}

export interface GoalTargetProgress {
  target: GoalSkillTarget;
  skillId: string;
  status: SkillSummaryStatus;
  firstAttemptCount: number;
  correctCount: number;
  accuracy: number;
  distinctItemCount: number;
  activeDayCount: number;
  hintRate: number;
  currentDueItemCount: number;
  currentMistakePatterns: string[];
  persistentMisconceptionPatterns: string[];
  questionsCompletedToday: number;
  displayScore: number;
  gates: TargetGateStatus;
  isComplete: boolean;
}

export interface GoalProgress {
  goal: LearningGoal;
  targets: GoalTargetProgress[];
  overallProgress: number;
  completedTargetCount: number;
  totalTargetCount: number;
  daysRemaining: number;
  isExpired: boolean;
}

export interface LifecycleEvaluation {
  goal: LearningGoal;
  events: GoalEvent[];
  changed: boolean;
}

export interface GoalTargetEditDraft extends Partial<Omit<GoalSkillTarget, 'baseline'>> {
  id?: string;
  skillId: string;
  reason: GoalTargetReason;
  baseline?: GoalBaseline;
}

const RECENT_ATTEMPT_LIMIT = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function defaultSkillIdForItem(itemId: string): string | null {
  const item = makeItemFromId(itemId);
  return item ? inferGrade3SkillId(item) : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function safeDateMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function calendarDayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function localDateInTimeZone(iso: string, timezone: string): string {
  return learnerLocalDateKey(new Date(iso), timezone);
}

function isDirectFirstAttempt(event: MathAnswerEvent): boolean {
  return !event.isRetry && !event.relatedEvidence && event.schedulingKind !== 'relearning_step';
}

function eventBelongsToSkill(
  event: MathAnswerEvent,
  skillId: string,
  studentId: string,
  resolveSkillId: SkillIdResolver,
): boolean {
  return event.studentId === studentId && resolveSkillId(event.itemId) === skillId;
}

function stateBelongsToSkill(
  state: StudentItemState,
  skillId: string,
  studentId: string,
  resolveSkillId: SkillIdResolver,
): boolean {
  if (state.studentId !== studentId) return false;
  return (resolveSkillId(state.lastItemId ?? state.cardKey) ?? state.skillId) === skillId;
}

function skillEvents(
  args: GoalEvidenceInput,
  skillId: string,
  options: { after?: string; through?: string } = {},
): MathAnswerEvent[] {
  const resolveSkillId = args.resolveSkillId ?? defaultSkillIdForItem;
  const afterMs = options.after ? safeDateMs(options.after) : null;
  const throughMs = options.through ? safeDateMs(options.through) : null;
  return args.events
    .filter(isDirectFirstAttempt)
    .filter(event => eventBelongsToSkill(event, skillId, args.studentId, resolveSkillId))
    .filter(event => {
      const eventMs = safeDateMs(event.createdAt);
      if (afterMs !== null && eventMs <= afterMs) return false;
      if (throughMs !== null && eventMs > throughMs) return false;
      return true;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function skillStates(args: GoalEvidenceInput, skillId: string): StudentItemState[] {
  const resolveSkillId = args.resolveSkillId ?? defaultSkillIdForItem;
  return args.itemStates.filter(state => stateBelongsToSkill(state, skillId, args.studentId, resolveSkillId));
}

function summaryFor(args: GoalEvidenceInput, skillId: string): StudentSkillSummary | undefined {
  return args.skillSummaries.find(s => s.studentId === args.studentId && s.skillId === skillId);
}

function accuracyOf(events: MathAnswerEvent[]): number {
  if (events.length === 0) return 0;
  return events.filter(e => e.isCorrect).length / events.length;
}

function hintRateOf(events: MathAnswerEvent[]): number {
  if (events.length === 0) return 0;
  return events.filter(e => e.hintUsed).length / events.length;
}

function distinctItems(events: MathAnswerEvent[]): number {
  return new Set(events.map(e => e.itemId)).size;
}

function activeDays(events: MathAnswerEvent[], timezone: string): number {
  return new Set(events.map(e => localDateInTimeZone(e.createdAt, timezone))).size;
}

function dueItemCount(states: StudentItemState[], now: string): number {
  return states.filter(s => s.nextDueAt != null && s.nextDueAt <= now).length;
}

function mistakePatterns(states: StudentItemState[]): string[] {
  return Array.from(new Set(states.flatMap(s => s.mistakePatterns ?? []))).sort();
}

export function captureGoalBaseline(args: GoalEvidenceInput, skillId: string): GoalBaseline {
  const allEvents = skillEvents(args, skillId, { through: args.now });
  const recent = allEvents.slice(-RECENT_ATTEMPT_LIMIT);
  const states = skillStates(args, skillId);
  const summary = summaryFor(args, skillId);

  return {
    capturedAt: args.now,
    status: summary?.status ?? 'new',
    attemptCount: allEvents.length,
    distinctItemCount: distinctItems(allEvents),
    recentAccuracy: accuracyOf(recent),
    dueItemCount: dueItemCount(states, args.now),
    mistakePatterns: mistakePatterns(states),
    hintRate: hintRateOf(recent),
  };
}

export function suggestedTargetDefaults(
  reason: GoalTargetReason,
  baseline: GoalBaseline,
): Pick<GoalSkillTarget, 'targetAccuracy' | 'minFirstAttempts' | 'minDistinctItems' | 'minActiveDays' | 'maxHintRate' | 'misconceptionTargets' | 'weight'> {
  const maxHintRate = Math.min(0.25, baseline.hintRate);
  if (reason === 'review_due') {
    return {
      targetAccuracy: 0.8,
      minFirstAttempts: Math.max(5, baseline.dueItemCount),
      minDistinctItems: 3,
      minActiveDays: 1,
      maxHintRate,
      misconceptionTargets: baseline.mistakePatterns,
      weight: 1,
    };
  }
  if (reason === 'needs_practice') {
    return {
      targetAccuracy: Math.max(0.8, clamp01(baseline.recentAccuracy + 0.15)),
      minFirstAttempts: 12,
      minDistinctItems: 4,
      minActiveDays: 2,
      maxHintRate,
      misconceptionTargets: baseline.mistakePatterns,
      weight: 1,
    };
  }
  if (reason === 'continue_progress' || reason === 'ready_next') {
    return {
      targetAccuracy: 0.9,
      minFirstAttempts: 8,
      minDistinctItems: 4,
      minActiveDays: 2,
      maxHintRate,
      misconceptionTargets: baseline.mistakePatterns,
      weight: 1,
    };
  }
  return {
    targetAccuracy: 0.8,
    minFirstAttempts: 10,
    minDistinctItems: 4,
    minActiveDays: 2,
    maxHintRate,
    misconceptionTargets: baseline.mistakePatterns,
    weight: 1,
  };
}

export function buildGoalSkillTarget(
  draft: GoalTargetEditDraft,
  baseline: GoalBaseline,
  id: string,
): GoalSkillTarget {
  const defaults = suggestedTargetDefaults(draft.reason, baseline);
  return {
    id,
    skillId: draft.skillId,
    reason: draft.reason,
    baseline,
    targetAccuracy: draft.targetAccuracy ?? defaults.targetAccuracy,
    minFirstAttempts: draft.minFirstAttempts ?? defaults.minFirstAttempts,
    minDistinctItems: draft.minDistinctItems ?? defaults.minDistinctItems,
    minActiveDays: draft.minActiveDays ?? defaults.minActiveDays,
    maxHintRate: draft.maxHintRate ?? defaults.maxHintRate,
    misconceptionTargets: draft.misconceptionTargets ?? defaults.misconceptionTargets,
    weight: draft.weight ?? defaults.weight,
  };
}

export function applyGoalTargetEdits(
  existingTargets: GoalSkillTarget[],
  drafts: GoalTargetEditDraft[],
  captureBaselineForSkill: (skillId: string) => GoalBaseline,
  makeId: () => string,
): GoalSkillTarget[] {
  return drafts.map(draft => {
    const existing = draft.id
      ? existingTargets.find(t => t.id === draft.id)
      : existingTargets.find(t => t.skillId === draft.skillId);

    if (existing && existing.skillId === draft.skillId) {
      return {
        ...existing,
        ...draft,
        id: existing.id,
        baseline: existing.baseline,
      };
    }

    const baseline = draft.baseline ?? captureBaselineForSkill(draft.skillId);
    return buildGoalSkillTarget(draft, baseline, draft.id ?? makeId());
  });
}

function displayAccuracyProgress(target: GoalSkillTarget, accuracy: number, attempts: number): number {
  if (attempts === 0) return 0;
  const from = target.baseline.recentAccuracy;
  const to = target.targetAccuracy;
  if (to <= from) return clamp01(accuracy / Math.max(to, 0.01));
  return clamp01((accuracy - from) / (to - from));
}

function displayHintProgress(target: GoalSkillTarget, hintRate: number, attempts: number): number {
  if (attempts === 0) return 0;
  if (hintRate <= target.maxHintRate) return 1;
  if (hintRate === 0) return 1;
  return clamp01(target.maxHintRate / hintRate);
}

function displayScore(
  target: GoalSkillTarget,
  postEvents: MathAnswerEvent[],
  stats: {
    accuracy: number;
    distinctItemCount: number;
    activeDayCount: number;
    hintRate: number;
    persistentMisconceptionPatterns: string[];
  },
): number {
  const misconceptionProgress = target.misconceptionTargets.length === 0
    ? 1
    : clamp01((target.misconceptionTargets.length - stats.persistentMisconceptionPatterns.length) / target.misconceptionTargets.length);
  return clamp01(
    displayAccuracyProgress(target, stats.accuracy, postEvents.length) * 0.4 +
    clamp01(postEvents.length / Math.max(target.minFirstAttempts, 1)) * 0.2 +
    clamp01(stats.distinctItemCount / Math.max(target.minDistinctItems, 1)) * 0.15 +
    clamp01(stats.activeDayCount / Math.max(target.minActiveDays, 1)) * 0.1 +
    misconceptionProgress * 0.1 +
    displayHintProgress(target, stats.hintRate, postEvents.length) * 0.05,
  );
}

export function calculateTargetProgress(
  target: GoalSkillTarget,
  args: GoalEvidenceInput,
): GoalTargetProgress {
  const postEvents = skillEvents(args, target.skillId, { after: target.baseline.capturedAt, through: args.now });
  const states = skillStates(args, target.skillId);
  const summary = summaryFor(args, target.skillId);
  const today = localDateInTimeZone(args.now, args.timezone);
  const currentMistakes = mistakePatterns(states);
  const persistentMisconceptionPatterns = target.misconceptionTargets
    .filter(pattern => currentMistakes.includes(pattern));
  const accuracy = accuracyOf(postEvents);
  const hintRate = hintRateOf(postEvents);
  const activeDayCount = activeDays(postEvents, args.timezone);
  const distinctItemCount = distinctItems(postEvents);
  const currentDueItemCount = dueItemCount(states, args.now);
  const status = summary?.status ?? target.baseline.status;
  const questionsCompletedToday = postEvents
    .filter(e => localDateInTimeZone(e.createdAt, args.timezone) === today)
    .length;

  const gates: TargetGateStatus = {
    accuracy: postEvents.length > 0 && accuracy >= target.targetAccuracy,
    firstAttempts: postEvents.length >= target.minFirstAttempts,
    distinctItems: distinctItemCount >= target.minDistinctItems,
    activeDays: activeDayCount >= target.minActiveDays,
    hintRate: hintRate <= target.maxHintRate,
    misconceptions: persistentMisconceptionPatterns.length === 0,
    skillStatus: target.reason === 'review_due'
      ? currentDueItemCount === 0
      : status === 'strong' || status === 'mastered',
    sufficientPostBaselineEvidence: postEvents.length > 0 && distinctItemCount > 0,
  };

  const isComplete = Object.values(gates).every(Boolean);

  return {
    target,
    skillId: target.skillId,
    status,
    firstAttemptCount: postEvents.length,
    correctCount: postEvents.filter(e => e.isCorrect).length,
    accuracy,
    distinctItemCount,
    activeDayCount,
    hintRate,
    currentDueItemCount,
    currentMistakePatterns: currentMistakes,
    persistentMisconceptionPatterns,
    questionsCompletedToday,
    displayScore: displayScore(target, postEvents, {
      accuracy,
      distinctItemCount,
      activeDayCount,
      hintRate,
      persistentMisconceptionPatterns,
    }),
    gates,
    isComplete,
  };
}

export function calculateGoalProgress(goal: LearningGoal, args: GoalEvidenceInput): GoalProgress {
  const targets = goal.targets.map(target => calculateTargetProgress(target, args));
  const totalWeight = goal.targets.reduce((sum, target) => sum + Math.max(0, target.weight), 0);
  const overallProgress = totalWeight === 0
    ? 0
    : targets.reduce((sum, progress) => sum + progress.displayScore * Math.max(0, progress.target.weight), 0) / totalWeight;
  const today = localDateInTimeZone(args.now, args.timezone);
  const daysRemaining = calendarDayNumber(goal.targetDate) - calendarDayNumber(today);

  return {
    goal,
    targets,
    overallProgress: clamp01(overallProgress),
    completedTargetCount: targets.filter(t => t.isComplete).length,
    totalTargetCount: targets.length,
    daysRemaining,
    isExpired: today > goal.targetDate,
  };
}

function hasEvent(
  events: GoalEvent[],
  type: GoalEventType,
  goalId: string,
  targetId?: string,
): boolean {
  return events.some(e => e.goalId === goalId && e.type === type && (targetId === undefined || e.targetId === targetId));
}

function goalEvent(
  goal: LearningGoal,
  type: GoalEventType,
  now: string,
  id: string,
  targetId?: string,
): GoalEvent {
  return {
    id,
    studentId: goal.studentId,
    goalId: goal.id,
    type,
    targetId,
    createdAt: now,
  };
}

export function evaluateGoalLifecycle(
  goal: LearningGoal,
  progress: GoalProgress,
  existingEvents: GoalEvent[],
  now: string,
  makeEventId: () => string,
): LifecycleEvaluation {
  if (goal.status === 'completed' || goal.status === 'ended' || goal.status === 'cancelled') {
    return { goal, events: [], changed: false };
  }

  const events: GoalEvent[] = [];
  for (const targetProgress of progress.targets) {
    if (
      targetProgress.isComplete &&
      !hasEvent(existingEvents, 'target_completed', goal.id, targetProgress.target.id)
    ) {
      events.push(goalEvent(goal, 'target_completed', now, makeEventId(), targetProgress.target.id));
    }
  }

  // Completion and overdue lifecycle decisions are user-controlled. Calendar
  // evaluation may record target evidence, but never changes goal status.
  return { goal, events, changed: events.length > 0 };
}

export function transitionGoal(
  goal: LearningGoal,
  type: Extract<GoalEventType, 'paused' | 'resumed' | 'completed' | 'cancelled' | 'ended' | 'updated'>,
  now: string,
  makeEventId: () => string,
  changes: Partial<Omit<LearningGoal, 'id' | 'studentId' | 'createdAt'>> = {},
): LifecycleEvaluation {
  const statusByEvent: Partial<Record<GoalEventType, LearningGoal['status']>> = {
    paused: 'paused',
    resumed: 'active',
    completed: 'completed',
    cancelled: 'cancelled',
    ended: 'ended',
  };
  const nextStatus = statusByEvent[type] ?? goal.status;
  const next: LearningGoal = {
    ...goal,
    ...changes,
    status: nextStatus,
    updatedAt: now,
    endedAt: type === 'ended' || type === 'cancelled' ? (goal.endedAt ?? now) : changes.endedAt ?? goal.endedAt,
    completedAt: type === 'completed' ? (goal.completedAt ?? now) : changes.completedAt ?? goal.completedAt,
  };
  return {
    goal: next,
    events: [goalEvent(goal, type, now, makeEventId())],
    changed: true,
  };
}
