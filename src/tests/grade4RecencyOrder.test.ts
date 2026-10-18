import { describe, expect, it } from 'vitest';
import { getCurriculumSkill } from '../features/curriculum/curriculumRegistry';
import { makeFoundationItem } from '../features/curriculum/foundationItems';
import { planDailyLesson } from '../features/learningPlan/dailyLessonPlanner';
import { rankFocusSkills } from '../features/learningPlan/focusSkillSelector';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import { mulberry32 } from '../utils/rng';
import type { PracticeItem } from '../types/math';

const settings = {
  audioEnabled: false,
  speechRate: 1,
  dailyGoalMinutes: 12,
  sessionLength: 10 as const,
  autoAdvance: false,
  theme: 'indigo' as const,
  allowTimedMode: false,
  competitionModeEnabled: false,
  parentModeEnabled: false,
};

function summary(skillId: string, overrides: Partial<StudentSkillSummary> = {}): StudentSkillSummary {
  return {
    skillId,
    studentId: 'student',
    status: 'new',
    attemptCount: 0,
    correctCount: 0,
    accuracy: 0,
    dueItemCount: 0,
    itemCount: 0,
    mistakePatterns: [],
    ...overrides,
  };
}

function answerEvent(item: PracticeItem, index: number, isCorrect: boolean): MathAnswerEvent {
  return {
    id: `event-${index}`,
    studentId: 'student',
    sessionId: `session-${index}`,
    itemId: item.id,
    cardKey: item.cardKey,
    schemaId: item.schemaId,
    mode: 'practice',
    promptShown: item.prompt,
    correctAnswer: item.answer,
    studentAnswer: isCorrect ? item.answer : 0,
    isCorrect,
    isRetry: false,
    hintUsed: false,
    latencyMs: 30000,
    createdAt: new Date(Date.UTC(2026, 8, 1 + index, 12)).toISOString(),
  };
}

function lessonSignature(events: MathAnswerEvent[]) {
  const skillId = 'g4-nbt-ten-times';
  const plan = planDailyLesson({
    studentId: 'student',
    gradeLevel: 4,
    now: '2026-09-20T12:00:00.000Z',
    timezone: 'America/Los_Angeles',
    settings,
    events,
    itemStates: [],
    skillSummaries: [summary(skillId, { status: 'strong', learningState: 'strong', attemptCount: 12, correctCount: 8, accuracy: 2 / 3 })],
    goals: [],
    rng: mulberry32(77),
  });

  return plan.items.map(entry => ({
    segment: entry.segment,
    cardKey: entry.cardKey,
    skillId: entry.item.skillId,
    band: entry.item.contentSpec?.domain === 'foundation' ? entry.item.contentSpec.data.band : undefined,
    form: entry.item.contentSpec?.domain === 'foundation' ? entry.item.contentSpec.data.form : undefined,
  }));
}

function deterministicShuffle<T>(values: T[]): T[] {
  const order = [5, 0, 10, 2, 8, 1, 11, 4, 7, 3, 9, 6];
  return order.map(index => values[index]);
}

describe('Grade 4 recency ordering', () => {
  it('keeps focus ranking and lesson difficulty invariant to event storage order', () => {
    const skillId = 'g4-nbt-ten-times';
    const items = Array.from({ length: 12 }, (_, index) => makeFoundationItem(skillId, 'symbolic', 0, 700 + index));
    const chronological = items.map((item, index) => answerEvent(item, index, index >= 4));
    const reversed = [...chronological].reverse();
    const shuffled = deterministicShuffle(chronological);
    const summaries = [summary(skillId, { status: 'strong', learningState: 'strong', attemptCount: 12, correctCount: 8, accuracy: 2 / 3 })];
    const skillGraph = [getCurriculumSkill(skillId)!];

    const rank = (events: MathAnswerEvent[]) => rankFocusSkills({
      studentId: 'student',
      now: '2026-09-20T12:00:00.000Z',
      summaries,
      goals: [],
      events,
      usableSkillIds: new Set([skillId]),
      skillGraph,
    })[0];

    expect(rank(reversed)).toEqual(rank(chronological));
    expect(rank(shuffled)).toEqual(rank(chronological));
    expect(lessonSignature(reversed)).toEqual(lessonSignature(chronological));
    expect(lessonSignature(shuffled)).toEqual(lessonSignature(chronological));
    expect(lessonSignature(chronological).some(entry => entry.band === 2)).toBe(true);
  });
});
