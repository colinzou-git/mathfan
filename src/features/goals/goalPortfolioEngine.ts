import type { DailyNewGoalQuestionLimits } from '../../types/math';
import { calculateGoalProgress, type GoalEvidenceInput, type GoalProgress } from './goalEngine';
import { normalizeDailyNewGoalLimits, resolveGoalTileLimits } from './dailyNewGoalLimits';
import type { GoalPortfolioRole, LearningGoal } from './types';

export interface GoalTargetContribution {
  goalId: string; targetId: string; skillId: string; role: GoalPortfolioRole;
  targetDate: string; progress: number; urgency: number;
}
export interface ConsolidatedSkillTarget {
  skillId: string; contributions: GoalTargetContribution[]; primaryGoalIds: string[]; maintenanceGoalIds: string[];
  effectivePriority: number; effectiveDaysRemaining: number; effectiveDailyNewCap: number;
}
export type GoalPortfolioWarningCode = 'too_many_primary_goals' | 'too_many_active_goals' | 'overlapping_skill_targets'
  | 'overdue_goal' | 'daily_workload_exceeds_limit' | 'prerequisite_gap' | 'conflicting_goal_limits';
export interface GoalPortfolioWarning { code: GoalPortfolioWarningCode; message: string; goalIds?: string[]; skillIds?: string[] }
export interface GoalPortfolioAction { action: 'organize_roles' | 'edit_existing_goal' | 'extend_goal_date' | 'reduce_daily_workload'; label: string; goalId?: string; skillId?: string }
export interface GoalPortfolioAnalysis {
  activeGoals: LearningGoal[]; consolidatedTargets: ConsolidatedSkillTarget[]; warnings: GoalPortfolioWarning[];
  recommendedActions: GoalPortfolioAction[]; totalEstimatedDailyQuestions: number; totalEstimatedMinutes: number;
}
export interface AnalyzeGoalPortfolioArgs { goals: LearningGoal[]; evidence: GoalEvidenceInput; dailyNewGoalQuestionLimits?: Partial<DailyNewGoalQuestionLimits> }

const roleFor = (goal: LearningGoal): GoalPortfolioRole => goal.portfolioRole ?? 'primary';
const urgencyFor = (days: number, progress: number) => (days < 0 ? 5 : days <= 1 ? 4 : days <= 3 ? 2 : 0) + (1 - progress);

export function analyzeGoalPortfolio(args: AnalyzeGoalPortfolioArgs): GoalPortfolioAnalysis {
  const activeGoals = args.goals.filter(goal => goal.status === 'active').sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999));
  const limits = normalizeDailyNewGoalLimits(args.dailyNewGoalQuestionLimits);
  const warnings: GoalPortfolioWarning[] = [], recommendedActions: GoalPortfolioAction[] = [];
  const primary = activeGoals.filter(goal => roleFor(goal) === 'primary');
  const maintenance = activeGoals.filter(goal => roleFor(goal) === 'maintenance');
  if (primary.length > 2) { warnings.push({ code: 'too_many_primary_goals', message: 'More than two primary goals may make today’s plan hard to focus.', goalIds: primary.map(goal => goal.id) }); recommendedActions.push({ action: 'organize_roles', label: 'Move a goal to maintenance' }); }
  if (activeGoals.length > 3 || maintenance.length > 1) warnings.push({ code: 'too_many_active_goals', message: 'This portfolio is larger than the recommended two primary goals and one maintenance goal.', goalIds: activeGoals.map(goal => goal.id) });
  const bySkill = new Map<string, { contributions: GoalTargetContribution[]; caps: number[]; days: number[] }>();
  for (const goal of activeGoals) {
    const progress = calculateGoalProgress(goal, args.evidence);
    if (progress.isExpired) { warnings.push({ code: 'overdue_goal', message: `${goal.title} is past its target date and remains active.`, goalIds: [goal.id] }); recommendedActions.push({ action: 'extend_goal_date', label: `Review ${goal.title}`, goalId: goal.id }); }
    const resolved = resolveGoalTileLimits(goal, limits);
    for (const target of progress.targets.filter(target => !target.isComplete)) {
      const contribution: GoalTargetContribution = { goalId: goal.id, targetId: target.target.id, skillId: target.skillId, role: roleFor(goal), targetDate: goal.targetDate, progress: target.displayScore, urgency: urgencyFor(progress.daysRemaining, target.displayScore) };
      const group = bySkill.get(target.skillId) ?? { contributions: [], caps: [], days: [] };
      group.contributions.push(contribution); group.caps.push(resolved.maxQuestionsPerSkillTile); group.days.push(progress.daysRemaining); bySkill.set(target.skillId, group);
    }
  }
  const consolidatedTargets = [...bySkill].map(([skillId, group]) => {
    const goalIds = [...new Set(group.contributions.map(value => value.goalId))];
    if (goalIds.length > 1) { warnings.push({ code: 'overlapping_skill_targets', message: `One ${skillId} quota will advance ${goalIds.length} goals.`, goalIds, skillIds: [skillId] }); recommendedActions.push({ action: 'edit_existing_goal', label: 'Edit the existing overlapping goal', skillId }); }
    if (new Set(group.caps).size > 1) warnings.push({ code: 'conflicting_goal_limits', message: `Different limits for ${skillId} were resolved conservatively.`, goalIds, skillIds: [skillId] });
    return { skillId, contributions: group.contributions, primaryGoalIds: [...new Set(group.contributions.filter(c => c.role === 'primary').map(c => c.goalId))], maintenanceGoalIds: [...new Set(group.contributions.filter(c => c.role === 'maintenance').map(c => c.goalId))], effectivePriority: Math.max(...group.contributions.map(c => c.urgency)), effectiveDaysRemaining: Math.min(...group.days), effectiveDailyNewCap: Math.min(...group.caps) };
  }).sort((a, b) => (b.primaryGoalIds.length > 0 ? 1 : 0) - (a.primaryGoalIds.length > 0 ? 1 : 0) || b.effectivePriority - a.effectivePriority);
  const totalEstimatedDailyQuestions = Math.min(limits.maxPlannedQuestionsPerDay, consolidatedTargets.reduce((sum, target) => sum + target.effectiveDailyNewCap, 0));
  const totalEstimatedMinutes = Math.ceil(totalEstimatedDailyQuestions / 3);
  if (consolidatedTargets.reduce((sum, target) => sum + target.effectiveDailyNewCap, 0) > limits.maxPlannedQuestionsPerDay) { warnings.push({ code: 'daily_workload_exceeds_limit', message: `Planned learning was capped at ${limits.maxPlannedQuestionsPerDay} questions.` }); recommendedActions.push({ action: 'reduce_daily_workload', label: 'Adjust dates or daily limits' }); }
  return { activeGoals, consolidatedTargets, warnings, recommendedActions, totalEstimatedDailyQuestions, totalEstimatedMinutes };
}

