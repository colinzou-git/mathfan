import type { PracticeItem, StudentItemState } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { getCurriculumSkill } from '../curriculum/curriculumRegistry';
import { learnerLocalDateKey } from '../time/localDate';
import type { StudentSkillSummary } from './skillMasteryEngine';

export function independentLearningEvidence(event: MathAnswerEvent): boolean {
  return !event.isRetry && !event.hintUsed && !event.relatedEvidence
    && event.schedulingKind !== 'relearning_step' && event.mode !== 'diagnostic' && event.mode !== 'goal_evaluation'
    && (!event.schedulingTelemetry || event.schedulingTelemetry.supportLevel === 'independent');
}
/** Skill-level hypotheses aggregate across different schema cards and replay from canonical events. */
export function deriveCurriculumMisconceptions(events: MathAnswerEvent[], items: Map<string, PracticeItem>, timezone: string): Array<{ code: string; status: 'suspected' | 'confirmed' | 'resolved' }> {
  const hypotheses = new Map<string, { wrongItems: Set<string>; wrongSchemas: Set<string>; lastWrong: string; successDays: Set<string>; successSessions: Set<string> }>();
  for (const event of [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (!independentLearningEvidence(event)) continue;
    const item = items.get(event.itemId), spec = item?.contentSpec;
    if (spec?.domain !== 'foundation') continue;
    if (!event.isCorrect) {
      const codes = event.detectedMisconceptions ?? [spec.data.misconceptionAnswers[String(event.studentAnswer)]].filter(Boolean);
      for (const code of codes) {
        const prior = hypotheses.get(code) ?? { wrongItems: new Set<string>(), wrongSchemas: new Set<string>(), lastWrong: '', successDays: new Set<string>(), successSessions: new Set<string>() };
        prior.wrongItems.add(event.itemId); prior.wrongSchemas.add(item?.schemaId ?? ''); prior.lastWrong = event.createdAt;
        prior.successDays.clear(); prior.successSessions.clear(); hypotheses.set(code, prior);
      }
    } else {
      const targets = new Set(Object.values(spec.data.misconceptionAnswers));
      for (const [code, hypothesis] of hypotheses) {
        if (!targets.has(code) || Date.parse(event.createdAt) - Date.parse(hypothesis.lastWrong) < 86400000) continue;
        hypothesis.successDays.add(learnerLocalDateKey(new Date(event.createdAt), timezone)); hypothesis.successSessions.add(event.sessionId);
      }
    }
  }
  return [...hypotheses].map(([code, value]) => ({ code, status: value.successDays.size >= 2 && value.successSessions.size >= 2 ? 'resolved' : value.wrongItems.size >= 2 && value.wrongSchemas.size >= 2 ? 'confirmed' : 'suspected' }));
}
export function deriveConfiguredSkillSummary(args: {
  skillId: string; studentId: string; events: MathAnswerEvent[]; items: Map<string, PracticeItem>;
  states: StudentItemState[]; now: string; timezone: string;
}): StudentSkillSummary {
  const node = getCurriculumSkill(args.skillId), profile = node?.evidenceProfile;
  if (!profile) throw new Error(`Missing evidence profile: ${args.skillId}`);
  const unique = new Map(args.events.map(event => [event.id, event]));
  const all = [...unique.values()].filter(event => event.studentId === args.studentId
    && event.createdAt <= args.now && Number.isFinite(Date.parse(event.createdAt))
    && args.items.get(event.itemId)?.skillId === args.skillId && !event.relatedEvidence)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const direct = all.filter(independentLearningEvidence);
  const recent = direct.slice(-profile.recentWindow), successful = direct.filter(event => event.isCorrect);
  const correctCount = direct.filter(event => event.isCorrect).length;
  const accuracy = recent.length ? recent.filter(event => event.isCorrect).length / recent.length : 0;
  const distinct = new Set(successful.map(event => event.itemId));
  const representations = new Set(successful.map(event => args.items.get(event.itemId)?.representationId));
  const schemas = new Set(successful.map(event => args.items.get(event.itemId)?.schemaId));
  const sessions = new Set(successful.map(event => event.sessionId));
  const first = direct[0];
  const delayedDays = new Set(successful.filter(event => first && event.sessionId !== first.sessionId
    && Date.parse(event.createdAt) - Date.parse(first.createdAt) >= 86400000)
    .map(event => learnerLocalDateKey(new Date(event.createdAt), args.timezone)));
  const forms = new Set(successful.map(event => {
    const spec = args.items.get(event.itemId)?.contentSpec; return spec?.domain === 'foundation' ? spec.data.form : undefined;
  }));
  const specs = successful.flatMap(event => { const spec = args.items.get(event.itemId)?.contentSpec; return spec?.domain === 'foundation' ? [spec.data] : []; });
  const bands = new Set(specs.map(spec => spec.band));
  const contexts = new Set(specs.map(spec => spec.contextFamily).filter(Boolean));
  const misconceptions = deriveCurriculumMisconceptions(all, args.items, args.timezone);
  const blocked = misconceptions.some(value => value.status === 'confirmed');
  const mastered = recent.length >= profile.minIndependent && distinct.size >= profile.minDistinct
    && representations.size >= profile.minRepresentations && schemas.size >= profile.minSchemas
    && sessions.size >= profile.minSessions && delayedDays.size >= profile.minDelayedDays
    && accuracy >= profile.minAccuracy && recent.slice(-3).every(event => event.isCorrect)
    && bands.size >= profile.minBands && contexts.size >= profile.minContextFamilies
    && profile.requiredForms.every(form => forms.has(form)) && !blocked;
  const learningState = direct.length === 0 ? 'new' : accuracy < .6 || blocked ? 'needs_practice' : mastered ? 'mastered' : 'strong';
  const states = args.states.filter(state => state.studentId === args.studentId && (state.skillId === args.skillId || args.items.get(state.lastItemId ?? '')?.skillId === args.skillId));
  const dueItemCount = new Set(states.filter(state => state.nextDueAt && state.nextDueAt <= args.now).map(state => state.cardKey)).size;
  return { skillId: args.skillId, studentId: args.studentId, status: learningState,
    learningState, reviewState: dueItemCount ? 'due' : states.length ? 'scheduled' : 'unintroduced',
    recommendationState: blocked ? 'remediate' : dueItemCount ? 'review' : mastered ? 'transfer' : direct.length ? 'continue' : 'start',
    attemptCount: direct.length, correctCount, accuracy, lifetimeAccuracy: direct.length ? correctCount / direct.length : 0,
    dueItemCount, itemCount: new Set(direct.map(event => event.itemId)).size,
    mistakePatterns: misconceptions.filter(value => value.status === 'confirmed').map(value => value.code),
    evidenceGaps: [!mastered && delayedDays.size < profile.minDelayedDays ? 'Independent successes on two later days' : '',
      bands.size < profile.minBands ? 'Practice across three difficulty bands' : '',
      contexts.size < profile.minContextFamilies ? 'Transfer in two different contexts' : '',
      ...profile.requiredForms.filter(form => !forms.has(form)).map(form => `${form} evidence`)].filter(Boolean),
    provisionalPlacement: all.some(event => event.mode === 'diagnostic' && event.isCorrect),
  };
}
