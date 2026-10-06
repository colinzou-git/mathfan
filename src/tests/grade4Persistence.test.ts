import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { makeFoundationItem } from '../features/curriculum/foundationItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { FOUNDATION_FORMS, GRADE4_SKILLS } from '../features/curriculum/curriculumRegistry';
import { buildDiagnosticAnswerProposal } from '../features/diagnosis/diagnosticAnswerProposal';
import { persistDiagnosticAnswerProposal } from '../features/diagnosis/diagnosticPersistence';
import { recordPracticeAnswer } from '../features/learning/recordAnswer';
import { rebuildItemStatesFromEvents } from '../features/learning/eventRebuild';
import { applyReview, createInitialState } from '../features/scheduler/scheduler';
import { buildSnapshot, mergeSnapshot, normalizeSnapshot } from '../features/sync/snapshot';
import { deriveCurriculumSkillSummaries } from '../features/mastery/skillMasteryEngine';
import { getOrCreateDailyLessonPlan } from '../features/learningPlan/dailyLessonPersistence';
import { planFullAdaptiveGoalEvaluation } from '../features/goals/goalEvaluationEngine';
import { mulberry32 } from '../utils/rng';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentProfile } from '../types/math';

const profile: StudentProfile = { id: 'g4-persist', gradeLevel: 4, displayName: 'Foundation', timezone: 'America/Los_Angeles',
  createdAt: '2026-09-01T00:00:00.000Z', settings: { audioEnabled: false, speechRate: 1, dailyGoalMinutes: 12,
    sessionLength: 10, autoAdvance: false, theme: 'indigo', allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false } };
const now = '2026-09-20T12:00:00.000Z';
async function summaries() {
  return deriveCurriculumSkillSummaries({ studentId: profile.id, items: makeItemFromId, now, timezone: profile.timezone,
    mathAnswerEvents: await db.mathAnswerEvents.toArray(), itemStates: await db.itemStates.toArray() });
}
beforeAll(async () => { if (!db.isOpen()) await db.open(); });
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); await db.students.put(profile); });

describe('Grade 4 canonical persistence and sync', () => {
  it('persists readiness idempotently and rebuilds without introducing any FSRS card', async () => {
    for (const item of [makeFoundationItem('g4-nbt-ten-times', 'model', 0, 77), makeItemFromId('MUL_7x8')!]) {
      const proposal = buildDiagnosticAnswerProposal({ studentId: profile.id, sessionId: 'readiness', item,
        eventId: `probe:${item.id}`, attemptId: `attempt:${item.id}`, answeredAt: now,
        rawInput: String(item.answer), latencyMs: 120000, schedulingEligible: false });
      await persistDiagnosticAnswerProposal(proposal);
      await persistDiagnosticAnswerProposal(proposal);
    }
    expect(await db.mathAnswerEvents.count()).toBe(2);
    expect(await db.attempts.count()).toBe(2);
    await rebuildItemStatesFromEvents(profile.id);
    expect(await db.itemStates.count()).toBe(0);
    expect((await summaries()).find(value => value.skillId === 'g4-nbt-ten-times')).toMatchObject({ learningState: 'new', provisionalPlacement: true });
  });

  it('round-trips events, schema scheduling, mastery, and lesson metadata through an idempotent sync merge', async () => {
    for (let i = 0; i < 12; i++) {
      const item = makeFoundationItem('g4-nbt-ten-times', FOUNDATION_FORMS[i % 6], (i % 3) as 0 | 1 | 2, 700 + i);
      const createdAt = new Date(Date.UTC(2026, 8, 1 + Math.floor(i / 4), 12, i % 4)).toISOString();
      const prior = await db.itemStates.get([profile.id, item.cardKey!]) ?? createInitialState(profile.id, item);
      const updatedState = { ...applyReview(prior, 'good', 120000, String(item.answer), new Date(createdAt), { isCorrect: true }), lastItemId: item.id };
      const event: MathAnswerEvent = { id: `answer-${i}`, studentId: profile.id, sessionId: `day-${Math.floor(i / 4)}`,
        itemId: item.id, cardKey: item.cardKey, schemaId: item.schemaId, mode: 'practice', promptShown: item.prompt,
        correctAnswer: item.answer, studentAnswer: item.answer, isCorrect: true, isRetry: false, hintUsed: false,
        reviewGrade: 'good', schedulingEligible: true, schedulingApplied: true, latencyMs: 120000, createdAt };
      const payload = { event, updatedState, attempt: { ...event, id: `attempt-${i}`, skillId: item.skillId, studentAnswer: item.answer, reviewGrade: 'good' as const } };
      await recordPracticeAnswer(payload); await recordPracticeAnswer(payload);
    }
    expect(await db.mathAnswerEvents.count()).toBe(12);
    expect(await db.attempts.count()).toBe(12);
    const before = await summaries();
    expect(before.find(value => value.skillId === 'g4-nbt-ten-times')?.learningState).toBe('mastered');
    const plan = await getOrCreateDailyLessonPlan({ studentId: profile.id, gradeLevel: 4, now, timezone: profile.timezone,
      settings: profile.settings, events: await db.mathAnswerEvents.toArray(), itemStates: await db.itemStates.toArray(),
      skillSummaries: before, goals: [], rng: mulberry32(82) });
    const snapshot = JSON.parse(JSON.stringify(await buildSnapshot()));
    expect(normalizeSnapshot(snapshot).problems).toEqual([]);
    await Promise.all(db.tables.map(table => table.clear()));
    await mergeSnapshot(snapshot); await mergeSnapshot(snapshot);
    expect(await db.mathAnswerEvents.count()).toBe(12);
    expect(await db.attempts.count()).toBe(12);
    expect(await summaries()).toEqual(before);
    expect((await db.dailyLessonPlans.get(plan.id))?.curriculumId).toBe('california-g4-foundation');
    expect((await db.dailyLessonPlans.get(plan.id))?.items).toEqual(plan.items);
    const firstRebuild = await db.itemStates.toArray();
    await rebuildItemStatesFromEvents(profile.id);
    expect(await db.itemStates.toArray()).toEqual(firstRebuild);
  });

  it('replaces a same-day lesson after changing grade without rewriting old progress', async () => {
    const args = { studentId: profile.id, now, timezone: profile.timezone, settings: profile.settings,
      events: [], itemStates: [], skillSummaries: await summaries(), goals: [], rng: mulberry32(3) };
    const old = await getOrCreateDailyLessonPlan({ ...args, gradeLevel: 3 });
    const current = await getOrCreateDailyLessonPlan({ ...args, gradeLevel: 4 });
    expect(current.id).not.toBe(old.id);
    expect(current.curriculumId).toBe('california-g4-foundation');
    expect((await db.dailyLessonPlans.get(old.id))?.status).toBe('replaced');
    expect(current.items.some(entry => entry.item.gradeLevel === 4)).toBe(true);
  });

  it('uses the shared goal-evaluation planner with the Grade 4 registry', () => {
    const questions = planFullAdaptiveGoalEvaluation({ studentId: profile.id, seed: 3, now,
      mathAnswerEvents: [], itemStates: [], skillGraph: GRADE4_SKILLS });
    expect(questions).toHaveLength(30);
    expect(questions.every(value => value.skillId.startsWith('g4-'))).toBe(true);
    expect(new Set(questions.map(value => value.item.id)).size).toBe(30);
  });
});
