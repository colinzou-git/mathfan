import type { DailyNewGoalQuestionLimits } from '../../types/math';
import type { LearningGoal } from './types';

export const DEFAULT_DAILY_NEW_GOAL_LIMITS: DailyNewGoalQuestionLimits = {
  minQuestionsPerSkillTile: 5,
  maxQuestionsPerSkillTile: 12,
  maxPlannedQuestionsPerDay: 80,
};

export interface DailyNewGoalLimitValidationResult {
  limits: DailyNewGoalQuestionLimits;
  errors: string[];
  warnings: string[];
}

const integer = (value: number | undefined, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value!))) : fallback;

export function normalizeDailyNewGoalLimits(
  input?: Partial<DailyNewGoalQuestionLimits> | null,
): DailyNewGoalQuestionLimits {
  const min = integer(input?.minQuestionsPerSkillTile, DEFAULT_DAILY_NEW_GOAL_LIMITS.minQuestionsPerSkillTile, 1, 50);
  const max = Math.max(min, integer(input?.maxQuestionsPerSkillTile, DEFAULT_DAILY_NEW_GOAL_LIMITS.maxQuestionsPerSkillTile, 1, 100));
  const total = Math.max(min, integer(input?.maxPlannedQuestionsPerDay, DEFAULT_DAILY_NEW_GOAL_LIMITS.maxPlannedQuestionsPerDay, 1, 200));
  return { minQuestionsPerSkillTile: min, maxQuestionsPerSkillTile: max, maxPlannedQuestionsPerDay: total };
}

export function validateDailyNewGoalLimits(
  input: Partial<DailyNewGoalQuestionLimits>,
): DailyNewGoalLimitValidationResult {
  const limits = normalizeDailyNewGoalLimits(input);
  const errors: string[] = [];
  const { minQuestionsPerSkillTile: min, maxQuestionsPerSkillTile: max, maxPlannedQuestionsPerDay: total } = input;
  if (!Number.isFinite(min) || min! < 1 || min! > 50) errors.push('Min questions per skill must be between 1 and 50.');
  if (!Number.isFinite(max) || max! > 100) errors.push('Max questions per skill must be between 1 and 100.');
  if (Number.isFinite(min) && Number.isFinite(max) && max! < min!) errors.push('Max questions per skill must be greater than or equal to min questions per skill.');
  if (!Number.isFinite(total) || total! > 200) errors.push('Max planned goal-new questions per day must be between 1 and 200.');
  if (Number.isFinite(min) && Number.isFinite(total) && total! < min!) errors.push('Max planned goal-new questions per day must be greater than or equal to min questions per skill.');
  return { limits, errors, warnings: [] };
}

export function resolveGoalTileLimits(goal: LearningGoal, globalLimits: DailyNewGoalQuestionLimits) {
  const normalized = normalizeDailyNewGoalLimits({ ...globalLimits, ...goal.dailyNewQuestionLimitsOverride });
  return {
    minQuestionsPerSkillTile: normalized.minQuestionsPerSkillTile,
    maxQuestionsPerSkillTile: normalized.maxQuestionsPerSkillTile,
  };
}
