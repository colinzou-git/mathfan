import type { SkillSummaryStatus } from '../mastery/skillMasteryEngine';
import type { MathAnswerEvent } from '../learning/learningEvents';

export type LearningGoalStatus = 'active' | 'paused' | 'completed' | 'ended' | 'cancelled';
export type GoalSource = 'recommended' | 'evaluation' | 'manual';

export type GoalTargetReason =
  | 'review_due'
  | 'needs_practice'
  | 'continue_progress'
  | 'ready_next'
  | 'needs_evaluation';

export interface GoalBaseline {
  capturedAt: string;
  status: SkillSummaryStatus;
  attemptCount: number;
  distinctItemCount: number;
  recentAccuracy: number;
  dueItemCount: number;
  mistakePatterns: string[];
  hintRate: number;
}

export interface GoalSkillTarget {
  id: string;
  skillId: string;
  reason: GoalTargetReason;
  baseline: GoalBaseline;
  targetAccuracy: number;
  minFirstAttempts: number;
  minDistinctItems: number;
  minActiveDays: number;
  maxHintRate: number;
  misconceptionTargets: string[];
  weight: number;
}

export interface LearningGoal {
  id: string;
  studentId: string;
  title: string;
  source: GoalSource;
  status: LearningGoalStatus;
  durationDays: number;
  startDate: string;
  targetDate: string;
  targets: GoalSkillTarget[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  endedAt?: string;
  evaluationId?: string;
}

export type GoalEventType =
  | 'created'
  | 'updated'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'ended'
  | 'cancelled'
  | 'target_progress'
  | 'evaluation_started'
  | 'evaluation_completed';

export interface GoalEvent {
  id: string;
  studentId: string;
  goalId: string;
  type: GoalEventType;
  createdAt: string;
  targetId?: string;
  evaluationId?: string;
  message?: string;
  data?: Record<string, unknown>;
}

export type GoalEvaluationStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';

export interface GoalEvaluationAnswer {
  eventId: string;
  targetId?: string;
  itemId: string;
  answeredAt: string;
  isCorrect: boolean;
}

export interface GoalEvaluation {
  id: string;
  studentId: string;
  status: GoalEvaluationStatus;
  source: GoalSource;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  goalId?: string;
  currentQuestionIndex: number;
  plannedQuestionCount: number;
  itemIds: string[];
  targetSkillIds: string[];
  answers: GoalEvaluationAnswer[];
  resultGoalId?: string;
  answerEvents?: MathAnswerEvent[];
}
