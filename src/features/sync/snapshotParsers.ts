import type { AttemptLog, PersistedDailyLessonPlan, PracticeSession, StudentItemState, StudentProfile } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../goals/types';
import type { SnapshotNormalizationProblem } from './snapshot';
import { GoalEvaluationSelectionValidationError, validatePersistedGoalEvaluationSelection } from '../goals/goalEvaluationSelection';

export type ParseResult<T> =
  | { ok: true; value: T; warnings: SnapshotNormalizationProblem[] }
  | { ok: false; problems: SnapshotNormalizationProblem[] };

type Row = Record<string, unknown>;

const record = (value: unknown): Row | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : undefined;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const finiteNonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const validDate = (value: unknown): value is string => nonempty(value) && Number.isFinite(Date.parse(value));

function parseRow<T>(table: string, value: unknown, index: number, validate: (row: Row, add: (code: string, message: string) => void) => void): ParseResult<T> {
  const row = record(value);
  if (!row) return { ok: false, problems: [{ table, recordId: String(index), code: 'not_object', message: 'Record must be an object.' }] };
  const problems: SnapshotNormalizationProblem[] = [];
  const recordId = nonempty(row.id) ? row.id : String(index);
  const add = (code: string, message: string) => problems.push({ table, recordId, code, message });
  validate(row, add);
  return problems.length ? { ok: false, problems } : { ok: true, value: row as T, warnings: [] };
}

const identity = (row: Row, add: (code: string, message: string) => void) => {
  if (!nonempty(row.id)) add('missing_id', 'Record is missing a nonempty id.');
  if (!nonempty(row.studentId)) add('missing_owner', 'Record is missing a nonempty studentId.');
};
const dateField = (row: Row, key: string, add: (code: string, message: string) => void, optional = false) => {
  if (optional && row[key] === undefined) return;
  if (!validDate(row[key])) add('invalid_timestamp', `${key} must be a valid timestamp.`);
};
const stringField = (row: Row, key: string, add: (code: string, message: string) => void) => {
  if (!nonempty(row[key])) add('missing_field', `${key} must be a nonempty string.`);
};
const numberField = (row: Row, key: string, add: (code: string, message: string) => void) => {
  if (!finiteNonnegative(row[key])) add('invalid_number', `${key} must be a finite nonnegative number.`);
};
const arrayField = (row: Row, key: string, add: (code: string, message: string) => void) => {
  if (!Array.isArray(row[key])) add('invalid_array', `${key} must be an array.`);
};
const enumField = (row: Row, key: string, values: readonly string[], add: (code: string, message: string) => void) => {
  if (!nonempty(row[key]) || !values.includes(row[key])) add('invalid_enum', `${key} is not a supported value.`);
};

export const parseStudentProfile = (value: unknown, index: number): ParseResult<StudentProfile> => parseRow('students', value, index, (row, add) => {
  if (!nonempty(row.id)) add('missing_id', 'Profile is missing a nonempty id.');
  stringField(row, 'displayName', add);
  dateField(row, 'createdAt', add, true);
  if (row.settings !== undefined && !record(row.settings)) add('invalid_settings', 'settings must be an object.');
});

export const parseAttemptLog = (value: unknown, index: number): ParseResult<AttemptLog> => parseRow('attempts', value, index, (row, add) => {
  identity(row, add); ['itemId', 'skillId', 'sessionId', 'promptShown'].forEach(key => stringField(row, key, add));
  numberField(row, 'latencyMs', add); dateField(row, 'createdAt', add);
  enumField(row, 'reviewGrade', ['again', 'hard', 'good', 'easy'], add);
  if (typeof row.isCorrect !== 'boolean') add('invalid_boolean', 'isCorrect must be a boolean.');
});

