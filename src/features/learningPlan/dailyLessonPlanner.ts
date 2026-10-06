import type { GradeLevel, PracticeItem, SelectionContext, StudentItemState, StudentSettings } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
import type { LearningGoal } from '../goals/types';
import { deriveCardKey } from '../scheduler/cardModel';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { planPracticeForSkill, buildFocusSequence as buildSkillFocusSequence } from '../mastery/skillPracticePlanner';
import { getCurriculum, getCurriculumSkill } from '../curriculum/curriculumRegistry';
import { foundationItemIds, freshFoundationItem } from '../curriculum/foundationItems';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { getRelatedSkillIds } from '../adaptive/relatedItemMapping';
import { rankFocusSkills } from './focusSkillSelector';
import { deriveLearningUnitProgress } from '../learning/learningUnitProgress';
import { learnerLocalDateKey } from '../time/localDate';
import { chronologicalEvents } from '../learning/eventOrdering';
import { DAILY_LESSON_PLANNER_VERSION } from '../learning/schedulingTelemetry';
import { contentSpecForItem } from '../curriculum/practiceContentSpec';

export type LessonSegmentKind = 'retrieval' | 'focus' | 'transfer';
export interface PlannedLessonItem {
  item: PracticeItem;
  cardKey: string;
  segment: LessonSegmentKind;
  rationale: string;
  schedulingEligible: boolean;
  selection: SelectionContext;
}
export interface DailyLessonWarning { code: 'sparse_retrieval' | 'unmet_prerequisite' | 'sparse_transfer' | 'no_focus'; message: string }
export interface DailyLessonPlan { id: string; studentId: string; generatedAt: string; estimatedMinutes: number; focusSkillId?: string; focusSkillTitle?: string; items: PlannedLessonItem[]; segmentCounts: Record<LessonSegmentKind, number>; warnings: DailyLessonWarning[] }
export interface PlanDailyLessonArgs { studentId: string; gradeLevel: GradeLevel; now: string; timezone: string; settings: StudentSettings; events: MathAnswerEvent[]; itemStates: StudentItemState[]; skillSummaries: StudentSkillSummary[]; goals: LearningGoal[]; rng: () => number }
export interface LessonAvailability { retrieval: number; focus: number; transfer: number }
export interface LessonAllocation { retrieval: number; focus: number; transfer: number }

const COMPLEX_TYPES = new Set(['word_problem', 'elapsed_time', 'area_perimeter_compare', 'perimeter_unknown_side']);
export function estimateItemSeconds(item: PracticeItem, events: MathAnswerEvent[]): number {
  const history = chronologicalEvents(events)
    .filter(event => event.itemId === item.id && event.isCorrect)
    .slice(-5)
    .map(event => event.latencyMs)
    .filter(value => value > 0);
  if (history.length) return Math.max(8, Math.min(90, Math.round(history.reduce((sum, value) => sum + value, 0) / history.length / 1000)));
  const content = contentSpecForItem(item);
  if (COMPLEX_TYPES.has(item.itemType) || (content?.domain === 'word_problem' && content.data.steps.length === 2)) return 45;
  if (item.visualSpec || content) return 30;
  return 20;
}

export function allocateLessonSegments(targetSeconds: number, available: LessonAvailability): LessonAllocation {
  const questionBudget = Math.max(8, Math.min(20, Math.round(targetSeconds / 30)));
  const retrieval = Math.min(available.retrieval, Math.max(0, Math.round(questionBudget * .25)));
  const transfer = Math.min(available.transfer, Math.max(0, Math.round(questionBudget * .25)));
  const focus = Math.min(available.focus, Math.max(0, questionBudget - retrieval - transfer));
  return { retrieval, focus, transfer };
}

const shuffled = <T,>(values: T[], rng: () => number) => values.map(value => ({ value, order: rng() })).sort((a, b) => a.order - b.order).map(entry => entry.value);
const uniqueItems = (ids: string[]) => [...new Set(ids)].map(makeItemFromId).filter((item): item is PracticeItem => item !== null);

