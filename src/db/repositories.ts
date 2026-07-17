import { db } from './dexie';
import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession, GradeLevel } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { classifyLegacyFluencyEvidence } from '../features/fluency/fluencyEngine';
import type { QuizSession, MultiplicationFactStats, MultiplicationFactKey } from '../features/multiplication/types';
import type { GoalEvaluation, GoalEvent, LearningGoal, LearningGoalStatus } from '../features/goals/types';
import { normalizeLocalGoalEvaluation } from '../features/goals/goalEvaluationSelection';
import { profileCreationMatch } from '../features/profile/learnerIdentity';
import { chronologicalEvents } from '../features/learning/eventOrdering';

export const studentRepo = {
  async getAll(): Promise<StudentProfile[]> {
    return db.students.toArray();
  },
  async get(id: string): Promise<StudentProfile | undefined> {
    return db.students.get(id);
  },
  async getByLearnerKey(learnerKey: string): Promise<StudentProfile | undefined> {
    return db.students.where('learnerKey').equals(learnerKey).first();
  },
  /** Advisory duplicate-prevention lookup — does not guarantee global uniqueness. */
  async findCreationMatches(name: string, grade: GradeLevel): Promise<StudentProfile[]> {
    const all = await db.students.toArray();
    return profileCreationMatch({ displayName: name, gradeLevel: grade }, all);
  },
  async save(profile: StudentProfile): Promise<void> {
    await db.students.put(profile);
  },
  /** Creates a new profile, rejecting an accidental duplicate learnerKey or id instead of silently overwriting. */
  async saveNew(profile: StudentProfile): Promise<void> {
    if (profile.learnerKey) {
      const existingByKey = await studentRepo.getByLearnerKey(profile.learnerKey);
      if (existingByKey) throw new Error(`A profile with learnerKey ${profile.learnerKey} already exists.`);
    }
    const existingById = await db.students.get(profile.id);
    if (existingById) throw new Error(`A profile with id ${profile.id} already exists.`);
    await db.students.add(profile);
  },
  async delete(id: string): Promise<void> {
    await db.students.delete(id);
  },
};

/**
 * DERIVED CACHE — do not treat as source of truth.
 * These records are computed from mathAnswerEvents (practice mode) via applyReview.
 * They are kept for scheduling speed (FSRS next-due lookups) and legacy UI.
 * Ground truth: db.mathAnswerEvents where mode='practice'.
 * Use rebuildItemStatesFromEvents() to regenerate.
 */
export const itemStateRepo = {
  async get(studentId: string, cardKey: string): Promise<StudentItemState | undefined> {
    return db.itemStates.get([studentId, cardKey]);
  },
  async getForCardKeys(studentId: string, cardKeys: string[]): Promise<StudentItemState[]> {
    if (cardKeys.length === 0) return [];
    const keySet = new Set(cardKeys);
    return db.itemStates
      .where('studentId').equals(studentId)
      .and(s => keySet.has(s.cardKey))
      .toArray();
  },
  async getForStudent(studentId: string): Promise<StudentItemState[]> {
    return db.itemStates.where('studentId').equals(studentId).toArray();
  },
  async getDue(studentId: string, now: string): Promise<StudentItemState[]> {
    return db.itemStates
      .where('studentId').equals(studentId)
      .and(s => !s.nextDueAt || s.nextDueAt <= now)
      .toArray();
  },
  async save(state: StudentItemState): Promise<void> {
    await db.itemStates.put(state);
  },
};

/**
 * COMPATIBILITY LAYER — do not treat as source of truth.
 * These records duplicate data from mathAnswerEvents for backward compatibility.
 * New reads should prefer mathAnswerEventRepo.
 * Ground truth: db.mathAnswerEvents.
 */
