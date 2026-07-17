import type { MathAnswerEvent } from '../learning/learningEvents';
import type { Grade3Domain, MasterySkillNode } from '../mastery/grade3MasteryMap';
import { GRADE3_MASTERY_MAP } from '../mastery/grade3MasteryMap';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { planPracticeForSkill } from '../mastery/skillPracticePlanner';
import { makeItemFromId as defaultMakeItemFromId } from '../curriculum/makeItemFromId';
import type { PracticeItem, SessionConfig, StudentItemState } from '../../types/math';
import { mulberry32, shuffled, type Rng } from '../../utils/rng';
import { deriveCardKey } from '../scheduler/cardModel';
import { compareEventsChronologically } from '../learning/eventOrdering';

export type AdaptiveGoalEvaluationPhase = 'screening' | 'adaptive_probe' | 'confirmation';

export interface AdaptiveGoalEvaluationResponse {
  itemId: string;
  isCorrect: boolean;
  latencyMs?: number;
  answeredAt?: string;
  skillId?: string;
}

export interface AdaptiveGoalEvaluationItem {
  item: PracticeItem;
  skillId: string;
  domain: Grade3Domain;
  schemaKey: string;
  representation: EvaluationRepresentation;
}

export interface AdaptiveGoalSkillEvidence {
  skillId: string;
  domain: Grade3Domain;
  alpha: number;
  beta: number;
  mean: number;
  variance: number;
  uncertainty: number;
  historicalWeight: number;
  historicalCorrectWeight: number;
  evaluationAttempts: number;
  evaluationCorrect: number;
  evaluationIncorrect: number;
}

export interface AdaptiveGoalEvaluationSelection {
  questionNumber: number;
  phase: AdaptiveGoalEvaluationPhase;
  item: PracticeItem;
  skillId: string;
  domain: Grade3Domain;
  evidence: AdaptiveGoalSkillEvidence[];
  topCandidates: GoalEvaluationCandidate[];
  rationale: string;
  cardKey: string;
  schedulingEligible: boolean;
  schedulingReason: 'first_card_evidence' | 'same_evaluation_template_repeat';
}

export interface GoalEvaluationCandidate {
  skillId: string;
  domain: Grade3Domain;
  score: number;
  mean: number;
  uncertainty: number;
  reason: 'strengthen' | 'confirm' | 'ready_next';
}

export interface AdaptiveGoalEvaluationResult {
  evidence: AdaptiveGoalSkillEvidence[];
  topGoalCandidates: GoalEvaluationCandidate[];
  strengths: GoalEvaluationCandidate[];
  skillsToStrengthen: GoalEvaluationCandidate[];
  skillsReadyToLearnNext: GoalEvaluationCandidate[];
}

export interface AdaptiveGoalEvaluationArgs {
  studentId: string;
  seed: number;
  now: string;
  mathAnswerEvents: MathAnswerEvent[];
  itemStates: StudentItemState[];
  responses: AdaptiveGoalEvaluationResponse[];
  currentEvaluationId?: string;
  scheduledCardKeys?: string[];
  skillGraph?: readonly MasterySkillNode[];
  makeItemFromId?: (itemId: string) => PracticeItem | null;
  itemPoolForSkill?: (skillId: string) => SessionConfig;
}

export type EvaluationRepresentation = 'conceptual' | 'visual' | 'symbolic' | 'word';

export interface EvaluationSelectionHistory {
  usedItemIds: Set<string>;
  selectedSchemaKeys: Set<string>;
  selectedRepresentations: Set<EvaluationRepresentation>;
  selectedDomains: Grade3Domain[];
}

interface SkillCatalogue {
  skill: MasterySkillNode;
  items: AdaptiveGoalEvaluationItem[];
}

