import type { MathAnswerEvent } from '../learning/learningEvents';
import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
import type { LearningGoal } from './types';
import type { DailyNewGoalQuestionLimits, PracticeItem, SessionConfig, StudentItemState } from '../../types/math';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { planPracticeForSkill } from '../mastery/skillPracticePlanner';
import { getGrade3Skill } from '../mastery/grade3MasteryMap';
import { calculateGoalProgress, localDateInTimeZone, type GoalEvidenceInput, type GoalTargetProgress } from './goalEngine';
import { normalizeDailyNewGoalLimits, resolveGoalTileLimits } from './dailyNewGoalLimits';
import { analyzeGoalPortfolio, type GoalPortfolioAnalysis } from './goalPortfolioEngine';
import { deriveLearningUnitProgress, remainingLearningUnitEvidence } from '../learning/learningUnitProgress';
import { deriveCardKey } from '../scheduler/cardModel';

export type DailyNewGoalTileKind = 'new_skill' | 'continue_new_learning';
export type DailyNewGoalLearningKind = 'planned' | 'extra';
export type DailyNewGoalEmptyReason = 'no_active_goals' | 'no_unseen_items' | null;

export interface DailyNewGoalTile {
  id: string;
  goalIds: string[];
  goalTitles: string[];
  targetIds: string[];
  skillId: string;
  skillTitle: string;
  kind: DailyNewGoalTileKind;
  reason: string;
  questionCount: number;
  estimatedMinutes: number;
  progress: number;
  daysRemaining: number;
  isExtra: boolean;
  isComplete: boolean;
  itemIds: string[];
  config: SessionConfig;
}

export interface DailyNewGoalPlan {
  tiles: DailyNewGoalTile[];
  extraChoices: DailyNewGoalTile[];
  emptyReason: DailyNewGoalEmptyReason;
  exhaustedExtra: boolean;
  warnings: DailyNewGoalWarning[];
}

export type DailyNewGoalWarningCode = 'goal_needs_more_days' | 'conflicting_goal_tile_limits';
export interface DailyNewGoalWarning {
  code: DailyNewGoalWarningCode;
  goalId?: string;
  goalTitle?: string;
  skillId?: string;
  message: string;
  extraDaysNeeded?: number;
}

export interface PlanDailyNewGoalsArgs {
  studentId: string;
  goals: LearningGoal[];
  events: MathAnswerEvent[];
  itemStates: StudentItemState[];
  skillSummaries: StudentSkillSummary[];
  now: string;
  timezone: string;
  dailyNewGoalQuestionLimits?: Partial<DailyNewGoalQuestionLimits>;
}

interface Candidate {
  goal: LearningGoal;
  target: GoalTargetProgress;
  itemIds: string[];
  attemptedBeforeDay: number;
  priority: number;
  progress: number;
  daysRemaining: number;
  minQuestionsPerSkillTile: number;
  maxQuestionsPerSkillTile: number;
}

export interface SkillGroup {
  skillId: string;
  candidates: Candidate[];
  itemIds: string[];
  priority: number;
  progress: number;
  daysRemaining: number;
  minQuestionsPerSkillTile: number;
  maxQuestionsPerSkillTile: number;
  hasConflictingLimits: boolean;
}

const MAX_PLANNED_TILES = 3;

function directFirstAttempt(event: MathAnswerEvent): boolean {
  return !event.isRetry && event.relatedEvidence !== true;
}

function localDayStartIso(now: string, timezone: string): string {
  const local = localDateInTimeZone(now, timezone);
  const [year, month, day] = local.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(guess));
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(byType.year),
    Number(byType.month) - 1,
    Number(byType.day),
    Number(byType.hour === '24' ? '0' : byType.hour),
    Number(byType.minute),
    Number(byType.second),
  );
  const wanted = Date.UTC(year, month - 1, day, 0, 0, 0);
  return new Date(guess + (wanted - asUtc)).toISOString();
}

function dueItemIds(itemStates: StudentItemState[], now: string): Set<string> {
  return new Set(
    itemStates
      .filter(state => state.nextDueAt && state.nextDueAt <= now)
      .map(state => state.lastItemId ?? state.cardKey)
  );
}

function directAttemptedItemIds(events: MathAnswerEvent[], studentId: string, beforeIso?: string): Set<string> {
  return new Set(events
    .filter(event => event.studentId === studentId)
    .filter(directFirstAttempt)
    .filter(event => beforeIso ? event.createdAt < beforeIso : true)
    .map(event => event.itemId));
}