export const parseStudentItemState = (value: unknown, index: number): ParseResult<StudentItemState> => parseRow('itemStates', value, index, (row, add) => {
  if (!nonempty(row.studentId)) add('missing_owner', 'Record is missing a nonempty studentId.');
  ['cardKey', 'skillId', 'masteryLevel'].forEach(key => stringField(row, key, add));
  ['attemptCount', 'correctCount', 'lastLatencyMs', 'medianLatencyMs', 'ease', 'stabilityDays', 'difficulty'].forEach(key => numberField(row, key, add));
  if (typeof row.lastCorrect !== 'boolean') add('invalid_boolean', 'lastCorrect must be a boolean.');
  arrayField(row, 'mistakePatterns', add);
  dateField(row, 'lastSeenAt', add, true); dateField(row, 'nextDueAt', add, true);
});

export const parsePracticeSession = (value: unknown, index: number): ParseResult<PracticeSession> => parseRow('sessions', value, index, (row, add) => {
  identity(row, add); dateField(row, 'startedAt', add); dateField(row, 'endedAt', add, true); enumField(row, 'mode', ['daily_review', 'adaptive_lesson', 'single_table', 'multi_table', 'multiplication', 'addition', 'subtraction', 'division', 'fraction', 'word_problem', 'rounding', 'factors', 'decimals', 'audio', 'challenge', 'area', 'geometry', 'measurement'], add);
  ['plannedQuestionCount', 'completedQuestionCount', 'correctCount', 'averageLatencyMs'].forEach(key => numberField(row, key, add));
  if (row.lessonSegments !== undefined && !Array.isArray(row.lessonSegments)) add('invalid_array', 'lessonSegments must be an array.');
});

export const parseMathAnswerEvent = (value: unknown, index: number): ParseResult<MathAnswerEvent> => parseRow('mathAnswerEvents', value, index, (row, add) => {
  identity(row, add); ['sessionId', 'itemId', 'promptShown'].forEach(key => stringField(row, key, add)); enumField(row, 'mode', ['quiz', 'practice', 'diagnostic', 'goal_evaluation'], add);
  numberField(row, 'latencyMs', add); dateField(row, 'createdAt', add);
  ['isCorrect', 'isRetry', 'hintUsed'].forEach(key => { if (typeof row[key] !== 'boolean') add('invalid_boolean', `${key} must be a boolean.`); });
  if (row.schedulingKind !== undefined) enumField(row, 'schedulingKind', ['independent_review', 'relearning_step', 'related_evidence'], add);
  if (row.schedulingReason !== undefined) enumField(row, 'schedulingReason', ['first_card_evidence', 'same_session_repeat', 'same_presentation_relearning', 'deferred_related_evidence', 'same_evaluation_template_repeat'], add);
  if (row.relearningFromEventId !== undefined) stringField(row, 'relearningFromEventId', add);
});

export const parseMultiplicationFactStat = (value: unknown, index: number): ParseResult<MultiplicationFactStats> => parseRow('multFactStats', value, index, (row, add) => {
  if (!nonempty(row.studentId)) add('missing_owner', 'Record is missing a nonempty studentId.');
  stringField(row, 'key', add); ['left', 'right', 'answer', 'totalAttempts', 'correctAttempts', 'incorrectAttempts', 'accuracy', 'masteryScore', 'streakCorrect', 'streakIncorrect'].forEach(key => numberField(row, key, add));
  enumField(row, 'masteryState', ['new', 'weak', 'learning', 'strong', 'mastered', 'forgotten'], add);
  if (row.lastPracticedAt !== null) dateField(row, 'lastPracticedAt', add, true);
});

export const parseQuizSession = (value: unknown, index: number): ParseResult<QuizSession> => parseRow('quizSessions', value, index, (row, add) => {
  identity(row, add); dateField(row, 'startedAt', add); if (row.completedAt !== null) dateField(row, 'completedAt', add, true);
  enumField(row, 'category', ['multiplication'], add);
  ['quizLength', 'correctCount', 'incorrectCount', 'accuracy'].forEach(key => numberField(row, key, add));
  ['answerLogs', 'weakFactsDiscovered', 'strongFactsConfirmed', 'forgottenFactsDiscovered', 'untestedFactsCovered', 'recommendedPracticeFacts'].forEach(key => arrayField(row, key, add));
});

