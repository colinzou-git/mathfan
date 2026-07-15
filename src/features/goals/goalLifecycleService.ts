import { goalEventRepo, learningGoalRepo } from '../../db/repositories';
import { generateId } from '../../utils/id';
import type { GoalEvent, LearningGoal } from './types';
import type { GoalProgress, LifecycleEvaluation } from './goalEngine';
import { evaluateGoalLifecycle, transitionGoal } from './goalEngine';

async function persistEvaluation(result: LifecycleEvaluation): Promise<LearningGoal> {
  if (result.changed) {
    await learningGoalRepo.update(result.goal.id, result.goal, result.goal.updatedAt);
    for (const event of result.events) {
      await goalEventRepo.append(event);
    }
  }
  return result.goal;
}

export async function evaluateGoalLifecycleAndPersist(
  goal: LearningGoal,
  progress: GoalProgress,
  existingEvents: GoalEvent[],
  now: string,
): Promise<LearningGoal> {
  return persistEvaluation(evaluateGoalLifecycle(goal, progress, existingEvents, now, generateId));
}

export async function pauseGoal(goal: LearningGoal, now: string): Promise<LearningGoal> {
  return persistEvaluation(transitionGoal(goal, 'paused', now, generateId));
}

export async function resumeGoal(goal: LearningGoal, now: string): Promise<LearningGoal> {
  return persistEvaluation(transitionGoal(goal, 'resumed', now, generateId));
}

export async function cancelGoal(goal: LearningGoal, now: string): Promise<LearningGoal> {
  return persistEvaluation(transitionGoal(goal, 'cancelled', now, generateId));
}

export async function endGoal(goal: LearningGoal, now: string): Promise<LearningGoal> {
  return persistEvaluation(transitionGoal(goal, 'ended', now, generateId));
}

export async function completeGoal(goal: LearningGoal, now: string): Promise<LearningGoal> {
  return persistEvaluation(transitionGoal(goal, 'completed', now, generateId));
}

export async function updateGoal(
  goal: LearningGoal,
  changes: Partial<Omit<LearningGoal, 'id' | 'studentId' | 'createdAt'>>,
  now: string,
): Promise<LearningGoal> {
  return persistEvaluation(transitionGoal(goal, 'updated', now, generateId, changes));
}