const QUESTION_COUNT = 30;
const SCREENING_COUNT = 10;
const ADAPTIVE_COUNT = 24;
const CONFIRMATION_COUNT = 6;
const HISTORICAL_PRIOR_CAP = 8;
const PRIOR_ALPHA = 2;
const PRIOR_BETA = 2;
const HISTORY_DECAY = 0.85;
const DOMAIN_ORDER: Grade3Domain[] = [
  'multiplication',
  'division',
  'fractions',
  'area_perimeter',
  'geometry',
  'addition_subtraction',
  'measurement_data',
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rngFor(args: AdaptiveGoalEvaluationArgs, salt: string): Rng {
  const path = args.responses
    .map(response => `${response.itemId}:${response.isCorrect ? 1 : 0}`)
    .join('|');
  return mulberry32((args.seed ^ hashString(`${salt}:${path}`)) >>> 0);
}

function directFirstAttempt(event: MathAnswerEvent): boolean {
  return !event.isRetry && !event.relatedEvidence;
}

export function isHistoricalGoalEvaluationPriorEvent(event: MathAnswerEvent, currentEvaluationId?: string): boolean {
  return directFirstAttempt(event)
    && !(currentEvaluationId && event.mode === 'goal_evaluation' && event.sessionId === currentEvaluationId);
}

function schemaKey(item: PracticeItem): string {
  return item.schemaId ?? item.tags.find(tag => tag.startsWith('schema:')) ?? item.itemType;
}

function representation(item: PracticeItem): EvaluationRepresentation {
  if (item.itemType === 'word_problem' || item.itemType === 'measurement_word') return 'word';
  if (item.visualModelType && item.visualModelType !== 'none') return 'visual';
  if (
    item.itemType === 'area_unit_squares' ||
    item.itemType === 'geometry_vocabulary' ||
    item.itemType === 'bar_graph_read' ||
    item.itemType === 'line_plot_read'
  ) return 'conceptual';
  return 'symbolic';
}

function buildCatalogue(args: AdaptiveGoalEvaluationArgs): SkillCatalogue[] {
  const graph = args.skillGraph ?? GRADE3_MASTERY_MAP;
  const makeItem = args.makeItemFromId ?? defaultMakeItemFromId;
  const poolForSkill = args.itemPoolForSkill ?? ((skillId: string) => planPracticeForSkill(skillId, { sessionLength: 40 }));

  return graph.map(skill => {
    const ids = poolForSkill(skill.id).specificItemIds ?? [];
    const seen = new Set<string>();
    const items: AdaptiveGoalEvaluationItem[] = [];
    for (const itemId of ids) {
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      const item = makeItem(itemId);
      if (!item) continue;
      const inferredSkillId = inferGrade3SkillId(item);
      if (inferredSkillId && inferredSkillId !== skill.id) continue;
      items.push({
        item,
        skillId: skill.id,
        domain: skill.domain,
        schemaKey: schemaKey(item),
        representation: representation(item),
      });
    }
    return { skill, items };
  });
}

function itemLookup(catalogue: SkillCatalogue[]): Map<string, AdaptiveGoalEvaluationItem> {
  const map = new Map<string, AdaptiveGoalEvaluationItem>();
  for (const skillPool of catalogue) {
    for (const item of skillPool.items) map.set(item.item.id, item);
  }
  return map;
}

export function buildSelectionHistory(
  responses: AdaptiveGoalEvaluationResponse[],
  lookup: Map<string, AdaptiveGoalEvaluationItem>,
): EvaluationSelectionHistory {
  const selected = responses
    .map(response => lookup.get(response.itemId))
    .filter((item): item is AdaptiveGoalEvaluationItem => Boolean(item));
  return {
    usedItemIds: new Set(responses.map(response => response.itemId)),
    selectedSchemaKeys: new Set(selected.map(item => item.schemaKey)),
    selectedRepresentations: new Set(selected.map(item => item.representation)),
    selectedDomains: selected.map(item => item.domain),
  };
}

export function validateAdaptiveGoalEvaluationCatalogue(args: Omit<AdaptiveGoalEvaluationArgs, 'responses'>): string[] {
  const catalogue = buildCatalogue({ ...args, responses: [] });
  const problems: string[] = [];
  for (const { skill, items } of catalogue) {
    if (items.length === 0) problems.push(`${skill.id} has no resolved evaluation items`);
  }
  for (const domain of DOMAIN_ORDER) {
    if (!catalogue.some(pool => pool.skill.domain === domain && pool.items.length > 0)) {
      problems.push(`${domain} has no resolved evaluation items`);
    }
  }
  if (catalogue.reduce((sum, pool) => sum + pool.items.length, 0) < QUESTION_COUNT) {
    problems.push('fewer than 30 resolved evaluation items are available');
  }
  return problems;
}

function historicalEvidence(
  args: AdaptiveGoalEvaluationArgs,
  catalogue: SkillCatalogue[],
): Map<string, { correctWeight: number; totalWeight: number }> {
  const makeItem = args.makeItemFromId ?? defaultMakeItemFromId;
  const skillIds = new Set(catalogue.map(pool => pool.skill.id));
  const bySkill = new Map<string, MathAnswerEvent[]>();
  for (const event of args.mathAnswerEvents) {
    if (event.studentId !== args.studentId || !isHistoricalGoalEvaluationPriorEvent(event, args.currentEvaluationId)) continue;
    const item = makeItem(event.itemId);
    if (!item) continue;
    const skillId = inferGrade3SkillId(item);
    if (!skillId || !skillIds.has(skillId)) continue;
    const list = bySkill.get(skillId) ?? [];
    list.push(event);
    bySkill.set(skillId, list);
  }

  const result = new Map<string, { correctWeight: number; totalWeight: number }>();
  for (const [skillId, events] of bySkill) {
    const sorted = events.sort((a, b) => compareEventsChronologically(b, a));
    let correctWeight = 0;
    let totalWeight = 0;
    sorted.forEach((event, index) => {
      const weight = Math.pow(HISTORY_DECAY, index);
      totalWeight += weight;
      if (event.isCorrect) correctWeight += weight;
    });
    const scale = totalWeight > HISTORICAL_PRIOR_CAP ? HISTORICAL_PRIOR_CAP / totalWeight : 1;
    result.set(skillId, {
      correctWeight: correctWeight * scale,
      totalWeight: totalWeight * scale,
    });
  }
  return result;
}

export function buildAdaptiveGoalSkillEvidence(args: AdaptiveGoalEvaluationArgs): AdaptiveGoalSkillEvidence[] {
  const catalogue = buildCatalogue(args);
  const lookup = itemLookup(catalogue);
  const history = historicalEvidence(args, catalogue);
  const bySkill = new Map<string, AdaptiveGoalSkillEvidence>();

  for (const { skill } of catalogue) {
    const historical = history.get(skill.id) ?? { correctWeight: 0, totalWeight: 0 };
    const alpha = PRIOR_ALPHA + historical.correctWeight;
    const beta = PRIOR_BETA + historical.totalWeight - historical.correctWeight;
    bySkill.set(skill.id, {
      skillId: skill.id,
      domain: skill.domain,
      alpha,
      beta,
      mean: alpha / (alpha + beta),
      variance: (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1)),
      uncertainty: 0,
      historicalWeight: historical.totalWeight,
      historicalCorrectWeight: historical.correctWeight,
      evaluationAttempts: 0,
      evaluationCorrect: 0,
      evaluationIncorrect: 0,
    });
  }

  for (const response of args.responses) {
    const selected = lookup.get(response.itemId);
    const skillId = response.skillId ?? selected?.skillId;
    if (!skillId) continue;
    const evidence = bySkill.get(skillId);
    if (!evidence) continue;
    evidence.evaluationAttempts += 1;
    if (response.isCorrect) {
      evidence.alpha += 1;
      evidence.evaluationCorrect += 1;
    } else {
      evidence.beta += 1;
      evidence.evaluationIncorrect += 1;
    }
  }

  for (const evidence of bySkill.values()) {
    const total = evidence.alpha + evidence.beta;
    evidence.mean = evidence.alpha / total;
    evidence.variance = (evidence.alpha * evidence.beta) / (Math.pow(total, 2) * (total + 1));
  }
  const maxVariance = Math.max(...Array.from(bySkill.values(), evidence => evidence.variance), 0.0001);
  for (const evidence of bySkill.values()) {
    evidence.uncertainty = evidence.variance / maxVariance;
  }
  return Array.from(bySkill.values());
}