export const attemptRepo = {
  async save(attempt: AttemptLog): Promise<void> {
    await db.attempts.put(attempt);
  },
  async getAll(studentId: string): Promise<AttemptLog[]> {
    return db.attempts.where('studentId').equals(studentId).toArray();
  },
  async getForDateRange(studentId: string, start: Date, end: Date): Promise<AttemptLog[]> {
    return db.attempts
      .where('[studentId+createdAt]')
      .between([studentId, start.toISOString()], [studentId, end.toISOString()])
      .toArray();
  },
  async getForSession(sessionId: string): Promise<AttemptLog[]> {
    return db.attempts.where('sessionId').equals(sessionId).toArray();
  },
  async getRecent(studentId: string, limit = 50): Promise<AttemptLog[]> {
    return db.attempts
      .where('studentId').equals(studentId)
      .reverse()
      .limit(limit)
      .toArray();
  },
};

/** Canonical answer-attempt log. All stats and mastery can be recomputed from these records. */
export const mathAnswerEventRepo = {
  async save(event: MathAnswerEvent): Promise<void> {
    await db.mathAnswerEvents.put(event);
  },
  async bulkSave(events: MathAnswerEvent[]): Promise<void> {
    await db.mathAnswerEvents.bulkPut(events);
  },
  async getAll(studentId: string): Promise<MathAnswerEvent[]> {
    // Ordering intentionally unspecified. Recency-sensitive callers must use an ordered method below.
    return db.mathAnswerEvents.where('studentId').equals(studentId).toArray();
  },
  async getAllChronological(studentId: string): Promise<MathAnswerEvent[]> {
    const events = await db.mathAnswerEvents
      .where('[studentId+createdAt]')
      .between([studentId, ''], [studentId, '\uffff'])
      .toArray();
    return chronologicalEvents(events);
  },
  async getRecentChronological(studentId: string, limit: number): Promise<MathAnswerEvent[]> {
    if (limit <= 0) return [];
    const events = await db.mathAnswerEvents
      .where('[studentId+createdAt]')
      .between([studentId, ''], [studentId, '\uffff'])
      .toArray();
    return chronologicalEvents(events).slice(-limit);
  },
  async getForDateRange(studentId: string, start: Date, end: Date): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents
      .where('[studentId+createdAt]')
      .between([studentId, start.toISOString()], [studentId, end.toISOString()])
      .toArray();
  },
  async getForSession(sessionId: string): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents.where('sessionId').equals(sessionId).toArray();
  },
  async getForItem(studentId: string, itemId: string): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents
      .where('studentId').equals(studentId)
      .and(e => e.itemId === itemId)
      .toArray();
  },
  /** Returns only first-attempt events (isRetry=false) — excludes retries. */
  async getFirstAttempts(studentId: string): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents
      .where('studentId').equals(studentId)
      .and(e => !e.isRetry)
      .toArray();
  },
  /** Chronological candidates; fluencyEngine owns the semantic evidence rule. */
  async getFluencyEvidenceCandidatesChronological(studentId: string): Promise<MathAnswerEvent[]> {
    return this.getAllChronological(studentId);
  },
  /** Backward-compatible name returning only classifier-approved durable evidence. */
  async getDirectCorrectFirstAttempts(studentId: string): Promise<MathAnswerEvent[]> {
    return (await this.getFluencyEvidenceCandidatesChronological(studentId))
      .filter(event => classifyLegacyFluencyEvidence(event).eligible);
  },
};

// ── Quiz stats ────────────────────────────────────────────────────────────────

