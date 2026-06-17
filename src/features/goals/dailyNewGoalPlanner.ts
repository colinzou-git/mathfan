import type { MathAnswerEvent } from '../learning/learningEvents';
import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
import type { LearningGoal } from './types';
import type { SessionConfig, StudentItemState } from '../../types/math';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { planPracticeForSkill } from '../mastery/skillPracticePlanner';
import { getGrade3Skill } from '../mastery/grade3MasteryMap';
import { calculateGoalProgress, localDateInTimeZone, type GoalEvidenceInput, type GoalTargetProgress } from './goalEngine';

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
}

export interface PlanDailyNewGoalsArgs {
  studentId: string;
  goals: LearningGoal[];
  events: MathAnswerEvent[];
  itemStates: StudentItemState[];
  skillSummaries: StudentSkillSummary[];
  now: string;
  timezone: string;
}

interface Candidate {
  goal: LearningGoal;
  target: GoalTargetProgress;
  itemIds: string[];
  attemptedBeforeDay: number;
  priority: number;
  progress: number;
  daysRemaining: number;
}

interface SkillGroup {
  skillId: string;
  candidates: Candidate[];
  itemIds: string[];
  priority: number;
  progress: number;
  daysRemaining: number;
}

const MIN_TILE_QUESTIONS = 5;
const MAX_TILE_QUESTIONS = 12;
const MAX_PLANNED_TILES = 3;
const MAX_PLANNED_TOTAL = 40;

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
  return new Set(itemStates.filter(state => state.nextDueAt && state.nextDueAt <= now).map(state => state.itemId));
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

function buildGroups(args: PlanDailyNewGoalsArgs, attempted: Set<string>, excludedIds: Set<string>): SkillGroup[] {
  const { studentId, goals, events, itemStates, skillSummaries, now, timezone } = args;
  const activeGoals = goals.filter(goal => goal.status === 'active');
  const dueIds = dueItemIds(itemStates, now);
  const summaryMap = new Map(skillSummaries.map(summary => [summary.skillId, summary]));
  const evidence: GoalEvidenceInput = { studentId, events, itemStates, skillSummaries, now, timezone };
  const bySkill = new Map<string, SkillGroup>();

  for (const goal of activeGoals) {
    const progress = calculateGoalProgress(goal, evidence);
    for (const targetProgress of progress.targets) {
      if (targetProgress.isComplete) continue;
      if (summaryMap.get(targetProgress.skillId)?.status === 'mastered' || targetProgress.status === 'mastered') continue;
      const pool = poolForSkill(targetProgress.skillId);
      const eligible = pool.filter(id => !attempted.has(id) && !dueIds.has(id) && !excludedIds.has(id));
      if (eligible.length === 0) continue;
      const unfinishedPerDay = eligible.length / Math.max(1, progress.daysRemaining + 1);
      const urgency = progress.daysRemaining <= 1 ? 4 : progress.daysRemaining <= 3 ? 2 : 0;
      const candidate: Candidate = {
        goal,
        target: targetProgress,
        itemIds: eligible,
        attemptedBeforeDay: pool.filter(id => attempted.has(id)).length,
        priority: unfinishedPerDay + urgency + (1 - targetProgress.displayScore),
        progress: targetProgress.displayScore,
        daysRemaining: progress.daysRemaining,
      };
      const group = bySkill.get(targetProgress.skillId) ?? {
        skillId: targetProgress.skillId,
        candidates: [],
        itemIds: [],
        priority: 0,
        progress: 1,
        daysRemaining: Number.POSITIVE_INFINITY,
      };
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

function chooseItemBatch(group: SkillGroup, used: Set<string>, preferredCount: number, batchIndex = 0): string[] {
  const remaining = orderItems(group.itemIds.filter(id => !used.has(id)));
  const start = Math.min(remaining.length, batchIndex * MAX_TILE_QUESTIONS);
  const sliced = remaining.slice(start);
  const count = Math.min(MAX_TILE_QUESTIONS, Math.max(Math.min(MIN_TILE_QUESTIONS, sliced.length), preferredCount), sliced.length);
  return sliced.slice(0, count);
}

export function planDailyNewForGoals(args: PlanDailyNewGoalsArgs): DailyNewGoalPlan {
  const activeGoals = args.goals.filter(goal => goal.status === 'active');
  const dayStartIso = localDayStartIso(args.now, args.timezone);
  const attemptedBeforeDay = directAttemptedItemIds(args.events, args.studentId, dayStartIso);
  const todayEvents = todayGoalLearningEvents(args.events, args.studentId, dayStartIso);
  const todayCompletedIds = new Set(todayEvents.map(event => event.itemId));
  const used = new Set<string>();
  const groups = buildGroups(args, attemptedBeforeDay, new Set());
  const tiles: DailyNewGoalTile[] = [];
  let plannedTotal = 0;

  for (const group of groups.slice(0, MAX_PLANNED_TILES)) {
    const preferred = Math.min(MAX_TILE_QUESTIONS, Math.max(MIN_TILE_QUESTIONS, Math.ceil(group.itemIds.length / Math.max(1, group.daysRemaining + 1))));
    const remainingBudget = MAX_PLANNED_TOTAL - plannedTotal;
    if (remainingBudget <= 0) break;
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
  const extraBatchIndex = new Set(todayEvents
    .filter(event => event.goalLearningKind === 'extra')
    .map(event => event.sessionId)).size;
  const extraGroups = buildGroups(args, allTimeAttempted, extraExcluded);
  const extraChoices = extraGroups.map(group => {
    const ids = chooseItemBatch(group, new Set(), MAX_TILE_QUESTIONS, extraBatchIndex);
    return ids.length ? makeTile(group, ids, 'extra', todayCompletedIds) : null;
  }).filter((tile): tile is DailyNewGoalTile => Boolean(tile));

  return {
    tiles,
    extraChoices,
    emptyReason: activeGoals.length === 0 ? 'no_active_goals' : tiles.length === 0 ? 'no_unseen_items' : null,
    exhaustedExtra: activeGoals.length > 0 && extraChoices.length === 0,
  };
}
