import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FOUNDATION_FORMS, getCurriculumSkill } from '../features/curriculum/curriculumRegistry';
import { foundationItemIds, makeFoundationItem } from '../features/curriculum/foundationItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { VisualModel } from '../features/visuals/VisualModel';
import { checkAnswer } from '../features/practice/answerChecker';
import { getHint } from '../features/practice/hintEngine';
import { detectMistakes } from '../features/mastery/misconceptionEngine';
import { deriveCurriculumMisconceptions } from '../features/mastery/curriculumEvidence';
import { deriveCurriculumSkillSummaries } from '../features/mastery/skillMasteryEngine';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { planDailyLesson } from '../features/learningPlan/dailyLessonPlanner';
import { createInitialState } from '../features/scheduler/scheduler';
import { buildDailyReviewQueue } from '../features/scheduler/dailyReviewQueue';
import { mulberry32 } from '../utils/rng';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { PracticeItem } from '../types/math';

const skillId = 'g4-oa-mult-compare-meaning';
const now = '2026-10-19T16:00:00.000Z';
const settings = { audioEnabled: false, speechRate: 1, dailyGoalMinutes: 12, sessionLength: 10, autoAdvance: false, theme: 'indigo' as const, allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false };
function event(item: PracticeItem, i: number, overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return { id: `comparison-${i}`, studentId: 's', sessionId: `day-${Math.floor(i / 4)}`, itemId: item.id,
    cardKey: item.cardKey, schemaId: item.schemaId, mode: 'practice', promptShown: item.prompt, correctAnswer: item.answer,
    studentAnswer: item.answer, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 180000,
    createdAt: new Date(Date.UTC(2026, 9, 1 + Math.floor(i / 4), 12, i % 4)).toISOString(), ...overrides };
}
function summary(items: PracticeItem[], events: MathAnswerEvent[]) {
  return deriveCurriculumSkillSummaries({ studentId: 's', items, mathAnswerEvents: events, itemStates: [], now, timezone: 'UTC' }).find(value => value.skillId === skillId)!;
}