export function buildTransferPool(focusSkillId: string, grade: GradeLevel, summaries: StudentSkillSummary[]): PracticeItem[] {
  if (getCurriculumSkill(focusSkillId)?.evidenceProfile) {
    const introduced = new Set(summaries.filter(summary => summary.attemptCount > 0).map(summary => summary.skillId));
    const related = (getCurriculumSkill(focusSkillId)?.transferSkillIds ?? []).filter(id => id === focusSkillId || introduced.has(id));
    return uniqueItems(related.flatMap(id => foundationItemIds(id))).filter(item => item.contentSpec?.domain === 'foundation' && ['transfer', 'verify', 'check'].includes(item.contentSpec.data.form));
  }
  if (grade !== 3) return [];
  const maintained = new Set(summaries.filter(summary => ['strong', 'mastered', 'review_due'].includes(summary.status)).map(summary => summary.skillId));
  const pools = ['g3-word-one-step', 'g3-word-two-step', 'g3-scaled-bar-graphs', 'g3-area-perimeter-choice'].flatMap(skillId => planPracticeForSkill(skillId, { sessionLength: 10 }).specificItemIds ?? []);
  return uniqueItems(pools).filter(item => {
    const own = inferGrade3SkillId(item);
    const related = getRelatedSkillIds(item);
    return related.includes(focusSkillId) || (own != null && maintained.has(own));
  });
}