function selectedDomains(args: AdaptiveGoalEvaluationArgs, lookup: Map<string, AdaptiveGoalEvaluationItem>): Grade3Domain[] {
  return buildSelectionHistory(args.responses, lookup).selectedDomains;
}

function wouldBreakConsecutiveDomain(args: AdaptiveGoalEvaluationArgs, domain: Grade3Domain, lookup: Map<string, AdaptiveGoalEvaluationItem>): boolean {
  const domains = selectedDomains(args, lookup);
  if (domains.length < 2) return false;
  return domains[domains.length - 1] === domain && domains[domains.length - 2] === domain;
}

function screeningDomainSequence(args: AdaptiveGoalEvaluationArgs): Grade3Domain[] {
  const rng = mulberry32((args.seed ^ hashString('screening-domains')) >>> 0);
  const base = shuffled(DOMAIN_ORDER, rng);
  const extras = shuffled(DOMAIN_ORDER, rng).slice(0, SCREENING_COUNT - DOMAIN_ORDER.length);
  const sequence = [...base, ...extras];
  for (let i = 2; i < sequence.length; i++) {
    if (sequence[i] !== sequence[i - 1] || sequence[i] !== sequence[i - 2]) continue;
    const swapIndex = sequence.findIndex((domain, index) => index > i && domain !== sequence[i]);
    if (swapIndex > i) [sequence[i], sequence[swapIndex]] = [sequence[swapIndex], sequence[i]];
  }
  return sequence;
}