function todayGoalLearningEvents(events: MathAnswerEvent[], studentId: string, dayStartIso: string): MathAnswerEvent[] {
  return events
    .filter(event => event.studentId === studentId)
    .filter(directFirstAttempt)
    .filter(event => event.createdAt >= dayStartIso)
    .filter(event => event.origin === 'daily_new_for_goals' || event.origin === 'daily_recommended_learning');
}

function poolForSkill(skillId: string): string[] {
  const config = planPracticeForSkill(skillId);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of config.specificItemIds ?? []) {
    if (seen.has(id)) continue;
    const item = makeItemFromId(id);
    if (!item) continue;
    if (inferGrade3SkillId(item) !== skillId) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function schemaKey(itemId: string): string {
  return itemId.replace(/[-_]\d+.*$/, '').replace(/\d+x\d+.*$/, '');
}

function orderItems(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const sa = schemaKey(a);
    const sb = schemaKey(b);
    if (sa !== sb) return sa.localeCompare(sb);
    return a.localeCompare(b);
  });
}

function makeConfig(
  group: SkillGroup,
  itemIds: string[],
  learningKind: DailyNewGoalLearningKind,
): SessionConfig {
  const base = planPracticeForSkill(group.skillId, { sessionLength: itemIds.length });
  const goalIds = Array.from(new Set(group.candidates.map(candidate => candidate.goal.id)));
  const targetIds = Array.from(new Set(group.candidates.map(candidate => candidate.target.target.id)));
  return {
    ...base,
    specificItemIds: itemIds,
    sessionLength: itemIds.length,
    origin: 'daily_new_for_goals',
    goalId: goalIds[0],
    goalTargetId: targetIds[0],
    goalIds,
    goalTargetIds: targetIds,
    goalLearningKind: learningKind,
  };
}

function makeTile(
  group: SkillGroup,
  itemIds: string[],
  learningKind: DailyNewGoalLearningKind,
  todayCompletedIds: Set<string>,
): DailyNewGoalTile {
  const goalIds = Array.from(new Set(group.candidates.map(candidate => candidate.goal.id)));
  const targetIds = Array.from(new Set(group.candidates.map(candidate => candidate.target.target.id)));
  const goalTitles = Array.from(new Set(group.candidates.map(candidate => candidate.goal.title)));
  const kind: DailyNewGoalTileKind = group.candidates.some(candidate => candidate.attemptedBeforeDay > 0)
    ? 'continue_new_learning'
    : 'new_skill';
  const skillTitle = getGrade3Skill(group.skillId)?.title ?? group.skillId;
  return {
    id: `${learningKind}:${group.skillId}:${itemIds.join('|')}`,
    goalIds,
    goalTitles,
    targetIds,
    skillId: group.skillId,
    skillTitle,
    kind,
    reason: kind === 'new_skill'
      ? 'Start unseen goal material.'
      : 'Continue with unseen items for this goal skill.',
    questionCount: itemIds.length,
    estimatedMinutes: Math.max(1, Math.ceil(itemIds.length / 3)),
    progress: group.progress,
    daysRemaining: group.daysRemaining,
    isExtra: learningKind === 'extra',
    isComplete: itemIds.length > 0 && itemIds.every(id => todayCompletedIds.has(id)),
    itemIds,
    config: makeConfig(group, itemIds, learningKind),
  };
}

function learningItemsForPool(
  pool: string[], events: MathAnswerEvent[], itemStates: StudentItemState[], attempted: Set<string>, dueIds: Set<string>, excludedIds: Set<string>,
  minimumQuestions: number,
): { itemIds: string[]; priorEvidenceCount: number } {
  const items = pool.map(makeItemFromId).filter((item): item is PracticeItem => item !== null);
  const progress = deriveLearningUnitProgress({ items, events, states: itemStates });
  const byCard = new Map<string, string[]>();
  for (const item of items) {
    if (dueIds.has(item.id) || excludedIds.has(item.id)) continue;
    const ids = byCard.get(deriveCardKey(item)) ?? [];
    ids.push(item.id);
    byCard.set(deriveCardKey(item), ids);
  }
  const eligible: string[] = [];
  let priorEvidenceCount = 0;
  for (const [cardKey, ids] of byCard) {
    const unit = progress.get(cardKey);
    if (!unit || unit.status === 'maintenance') continue;
    priorEvidenceCount += unit.directInstanceCount;
    const fresh = ids.filter(id => !attempted.has(id));
    if (unit.kind === 'atomic_fact') {
      if (unit.status === 'new' && fresh[0]) eligible.push(fresh[0]);
      continue;
    }
    eligible.push(...fresh.slice(0, Math.max(remainingLearningUnitEvidence(unit), minimumQuestions)));
  }
  return { itemIds: eligible, priorEvidenceCount };
}

