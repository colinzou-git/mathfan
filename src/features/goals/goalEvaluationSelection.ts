import type { PracticeItem } from '../../types/math';
import { assertValidPracticeItem } from '../curriculum/practiceContentSpec';
import { deriveCardKey } from '../scheduler/cardModel';
import type { GoalEvaluation, PersistedGoalEvaluationSelection } from './types';

export class GoalEvaluationSelectionValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'GoalEvaluationSelectionValidationError';
  }
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function validatePersistedGoalEvaluationSelection(args: {
  evaluation: GoalEvaluation;
  selection: unknown;
}): PersistedGoalEvaluationSelection {
  const value = object(args.selection);
  if (!value) throw new GoalEvaluationSelectionValidationError('invalid_goal_selection', 'currentSelection must be an object.');
  if (value.version !== 1) throw new GoalEvaluationSelectionValidationError('invalid_goal_selection_version', 'currentSelection.version must be 1.');
  if (!Number.isInteger(value.questionIndex) || (value.questionIndex as number) < 0) {
    throw new GoalEvaluationSelectionValidationError('invalid_goal_question_index', 'currentSelection.questionIndex must be a nonnegative integer.');
  }
  if (value.questionIndex !== args.evaluation.answers.length) {
    throw new GoalEvaluationSelectionValidationError('goal_question_answer_count_mismatch', 'Pending question must match the answer count.');
  }
  if (!text(value.selectedAt) || !Number.isFinite(Date.parse(value.selectedAt))) {
    throw new GoalEvaluationSelectionValidationError('invalid_goal_selection_timestamp', 'currentSelection.selectedAt must be a valid timestamp.');
  }
  const requiredText = ['skillId', 'domain', 'phase', 'rationale', 'cardKey', 'schedulingReason'] as const;
  if (requiredText.some(key => !text(value[key]))) {
    throw new GoalEvaluationSelectionValidationError('invalid_goal_selection_metadata', 'currentSelection metadata is incomplete.');
  }
  if (!['screening', 'adaptive_probe', 'confirmation'].includes(value.phase as string)
      || !['first_card_evidence', 'same_evaluation_template_repeat'].includes(value.schedulingReason as string)
      || typeof value.schedulingEligible !== 'boolean') {
    throw new GoalEvaluationSelectionValidationError('invalid_goal_selection_metadata', 'currentSelection metadata is invalid.');
  }
  let item: PracticeItem;
  try {
    item = assertValidPracticeItem(value.item as PracticeItem);
  } catch (error) {
    throw new GoalEvaluationSelectionValidationError('invalid_goal_selection_item', error instanceof Error ? error.message : 'currentSelection.item is invalid.');
  }
  if (deriveCardKey(item) !== value.cardKey) {
    throw new GoalEvaluationSelectionValidationError('goal_question_card_key_mismatch', 'Pending question cardKey does not match its item.');
  }
  return { ...(value as unknown as PersistedGoalEvaluationSelection), item };
}

/** Local legacy/incomplete records safely reselect; valid pending questions are normalized once here. */
export function normalizeLocalGoalEvaluation(evaluation: GoalEvaluation): GoalEvaluation {
  const clean = { ...evaluation } as GoalEvaluation & { currentItem?: unknown; currentItemId?: unknown };
  delete clean.currentItem;
  delete clean.currentItemId;
  if (clean.status !== 'in_progress' || clean.currentSelection === undefined) {
    delete clean.currentSelection;
    return clean;
  }
  try {
    return { ...clean, currentSelection: validatePersistedGoalEvaluationSelection({ evaluation: clean, selection: clean.currentSelection }) };
  } catch {
    delete clean.currentSelection;
    return clean;
  }
}