function dependentSkillIds(skillId: string, graph: readonly MasterySkillNode[]): string[] {
  return graph.filter(skill => skill.prerequisites.includes(skillId)).map(skill => skill.id);
}

function topCandidates(evidence: AdaptiveGoalSkillEvidence[], graph: readonly MasterySkillNode[]): GoalEvaluationCandidate[] {
  const evidenceBySkill = new Map(evidence.map(item => [item.skillId, item]));
  return evidence.map(item => {
    const skill = graph.find(node => node.id === item.skillId);
    const prereqs = skill?.prerequisites ?? [];
    const prereqReady = prereqs.length === 0 || prereqs.every(id => {
      const prereq = evidenceBySkill.get(id);
      return prereq && prereq.mean >= 0.72;
    });
    const strengthen = item.mean < 0.68 || item.evaluationIncorrect > 0;
    const readyNext = item.evaluationAttempts === 0 && prereqReady;
    const reason: GoalEvaluationCandidate['reason'] = readyNext ? 'ready_next' : strengthen ? 'strengthen' : 'confirm';
    const score =
      item.uncertainty * 1.25 +
      (1 - item.mean) * (strengthen ? 1.1 : 0.5) +
      (readyNext ? 0.35 : 0) +
      Math.min(0.25, item.evaluationAttempts * 0.05);
    return {
      skillId: item.skillId,
      domain: item.domain,
      score,
      mean: item.mean,
      uncertainty: item.uncertainty,
      reason,
    };
  }).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.skillId.localeCompare(b.skillId);
  });
}

export function itemScore(
  candidate: AdaptiveGoalEvaluationItem,
  evidence: AdaptiveGoalSkillEvidence,
  history: EvaluationSelectionHistory,
  rng: Rng,
): number {
  const targetDifficulty = evidence.mean >= 0.72 ? 0.75 : evidence.mean <= 0.45 ? 0.35 : 0.55;
  const difficultyFit = 1 - Math.min(1, Math.abs(candidate.item.difficulty - targetDifficulty));
  const schemaNovelty = history.selectedSchemaKeys.has(candidate.schemaKey) ? -0.2 : 0.15;
  const representationNovelty = history.selectedRepresentations.has(candidate.representation) ? 0 : 0.08;
  return difficultyFit + schemaNovelty + representationNovelty + rng() * 0.0001;
}

function selectFromSkills(
  args: AdaptiveGoalEvaluationArgs,
  catalogue: SkillCatalogue[],
  evidence: AdaptiveGoalSkillEvidence[],
  skillIds: string[],
  rationale: string,
): AdaptiveGoalEvaluationSelection {
  const lookup = itemLookup(catalogue);
  const history = buildSelectionHistory(args.responses, lookup);
  const scheduledCards = new Set(args.scheduledCardKeys ?? []);
  const rng = rngFor(args, `item:${rationale}:${skillIds.join('|')}`);
  const evidenceBySkill = new Map(evidence.map(item => [item.skillId, item]));
  const skillSet = new Set(skillIds);
  let eligible = catalogue
    .filter(pool => skillSet.has(pool.skill.id))
    .flatMap(pool => pool.items)
    .filter(item => !history.usedItemIds.has(item.item.id))
    .filter(item => !wouldBreakConsecutiveDomain(args, item.domain, lookup));

  if (eligible.length === 0) {
    eligible = catalogue
      .flatMap(pool => pool.items)
      .filter(item => !history.usedItemIds.has(item.item.id))
      .filter(item => !wouldBreakConsecutiveDomain(args, item.domain, lookup));
  }

  if (eligible.length === 0) {
    throw new Error('Adaptive Goal Evaluation cannot select another resolved, non-repeated item with the current catalogue constraints.');
  }

  const scored = eligible
    .slice()
    .sort((a, b) => a.item.id.localeCompare(b.item.id))
    .map(candidate => ({
      candidate,
      freshCard: scheduledCards.has(deriveCardKey(candidate.item)) ? 0 : 1,
      score: itemScore(candidate, evidenceBySkill.get(candidate.skillId)!, history, rng),
    }))
    .sort((a, b) => {
      if (b.freshCard !== a.freshCard) return b.freshCard - a.freshCard;
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.item.id.localeCompare(b.candidate.item.id);
    });

  const selected = scored[0].candidate;
  const cardKey = deriveCardKey(selected.item);
  const schedulingEligible = !scheduledCards.has(cardKey);
  return {
    questionNumber: args.responses.length + 1,
    phase: args.responses.length < SCREENING_COUNT
      ? 'screening'
      : args.responses.length < ADAPTIVE_COUNT
        ? 'adaptive_probe'
        : 'confirmation',
    item: selected.item,
    skillId: selected.skillId,
    domain: selected.domain,
    evidence,
    topCandidates: topCandidates(evidence, args.skillGraph ?? GRADE3_MASTERY_MAP),
    rationale,
    cardKey,
    schedulingEligible,
    schedulingReason: schedulingEligible ? 'first_card_evidence' : 'same_evaluation_template_repeat',
  };
}

