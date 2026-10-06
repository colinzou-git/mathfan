import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CURRICULA, FOUNDATION_FORMS, GRADE4_SKILLS, getCurriculum, validateCurriculumRegistry } from '../features/curriculum/curriculumRegistry';
import { factorPairs, foundationItemIds, freshFoundationItem, makeFoundationItem, numberName } from '../features/curriculum/foundationItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { validatePracticeItem } from '../features/curriculum/practiceContentSpec';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { deriveCurriculumSkillSummaries } from '../features/mastery/skillMasteryEngine';
import { deriveCurriculumMisconceptions } from '../features/mastery/curriculumEvidence';
import { checkAnswer } from '../features/practice/answerChecker';
import { VisualModel } from '../features/visuals/VisualModel';
import { NumPad } from '../components/NumPad';
import { fireEvent } from '@testing-library/react';
import { deriveLearningUnitProgress } from '../features/learning/learningUnitProgress';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { planDailyLesson } from '../features/learningPlan/dailyLessonPlanner';
import { buildDailyReviewQueue } from '../features/scheduler/dailyReviewQueue';
import { resolveCanonicalReviewCards } from '../features/scheduler/dailyReviewCandidates';
import { createInitialState } from '../features/scheduler/scheduler';
import { buildReadinessPlan, readinessRecommendations } from '../features/diagnosis/readinessPlanner';
import { buildDiagnosticAnswerProposal } from '../features/diagnosis/diagnosticAnswerProposal';
import { replayCardEvents } from '../features/learning/eventRebuild';
import { mulberry32 } from '../utils/rng';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { PracticeItem } from '../types/math';