describe('Unit 3 first comparison skill: complete learning flow', () => {
  it('connects instruction and all forms to correct comparison meaning', () => {
    expect(getCurriculumSkill(skillId)?.instruction?.model).toContain('reference');
    for (let seed = 0; seed < 1000; seed++) {
      const form = FOUNDATION_FORMS[seed % 6], item = makeFoundationItem(skillId, form, (seed % 3) as 0 | 1 | 2, seed);
      if (item.contentSpec?.domain !== 'foundation') throw new Error('Missing content');
      const p = item.contentSpec.data.parameters;
      expect(p.compared).toBe(Number(p.reference) * Number(p.multiplier));
      if (['model', 'symbolic', 'transfer'].includes(form)) expect(item.answer).toBe(p.compared);
      if (form === 'verify') expect(item.answer).toBe(`${p.compared} is ${p.multiplier} times as many as ${p.reference}`);
      if (form === 'explain') expect(item.answer).toBe(`${p.multiplier} equal groups of ${p.reference}`);
      expect(checkAnswer(item, String(item.answer), 180000).reviewGrade).toBe('good');
      expect(makeItemFromId(item.id)).toEqual(item);
    }
  });
  it('renders tape/table relationships and reveals the value only in a worked example', () => {
    const item = makeFoundationItem(skillId, 'model', 0, 21);
    const { rerender } = render(<VisualModel item={item} />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/Compared quantity: \?/);
    rerender(<VisualModel item={item} revealAnswer />);
    expect(screen.getByRole('img')).toHaveAccessibleName(new RegExp(`Compared quantity: ${item.answer}`));
    rerender(<VisualModel item={makeFoundationItem(skillId, 'explain', 0, 21)} />);
    expect(screen.getByRole('table', { name: 'Quantity relationships' })).toHaveTextContent('Compared quantity?');
  });
  it('recognizes normalized choice misconceptions and resolves them with delayed contrasts', () => {
    const items = ['explain', 'check', 'symbolic', 'transfer'].map((form, i) => makeFoundationItem(skillId, form as typeof FOUNDATION_FORMS[number], 0, 100 + i));
    const wrong = items.slice(0, 2).map((item, i) => {
      const spec = item.contentSpec!; if (spec.domain !== 'foundation') throw new Error('Missing content');
      const input = Object.entries(spec.data.misconceptionAnswers).find(([, code]) => code === 'foundation:times_means_add')![0];
      const checked = checkAnswer(item, input, 100);
      expect(detectMistakes(item, checked.studentAnswer)).toEqual(['foundation:times_means_add']);
      expect(getHint(item, 1)?.text).toBeTruthy();
      return event(item, i, { studentAnswer: checked.studentAnswer, isCorrect: false });
    });
    const map = new Map(items.map(item => [item.id, item]));
    expect(deriveCurriculumMisconceptions(wrong.slice(0, 1), map, 'UTC')[0].status).toBe('suspected');
    expect(deriveCurriculumMisconceptions(wrong, map, 'UTC')[0].status).toBe('confirmed');
    expect(deriveCurriculumMisconceptions([...wrong, event(items[2], 8), event(items[3], 12)], map, 'UTC')[0].status).toBe('resolved');
  });
  it('requires independent, held-out and later-day evidence before mastery', () => {
    const items = Array.from({ length: 12 }, (_, i) => makeFoundationItem(skillId, FOUNDATION_FORMS[i % 6], 0, 900 + i));
    const events = items.map((item, i) => event(item, i));
    expect(summary(items, events).learningState).toBe('mastered');
    expect(summary(items, events.filter(e => !e.itemId.includes('~verify~'))).learningState).not.toBe('mastered');
    expect(summary(items, events.map(e => ({ ...e, createdAt: events[0].createdAt, sessionId: 'one' }))).learningState).not.toBe('mastered');
    for (const flags of [{ hintUsed: true }, { isRetry: true }, { mode: 'diagnostic' as const }, { mode: 'goal_evaluation' as const }]) {
      expect(summary(items, events.map(e => ({ ...e, ...flags }))).learningState).toBe('new');
    }
  });
  it('integrates lesson verification, due/new separation and fresh same-card review', () => {
    const item = makeFoundationItem(skillId, 'model', 0, 101);
    const state = { ...createInitialState('s', item), lastItemId: item.id, nextDueAt: '2026-10-01T00:00:00.000Z' };
    const summaries = deriveCurriculumSkillSummaries({ studentId: 's', items: makeItemFromId, mathAnswerEvents: [], itemStates: [state], now }).filter(value => value.skillId === skillId || value.skillId.startsWith('g3-'));
    const plan = planDailyLesson({ studentId: 's', gradeLevel: 4, now, timezone: 'UTC', settings, events: [], itemStates: [state], skillSummaries: summaries, goals: [], rng: mulberry32(8) });
    expect(plan.focusSkillId).toBe(skillId);
    expect(plan.items.some(entry => entry.segment === 'transfer' && entry.item.id.includes('~verify~'))).toBe(true);
    expect(plan.items.filter(entry => entry.segment !== 'retrieval').every(entry => entry.cardKey !== item.cardKey)).toBe(true);
    expect(new Set(plan.items.map(entry => entry.cardKey)).size).toBe(plan.items.length);
    expect(planPracticeForSkill(skillId).specificItemIds?.every(id => !id.includes('~verify~'))).toBe(true);
    const queue = buildDailyReviewQueue({ requestedItemIds: [item.id], states: new Map([[item.cardKey!, state]]), sessionLength: 1, now: new Date(now), rng: mulberry32(33) });
    expect(queue).toHaveLength(1);
    expect(queue[0].itemId).not.toBe(item.id);
    expect(makeItemFromId(queue[0].itemId)?.cardKey).toBe(item.cardKey);
    expect(foundationItemIds(skillId)).toHaveLength(72);
  });
});
