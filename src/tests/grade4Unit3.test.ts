import { describe, expect, it } from 'vitest';
import { GRADE4_SKILLS, FOUNDATION_FORMS, getCurriculum, validateCurriculumRegistry } from '../features/curriculum/curriculumRegistry';
import { makeFoundationItem, freshFoundationItem } from '../features/curriculum/foundationItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { deriveCurriculumSkillSummaries } from '../features/mastery/skillMasteryEngine';
import { checkAnswer } from '../features/practice/answerChecker';
import { mulberry32 } from '../utils/rng';
import { planDailyNewForGoals } from '../features/goals/dailyNewGoalPlanner';
import { createInitialState } from '../features/scheduler/scheduler';
import type { LearningGoal } from '../features/goals/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

// Independent small arithmetic interpreter for checking generated equation choices.
function evaluate(expression: string, x: number): number {
  const tokens = expression.match(/\d+|x|[()+×÷−]/g) ?? []; let i = 0;
  const atom = (): number => {
    const token = tokens[i++];
    if (token === '(') { const value = sum(); expect(tokens[i++]).toBe(')'); return value; }
    return token === 'x' ? x : Number(token);
  };
  const product = (): number => {
    let value = atom();
    while (tokens[i] === '×' || tokens[i] === '÷') { const op = tokens[i++], right = atom(); value = op === '×' ? value * right : value / right; }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[i] === '+' || tokens[i] === '−') { const op = tokens[i++], right = product(); value = op === '+' ? value + right : value - right; }
    return value;
  };
  const value = sum(); expect(i).toBe(tokens.length); return value;
}
function equationHolds(choice: string | number, x: number) {
  const parts = String(choice).split('=');
  return parts.length === 2 && Math.abs(evaluate(parts[0], x) - evaluate(parts[1], x)) < 1e-9;
}
const skills = GRADE4_SKILLS.filter(skill => skill.unitId === 'g4-u3');

