import type { MathAnswerEvent } from '../learning/learningEvents';
import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
import { GRADE3_MASTERY_MAP, type MasterySkillNode } from '../mastery/grade3MasteryMap';
import type { StudentItemState, StudentSettings } from '../../types/math';
import type { GoalBaseline, GoalSkillTarget, GoalTargetReason, LearningGoal } from './types';
import {
  captureGoalBaseline,
  defaultSkillIdForItem,
  localDateInTimeZone,
  suggestedTargetDefaults,
  type GoalEvidenceInput,
  type SkillIdResolver,
} from './goalEngine';

export type RecommendationReasonLabel =
  | 'Review now'
  | 'Strengthen a weak skill'
  | 'Keep the progress going'
  | 'Ready to learn next'
  | 'Evaluate this skill';

export interface CandidateFeatures {
  duePressure: number;
  weakness: number;
  progressContinuation: number;
  frontierReadiness: number;
  misconceptionSeverity: number;
  evidenceUncertainty: number;
  activeGoalOverlap: number;
}

export interface GoalRecommendationCandidate {
  skillId: string;
  title: string;
  summary: StudentSkillSummary;
  features: CandidateFeatures;
  score: number;
  primaryReason: RecommendationReasonLabel;
  explanation: string;
  prerequisiteAdvisories: string[];
  dueItemCount: number;
  overdueDays: number;
  recentAttemptCount: number;
  recentWrongCount: number;
  distinctItemCount: number;
  misconceptionCount: number;
}

export interface GoalRecommendationTarget {
  skillId: string;
  reason: GoalTargetReason;
  baseline: GoalBaseline;
  thresholds: Pick<GoalSkillTarget,
    'targetAccuracy' |
    'minFirstAttempts' |
    'minDistinctItems' |
    'minActiveDays' |
    'maxHintRate' |
    'misconceptionTargets' |
    'weight'
  >;
}

export interface GoalRecommendation {
  skillIds: string[];
  title: string;
  primaryReason: RecommendationReasonLabel;
  explanation: string;
  confidence: number;
  score: number;
  estimatedTotalQuestions: number;
  estimatedQuestionsPerDay: number;
  estimatedMinutesPerDay: number;
  targets: GoalRecommendationTarget[];
  prerequisiteAdvisories: string[];
  isStretch: boolean;
}

export interface GoalRecommendationResult {
  recommendations: GoalRecommendation[];
  candidates: GoalRecommendationCandidate[];
  capacity: {
    durationDays: number;
    questionsPerDay: number;
    minutesPerDay: number;
    totalQuestions: number;
    recentMedianQuestionsPerActiveDay: number | null;
    fallbackQuestionsPerDay: number;
  };
}

export interface GoalRecommendationArgs {
  studentId: string;
  skillSummaries: StudentSkillSummary[];
  events: MathAnswerEvent[];
  itemStates: StudentItemState[];
  activeGoals: LearningGoal[];
  settings: StudentSettings;
  durationDays?: number;
  now: string;
  timezone: string;
  resolveSkillId?: SkillIdResolver;
}

const RECENT_EVENT_LIMIT = 20;
const RECENT_VOLUME_DAYS = 14;
const FALLBACK_QUESTIONS_PER_DAY = 12;
const SECONDS_PER_QUESTION = 20;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function directFirstAttempt(event: MathAnswerEvent): boolean {
  return !event.isRetry && !event.relatedEvidence;
}