function selectScreening(args: AdaptiveGoalEvaluationArgs, catalogue: SkillCatalogue[], evidence: AdaptiveGoalSkillEvidence[]): AdaptiveGoalEvaluationSelection {
  const targetDomain = screeningDomainSequence(args)[args.responses.length];
  const skills = catalogue
    .filter(pool => pool.skill.domain === targetDomain && pool.items.length > 0)
    .map(pool => pool.skill.id);
  return selectFromSkills(args, catalogue, evidence, skills, `screen ${targetDomain}`);
}

function selectAdaptiveProbe(args: AdaptiveGoalEvaluationArgs, catalogue: SkillCatalogue[], evidence: AdaptiveGoalSkillEvidence[]): AdaptiveGoalEvaluationSelection {
  const graph = args.skillGraph ?? GRADE3_MASTERY_MAP;
  const lookup = itemLookup(catalogue);
  const last = args.responses[args.responses.length - 1];
  const lastSkill = last ? (last.skillId ?? lookup.get(last.itemId)?.skillId) : null;
  const evidenceBySkill = new Map(evidence.map(item => [item.skillId, item]));
  const domainCounts = selectedDomains(args, lookup).reduce((map, domain) => {
    map.set(domain, (map.get(domain) ?? 0) + 1);
    return map;
  }, new Map<Grade3Domain, number>());

  let preferredSkillIds: string[] = [];
  if (lastSkill && last?.isCorrect) {
    preferredSkillIds = [...dependentSkillIds(lastSkill, graph), lastSkill];
  } else if (lastSkill && last && !last.isCorrect) {
    const skill = graph.find(node => node.id === lastSkill);
    preferredSkillIds = [...(skill?.prerequisites ?? []), lastSkill];
  }

  const ranked = catalogue
    .filter(pool => pool.items.length > 0)
    .map(pool => {
      const skillEvidence = evidenceBySkill.get(pool.skill.id)!;
      const preferred = preferredSkillIds.includes(pool.skill.id) ? 2 : 0;
      const domainPenalty = Math.max(0, (domainCounts.get(pool.skill.domain) ?? 0) - 3) * 0.12;
      return {
        skillId: pool.skill.id,
        score: skillEvidence.uncertainty + (1 - skillEvidence.mean) * 0.35 + preferred - domainPenalty,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.skillId.localeCompare(b.skillId);
    });

  return selectFromSkills(
    args,
    catalogue,
    evidence,
    preferredSkillIds.length > 0 ? preferredSkillIds : ranked.slice(0, 5).map(item => item.skillId),
    last?.isCorrect ? 'advance after correct response' : 'probe prerequisite or alternate representation',
  );
}

function selectConfirmation(args: AdaptiveGoalEvaluationArgs, catalogue: SkillCatalogue[], evidence: AdaptiveGoalSkillEvidence[]): AdaptiveGoalEvaluationSelection {
  const graph = args.skillGraph ?? GRADE3_MASTERY_MAP;
  const frozenEvidence = buildAdaptiveGoalSkillEvidence({
    ...args,
    responses: args.responses.slice(0, ADAPTIVE_COUNT),
  });
  const seenDomains = new Set<Grade3Domain>();
  const distinctDomainCandidates: GoalEvaluationCandidate[] = [];
  for (const candidate of topCandidates(frozenEvidence, graph)) {
    if (seenDomains.has(candidate.domain)) continue;
    seenDomains.add(candidate.domain);
    distinctDomainCandidates.push(candidate);
    if (distinctDomainCandidates.length === 3) break;
  }
  const candidates = distinctDomainCandidates.length >= 3
    ? distinctDomainCandidates
    : topCandidates(frozenEvidence, graph).slice(0, 3);
  if (candidates.length < 3) {
    throw new Error('Adaptive Goal Evaluation needs at least three goal candidates for confirmation.');
  }
  const domainsBeforeConfirmation = selectedDomains({
    ...args,
    responses: args.responses.slice(0, ADAPTIVE_COUNT),
  }, itemLookup(catalogue));
  const domainBeforeConfirmation = domainsBeforeConfirmation[domainsBeforeConfirmation.length - 1];
  if (domainBeforeConfirmation && candidates[0].domain === domainBeforeConfirmation) {
    const swapIndex = candidates.findIndex(candidate => candidate.domain !== domainBeforeConfirmation);
    if (swapIndex > 0) [candidates[0], candidates[swapIndex]] = [candidates[swapIndex], candidates[0]];
  }
  const confirmationIndex = args.responses.length - ADAPTIVE_COUNT;
  const candidate = candidates[Math.floor(confirmationIndex / 2)];
  return selectFromSkills(args, catalogue, evidence, [candidate.skillId], `confirm ${candidate.skillId}`);
}

export function selectNextAdaptiveGoalEvaluationItem(
  args: AdaptiveGoalEvaluationArgs,
): AdaptiveGoalEvaluationSelection | null {
  if (args.responses.length >= QUESTION_COUNT) return null;
  const problems = validateAdaptiveGoalEvaluationCatalogue(args);
  if (problems.length > 0) {
    throw new Error(`Adaptive Goal Evaluation catalogue is incomplete: ${problems.join('; ')}`);
  }
  const catalogue = buildCatalogue(args);
  const evidence = buildAdaptiveGoalSkillEvidence(args);
  if (args.responses.length < SCREENING_COUNT) return selectScreening(args, catalogue, evidence);
  if (args.responses.length < ADAPTIVE_COUNT) return selectAdaptiveProbe(args, catalogue, evidence);
  return selectConfirmation(args, catalogue, evidence);
}

export function planFullAdaptiveGoalEvaluation(
  args: Omit<AdaptiveGoalEvaluationArgs, 'responses'> & {
    responseStrategy?: (selection: AdaptiveGoalEvaluationSelection) => boolean;
  },
): AdaptiveGoalEvaluationSelection[] {
  const selections: AdaptiveGoalEvaluationSelection[] = [];
  const responses: AdaptiveGoalEvaluationResponse[] = [];
  const scheduledCardKeys: string[] = [];
  for (let i = 0; i < QUESTION_COUNT; i++) {
    const selection = selectNextAdaptiveGoalEvaluationItem({ ...args, responses, scheduledCardKeys });
    if (!selection) break;
    selections.push(selection);
    if (selection.schedulingEligible) scheduledCardKeys.push(selection.cardKey);
    responses.push({
      itemId: selection.item.id,
      skillId: selection.skillId,
      isCorrect: args.responseStrategy?.(selection) ?? true,
    });
  }
  if (selections.length !== QUESTION_COUNT) {
    throw new Error(`Adaptive Goal Evaluation planned ${selections.length} questions instead of ${QUESTION_COUNT}.`);
  }
  return selections;
}

export function buildAdaptiveGoalEvaluationResult(args: AdaptiveGoalEvaluationArgs): AdaptiveGoalEvaluationResult {
  const evidence = buildAdaptiveGoalSkillEvidence(args);
  const graph = args.skillGraph ?? GRADE3_MASTERY_MAP;
  const candidates = topCandidates(evidence, graph);
  const strengths = candidates
    .filter(candidate => candidate.mean >= 0.78)
    .sort((a, b) => b.mean - a.mean)
    .slice(0, 5);
  const skillsToStrengthen = candidates
    .filter(candidate => candidate.mean < 0.68 || candidate.reason === 'strengthen')
    .slice(0, 8);
  const skillsReadyToLearnNext = candidates
    .filter(candidate => candidate.reason === 'ready_next')
    .slice(0, 5);
  return {
    evidence,
    topGoalCandidates: candidates.slice(0, 3),
    strengths,
    skillsToStrengthen,
    skillsReadyToLearnNext,
  };
}

export const ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT = QUESTION_COUNT;
export const ADAPTIVE_GOAL_EVALUATION_CONFIRMATION_COUNT = CONFIRMATION_COUNT;
export const ADAPTIVE_GOAL_EVALUATION_HISTORICAL_PRIOR_CAP = HISTORICAL_PRIOR_CAP;