function event(item: PracticeItem, index: number, overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return { id: `e-${index}`, studentId: 's', sessionId: `session-${Math.floor(index / 4)}`, itemId: item.id,
    cardKey: item.cardKey, schemaId: item.schemaId, mode: 'practice', promptShown: item.prompt, correctAnswer: item.answer,
    studentAnswer: item.answer, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 90000,
    createdAt: new Date(Date.UTC(2026, 8, 1 + Math.floor(index / 4), 12, index % 4)).toISOString(), ...overrides };
}
function summary(items: PracticeItem[], events: MathAnswerEvent[], due = false) {
  return deriveCurriculumSkillSummaries({ studentId: 's', items, mathAnswerEvents: events,
    itemStates: due ? [{ ...createInitialState('s', items[0]), lastItemId: items[0].id, nextDueAt: '2026-09-01T00:00:00.000Z' }] : [],
    now: '2026-09-20T00:00:00.000Z', timezone: 'America/Los_Angeles' }).find(value => value.skillId === items[0].skillId)!;
}
function variedItems(skillId: string) {
  return Array.from({ length: 12 }, (_, i) => makeFoundationItem(skillId, FOUNDATION_FORMS[i % 6], (i % 3) as 0 | 1 | 2, 400 + i));
}
const settings = { audioEnabled: false, speechRate: 1, dailyGoalMinutes: 12, sessionLength: 15, autoAdvance: false, theme: 'indigo' as const, allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false };
function lesson(events: MathAnswerEvent[] = [], states: ReturnType<typeof createInitialState>[] = [], focusOnly?: string) {
  const summaries = deriveCurriculumSkillSummaries({ studentId: 's', items: makeItemFromId, mathAnswerEvents: events, itemStates: states, now: '2026-09-20T12:00:00.000Z' })
    .filter(value => !focusOnly || value.skillId.startsWith('g3-') || value.skillId === focusOnly);
  return planDailyLesson({ studentId: 's', gradeLevel: 4, now: '2026-09-20T12:00:00.000Z', timezone: 'America/Los_Angeles', settings, events, itemStates: states, skillSummaries: summaries, goals: [], rng: mulberry32(123) });
}
describe('Grade 4 registered foundation', () => {
  it('registers exactly 13 skills, two units, complete references, and partial 4.OA.3 coverage', () => {
    expect(GRADE4_SKILLS).toHaveLength(13);
    expect(getCurriculum(4)?.units).toHaveLength(2);
    expect(validateCurriculumRegistry()).toEqual([]);
    expect(GRADE4_SKILLS.at(-1)?.partialStandardIds).toEqual(['4.OA.3']);
    for (const node of GRADE4_SKILLS) {
      expect(node.blueprintForms).toEqual(FOUNDATION_FORMS);
      expect(foundationItemIds(node.id)).toHaveLength(72);
    }
  });
  it('rejects duplicate IDs, missing references, and cycles', () => {
    const base = CURRICULA[1], first = base.skills[0];
    expect(validateCurriculumRegistry([{ ...base, skills: [first, first] }])).toContain('Duplicate skill IDs');
    expect(validateCurriculumRegistry([{ ...base, skills: [{ ...first, prerequisites: ['missing'] }] }])).toContain('Unresolved skill: missing');
    expect(validateCurriculumRegistry([{ ...base, skills: [{ ...first, prerequisites: [first.id] }] }])).toContain(`Prerequisite cycle: ${first.id}`);
  });
  for (const skill of GRADE4_SKILLS) it(`checks 1,000 seeded ${skill.id} instances across forms and bands`, () => {
    const representations = new Set<string>(), answers = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const item = makeFoundationItem(skill.id, FOUNDATION_FORMS[seed % 6], (Math.floor(seed / 6) % 3) as 0 | 1 | 2, seed);
      expect(validatePracticeItem(item)).toEqual([]);
      expect(makeItemFromId(item.id)).toEqual(item);
      expect(checkAnswer(item, String(item.answer), 180000).reviewGrade).toBe('good');
      expect(item.explanation).toBeTruthy();
      const spec = item.contentSpec!;
      if (spec.domain !== 'foundation') throw new Error('Wrong content domain');
      const p = spec.data.parameters;
      for (const value of Object.values(p).flat()) expect(value).toBeGreaterThanOrEqual(0);
      expect(Math.max(...Object.values(p).flat())).toBeLessThanOrEqual(1000000);
      if (typeof p.n === 'number' && skill.id.startsWith('g4-oa-')) expect(p.n).toBeLessThanOrEqual(100);
      if (typeof item.answer === 'number' && !item.choices) {
        if (skill.id === 'g4-oa-factor-meaning') expect(Number(spec.data.form === 'verify' ? p.b : p.a) * Number(item.answer)).toBe(p.n);
        if (skill.id === 'g4-oa-factor-pairs') {
          const factors = Array.from({ length: Number(p.n) }, (_, i) => i + 1).filter(value => Number(p.n) % value === 0);
          expect(item.answer).toBe(Math.ceil(factors.length / 2));
        }
        if (skill.id === 'g4-oa-multiples') expect(item.answer).toBe(Number(p.step) * Number(p.count));
        if (skill.id === 'g4-nbt-add-standard') expect(item.answer).toBe(Number(p.a) + Number(p.b));
        if (skill.id === 'g4-nbt-sub-standard') expect(item.answer).toBe(Number(p.a) - Number(p.b));
        if (skill.id === 'g4-nbt-round-any-place') expect(item.answer).toBe(Math.floor((Number(p.n) + Number(p.place) / 2) / Number(p.place)) * Number(p.place));
      }
      if (item.choices) {
        expect(item.choices.filter(value => value === item.answer)).toHaveLength(1);
        expect(new Set(item.choices).size).toBe(item.choices.length);
        for (const wrong of item.choices.filter(value => value !== item.answer)) expect(checkAnswer(item, String(wrong), 1).isCorrect).toBe(false);
      }
      for (const [wrong, code] of Object.entries(spec.data.misconceptionAnswers)) {
        expect(checkAnswer(item, wrong, 1).isCorrect).toBe(false);
        expect(skill.misconceptions).toContain(code);
      }
      representations.add(item.representationId!); answers.add(String(item.answer));
      expect(freshFoundationItem(item, mulberry32(seed + 1)).cardKey).toBe(item.cardKey);
    }
    expect(representations.size).toBeGreaterThanOrEqual(2); expect(answers.size).toBeGreaterThan(2);
  }, 30000);
  it('covers one, perfect squares, a million, and invalid reconstruction', () => {
    expect(factorPairs(1)).toEqual([[1, 1]]); expect(factorPairs(100)).toEqual([[1, 100], [2, 50], [4, 25], [5, 20], [10, 10]]);
    expect(numberName(1000000)).toBe('one million');
    expect(makeItemFromId('G4F1~g4-fake~model~0~1')).toBeNull();
    expect(makeItemFromId('G4F1~g4-oa-multiples~model~0~4294967296')).toBeNull();
  });
});
describe('independent, delayed, and misconception evidence', () => {
  it('keeps future and other-learner evidence out of current mastery', () => {
    const items = variedItems('g4-nbt-ten-times');
    expect(summary(items, items.map((item, i) => event(item, i, { studentId: 'someone-else' }))).learningState).toBe('new');
    expect(summary(items, items.map((item, i) => event(item, i, { createdAt: '2027-01-01T00:00:00.000Z' }))).learningState).toBe('new');
  });
  it('requires procedural bands and independent evidence for template maintenance', () => {
    const items = variedItems('g4-nbt-add-standard');
    const sameBand = items.map(item => { const spec = item.contentSpec!; if (spec.domain !== 'foundation') throw new Error('Missing foundation'); return makeFoundationItem(item.skillId, spec.data.form, 0, spec.data.seed); });
    expect(summary(sameBand, sameBand.map((item, i) => event(item, i))).learningState).not.toBe('mastered');
    expect(summary(items, items.map((item, i) => event(item, i))).learningState).toBe('mastered');
    const item = items[0], hinted = [0, 4, 8].map(i => event(item, i, { hintUsed: true }));
    const state = { ...createInitialState('s', item), masteryLevel: 'mastered' as const, attemptCount: 3, lastItemId: item.id };
    expect(deriveLearningUnitProgress({ items: [item], events: hinted, states: [state] }).get(item.cardKey!)?.status).not.toBe('maintenance');
  });
  it('requires later-day, representation, explanation/check, transfer, and held-out evidence', () => {
    const items = variedItems('g4-nbt-ten-times'), events = items.map((item, i) => event(item, i));
    expect(summary(items, events).learningState).toBe('mastered');
    expect(summary(items, events.map(value => ({ ...value, createdAt: events[0].createdAt, sessionId: 'same' }))).learningState).not.toBe('mastered');
    expect(summary(items, events.filter(value => makeItemFromId(value.itemId)?.contentSpec?.domain === 'foundation' && !value.itemId.includes('~verify~'))).learningState).not.toBe('mastered');
    expect(summary(items, events, true)).toMatchObject({ learningState: 'mastered', status: 'mastered', reviewState: 'due', dueItemCount: 1 });
    const reviews = Array.from({ length: 12 }, (_, i) => makeFoundationItem(items[0].skillId, 'symbolic', 0, 900 + i));
    expect(summary([...items, ...reviews], [...events, ...reviews.map((item, i) => event(item, i + 12))], true).learningState).toBe('mastered');
  });
  for (const override of [{ hintUsed: true }, { isRetry: true }, { mode: 'diagnostic' as const }, { mode: 'goal_evaluation' as const }, { relatedEvidence: true }, { schedulingKind: 'relearning_step' as const }]) it(`excludes ${JSON.stringify(override)} from mastery`, () => {
    const items = variedItems('g4-nbt-ten-times'), events = items.map((item, i) => event(item, i, override));
    expect(summary(items, events).learningState).toBe('new');
  });
  it('uses recent proficiency instead of permanently penalizing early mistakes', () => {
    const items = variedItems('g4-nbt-ten-times');
    const wrong = items.map((item, i) => event(item, i, { id: `old-${i}`, isCorrect: false, createdAt: '2026-08-01T00:00:00.000Z' }));
    const value = summary(items, [...wrong, ...items.map((item, i) => event(item, i))]);
    expect(value).toMatchObject({ learningState: 'mastered', accuracy: 1, lifetimeAccuracy: .5 });
  });
  it('treats one plausible error as suspicion, confirms on a different schema, resolves on two later days', () => {
    const items = [makeFoundationItem('g4-nbt-ten-times', 'symbolic', 0, 1), makeFoundationItem('g4-nbt-ten-times', 'check', 0, 2), makeFoundationItem('g4-nbt-ten-times', 'symbolic', 1, 3), makeFoundationItem('g4-nbt-ten-times', 'check', 1, 4)];
    const map = new Map(items.map(item => [item.id, item]));
    const wrong = items.slice(0, 2).map((item, i) => event(item, i, { isCorrect: false, studentAnswer: Object.keys(item.contentSpec?.domain === 'foundation' ? item.contentSpec.data.misconceptionAnswers : {})[0] }));
    expect(deriveCurriculumMisconceptions(wrong.slice(0, 1), map, 'UTC')[0].status).toBe('suspected');
    expect(deriveCurriculumMisconceptions(wrong, map, 'UTC')[0].status).toBe('confirmed');
    const later = items.slice(2).map((item, i) => event(item, 8 + i * 4));
    expect(deriveCurriculumMisconceptions([...wrong, ...later], map, 'UTC')[0].status).toBe('resolved');
  });
});
describe('readiness, lessons, review, and visuals', () => {
  it('bounds an overdue backlog while supporting weak facts and across-zero bridges', () => {
    const items = foundationItemIds('g4-nbt-sub-standard').map(makeItemFromId).filter((item): item is PracticeItem => !!item);
    const states = items.map(item => ({ ...createInitialState('s', item), lastItemId: item.id, nextDueAt: '2026-09-01T00:00:00.000Z' }));
    const plan = lesson([], states, 'g4-nbt-sub-standard');
    expect(plan.segmentCounts.retrieval).toBeGreaterThan(0); expect(plan.segmentCounts.retrieval).toBeLessThanOrEqual(5);
    expect(plan.items.length).toBeLessThanOrEqual(20);
    expect(new Set(plan.items.map(value => value.cardKey)).size).toBe(plan.items.length);
    expect(plan.warnings.some(value => value.code === 'unmet_prerequisite')).toBe(true);
    expect(plan.items.every(value => value.rationale.length > 10)).toBe(true);
  });
  it('keeps transfer at the learner’s band and stretches after successful independent learning', () => {
    const skill = 'g4-oa-factor-meaning', first = lesson([], [], skill);
    expect(first.segmentCounts.transfer).toBeGreaterThan(0);
    expect(planPracticeForSkill(skill).specificItemIds?.some(id => id.includes('~verify~'))).toBe(false);
    expect(first.items.some(value => value.segment === 'transfer' && value.item.contentSpec?.domain === 'foundation' && value.item.contentSpec.data.form === 'verify')).toBe(true);
    expect(first.items.filter(value => value.item.skillId === skill).every(value => value.item.contentSpec?.domain === 'foundation' && value.item.contentSpec.data.band === 0)).toBe(true);
    const events = variedItems(skill).slice(0, 8).map((item, i) => event(item, i));
    const stretch = lesson(events, [], skill);
    expect(stretch.items.some(value => value.item.contentSpec?.domain === 'foundation' && value.item.contentSpec.data.band > 0)).toBe(true);
  });
  it('supports a million using touch input and labels truncated jump models accurately', () => {
    let entered = '';
    const { rerender } = render(<NumPad value="100000" maxLength={7} onChange={value => { entered = value; }} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(entered).toBe('1000000');
    const item = makeFoundationItem('g4-oa-multiples', 'model', 0, 101);
    rerender(<VisualModel item={item} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/First .* of .* equal jumps/);
  });
  it('bounds adaptive readiness and records observation without scheduling schema or atomic cards', () => {
    const base = buildReadinessPlan('r'); expect(base.items).toHaveLength(20);
    const results = base.items.slice(0, 7).map(item => ({ item, isCorrect: false }));
    expect(buildReadinessPlan('r', results).items).toHaveLength(22);
    expect(readinessRecommendations(results).refreshSkillIds).toHaveLength(7);
    expect(buildReadinessPlan('r', [{ item: base.items[7], isCorrect: false }]).items[8].id).toContain('~check~');
    for (const item of [base.items[0], base.items[7]]) {
      const proposal = buildDiagnosticAnswerProposal({ eventId: item.id, attemptId: item.id, answeredAt: '2026-09-01T12:00:00.000Z', studentId: 's', sessionId: 'r', item, rawInput: String(item.answer), latencyMs: 90000, schedulingEligible: false });
      expect(proposal.event).toMatchObject({ mode: 'diagnostic', schedulingEligible: false, schedulingApplied: false });
      expect(proposal.stateAfter).toBeUndefined();
      expect(replayCardEvents({ studentId: 's', cardKey: deriveCardKey(item), seedItem: item, events: [proposal.event] }).hasDirectEvidence).toBe(false);
    }
  });
  it('uses fresh variants of genuinely due cards and excludes them from focus/transfer', () => {
    const item = makeFoundationItem('g4-oa-factor-meaning', 'model', 0, 55), state = { ...createInitialState('s', item), lastItemId: item.id, nextDueAt: '2026-09-01T12:00:00.000Z' };
    const plan = lesson([], [state]);
    const review = plan.items.find(value => value.segment === 'retrieval')!;
    expect(review.item.id).not.toBe(item.id); expect(review.cardKey).toBe(item.cardKey);
    expect(plan.items.filter(value => value.cardKey === item.cardKey)).toHaveLength(1);
    expect(new Set(plan.items.map(value => value.cardKey)).size).toBe(plan.items.length);
    expect(plan.items.length).toBeLessThanOrEqual(20); expect(plan.warnings.some(warning => warning.code === 'unmet_prerequisite')).toBe(true);
    expect(lesson().segmentCounts.retrieval).toBe(0);
    const queue = buildDailyReviewQueue({ requestedItemIds: [item.id], states: new Map([[state.cardKey, state]]), sessionLength: 1, now: new Date('2026-09-20T12:00:00.000Z'), rng: mulberry32(1) });
    expect(queue[0].itemId).not.toBe(item.id); expect(makeItemFromId(queue[0].itemId)?.cardKey).toBe(item.cardKey);
    expect(resolveCanonicalReviewCards([{ ...state, lastItemId: undefined }]).cards).toHaveLength(1);
  });
  it('uses mixed application on the fifth focus day without introducing a new skill', () => {
    const item = makeFoundationItem('g4-oa-multiples', 'symbolic', 0, 101);
    const events = [1, 2, 3, 4].map((day, i) => event(item, i, { createdAt: `2026-09-0${day}T12:00:00.000Z`, lessonSegment: 'focus' }));
    const plan = lesson(events);
    expect(plan.focusSkillId).toBe(item.skillId);
    expect(plan.items.filter(value => value.segment !== 'retrieval').every(value => value.item.skillId === item.skillId)).toBe(true);
    expect(plan.warnings.some(value => value.message.includes('mixed application'))).toBe(true);
  });
  it('renders scalable place-value and regrouping models without exposing results', () => {
    const item = makeFoundationItem('g4-nbt-ten-times', 'model', 2, 9);
    const { container, rerender } = render(<VisualModel item={item} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/exchange ten/i);
    expect(container.textContent).toContain('?');
    const arithmetic = makeFoundationItem('g4-nbt-sub-standard', 'check', 2, 13);
    rerender(<VisualModel item={arithmetic} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/Result hidden/);
    expect(container.textContent).not.toContain(String(arithmetic.contentSpec?.domain === 'foundation' ? arithmetic.contentSpec.data.parameters.result : 'unavailable'));
    const rounding = makeFoundationItem('g4-nbt-round-any-place', 'check', 0, 103);
    rerender(<VisualModel item={rounding} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/unlabeled bounds/);
    expect(container.textContent).not.toContain(String(rounding.answer));
  });
});