export interface GoalWorkloadBudget { maxNewQuestions: number; maxEstimatedMinutes: number; reservedReviewMinutes: number }
export interface GoalWorkloadAllocation { allocations: Array<{ skillId: string; questionCount: number; goalIds: string[] }>; totalQuestions: number; estimatedMinutes: number; unallocatedSkillIds: string[] }
export function allocateGoalWorkload(targets: ConsolidatedSkillTarget[], budget: GoalWorkloadBudget): GoalWorkloadAllocation {
  const capacity = Math.max(0, Math.min(budget.maxNewQuestions, (budget.maxEstimatedMinutes - budget.reservedReviewMinutes) * 3));
  let remaining = capacity;
  const allocations = targets.map(target => { const questionCount = Math.max(0, Math.min(target.effectiveDailyNewCap, remaining)); remaining -= questionCount; return { skillId: target.skillId, questionCount, goalIds: [...target.primaryGoalIds, ...target.maintenanceGoalIds] }; }).filter(value => value.questionCount > 0);
  return { allocations, totalQuestions: capacity - remaining, estimatedMinutes: Math.ceil((capacity - remaining) / 3), unallocatedSkillIds: targets.filter(target => !allocations.some(value => value.skillId === target.skillId)).map(target => target.skillId) };
}

export type GoalLifecycleRecommendationAction = 'complete' | 'extend_target_date' | 'edit_targets' | 'move_to_maintenance' | 'pause' | 'end_goal' | 'keep_active';
export interface GoalLifecycleRecommendation { action: GoalLifecycleRecommendationAction; label: string }
export function recommendedGoalLifecycleActions(goal: LearningGoal, progress: GoalProgress, now: string): GoalLifecycleRecommendation[] {
  if (goal.status !== 'active' || now.slice(0, 10) < goal.targetDate) return [];
  if (progress.targets.length > 0 && progress.targets.every(target => target.isComplete)) return [{ action: 'complete', label: 'Complete goal' }, { action: 'keep_active', label: 'Keep active' }];
  return [
    { action: 'extend_target_date', label: 'Extend target date' }, { action: 'edit_targets', label: 'Reduce or edit targets' },
    { action: 'move_to_maintenance', label: 'Move to maintenance' }, { action: 'pause', label: 'Pause goal' },
    { action: 'end_goal', label: 'End goal' }, { action: 'keep_active', label: 'Keep active unchanged' },
  ];
}

export function dedupeGoalAttribution(goalIds: string[], targetIds: string[]): { goalIds: string[]; targetIds: string[] } {
  return { goalIds: [...new Set(goalIds.filter(Boolean))], targetIds: [...new Set(targetIds.filter(Boolean))] };
}
