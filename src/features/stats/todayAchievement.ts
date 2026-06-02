import type { MathAnswerEvent } from '../learning/learningEvents';
import type { PracticeSession } from '../../types/math';
import { describeItem } from '../curriculum/describeItem';

export type AchievementFilter = 'total' | 'due' | 'practice' | 'quiz' | 'improved' | 'needsFocus';

export interface TodayQuestionDetail {
  key: string;                         // `${sessionId}~~${itemId}`
  itemId: string;
  prompt: string;
  correctAnswer: string | number | null;
  group: string;                       // 'mul', 'div', 'unk', 'add', etc.
  sessionId: string;
  sessionMode: string;
  isDue: boolean;                      // session.mode === 'daily_review'
  isQuiz: boolean;                     // event.mode === 'quiz'
  isPractice: boolean;                 // practice, not due and not quiz
  isSkipped: boolean;                  // null answer or no correct event in session
  tries: number;                       // total events in group (first + retries)
  firstCorrect: boolean;               // answered correctly on first attempt
  latencyMs: number;                   // first correct event latency; 0 if skipped
  priorTries: number | null;           // tries in most recent prior session; null = no history
  priorLatencyMs: number | null;       // correct latency in most recent prior session
  improved: boolean;                   // fewer tries or faster than prior
  needsFocus: boolean;                 // more tries or >20% slower than prior
  encouragingIcon: boolean;            // strictly faster correct answer than prior
}

export interface TodaySummary {
  count: number;
  correct: number;    // first-try correct questions
  accuracy: number;   // correct / count
}

export interface TodayAchievementData {
  total: TodaySummary;
  due: TodaySummary;
  practice: TodaySummary;
  quiz: TodaySummary;
  improved: TodaySummary;
  needsFocus: TodaySummary;
  questions: TodayQuestionDetail[];
}

function makeSummary(questions: TodayQuestionDetail[]): TodaySummary {
  const count = questions.length;
  const correct = questions.filter(q => q.firstCorrect).length;
  return { count, correct, accuracy: count > 0 ? correct / count : 0 };
}

export function filterTodayQuestions(
  questions: TodayQuestionDetail[],
  filter: AchievementFilter,
): TodayQuestionDetail[] {
  switch (filter) {
    case 'total':      return questions;
    case 'due':        return questions.filter(q => q.isDue);
    case 'practice':   return questions.filter(q => q.isPractice);
    case 'quiz':       return questions.filter(q => q.isQuiz);
    case 'improved':   return questions.filter(q => q.improved);
    case 'needsFocus': return questions.filter(q => q.needsFocus);
  }
}

export function computeTodayAchievement(
  todayEvents: MathAnswerEvent[],
  priorEvents: MathAnswerEvent[],
  sessions: PracticeSession[],
): TodayAchievementData {
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  // Group today's events by (sessionId, itemId) — one group per question-in-session
  const todayGroupMap = new Map<string, MathAnswerEvent[]>();
  for (const ev of todayEvents) {
    const k = `${ev.sessionId}~~${ev.itemId}`;
    const g = todayGroupMap.get(k) ?? [];
    g.push(ev);
    todayGroupMap.set(k, g);
  }

  // Build prior comparison lookup: itemId → stats from most-recent prior session
  // Group prior events by (sessionId, itemId)
  const priorGroupMap = new Map<string, MathAnswerEvent[]>();
  for (const ev of priorEvents) {
    const k = `${ev.sessionId}~~${ev.itemId}`;
    const g = priorGroupMap.get(k) ?? [];
    g.push(ev);
    priorGroupMap.set(k, g);
  }

  // For each unique itemId, find the most recent prior (sessionId) group
  const latestPriorSessionByItem = new Map<string, { k: string; latestAt: string }>();
  for (const [k, evs] of priorGroupMap) {
    const itemId = evs[0].itemId;
    const latestAt = evs.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt;
    const existing = latestPriorSessionByItem.get(itemId);
    if (!existing || latestAt > existing.latestAt) {
      latestPriorSessionByItem.set(itemId, { k, latestAt });
    }
  }

  const priorByItem = new Map<string, { tries: number; correctLatencyMs: number | null }>();
  for (const [itemId, { k }] of latestPriorSessionByItem) {
    const evs = priorGroupMap.get(k) ?? [];
    const correctEv = evs.find(e => e.isCorrect);
    priorByItem.set(itemId, {
      tries: evs.length,
      correctLatencyMs: correctEv?.latencyMs ?? null,
    });
  }

  // Build question details
  const questions: TodayQuestionDetail[] = [];

  for (const [k, evs] of todayGroupMap) {
    evs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const firstEv = evs[0];
    const { itemId, sessionId } = firstEv;
    const session = sessionMap.get(sessionId);
    const sessionMode = session?.mode ?? '';

    const isDue = sessionMode === 'daily_review';
    const isQuiz = firstEv.mode === 'quiz';
    const isPractice = !isDue && !isQuiz;

    const hasNullAnswer = evs.some(e => e.studentAnswer === null);
    const correctEv = evs.find(e => e.isCorrect);
    const isSkipped = hasNullAnswer || !correctEv;

    const firstCorrect = !firstEv.isRetry && firstEv.isCorrect;
    const latencyMs = correctEv?.latencyMs ?? 0;

    const { prompt, group } = describeItem(itemId);
    const correctAnswer = firstEv.correctAnswer;

    const prior = priorByItem.get(itemId) ?? null;
    let improved = false;
    let needsFocus = false;
    let encouragingIcon = false;

    if (!isSkipped && prior) {
      const fewerTries = evs.length < prior.tries;
      const moreTries = evs.length > prior.tries;
      const fasterSpeed =
        latencyMs > 0 && prior.correctLatencyMs !== null && latencyMs < prior.correctLatencyMs;
      const slowerSpeed =
        latencyMs > 0 && prior.correctLatencyMs !== null &&
        latencyMs > prior.correctLatencyMs * 1.2;

      improved = fewerTries || fasterSpeed;
      needsFocus = moreTries || slowerSpeed;
      encouragingIcon = fasterSpeed;
    }

    questions.push({
      key: k,
      itemId,
      prompt,
      correctAnswer,
      group,
      sessionId,
      sessionMode,
      isDue,
      isQuiz,
      isPractice,
      isSkipped,
      tries: evs.length,
      firstCorrect,
      latencyMs,
      priorTries: prior?.tries ?? null,
      priorLatencyMs: prior?.correctLatencyMs ?? null,
      improved,
      needsFocus,
      encouragingIcon,
    });
  }

  return {
    total: makeSummary(questions),
    due: makeSummary(questions.filter(q => q.isDue)),
    practice: makeSummary(questions.filter(q => q.isPractice)),
    quiz: makeSummary(questions.filter(q => q.isQuiz)),
    improved: makeSummary(questions.filter(q => q.improved)),
    needsFocus: makeSummary(questions.filter(q => q.needsFocus)),
    questions,
  };
}