function buildGroups(args: PlanDailyNewGoalsArgs, attempted: Set<string>, progressEvents: MathAnswerEvent[], excludedIds: Set<string>, suppliedPortfolio?: GoalPortfolioAnalysis): SkillGroup[] {
  const { studentId, goals, events, itemStates, skillSummaries, now, timezone } = args;
  const activeGoals = goals.filter(goal => goal.status === 'active');
  const dueIds = dueItemIds(itemStates, now);
  const summaryMap = new Map(skillSummaries.map(summary => [summary.skillId, summary]));
  const evidence: GoalEvidenceInput = { studentId, events, itemStates, skillSummaries, now, timezone };
  const portfolio = suppliedPortfolio ?? analyzeGoalPortfolio({ goals, evidence, dailyNewGoalQuestionLimits: args.dailyNewGoalQuestionLimits });
  const consolidatedBySkill = new Map(portfolio.consolidatedTargets.map(target => [target.skillId, target]));
  const bySkill = new Map<string, SkillGroup>();
  const globalLimits = normalizeDailyNewGoalLimits(args.dailyNewGoalQuestionLimits);

  for (const goal of activeGoals) {
    const progress = calculateGoalProgress(goal, evidence);
    for (const targetProgress of progress.targets) {
      if (targetProgress.isComplete) continue;
      if (summaryMap.get(targetProgress.skillId)?.status === 'mastered' || targetProgress.status === 'mastered') continue;
      const pool = poolForSkill(targetProgress.skillId);
      const goalLimits = resolveGoalTileLimits(goal, globalLimits);
      const learningItems = learningItemsForPool(pool, progressEvents, itemStates, attempted, dueIds, excludedIds, goalLimits.minQuestionsPerSkillTile);
      const eligible = learningItems.itemIds;
      if (eligible.length === 0) continue;
      const unfinishedPerDay = eligible.length / Math.max(1, progress.daysRemaining + 1);
      const urgency = progress.daysRemaining <= 1 ? 4 : progress.daysRemaining <= 3 ? 2 : 0;
      const consolidated = consolidatedBySkill.get(targetProgress.skillId);
      const candidate: Candidate = {
        goal,
        target: targetProgress,
        itemIds: eligible,
        attemptedBeforeDay: learningItems.priorEvidenceCount,
        priority: consolidated?.effectivePriority ?? unfinishedPerDay + urgency + (1 - targetProgress.displayScore),
        progress: targetProgress.displayScore,
        daysRemaining: progress.daysRemaining,
        ...goalLimits,
        ...(consolidated ? { maxQuestionsPerSkillTile: consolidated.effectiveDailyNewCap } : {}),
      };
      const group = bySkill.get(targetProgress.skillId) ?? {
        skillId: targetProgress.skillId,
        candidates: [],
        itemIds: [],
        priority: 0,
        progress: 1,
        daysRemaining: Number.POSITIVE_INFINITY,
        minQuestionsPerSkillTile: candidate.minQuestionsPerSkillTile,
        maxQuestionsPerSkillTile: candidate.maxQuestionsPerSkillTile,
        hasConflictingLimits: false,
      };
      if (group.candidates.length > 0) {
        group.minQuestionsPerSkillTile = Math.max(group.minQuestionsPerSkillTile, candidate.minQuestionsPerSkillTile);
        group.maxQuestionsPerSkillTile = Math.min(group.maxQuestionsPerSkillTile, candidate.maxQuestionsPerSkillTile);
        if (group.minQuestionsPerSkillTile > group.maxQuestionsPerSkillTile) {
          group.minQuestionsPerSkillTile = group.maxQuestionsPerSkillTile;
          group.hasConflictingLimits = true;
        }
      }
      group.candidates.push(candidate);
      group.itemIds = Array.from(new Set([...group.itemIds, ...eligible]));
      group.priority = Math.max(group.priority, candidate.priority);
      group.progress = Math.min(group.progress, candidate.progress);
      group.daysRemaining = Math.min(group.daysRemaining, candidate.daysRemaining);
      bySkill.set(targetProgress.skillId, group);
    }
  }

  return Array.from(bySkill.values()).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.skillId.localeCompare(b.skillId);
  });
}

export function buildGoalSkillGroups(portfolio: GoalPortfolioAnalysis, args: PlanDailyNewGoalsArgs): SkillGroup[] {
  return buildGroups(args, new Set(), args.events, new Set(), portfolio);
}

function chooseItemBatch(group: SkillGroup, used: Set<string>, preferredCount: number): string[] {
  const remaining = orderItems(group.itemIds.filter(id => !used.has(id)));
  const minForGroup = Math.min(group.minQuestionsPerSkillTile, remaining.length);
  const count = Math.min(group.maxQuestionsPerSkillTile, Math.max(minForGroup, preferredCount), remaining.length);
  return remaining.slice(0, count);
}