export function planDailyLesson(args: PlanDailyLessonArgs): DailyLessonPlan {
  const curriculum = getCurriculum(args.gradeLevel);
  const configured = curriculum?.skills.some(skill => skill.evidenceProfile) ?? false;
  const studentEvents = args.events.filter(event => event.studentId === args.studentId && event.createdAt <= args.now);
  const localDate = learnerLocalDateKey(new Date(args.now), args.timezone);
  const priorFocusDays = new Set(studentEvents.filter(event => !event.isRetry && event.lessonSegment === 'focus'
    && (!configured || makeItemFromId(event.itemId)?.gradeLevel === args.gradeLevel))
    .map(event => learnerLocalDateKey(new Date(event.createdAt), args.timezone)).filter(date => date < localDate));
  const mixedDay = configured && (priorFocusDays.size + 1) % 5 === 0;
  const targetSeconds = Math.max(8, Math.min(15, args.settings.dailyGoalMinutes)) * 60;
  const dueStates = args.itemStates.filter(state => state.studentId === args.studentId && state.nextDueAt != null && state.nextDueAt <= args.now)
    .sort((a, b) => (a.nextDueAt ?? '').localeCompare(b.nextDueAt ?? ''));
  const retrievalAll: PracticeItem[] = []; const retrievalCards = new Set<string>();
  for (const state of dueStates) { const previous = makeItemFromId(state.lastItemId ?? state.cardKey); if (!previous) continue; const item = freshFoundationItem(previous, args.rng); const key = deriveCardKey(item); if (!retrievalCards.has(key)) { retrievalCards.add(key); retrievalAll.push(item); } }
  const usable = new Set(args.skillSummaries.map(summary => summary.skillId).filter(skillId => (planPracticeForSkill(skillId).specificItemIds?.length ?? 0) > 0));
  const focusCandidate = rankFocusSkills({ studentId: args.studentId, now: args.now, summaries: args.skillSummaries, goals: args.goals, events: studentEvents, usableSkillIds: usable, skillGraph: curriculum?.skills })
    .find(candidate => !mixedDay || studentEvents.some(event => makeItemFromId(event.itemId)?.skillId === candidate.skillId && event.mode === 'practice'));
  const focusIds = focusCandidate ? (buildSkillFocusSequence(focusCandidate.skillId).itemIds.length ? buildSkillFocusSequence(focusCandidate.skillId).itemIds : planPracticeForSkill(focusCandidate.skillId).specificItemIds ?? []) : [];
  let focusCatalogue = uniqueItems(focusIds).map(item => freshFoundationItem(item, args.rng));
  let highestBand = 2;
  if (configured) {
    const ownEvents = studentEvents.filter(event => makeItemFromId(event.itemId)?.skillId === focusCandidate?.skillId && event.mode === 'practice' && !event.isRetry && !event.hintUsed);
    const recent = ownEvents.slice(-8), accuracy = recent.length ? recent.filter(event => event.isCorrect).length / recent.length : 0;
    highestBand = recent.length < 6 || accuracy < .75 ? 0 : accuracy < .9 ? 1 : 2;
    focusCatalogue = focusCatalogue.filter(item => item.contentSpec?.domain !== 'foundation' || item.contentSpec.data.band <= highestBand);
  }
  const unitProgress = deriveLearningUnitProgress({ items: focusCatalogue, events: args.events, states: args.itemStates });
  let focusAll = shuffled(focusCatalogue.filter(item => !retrievalCards.has(deriveCardKey(item)) && unitProgress.get(deriveCardKey(item))?.status !== 'maintenance'), args.rng);
  if (configured && focusCandidate) {
    // Sequence representations before increasing structural difficulty; one concrete variant per card.
    const seen = new Set<string>();
    focusAll = focusAll.sort((a, b) => {
      const aa = a.contentSpec?.domain === 'foundation' ? a.contentSpec.data : undefined;
      const bb = b.contentSpec?.domain === 'foundation' ? b.contentSpec.data : undefined;
      const order = ['model', 'symbolic', 'explain', 'check', 'transfer', 'verify'];
      return (aa?.band ?? 0) - (bb?.band ?? 0) || order.indexOf(aa?.form ?? 'model') - order.indexOf(bb?.form ?? 'model');
    }).filter(item => { const key = deriveCardKey(item); if (seen.has(key)) return false; seen.add(key); return true; });
    if (mixedDay) {
      const introduced = curriculum?.skills.filter(skill => studentEvents.some(event => !event.isRetry && event.mode === 'practice' && makeItemFromId(event.itemId)?.skillId === skill.id)) ?? [];
      focusAll = shuffled(uniqueItems(introduced.flatMap(skill => foundationItemIds(skill.id)))
        .filter(item => item.contentSpec?.domain === 'foundation' && item.contentSpec.data.band <= highestBand
          && ['transfer', 'check', 'verify'].includes(item.contentSpec.data.form) && !retrievalCards.has(deriveCardKey(item))), args.rng)
        .filter(item => { const key = deriveCardKey(item); if (seen.has(`mixed:${key}`)) return false; seen.add(`mixed:${key}`); return true; })
        .map(item => freshFoundationItem(item, args.rng));
    }
    else {
      focusAll = focusAll.filter(item => item.contentSpec?.domain !== 'foundation' || !['transfer', 'verify'].includes(item.contentSpec.data.form));
      const bridgeId = focusCandidate.unmetPrerequisites[0];
      const bridgeCards = new Set<string>();
      const bridge = bridgeId ? uniqueItems(planPracticeForSkill(bridgeId, { sessionLength: 3 }).specificItemIds ?? [])
        .filter(item => { const key = deriveCardKey(item); if (retrievalCards.has(key) || bridgeCards.has(key)) return false; bridgeCards.add(key); return true; }).slice(0, 3) : [];
      focusAll = [...bridge, ...focusAll];
    }
  }
  const maintenanceTransfer = focusCatalogue.filter(item => unitProgress.get(deriveCardKey(item))?.status === 'maintenance');
  const focusCards = new Set(focusAll.map(deriveCardKey));
  const transferSeen = new Set<string>();
  const transferAll = (focusCandidate
    ? shuffled([...maintenanceTransfer, ...buildTransferPool(focusCandidate.skillId, args.gradeLevel, args.skillSummaries)], args.rng)
    : []).map(item => freshFoundationItem(item, args.rng)).filter(item => {
      const key = deriveCardKey(item);
      if (retrievalCards.has(key)) return false;
      if (!configured) return true;
      if (focusCards.has(key) || transferSeen.has(key) || (item.contentSpec?.domain === 'foundation' && item.contentSpec.data.band > highestBand)) return false;
      transferSeen.add(key); return true;
    });
  const allocation = allocateLessonSegments(targetSeconds, { retrieval: retrievalAll.length, focus: focusAll.length, transfer: transferAll.length });
  const selectedCards = new Set<string>(); const plannedIds = new Set<string>(); const planned: PlannedLessonItem[] = [];
  const add = (item: PracticeItem, segment: LessonSegmentKind, rationale: string) => {
    const cardKey = deriveCardKey(item); if (plannedIds.has(item.id) || (configured && selectedCards.has(cardKey)) || (segment === 'retrieval' && selectedCards.has(cardKey))) return;
    const schedulingEligible = !selectedCards.has(cardKey); selectedCards.add(cardKey); plannedIds.add(item.id);
    planned.push({
      item, cardKey, segment, rationale, schedulingEligible,
      selection: {
        origin: segment === 'retrieval' ? 'due_retrieval' : segment === 'focus' ? 'focus_skill' : 'transfer',
        plannerVersion: DAILY_LESSON_PLANNER_VERSION,
        rationaleCodes: [rationale],
        lessonPlanId: `lesson:${args.studentId}:${learnerLocalDateKey(new Date(args.now), args.timezone)}`,
        lessonSegment: segment,
      },
    });
  };
  retrievalAll.slice(0, allocation.retrieval).forEach(item => add(item, 'retrieval', 'This card is genuinely due for retrieval.'));
  focusAll.slice(0, allocation.focus).forEach((item, index) => add(item, 'focus', index === 0 ? 'Activates and builds today’s priority skill.' : 'Builds independent and near-transfer practice.'));
  transferAll.slice(0, allocation.transfer).forEach(item => add(item, 'transfer', 'Applies learned mathematics in a different representation or context.'));
  const warnings: DailyLessonWarning[] = [];
  if (retrievalAll.length < 3) warnings.push({ code: 'sparse_retrieval', message: 'Only genuinely due cards were included; the lesson did not invent extra review.' });
  if (!focusCandidate) warnings.push({ code: 'no_focus', message: 'No focus skill currently has a usable practice catalogue.' });
  if (focusCandidate?.unmetPrerequisites.length) warnings.push({ code: 'unmet_prerequisite', message: `Quick refreshes can help: ${focusCandidate.unmetPrerequisites.map(id => getCurriculumSkill(id)?.title ?? id).join(', ')}. Every skill stays available.` });
  if (mixedDay) warnings.push({ code: 'sparse_transfer', message: 'Today is mixed application: practice introduced skills without starting a new skill.' });
  if (transferAll.length < 3) warnings.push({ code: 'sparse_transfer', message: 'Transfer content is shorter because no unrelated new skill was introduced.' });
  const segmentCounts = { retrieval: planned.filter(value => value.segment === 'retrieval').length, focus: planned.filter(value => value.segment === 'focus').length, transfer: planned.filter(value => value.segment === 'transfer').length };
  const estimatedMinutes = Math.max(1, Math.ceil(planned.reduce((sum, value) => sum + estimateItemSeconds(value.item, args.events), 0) / 60));
  return { id: `lesson:${args.studentId}:${learnerLocalDateKey(new Date(args.now), args.timezone)}`, studentId: args.studentId, generatedAt: args.now, estimatedMinutes, focusSkillId: focusCandidate?.skillId, focusSkillTitle: focusCandidate ? getCurriculumSkill(focusCandidate.skillId)?.title ?? focusCandidate.skillId : undefined, items: planned, segmentCounts, warnings };
}