export const parseLearningGoal = (value: unknown, index: number): ParseResult<LearningGoal> => parseRow('learningGoals', value, index, (row, add) => {
  identity(row, add); ['title', 'startDate', 'targetDate'].forEach(key => stringField(row, key, add)); enumField(row, 'source', ['recommended', 'evaluation', 'manual'], add); enumField(row, 'status', ['active', 'paused', 'completed', 'ended', 'cancelled'], add);
  numberField(row, 'durationDays', add); arrayField(row, 'targets', add); dateField(row, 'createdAt', add); dateField(row, 'updatedAt', add);
});

export const parseGoalEvent = (value: unknown, index: number): ParseResult<GoalEvent> => parseRow('goalEvents', value, index, (row, add) => {
  identity(row, add); stringField(row, 'goalId', add); enumField(row, 'type', ['created', 'updated', 'paused', 'resumed', 'completed', 'ended', 'cancelled', 'target_completed', 'target_progress', 'evaluation_started', 'evaluation_completed'], add); dateField(row, 'createdAt', add);
});

export const parseGoalEvaluation = (value: unknown, index: number): ParseResult<GoalEvaluation> => parseRow('goalEvaluations', value, index, (row, add) => {
  identity(row, add); enumField(row, 'status', ['not_started', 'in_progress', 'completed', 'cancelled'], add); enumField(row, 'source', ['recommended', 'evaluation', 'manual'], add); dateField(row, 'createdAt', add); dateField(row, 'updatedAt', add);
  ['itemIds', 'targetSkillIds', 'answers'].forEach(key => arrayField(row, key, add));
  ['currentQuestionIndex', 'plannedQuestionCount'].forEach(key => numberField(row, key, add));
  if (Array.isArray(row.answers)) row.answers.forEach((answer, answerIndex) => {
    const parsed = record(answer);
    if (!parsed || !nonempty(parsed.eventId) || !nonempty(parsed.itemId) || !validDate(parsed.answeredAt)) add('invalid_answer', `answers[${answerIndex}] is missing eventId, itemId, or a valid answeredAt.`);
  });
  if (row.answerEvents !== undefined && !Array.isArray(row.answerEvents)) add('invalid_array', 'answerEvents must be an array.');
  delete row.currentItem;
  delete row.currentItemId;
  if (row.status !== 'in_progress') delete row.currentSelection;
  if (row.currentSelection !== undefined) {
    try {
      row.currentSelection = validatePersistedGoalEvaluationSelection({ evaluation: row as unknown as GoalEvaluation, selection: row.currentSelection });
    } catch (error) {
      if (error instanceof GoalEvaluationSelectionValidationError) add(error.code, error.message);
      else add('invalid_goal_selection', 'currentSelection is invalid.');
    }
  }
});

export const parseDailyLessonPlanShape = (value: unknown, index: number): ParseResult<PersistedDailyLessonPlan> => parseRow('dailyLessonPlans', value, index, (row, add) => {
  identity(row, add); ['localDate', 'timezone', 'plannerVersion'].forEach(key => stringField(row, key, add)); enumField(row, 'status', ['planned', 'in_progress', 'completed', 'replaced'], add);
  numberField(row, 'revision', add); numberField(row, 'estimatedMinutes', add); dateField(row, 'generatedAt', add); dateField(row, 'updatedAt', add);
  ['items', 'completedItemInstanceIds', 'warnings'].forEach(key => arrayField(row, key, add));
});

export function parseSnapshotTable<T>(table: string, rows: unknown, parser: (value: unknown, index: number) => ParseResult<T>, required = false) {
  if (rows === undefined && !required) return { values: [] as T[], problems: [] as SnapshotNormalizationProblem[], warnings: [] as SnapshotNormalizationProblem[] };
  if (!Array.isArray(rows)) return { values: [] as T[], problems: [{ table, code: 'not_array', message: `${table} must be an array.` }], warnings: [] as SnapshotNormalizationProblem[] };
  const values: T[] = [], problems: SnapshotNormalizationProblem[] = [], warnings: SnapshotNormalizationProblem[] = [];
  rows.forEach((row, index) => { const result = parser(row, index); if (result.ok) { values.push(result.value); warnings.push(...result.warnings); } else problems.push(...result.problems); });
  return { values, problems, warnings };
}