function buildWarnings(activeGoals: LearningGoal[], groups: SkillGroup[], limits: DailyNewGoalQuestionLimits): DailyNewGoalWarning[] {
  const warnings: DailyNewGoalWarning[] = groups.filter(group => group.hasConflictingLimits).map(group => ({
    code: 'conflicting_goal_tile_limits', skillId: group.skillId,
    message: 'Some goals have conflicting Daily New limits for this skill. MathFan used the lower max question cap.',
  }));
  for (const goal of activeGoals) {
    const candidates = groups.flatMap(group => group.candidates.filter(candidate => candidate.goal.id === goal.id));
    if (!candidates.length) continue;
    const daysAvailable = Math.max(1, Math.min(...candidates.map(candidate => candidate.daysRemaining)) + 1);
    const requiredBySkill = Math.max(...candidates.map(candidate => Math.ceil(candidate.itemIds.length / candidate.maxQuestionsPerSkillTile)));
    const totalEligible = new Set(candidates.flatMap(candidate => candidate.itemIds)).size;
    const requiredDays = Math.max(requiredBySkill, Math.ceil(totalEligible / limits.maxPlannedQuestionsPerDay));
    const extraDaysNeeded = requiredDays - daysAvailable;
    if (extraDaysNeeded > 0) warnings.push({
      code: 'goal_needs_more_days', goalId: goal.id, goalTitle: goal.title, extraDaysNeeded,
      message: `This goal may need ${extraDaysNeeded} more day${extraDaysNeeded === 1 ? '' : 's'} at your current Daily New limits.`,
    });
  }
  return warnings;
}

export function planDailyNewForGoals(args: PlanDailyNewGoalsArgs): DailyNewGoalPlan {
  const activeGoals = args.goals.filter(goal => goal.status === 'active');
  const dayStartIso = localDayStartIso(args.now, args.timezone);
  const attemptedBeforeDay = directAttemptedItemIds(args.events, args.studentId, dayStartIso);
  const eventsBeforeDay = args.events.filter(event => event.createdAt < dayStartIso);
  const todayEvents = todayGoalLearningEvents(args.events, args.studentId, dayStartIso);
  const todayCompletedIds = new Set(todayEvents.map(event => event.itemId));
  const used = new Set<string>();
  const groups = buildGroups(args, attemptedBeforeDay, eventsBeforeDay, new Set());
  const tiles: DailyNewGoalTile[] = [];
  let plannedTotal = 0;
  const globalLimits = normalizeDailyNewGoalLimits(args.dailyNewGoalQuestionLimits);

  for (const group of groups.slice(0, MAX_PLANNED_TILES)) {
    const preferred = Math.min(group.maxQuestionsPerSkillTile, Math.max(group.minQuestionsPerSkillTile, Math.ceil(group.itemIds.length / Math.max(1, group.daysRemaining + 1))));
    const remainingBudget = globalLimits.maxPlannedQuestionsPerDay - plannedTotal;
    if (remainingBudget < Math.min(group.minQuestionsPerSkillTile, group.itemIds.length)) break;
    const ids = chooseItemBatch(group, used, Math.min(preferred, remainingBudget));
    if (ids.length === 0) continue;
    ids.forEach(id => used.add(id));
    plannedTotal += ids.length;
    tiles.push(makeTile(group, ids, 'planned', todayCompletedIds));
  }

  const allTimeAttempted = directAttemptedItemIds(args.events, args.studentId);
  const plannedIds = new Set(tiles.flatMap(tile => tile.itemIds));
  const todayGoalLearningIds = new Set(todayEvents.map(event => event.itemId));
  const extraExcluded = new Set([...plannedIds, ...todayGoalLearningIds]);
  const extraGroups = buildGroups(args, allTimeAttempted, args.events, extraExcluded);
  const extraChoices = extraGroups.map(group => {
    const ids = chooseItemBatch(group, new Set(), group.maxQuestionsPerSkillTile);
    return ids.length ? makeTile(group, ids, 'extra', todayCompletedIds) : null;
  }).filter((tile): tile is DailyNewGoalTile => Boolean(tile));

  return {
    tiles,
    extraChoices,
    emptyReason: activeGoals.length === 0 ? 'no_active_goals' : tiles.length === 0 ? 'no_unseen_items' : null,
    exhaustedExtra: activeGoals.length > 0 && extraChoices.length === 0,
    warnings: buildWarnings(activeGoals, groups, globalLimits),
  };
}