function deriveSessionsFromEvents(studentId: string, events: MathAnswerEvent[]): QuizSession[] {
  const firstAttempts = events.filter(e => e.mode === 'quiz' && !e.isRetry);
  const bySession = new Map<string, MathAnswerEvent[]>();
  for (const e of firstAttempts) {
    const arr = bySession.get(e.sessionId) ?? [];
    arr.push(e);
    bySession.set(e.sessionId, arr);
  }
  const sessions: QuizSession[] = [];
  for (const [sessionId, evts] of bySession) {
    evts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const correct = evts.filter(e => e.isCorrect).length;
    const toKey = (e: MathAnswerEvent): MultiplicationFactKey | null =>
      e.itemId.startsWith('MUL_') ? e.itemId.slice(4) as MultiplicationFactKey : null;
    const weakFacts = evts.filter(e => e.factStatusAfter === 'weak').map(toKey).filter((k): k is MultiplicationFactKey => k !== null);
    const forgottenFacts = evts.filter(e => e.factStatusAfter === 'forgotten').map(toKey).filter((k): k is MultiplicationFactKey => k !== null);
    sessions.push({
      id: sessionId,
      studentId,
      category: 'multiplication',
      quizLength: evts.length,
      startedAt: evts[0].createdAt,
      completedAt: evts[evts.length - 1].createdAt,
      answerLogs: [],
      correctCount: correct,
      incorrectCount: evts.length - correct,
      accuracy: evts.length > 0 ? correct / evts.length : 0,
      averageResponseTimeMs: evts.length > 0 ? Math.round(evts.reduce((s, e) => s + e.latencyMs, 0) / evts.length) : null,
      weakFactsDiscovered: weakFacts,
      strongFactsConfirmed: [],
      forgottenFactsDiscovered: forgottenFacts,
      untestedFactsCovered: [],
      recommendedPracticeFacts: [...new Set([...forgottenFacts, ...weakFacts])],
    });
  }
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * DERIVED CACHE — do not treat as source of truth.
 * quizSessions and multFactStats are cached views written at quiz-end.
 * Ground truth: db.mathAnswerEvents (mode='quiz').
 * getSessions falls back to event-derived sessions if the cache is absent.
 */
export const quizStatsRepo = {
  async getSessions(studentId: string): Promise<QuizSession[]> {
    const cached = await db.quizSessions.where('studentId').equals(studentId).toArray();
    if (cached.length > 0) return cached.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const events = await db.mathAnswerEvents.where('studentId').equals(studentId).toArray();
    return deriveSessionsFromEvents(studentId, events);
  },

  async getStatsMap(studentId: string): Promise<Map<MultiplicationFactKey, MultiplicationFactStats>> {
    const stats = await db.multFactStats.where('studentId').equals(studentId).toArray();
    return new Map(stats.map(s => [s.key as MultiplicationFactKey, s]));
  },
};

export const sessionRepo = {
  async save(session: PracticeSession): Promise<void> {
    await db.sessions.put(session);
  },
  async get(id: string): Promise<PracticeSession | undefined> {
    return db.sessions.get(id);
  },
  async getAll(studentId: string): Promise<PracticeSession[]> {
    return db.sessions.where('studentId').equals(studentId).toArray();
  },
  async getRecent(studentId: string, limit = 10): Promise<PracticeSession[]> {
    return db.sessions
      .where('studentId').equals(studentId)
      .reverse()
      .limit(limit)
      .toArray();
  },
  async getLastByMode(studentId: string, mode: string): Promise<PracticeSession | undefined> {
    const all = await db.sessions
      .where('studentId').equals(studentId)
      .and(s => s.mode === mode)
      .toArray();
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  },
  /** Delete sessions with zero completed questions (left over from abandoned starts). */
  async deleteEmpty(studentId: string): Promise<number> {
    const empties = await db.sessions
      .where('studentId').equals(studentId)
      .and(s => s.completedQuestionCount === 0)
      .toArray();
    await db.sessions.bulkDelete(empties.map(s => s.id));
    return empties.length;
  },
};

const HISTORICAL_GOAL_STATUSES: LearningGoalStatus[] = ['completed', 'ended', 'cancelled'];

function withUpdatedAt<T extends { updatedAt: string }>(record: T, at: string): T {
  return { ...record, updatedAt: at };
}

function nowIso(): string {
  return new Date().toISOString();
}

export const learningGoalRepo = {
  async create(goal: LearningGoal, at = nowIso()): Promise<void> {
    await db.learningGoals.add(withUpdatedAt(goal, at));
  },
  async update(id: string, changes: Partial<Omit<LearningGoal, 'id' | 'studentId' | 'createdAt'>>, at = nowIso()): Promise<LearningGoal | undefined> {
    const existing = await db.learningGoals.get(id);
    if (!existing) return undefined;
    const next = withUpdatedAt({ ...existing, ...changes }, at);
    await db.learningGoals.put(next);
    return next;
  },
  async get(id: string): Promise<LearningGoal | undefined> {
    return db.learningGoals.get(id);
  },
  async list(studentId: string): Promise<LearningGoal[]> {
    return db.learningGoals.where('studentId').equals(studentId).toArray();
  },
  async listActive(studentId: string): Promise<LearningGoal[]> {
    return db.learningGoals.where('[studentId+status]').equals([studentId, 'active']).toArray();
  },
  async listPaused(studentId: string): Promise<LearningGoal[]> {
    return db.learningGoals.where('[studentId+status]').equals([studentId, 'paused']).toArray();
  },
  async listHistorical(studentId: string): Promise<LearningGoal[]> {
    return db.learningGoals
      .where('studentId').equals(studentId)
      .and(goal => HISTORICAL_GOAL_STATUSES.includes(goal.status))
      .toArray();
  },
  async pause(id: string, at = nowIso()): Promise<LearningGoal | undefined> {
    return learningGoalRepo.update(id, { status: 'paused' }, at);
  },
  async resume(id: string, at = nowIso()): Promise<LearningGoal | undefined> {
    return learningGoalRepo.update(id, { status: 'active' }, at);
  },
  async end(id: string, at = nowIso()): Promise<LearningGoal | undefined> {
    return learningGoalRepo.update(id, { status: 'ended', endedAt: at }, at);
  },
  async cancel(id: string, at = nowIso()): Promise<LearningGoal | undefined> {
    return learningGoalRepo.update(id, { status: 'cancelled', endedAt: at }, at);
  },
  async complete(id: string, at = nowIso()): Promise<LearningGoal | undefined> {
    return learningGoalRepo.update(id, { status: 'completed', completedAt: at }, at);
  },
};

export const goalEventRepo = {
  async append(event: GoalEvent): Promise<void> {
    await db.goalEvents.add(event);
  },
  async getForGoal(goalId: string): Promise<GoalEvent[]> {
    return db.goalEvents.where('goalId').equals(goalId).toArray();
  },
  async getForStudent(studentId: string): Promise<GoalEvent[]> {
    return db.goalEvents.where('studentId').equals(studentId).toArray();
  },
  async getForDateRange(studentId: string, start: Date, end: Date): Promise<GoalEvent[]> {
    return db.goalEvents
      .where('[studentId+createdAt]')
      .between([studentId, start.toISOString()], [studentId, end.toISOString()])
      .toArray();
  },
};

export const goalEvaluationRepo = {
  async save(evaluation: GoalEvaluation, at = nowIso()): Promise<void> {
    await db.goalEvaluations.put(withUpdatedAt(evaluation, at));
  },
  async load(id: string): Promise<GoalEvaluation | undefined> {
    const evaluation = await db.goalEvaluations.get(id);
    return evaluation ? normalizeLocalGoalEvaluation(evaluation) : undefined;
  },
  async listForStudent(studentId: string): Promise<GoalEvaluation[]> {
    return (await db.goalEvaluations.where('studentId').equals(studentId).toArray()).map(normalizeLocalGoalEvaluation);
  },
  async resume(id: string, at = nowIso()): Promise<GoalEvaluation | undefined> {
    const existing = await db.goalEvaluations.get(id);
    if (!existing) return undefined;
    const next = withUpdatedAt({ ...existing, status: 'in_progress' as const, startedAt: existing.startedAt ?? at }, at);
    await db.goalEvaluations.put(next);
    return next;
  },
  async complete(id: string, changes: Partial<Pick<GoalEvaluation, 'answers' | 'answerEvents' | 'resultGoalId' | 'currentQuestionIndex'>> = {}, at = nowIso()): Promise<GoalEvaluation | undefined> {
    const existing = await db.goalEvaluations.get(id);
    if (!existing) return undefined;
    const next = withUpdatedAt({ ...existing, ...changes, status: 'completed' as const, completedAt: at }, at);
    await db.goalEvaluations.put(next);
    return next;
  },
  async cancel(id: string, at = nowIso()): Promise<GoalEvaluation | undefined> {
    const existing = await db.goalEvaluations.get(id);
    if (!existing) return undefined;
    const next = withUpdatedAt({ ...existing, status: 'cancelled' as const, cancelledAt: at }, at);
    await db.goalEvaluations.put(next);
    return next;
  },
};