describe('Unit 3 comparison, unknown positions and connected steps', () => {
  it('registers all six skills with complete references and explicit partial 4.OA.3 coverage', () => {
    expect(skills).toHaveLength(6); expect(GRADE4_SKILLS).toHaveLength(19);
    expect(getCurriculum(4)?.version).toBe(2);
    expect(validateCurriculumRegistry()).toEqual([]);
    expect(skills.filter(skill => skill.californiaStandardIds.includes('4.OA.3')).every(skill => skill.partialStandardIds?.includes('4.OA.3'))).toBe(true);
  });
  for (const skill of skills.filter(skill => skill.id !== 'g4-oa-mult-compare-meaning')) it(`checks 1,000 independent mathematical oracles for ${skill.id}`, () => {
    const positions = new Set<string>(), contexts = new Set<string>(), relationships = new Set<number>();
    for (let seed = 0; seed < 1000; seed++) {
      const form = FOUNDATION_FORMS[Math.floor(seed / 8) % 6], band = (Math.floor(seed / 48) % 3) as 0 | 1 | 2;
      const item = makeFoundationItem(skill.id, form, band, seed);
      if (item.contentSpec?.domain !== 'foundation') throw new Error('Missing content');
      const spec = item.contentSpec.data, p = spec.parameters;
      const a = Number(p.reference), m = Number(p.multiplier), compared = Number(p.compared), total = Number(p.total), e = Number(p.change);
      let expected: number;
      if (skill.id.includes('multistep')) {
        expect(total).toBe(a * m + (p.subtractChange ? -e : e));
        expected = spec.unknownPosition === 'result' ? a * m + (p.subtractChange ? -e : e)
          : spec.unknownPosition === 'reference' ? (total + (p.subtractChange ? e : -e)) / m : Math.abs(total - a * m);
        expect(e).toBeGreaterThan(0); expect(total).toBeGreaterThan(0);
      } else {
        expect(compared).toBe(p.additive ? a + m : a * m);
        expected = spec.unknownPosition === 'reference' ? compared / m : spec.unknownPosition === 'multiplier' ? compared / a : p.additive ? a + m : a * m;
        relationships.add(Number(p.additive));
      }
      expect(p.target).toBe(expected);
      if (!item.choices) expect(item.answer).toBe(expected);
      if (item.choices?.some(value => String(value).includes('='))) {
        expect(item.choices.filter(value => equationHolds(value, expected))).toEqual([item.answer]);
      }
      if (skill.id === 'g4-oa-add-vs-mult-compare' && form === 'verify') expect(item.answer).toBe('A: add; B: multiply');
      expect(makeItemFromId(item.id)).toEqual(item);
      expect(checkAnswer(item, String(item.answer), 240000).reviewGrade).toBe('good');
      const fresh = freshFoundationItem(item, mulberry32(seed + 33));
      expect(fresh.cardKey).toBe(item.cardKey);
      expect(fresh.contentSpec?.domain === 'foundation' && fresh.contentSpec.data.unknownPosition).toBe(spec.unknownPosition);
      if (form === 'transfer') { positions.add(spec.unknownPosition!); contexts.add(spec.contextFamily!); }
    }
    expect(contexts.size).toBe(4);
    if (skill.evidenceProfile?.requiredUnknownPositions) expect([...positions].sort()).toEqual([...skill.evidenceProfile.requiredUnknownPositions].sort());
    if (skill.id === 'g4-oa-add-vs-mult-compare') expect(relationships).toEqual(new Set([0, 1]));
  }, 30000);

  for (const skill of skills.filter(skill => skill.evidenceProfile?.requiredUnknownPositions)) it(`requires independent transfer across roles and contexts for ${skill.id}`, () => {
    const items = Array.from({ length: 36 }, (_, i) => makeFoundationItem(skill.id, FOUNDATION_FORMS[i % 6], (Math.floor(i / 6) % 3) as 0 | 1 | 2, 700 + i + Math.floor(i / 6)));
    const events: MathAnswerEvent[] = items.map((item, i) => ({ id: `${i}`, studentId: 's', sessionId: `day-${Math.floor(i / 6)}`, itemId: item.id, cardKey: item.cardKey, schemaId: item.schemaId, mode: 'practice', promptShown: item.prompt, correctAnswer: item.answer, studentAnswer: item.answer, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 240000, createdAt: new Date(Date.UTC(2026, 9, 1 + Math.floor(i / 6), 12, i % 6)).toISOString() }));
    const derive = (selected: MathAnswerEvent[]) => deriveCurriculumSkillSummaries({ studentId: 's', items, mathAnswerEvents: selected, itemStates: [], now: '2026-10-19T00:00:00.000Z', timezone: 'UTC' }).find(value => value.skillId === skill.id)!;
    expect(derive(events).learningState).toBe('mastered');
    const lookup = new Map(items.map(item => [item.id, item]));
    const missingRole = events.filter(event => { const spec = lookup.get(event.itemId)!.contentSpec!; return spec.domain !== 'foundation' || spec.data.form !== 'transfer' || spec.data.unknownPosition !== 'reference'; });
    expect(derive(missingRole).learningState).not.toBe('mastered');
    const oneContext = events.filter(event => { const spec = lookup.get(event.itemId)!.contentSpec!; return spec.domain !== 'foundation' || spec.data.form !== 'transfer' || spec.data.contextFamily === 'library'; });
    if (skill.evidenceProfile!.minContextFamilies) expect(derive(oneContext).learningState).not.toBe('mastered');
    expect(derive(events.map(event => ({ ...event, hintUsed: true }))).learningState).toBe('new');
    expect(derive(events.filter(event => !event.itemId.includes('~verify~'))).learningState).not.toBe('mastered');
  });
  for (const skill of skills) it(`keeps ${skill.id} due cards out of planned and extra new goal work`, () => {
    const due = makeFoundationItem(skill.id, 'model', 0, 100), seen = makeFoundationItem(skill.id, 'symbolic', 0, 101);
    const state = { ...createInitialState('s', due), lastItemId: due.id, nextDueAt: '2026-10-01T00:00:00.000Z' };
    const now = '2026-10-19T16:00:00.000Z';
    const events: MathAnswerEvent[] = [{ id: 'seen', studentId: 's', sessionId: 'old', itemId: seen.id, cardKey: seen.cardKey, schemaId: seen.schemaId, mode: 'practice', promptShown: seen.prompt, correctAnswer: seen.answer, studentAnswer: seen.answer, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000, createdAt: '2026-10-01T12:00:00.000Z' }];
    const summaries = deriveCurriculumSkillSummaries({ studentId: 's', items: makeItemFromId, mathAnswerEvents: events, itemStates: [state], now });
    const goal: LearningGoal = { id: 'goal', studentId: 's', title: 'Comparison learning', status: 'active', source: 'manual', portfolioRole: 'primary', durationDays: 14, startDate: '2026-10-18', targetDate: '2026-11-01', createdAt: now, updatedAt: now, targets: [{ id: 'target', skillId: skill.id, reason: 'needs_evaluation', baseline: { capturedAt: now, status: 'new', attemptCount: 0, distinctItemCount: 0, recentAccuracy: 0, dueItemCount: 0, mistakePatterns: [], hintRate: 0 }, targetAccuracy: .9, minFirstAttempts: 8, minDistinctItems: 6, minActiveDays: 3, maxHintRate: .2, misconceptionTargets: [], weight: 1 }] };
    const plan = planDailyNewForGoals({ studentId: 's', goals: [goal], events, itemStates: [state], skillSummaries: summaries, now, timezone: 'UTC' });
    expect(plan.tiles.length).toBeGreaterThan(0); expect(plan.extraChoices.length).toBeGreaterThan(0);
    const planned = plan.tiles.flatMap(tile => tile.itemIds), extra = plan.extraChoices.flatMap(tile => tile.itemIds);
    for (const id of [...planned, ...extra]) {
      const item = makeItemFromId(id)!;
      expect(item.skillId).toBe(skill.id); expect(id).not.toBe(seen.id);
      expect(item.cardKey).not.toBe(due.cardKey); expect(id).not.toContain('~verify~');
    }
    expect(extra.every(id => !planned.includes(id))).toBe(true);
    expect(plan.tiles.every(tile => tile.goalIds.includes(goal.id) && tile.targetIds.includes('target'))).toBe(true);
  });

});