function safeTime(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function dayDiff(laterIso: string, earlierIso: string): number {
  return Math.max(0, Math.floor((safeTime(laterIso) - safeTime(earlierIso)) / (24 * 60 * 60 * 1000)));
}

function summaryMapWithStubs(studentId: string, summaries: StudentSkillSummary[]): Map<string, StudentSkillSummary> {
  const map = new Map(summaries.map(summary => [summary.skillId, summary]));
  for (const node of GRADE3_MASTERY_MAP) {
    if (!map.has(node.id)) {
      map.set(node.id, {
        skillId: node.id,
        studentId,
        status: 'new',
        attemptCount: 0,
        correctCount: 0,
        accuracy: 0,
        dueItemCount: 0,
        itemCount: 0,
        mistakePatterns: [],
      });
    }
  }
  return map;
}

function skillForState(
  state: StudentItemState,
  resolveSkillId: SkillIdResolver,
): string | null {
  return resolveSkillId(state.itemId) ?? state.skillId ?? null;
}

function skillEvents(args: GoalRecommendationArgs, skillId: string): MathAnswerEvent[] {
  const resolveSkillId = args.resolveSkillId ?? defaultSkillIdForItem;
  return args.events
    .filter(event => event.studentId === args.studentId)
    .filter(directFirstAttempt)
    .filter(event => resolveSkillId(event.itemId) === skillId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function skillStates(args: GoalRecommendationArgs, skillId: string): StudentItemState[] {
  const resolveSkillId = args.resolveSkillId ?? defaultSkillIdForItem;
  return args.itemStates
    .filter(state => state.studentId === args.studentId)
    .filter(state => skillForState(state, resolveSkillId) === skillId);
}

function dueStats(states: StudentItemState[], now: string): { dueItemCount: number; overdueDays: number } {
  let dueItemCount = 0;
  let overdueDays = 0;
  for (const state of states) {
    if (!state.nextDueAt || state.nextDueAt > now) continue;
    dueItemCount += 1;
    overdueDays = Math.max(overdueDays, dayDiff(now, state.nextDueAt));
  }
  return { dueItemCount, overdueDays };
}

function distinctItemCount(events: MathAnswerEvent[]): number {
  return new Set(events.map(event => event.itemId)).size;
}

/**
 * Weakness uses Bayesian smoothing with a Beta(2, 2) prior for correctness,
 * equivalent to four neutral prior answers. Recent events are weighted with
 * a deterministic 0.85 decay per older answer so a single old miss cannot
 * dominate and one or two fresh answers do not create false certainty.
 */
function smoothedRecentWeakness(events: MathAnswerEvent[]): { weakness: number; recentAttemptCount: number; recentWrongCount: number } {
  const recent = events.slice(-RECENT_EVENT_LIMIT);
  if (recent.length === 0) {
    return { weakness: 0, recentAttemptCount: 0, recentWrongCount: 0 };
  }
  let weightedWrong = 0;
  let weightedTotal = 0;
  recent.forEach((event, index) => {
    const ageFromNewest = recent.length - index - 1;
    const weight = Math.pow(0.85, ageFromNewest);
    weightedTotal += weight;
    if (!event.isCorrect) weightedWrong += weight;
  });
  const priorWrong = 2;
  const priorTotal = 4;
  return {
    weakness: clamp01((priorWrong + weightedWrong) / (priorTotal + weightedTotal)),
    recentAttemptCount: recent.length,
    recentWrongCount: recent.filter(event => !event.isCorrect).length,
  };
}

function recentImprovement(events: MathAnswerEvent[]): number {
  const recent = events.slice(-10);
  if (recent.length < 6) return 0;
  const midpoint = Math.floor(recent.length / 2);
  const older = recent.slice(0, midpoint);
  const newer = recent.slice(midpoint);
  const accuracy = (list: MathAnswerEvent[]) => list.filter(event => event.isCorrect).length / list.length;
  return clamp01(accuracy(newer) - accuracy(older));
}

function prerequisiteAdvisories(node: MasterySkillNode, summaryMap: Map<string, StudentSkillSummary>): string[] {
  return node.prerequisites
    .filter(prereqId => {
      const prereq = summaryMap.get(prereqId);
      return !(prereq?.status === 'strong' || prereq?.status === 'mastered');
    })
    .map(prereqId => GRADE3_MASTERY_MAP.find(skill => skill.id === prereqId)?.title ?? prereqId);
}

function activeGoalOverlap(skillId: string, activeGoals: LearningGoal[]): number {
  return activeGoals.some(goal =>
    goal.status === 'active' && goal.targets.some(target => target.skillId === skillId)
  ) ? 1 : 0;
}

function misconceptionSeverity(states: StudentItemState[]): { severity: number; misconceptionCount: number } {
  const count = states.reduce((sum, state) => sum + (state.mistakePatterns?.length ?? 0), 0);
  return {
    severity: clamp01(count / 4),
    misconceptionCount: count,
  };
}

function evidenceUncertainty(events: MathAnswerEvent[], itemCount: number): number {
  const attemptCoverage = clamp01(events.length / 10);
  const itemCoverage = clamp01(itemCount / 4);
  return clamp01(1 - (attemptCoverage + itemCoverage) / 2);
}

function progressContinuation(summary: StudentSkillSummary, events: MathAnswerEvent[]): number {
  const improvement = recentImprovement(events);
  const strongUnfinished = summary.status === 'strong' ? 0.7 : 0;
  return clamp01(Math.max(improvement, strongUnfinished));
}

function frontierReadiness(node: MasterySkillNode, summary: StudentSkillSummary, summaryMap: Map<string, StudentSkillSummary>): number {
  if (summary.status !== 'new') return 0;
  if (node.prerequisites.length === 0) return 0.8;
  const satisfied = node.prerequisites.filter(prereqId => {
    const prereq = summaryMap.get(prereqId);
    return prereq?.status === 'strong' || prereq?.status === 'mastered';
  }).length;
  return clamp01(satisfied / node.prerequisites.length);
}

function scoreFeatures(features: CandidateFeatures): number {
  return (
    30 * features.duePressure +
    25 * features.weakness +
    15 * features.progressContinuation +
    15 * features.frontierReadiness +
    10 * features.misconceptionSeverity +
    5 * features.evidenceUncertainty -
    25 * features.activeGoalOverlap
  );
}

function primaryReason(features: CandidateFeatures): RecommendationReasonLabel {
  if (features.duePressure >= 0.25) return 'Review now';
  if (features.weakness >= 0.55) return 'Strengthen a weak skill';
  if (features.progressContinuation >= 0.45) return 'Keep the progress going';
  if (features.frontierReadiness >= 0.5) return 'Ready to learn next';
  return 'Evaluate this skill';
}

function reasonToTargetReason(reason: RecommendationReasonLabel): GoalTargetReason {
  if (reason === 'Review now') return 'review_due';
  if (reason === 'Strengthen a weak skill') return 'needs_practice';
  if (reason === 'Keep the progress going') return 'continue_progress';
  if (reason === 'Ready to learn next') return 'ready_next';
  return 'needs_evaluation';
}

function explanation(candidate: Omit<GoalRecommendationCandidate, 'explanation'>): string {
  if (candidate.primaryReason === 'Review now') {
    return candidate.overdueDays > 0
      ? `${candidate.dueItemCount} due item${candidate.dueItemCount === 1 ? ' is' : 's are'} ready, oldest ${candidate.overdueDays} day${candidate.overdueDays === 1 ? '' : 's'} overdue.`
      : `${candidate.dueItemCount} due item${candidate.dueItemCount === 1 ? ' is' : 's are'} ready for review.`;
  }
  if (candidate.primaryReason === 'Strengthen a weak skill') {
    return `${candidate.recentWrongCount} of ${candidate.recentAttemptCount} recent first attempts need another look.`;
  }
  if (candidate.primaryReason === 'Keep the progress going') {
    return `${candidate.title} is in progress with ${candidate.recentAttemptCount} recent first attempts.`;
  }
  if (candidate.primaryReason === 'Ready to learn next') {
    return candidate.prerequisiteAdvisories.length === 0
      ? `Prerequisites are ready for ${candidate.title}.`
      : `${candidate.title} is available, with ${candidate.prerequisiteAdvisories.length} prerequisite ${candidate.prerequisiteAdvisories.length === 1 ? 'skill' : 'skills'} to keep nearby.`;
  }
  return `${candidate.recentAttemptCount} first attempts across ${candidate.distinctItemCount} item${candidate.distinctItemCount === 1 ? '' : 's'} leave room to learn more.`;
}

function candidateForSkill(
  node: MasterySkillNode,
  summary: StudentSkillSummary,
  summaryMap: Map<string, StudentSkillSummary>,
  args: GoalRecommendationArgs,
): GoalRecommendationCandidate | null {
  const events = skillEvents(args, node.id);
  const states = skillStates(args, node.id);
  const due = dueStats(states, args.now);
  const duePressure = clamp01(due.dueItemCount / 5 + due.overdueDays / 14);
  if (summary.status === 'mastered' && duePressure === 0) return null;

  const weak = smoothedRecentWeakness(events);
  const itemCount = Math.max(summary.itemCount, distinctItemCount(events));
  const misconception = misconceptionSeverity(states);
  const features: CandidateFeatures = {
    duePressure,
    weakness: weak.weakness,
    progressContinuation: progressContinuation(summary, events),
    frontierReadiness: frontierReadiness(node, summary, summaryMap),
    misconceptionSeverity: misconception.severity,
    evidenceUncertainty: evidenceUncertainty(events, itemCount),
    activeGoalOverlap: activeGoalOverlap(node.id, args.activeGoals),
  };
  const reason = primaryReason(features);
  const score = scoreFeatures(features);
  const candidate = {
    skillId: node.id,
    title: node.title,
    summary,
    features,
    score,
    primaryReason: reason,
    prerequisiteAdvisories: prerequisiteAdvisories(node, summaryMap),
    dueItemCount: due.dueItemCount,
    overdueDays: due.overdueDays,
    recentAttemptCount: weak.recentAttemptCount,
    recentWrongCount: weak.recentWrongCount,
    distinctItemCount: itemCount,
    misconceptionCount: misconception.misconceptionCount,
  };
  return {
    ...candidate,
    explanation: explanation(candidate),
  };
}

function recentMedianQuestionsPerActiveDay(args: GoalRecommendationArgs): number | null {
  const startMs = safeTime(args.now) - RECENT_VOLUME_DAYS * 24 * 60 * 60 * 1000;
  const byDate = new Map<string, number>();
  for (const event of args.events) {
    if (event.studentId !== args.studentId || !directFirstAttempt(event)) continue;
    const ms = safeTime(event.createdAt);
    if (ms < startMs || ms > safeTime(args.now)) continue;
    const date = localDateInTimeZone(event.createdAt, args.timezone);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }
  const counts = Array.from(byDate.values()).sort((a, b) => a - b);
  if (counts.length === 0) return null;
  const mid = Math.floor(counts.length / 2);
  return counts.length % 2 === 1 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
}

export function estimateGoalWorkload(args: GoalRecommendationArgs): GoalRecommendationResult['capacity'] {
  const durationDays = clampInt(args.durationDays ?? 7, 1, 30);
  const fromMinutes = Math.max(0, args.settings.dailyGoalMinutes) * 60 / SECONDS_PER_QUESTION;
  const recentMedian = recentMedianQuestionsPerActiveDay(args);
  // With no history, use a documented fallback of 12 questions/day. With history,
  // blend the student's recent median with their configured daily minutes so
  // recommendations respect both habit and available time.
  const raw = recentMedian == null
    ? (fromMinutes > 0 ? Math.min(fromMinutes, FALLBACK_QUESTIONS_PER_DAY) : FALLBACK_QUESTIONS_PER_DAY)
    : (fromMinutes + recentMedian) / 2;
  const questionsPerDay = clampInt(raw, 8, 40);
  return {
    durationDays,
    questionsPerDay,
    minutesPerDay: Math.ceil(questionsPerDay * SECONDS_PER_QUESTION / 60),
    totalQuestions: questionsPerDay * durationDays,
    recentMedianQuestionsPerActiveDay: recentMedian,
    fallbackQuestionsPerDay: FALLBACK_QUESTIONS_PER_DAY,
  };
}

function maxBundleSize(durationDays: number): number {
  if (durationDays <= 1) return 1;
  if (durationDays <= 7) return 2;
  return 3;
}

function targetForCandidate(candidate: GoalRecommendationCandidate, args: GoalRecommendationArgs): GoalRecommendationTarget {
  const evidenceInput: GoalEvidenceInput = {
    studentId: args.studentId,
    events: args.events,
    itemStates: args.itemStates,
    skillSummaries: args.skillSummaries,
    now: args.now,
    timezone: args.timezone,
    resolveSkillId: args.resolveSkillId,
  };
  const baseline = captureGoalBaseline(evidenceInput, candidate.skillId);
  const reason = reasonToTargetReason(candidate.primaryReason);
  return {
    skillId: candidate.skillId,
    reason,
    baseline,
    thresholds: suggestedTargetDefaults(reason, baseline),
  };
}

function recommendationTitle(candidates: GoalRecommendationCandidate[]): string {
  if (candidates.length === 1) return candidates[0].title;
  if (candidates.length === 2) return `${candidates[0].title} + ${candidates[1].title}`;
  return `${candidates[0].title} + ${candidates.length - 1} more skills`;
}

function buildRecommendation(
  candidates: GoalRecommendationCandidate[],
  args: GoalRecommendationArgs,
  capacity: GoalRecommendationResult['capacity'],
): GoalRecommendation {
  const targets = candidates.map(candidate => targetForCandidate(candidate, args));
  const requiredQuestions = targets.reduce((sum, target) => sum + target.thresholds.minFirstAttempts, 0);
  const isStretch = requiredQuestions > capacity.totalQuestions;
  const combinedScore = candidates.reduce((sum, candidate) => sum + candidate.score, 0) / candidates.length;
  const advisories = Array.from(new Set(candidates.flatMap(candidate => candidate.prerequisiteAdvisories))).sort();
  return {
    skillIds: candidates.map(candidate => candidate.skillId),
    title: recommendationTitle(candidates),
    primaryReason: candidates[0].primaryReason,
    explanation: candidates[0].explanation,
    confidence: clamp01(combinedScore / 80),
    score: combinedScore,
    estimatedTotalQuestions: capacity.totalQuestions,
    estimatedQuestionsPerDay: capacity.questionsPerDay,
    estimatedMinutesPerDay: capacity.minutesPerDay,
    targets,
    prerequisiteAdvisories: advisories,
    isStretch,
  };
}

export function recommendLearningGoals(args: GoalRecommendationArgs): GoalRecommendationResult {
  const capacity = estimateGoalWorkload(args);
  const summaryMap = summaryMapWithStubs(args.studentId, args.skillSummaries);
  const candidates = GRADE3_MASTERY_MAP
    .map(node => candidateForSkill(node, summaryMap.get(node.id)!, summaryMap, args))
    .filter((candidate): candidate is GoalRecommendationCandidate => candidate !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.skillId.localeCompare(b.skillId);
    });

  const recommendations: GoalRecommendation[] = [];
  const seenBundles = new Set<string>();
  const bundleMax = maxBundleSize(capacity.durationDays);
  for (let i = 0; i < candidates.length && recommendations.length < 5; i++) {
    let bundle = candidates.slice(i, i + bundleMax);
    while (bundle.length > 1) {
      const required = bundle
        .map(candidate => targetForCandidate(candidate, args).thresholds.minFirstAttempts)
        .reduce((sum, value) => sum + value, 0);
      if (required <= capacity.totalQuestions) break;
      bundle = bundle.slice(0, -1);
    }
    const key = bundle.map(candidate => candidate.skillId).sort().join('|');
    if (seenBundles.has(key)) continue;
    seenBundles.add(key);
    recommendations.push(buildRecommendation(bundle, args, capacity));
  }

  return { recommendations, candidates, capacity };
}
