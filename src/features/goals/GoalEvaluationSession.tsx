import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { NumPad } from '../../components/NumPad';
import type { AttemptLog, PracticeItem, ReviewGrade, StudentItemState } from '../../types/math';
import { generateId } from '../../utils/id';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { GRADE3_MASTERY_MAP, getGrade3Skill } from '../mastery/grade3MasteryMap';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { planLearningUnitsForSkill } from '../mastery/skillPracticePlanner';
import { checkAnswer, type RatingReason } from '../practice/answerChecker';
import type { ResponsePolicyKind } from '../scheduler/responsePolicy';
import type { FluencyBand } from '../fluency/fluencyEngine';
import { QuestionRenderer } from '../practice/QuestionRenderer';
import { applyReview, createInitialState } from '../scheduler/scheduler';
import { deriveCardKey } from '../scheduler/cardModel';
import {
  applyMisconceptionConfirmation,
  applyMisconceptionDetection,
  detectMistakes,
} from '../mastery/misconceptionEngine';
import { itemStateRepo, goalEvaluationRepo, mathAnswerEventRepo } from '../../db/repositories';
import { appNow } from '../time/clock';
import { currentState as authState } from '../auth/googleAuth';
import { pushLocal } from '../sync/driveSync';
import {
  ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT,
  buildAdaptiveGoalEvaluationResult,
  selectNextAdaptiveGoalEvaluationItem,
  type AdaptiveGoalEvaluationResponse,
  type AdaptiveGoalEvaluationResult,
} from './goalEvaluationEngine';
import {
  createGoalEvaluation,
  loadLatestResumableGoalEvaluation,
  recordGoalEvaluationAnswer,
} from './goalEvaluationPersistence';
import type { GoalEvaluation } from './types';
import { buildSchedulingTelemetry } from '../learning/schedulingTelemetry';
import { remainingLearningUnitEvidence } from '../learning/learningUnitProgress';

interface Props {
  studentId: string;
  onCancel: () => void;
  onReturnToGoals: () => void;
  onSelectGoalSkills: (skillIds: string[]) => void;
  onGoToDailyReview: () => void;
}

type Phase = 'loading' | 'intro' | 'active' | 'feedback' | 'results' | 'error';
type Feedback = 'correct' | 'wrong';

interface PendingWrite {
  eventId: string;
  attemptId: string;
  answeredAt: string;
  latencyMs: number;
  studentAnswer: string | number;
  isCorrect: boolean;
  reviewGrade: ReviewGrade;
  ratingReason: RatingReason;
  responsePolicy: ResponsePolicyKind;
  fluencyBand: FluencyBand;
  item: PracticeItem;
  skillId: string;
  cardKey: string;
  schedulingEligible: boolean;
  schedulingReason: 'first_card_evidence' | 'same_evaluation_template_repeat';
}

interface NewLearningCandidate {
  skillId: string;
  title: string;
  state: 'Completely new' | 'Partially learned';
  unseenCount: number;
  advisory: string;
  confidence: number;
  workload: string;
}

interface ReviewFinding {
  skillId: string;
  title: string;
  dueCount: number;
  weakCount: number;
}

const FEEDBACK_MS = 700;

function responsesFromEvaluation(evaluation: GoalEvaluation): AdaptiveGoalEvaluationResponse[] {
  return evaluation.answers.map(answer => ({
    itemId: answer.itemId,
    skillId: answer.skillId,
    isCorrect: answer.isCorrect,
    latencyMs: answer.latencyMs,
    answeredAt: answer.answeredAt,
  }));
}

function evaluationArgs(evaluation: GoalEvaluation, events: MathAnswerEvent[], itemStates: StudentItemState[], now: string) {
  return {
    studentId: evaluation.studentId,
    seed: evaluation.seed ?? 1,
    now,
    mathAnswerEvents: events,
    itemStates,
    responses: responsesFromEvaluation(evaluation),
    scheduledCardKeys: evaluation.scheduledCardKeys ?? [],
  };
}

function skillTitle(skillId: string): string {
  return getGrade3Skill(skillId)?.title ?? skillId;
}

function buildNewLearningCandidates(
  result: AdaptiveGoalEvaluationResult,
  events: MathAnswerEvent[],
  itemStates: StudentItemState[],
): NewLearningCandidate[] {
  const seenSkills = new Set<string>();
  const candidates = [...result.topGoalCandidates, ...result.skillsToStrengthen, ...result.skillsReadyToLearnNext];
  const rows: NewLearningCandidate[] = [];

  for (const candidate of candidates) {
    if (seenSkills.has(candidate.skillId)) continue;
    seenSkills.add(candidate.skillId);
    const units = [...planLearningUnitsForSkill(candidate.skillId, { events, states: itemStates }).progress.values()];
    const activeUnits = units.filter(unit => unit.status !== 'maintenance');
    if (activeUnits.length === 0) continue;
    const evidenceNeeded = activeUnits.reduce((sum, unit) => sum + remainingLearningUnitEvidence(unit), 0);
    const prereqIds = getGrade3Skill(candidate.skillId)?.prerequisites ?? [];
    const advisory = prereqIds.length === 0
      ? 'Ready to start.'
      : `Check nearby skills: ${prereqIds.map(skillTitle).slice(0, 2).join(', ')}.`;
    rows.push({
      skillId: candidate.skillId,
      title: skillTitle(candidate.skillId),
      state: activeUnits.every(unit => unit.status === 'new') ? 'Completely new' : 'Partially learned',
      unseenCount: activeUnits.length,
      advisory,
      confidence: Math.max(0, Math.min(1, 1 - candidate.uncertainty * 0.5)),
      workload: `${Math.max(1, Math.min(20, evidenceNeeded))} evidence question${evidenceNeeded === 1 ? '' : 's'}`,
    });
  }

  if (rows.length > 0) return rows.slice(0, 6);

  for (const skill of GRADE3_MASTERY_MAP) {
    const units = [...planLearningUnitsForSkill(skill.id, { events, states: itemStates }).progress.values()];
    const activeUnits = units.filter(unit => unit.status !== 'maintenance');
    if (activeUnits.length === 0) continue;
    const evidenceNeeded = activeUnits.reduce((sum, unit) => sum + remainingLearningUnitEvidence(unit), 0);
    rows.push({
      skillId: skill.id,
      title: skill.title,
      state: activeUnits.every(unit => unit.status === 'new') ? 'Completely new' : 'Partially learned',
      unseenCount: activeUnits.length,
      advisory: skill.prerequisites.length === 0 ? 'Ready to start.' : `Check nearby skills: ${skill.prerequisites.map(skillTitle).slice(0, 2).join(', ')}.`,
      confidence: 0.55,
      workload: `${Math.max(1, Math.min(20, evidenceNeeded))} evidence question${evidenceNeeded === 1 ? '' : 's'}`,
    });
    if (rows.length >= 3) break;
  }
  return rows;
}

function buildReviewFindings(itemStates: StudentItemState[], now: string): ReviewFinding[] {
  const bySkill = new Map<string, ReviewFinding>();
  for (const state of itemStates) {
    if (state.attemptCount <= 0) continue;
    const item = makeItemFromId(state.lastItemId ?? state.cardKey);
    const skillId = (item ? inferGrade3SkillId(item) : null) ?? state.skillId;
    const isDue = Boolean(state.nextDueAt && state.nextDueAt <= now);
    const isWeak = state.masteryLevel === 'learning' || state.masteryLevel === 'developing';
    if (!isDue && !isWeak) continue;
    const existing = bySkill.get(skillId) ?? {
      skillId,
      title: skillTitle(skillId),
      dueCount: 0,
      weakCount: 0,
    };
    if (isDue) existing.dueCount += 1;
    if (isWeak) existing.weakCount += 1;
    bySkill.set(skillId, existing);
  }
  return Array.from(bySkill.values()).sort((a, b) => (b.dueCount + b.weakCount) - (a.dueCount + a.weakCount)).slice(0, 6);
}

function buildUpdatedState(
  studentId: string,
  sessionId: string,
  item: PracticeItem,
  existing: StudentItemState | undefined,
  pending: PendingWrite,
  now: Date,
): {
  state: StudentItemState;
  detected: string[];
  confirmed: string[];
  schedulingApplied: boolean;
  schedulerErrorCode?: MathAnswerEvent['schedulerErrorCode'];
} {
  const before = existing ?? createInitialState(studentId, item);
  let updated = before;
  let schedulingApplied = false;
  let schedulerErrorCode: MathAnswerEvent['schedulerErrorCode'];
  try {
    updated = applyReview(before, pending.reviewGrade ?? 'again', pending.latencyMs, String(pending.studentAnswer), now, {
      isCorrect: pending.isCorrect,
    });
    schedulingApplied = true;
  } catch (error) {
    schedulerErrorCode = error instanceof RangeError ? 'clock_drift'
      : error instanceof TypeError ? 'invalid_card'
        : error instanceof Error ? 'fsrs_validation' : 'unknown';
  }
  updated = { ...updated, cardKey: deriveCardKey(item), lastItemId: item.id };
  const context = { eventId: pending.eventId, sessionId, itemId: item.id, createdAt: pending.answeredAt };
  let detected: string[] = [];
  let confirmed: string[] = [];
  if (!pending.isCorrect) {
    detected = detectMistakes(item, pending.studentAnswer);
    const merged = Array.from(new Set([...(updated.mistakePatterns ?? []), ...detected]));
    updated = {
      ...updated,
      mistakePatterns: merged,
      misconceptionEvidence: applyMisconceptionDetection(
        updated.misconceptionEvidence, detected, context, before.mistakePatterns,
      ),
    };
  } else {
    const confirmation = applyMisconceptionConfirmation(
      updated.misconceptionEvidence, item, context, updated.mistakePatterns,
    );
    confirmed = confirmation.confirmedCodes;
    updated = { ...updated, misconceptionEvidence: confirmation.evidence };
  }
  return { state: updated, detected, confirmed, schedulingApplied, schedulerErrorCode };
}

export function GoalEvaluationSession({ studentId, onCancel, onReturnToGoals, onSelectGoalSkills, onGoToDailyReview }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [evaluation, setEvaluation] = useState<GoalEvaluation | null>(null);
  const [events, setEvents] = useState<MathAnswerEvent[]>([]);
  const [itemStates, setItemStates] = useState<StudentItemState[]>([]);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const startMsRef = useRef(0);
  const continueRef = useRef<HTMLButtonElement>(null);

  const now = appNow().toISOString();
  const selection = useMemo(() => {
    if (!evaluation || phase === 'loading' || phase === 'intro' || phase === 'results') return null;
    return selectNextAdaptiveGoalEvaluationItem(evaluationArgs(evaluation, events, itemStates, now));
  }, [evaluation, events, itemStates, now, phase]);
  const currentItem = selection?.item ?? null;
  const result = useMemo(() => {
    if (!evaluation || evaluation.answers.length < ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT) return null;
    return buildAdaptiveGoalEvaluationResult(evaluationArgs(evaluation, events, itemStates, now));
  }, [evaluation, events, itemStates, now]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [resume, allEvents, states] = await Promise.all([
        loadLatestResumableGoalEvaluation(studentId),
        mathAnswerEventRepo.getAll(studentId),
        itemStateRepo.getForStudent(studentId),
      ]);
      if (!alive) return;
      setEvaluation(resume);
      setEvents(allEvents);
      setItemStates(states);
      setPhase(resume?.answers.length === ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT ? 'results' : 'intro');
    })().catch(err => {
      setSaveError(err instanceof Error ? err.message : 'Could not load evaluation.');
      setPhase('error');
    });
    return () => { alive = false; };
  }, [studentId]);

  useEffect(() => {
    if (phase === 'active' && currentItem) {
      startMsRef.current = performance.now();
    }
  }, [phase, currentItem]);

  useEffect(() => {
    if (phase === 'feedback' && !saveError) continueRef.current?.focus();
  }, [phase, saveError]);

  const startNew = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const created = await createGoalEvaluation(studentId, appNow().toISOString());
      setEvaluation(created);
      setInput('');
      setFeedback(null);
      setPhase('active');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not start the evaluation.');
    } finally {
      setSaving(false);
    }
  };

  const resume = () => {
    setInput('');
    setFeedback(null);
    setPhase(evaluation && evaluation.answers.length >= ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT ? 'results' : 'active');
  };

  const persistPending = useCallback(async (pending: PendingWrite) => {
    if (!evaluation) return;
    setSaving(true);
    setSaveError(null);
    try {
      const nowDate = appNow();
      const answeredAt = pending.answeredAt;
      const cardKey = deriveCardKey(pending.item);
      const scheduledCardKeys = evaluation.scheduledCardKeys ?? [];
      // Recompute from persisted evaluation state; selector metadata is advisory and may be stale after resume/retry.
      const schedulingEligible = !scheduledCardKeys.includes(cardKey);
      const schedulingReason = schedulingEligible ? 'first_card_evidence' : 'same_evaluation_template_repeat';
      const existing = await itemStateRepo.get(studentId, cardKey);
      const misconceptionUpdate = schedulingEligible
        ? buildUpdatedState(studentId, evaluation.id, pending.item, existing, pending, nowDate)
        : undefined;
      const updatedState = misconceptionUpdate?.state;
      const schedulingApplied = misconceptionUpdate?.schedulingApplied ?? false;
      const stateAfter = updatedState ?? existing ?? createInitialState(studentId, pending.item);
      const event: MathAnswerEvent = {
        id: pending.eventId,
        studentId,
        sessionId: evaluation.id,
        itemId: pending.item.id,
        cardKey,
        schemaId: pending.item.schemaId,
        mode: 'goal_evaluation',
        promptShown: pending.item.prompt,
        correctAnswer: pending.item.answer,
        studentAnswer: pending.studentAnswer,
        isCorrect: pending.isCorrect,
        isRetry: false,
        hintUsed: false,
        latencyMs: pending.latencyMs,
        ratingReason: pending.ratingReason,
        responsePolicy: pending.responsePolicy,
        fluencyBand: pending.fluencyBand,
        detectedMisconceptions: misconceptionUpdate?.detected.length ? misconceptionUpdate.detected : undefined,
        confirmedMisconceptions: misconceptionUpdate?.confirmed.length ? misconceptionUpdate.confirmed : undefined,
        reviewGrade: pending.reviewGrade,
        factStatusBefore: existing?.masteryLevel ?? 'new',
        factStatusAfter: stateAfter.masteryLevel,
        schedulingEligible,
        schedulingApplied,
        schedulerErrorCode: misconceptionUpdate?.schedulerErrorCode,
        schedulingReason,
        schedulingTelemetry: buildSchedulingTelemetry({
          item: pending.item,
          stateBefore: existing ?? createInitialState(studentId, pending.item),
          stateAfter: schedulingApplied ? stateAfter : undefined,
          response: { reviewGrade: pending.reviewGrade, ratingReason: pending.ratingReason, responsePolicy: pending.responsePolicy, fluencyBand: pending.fluencyBand, hintUsed: false, isRetry: false, schedulingEligible, schedulingApplied, schedulerErrorCode: misconceptionUpdate?.schedulerErrorCode },
          selection: { origin: 'goal', rationaleCodes: ['active_goal', 'diagnostic_coverage', schedulingReason] },
          presentationIndex: 1, attemptNo: 1, now: nowDate,
          schedulingReason,
        }),
        createdAt: answeredAt,
      };
      const attempt: AttemptLog = {
        id: pending.attemptId,
        studentId,
        itemId: pending.item.id,
        skillId: pending.item.skillId,
        sessionId: evaluation.id,
        promptShown: pending.item.prompt,
        correctAnswer: pending.item.answer,
        studentAnswer: pending.studentAnswer,
        isCorrect: pending.isCorrect,
        latencyMs: pending.latencyMs,
        reviewGrade: pending.reviewGrade,
        createdAt: answeredAt,
      };
      const nextAnswers = evaluation.answers.some(answer => answer.eventId === pending.eventId)
        ? evaluation.answers
        : [...evaluation.answers, {
            eventId: pending.eventId,
            attemptId: pending.attemptId,
            itemId: pending.item.id,
            skillId: pending.skillId,
            answeredAt,
            isCorrect: pending.isCorrect,
            studentAnswer: pending.studentAnswer,
            latencyMs: pending.latencyMs,
            reviewGrade: pending.reviewGrade,
          }];
      const nextResponses: AdaptiveGoalEvaluationResponse[] = nextAnswers.map(answer => ({
        itemId: answer.itemId,
        skillId: answer.skillId,
        isCorrect: answer.isCorrect,
        latencyMs: answer.latencyMs,
        answeredAt: answer.answeredAt,
      }));
      const complete = nextAnswers.length >= ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT;
      const completedResult = complete
        ? buildAdaptiveGoalEvaluationResult({
            studentId,
            seed: evaluation.seed ?? 1,
            now: nowDate.toISOString(),
            mathAnswerEvents: [...events.filter(item => item.id !== event.id), event],
            itemStates: updatedState ? [...itemStates.filter(item => item.cardKey !== updatedState.cardKey), updatedState] : itemStates,
            responses: nextResponses,
          })
        : null;
      const nextEvaluation: GoalEvaluation = {
        ...evaluation,
        status: complete ? 'completed' : 'in_progress',
        completedAt: complete ? answeredAt : evaluation.completedAt,
        currentQuestionIndex: nextAnswers.length,
        itemIds: Array.from(new Set([...evaluation.itemIds, pending.item.id])),
        targetSkillIds: completedResult?.topGoalCandidates.map(candidate => candidate.skillId) ?? evaluation.targetSkillIds,
        answers: nextAnswers,
        scheduledCardKeys: schedulingApplied ? [...scheduledCardKeys, cardKey] : scheduledCardKeys,
        answerEvents: [...(evaluation.answerEvents ?? []).filter(item => item.id !== event.id), event],
        updatedAt: answeredAt,
      };
      await recordGoalEvaluationAnswer({ event, attempt, updatedState, evaluation: nextEvaluation });
      setEvaluation(nextEvaluation);
      setEvents(current => [...current.filter(item => item.id !== event.id), event]);
      if (updatedState) {
        setItemStates(current => [...current.filter(item => !(item.studentId === updatedState.studentId && item.cardKey === updatedState.cardKey)), updatedState]);
      }
      setPendingWrite(null);
      if (complete) {
        if (authState().signedIn) pushLocal().catch(console.warn);
        setPhase('results');
      } else {
        setPhase('feedback');
        window.setTimeout(() => continueRef.current?.focus(), FEEDBACK_MS);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your answer yet.');
    } finally {
      setSaving(false);
    }
  }, [evaluation, events, itemStates, studentId]);

  const submit = useCallback(() => {
    if (!currentItem || !selection || saving || phase !== 'active' || !input.trim()) return;
    const latencyMs = Math.max(1, Math.round(performance.now() - startMsRef.current));
    const checked = checkAnswer(currentItem, input, latencyMs);
    const pending: PendingWrite = {
      eventId: generateId(),
      attemptId: generateId(),
      answeredAt: appNow().toISOString(),
      latencyMs,
      studentAnswer: checked.studentAnswer,
      isCorrect: checked.isCorrect,
      reviewGrade: checked.reviewGrade,
      ratingReason: checked.ratingReason,
      responsePolicy: checked.policyKind,
      fluencyBand: checked.fluencyBand,
      item: currentItem,
      skillId: selection.skillId,
      cardKey: selection.cardKey,
      schedulingEligible: selection.schedulingEligible,
      schedulingReason: selection.schedulingReason,
    };
    setInput('');
    setFeedback(checked.isCorrect ? 'correct' : 'wrong');
    setPendingWrite(pending);
    setPhase('feedback');
    void persistPending(pending);
  }, [currentItem, input, persistPending, phase, saving, selection]);

  const retrySave = () => {
    if (pendingWrite && !saving) void persistPending(pendingWrite);
  };

  const continueNext = () => {
    if (saving || saveError) return;
    setFeedback(null);
    setInput('');
    setPhase('active');
  };

  const confirmCancel = async () => {
    if (evaluation?.status === 'in_progress') await goalEvaluationRepo.cancel(evaluation.id, appNow().toISOString());
    onCancel();
  };

  useEffect(() => {
    if (phase !== 'active' || !currentItem) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setShowCancelConfirm(true); return; }
      if (event.key === 'Enter') { if (input.trim()) { event.preventDefault(); submit(); } return; }
      if (currentItem.answerInput === 'choice') {
        const choices = currentItem.choices ?? [];
        if (/^[1-9]$/.test(event.key)) {
          const choice = choices[Number(event.key) - 1];
          if (choice !== undefined) { event.preventDefault(); setInput(String(choice)); }
        }
        return;
      }
      if (/^[0-9]$/.test(event.key)) { event.preventDefault(); setInput(value => value + event.key); }
      if (event.key === 'Backspace') { event.preventDefault(); setInput(value => value.slice(0, -1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentItem, input, phase, submit]);

  if (phase === 'loading') return <div style={s.container}><p>Loading evaluation...</p></div>;

  if (phase === 'error') {
    return (
      <div style={s.container}>
        <div role="alert" style={s.card}>
          <h1 style={s.title}>Evaluation could not load.</h1>
          <p style={s.body}>{saveError}</p>
          <button style={s.primaryBtn} onClick={onCancel}>Back to Goals</button>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    const hasResume = Boolean(evaluation && evaluation.status === 'in_progress' && evaluation.answers.length > 0);
    return (
      <div style={s.container}>
        <div style={s.card}>
          <h1 style={s.title}>Adaptive Goal Evaluation</h1>
          <p style={s.body}>Exactly 30 questions across different Grade 3 skills.</p>
          <p style={s.body}>No timer pressure. Take your time and do your best.</p>
          <p style={s.body}>Results separate new goal learning from skills that belong in Daily Review.</p>
          {saveError && <p role="alert" style={s.errorText}>{saveError}</p>}
          {hasResume && <button style={s.primaryBtn} onClick={resume}>Resume question {(evaluation?.answers.length ?? 0) + 1}</button>}
          <button style={hasResume ? s.secondaryBtn : s.primaryBtn} disabled={saving} onClick={startNew}>
            {saving ? 'Starting...' : hasResume ? 'Start over' : 'Start'}
          </button>
          <button style={s.secondaryBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  if (phase === 'results' && result && evaluation) {
    const newLearning = buildNewLearningCandidates(result, events, itemStates);
    const review = buildReviewFindings(itemStates, now);
    return (
      <div style={s.containerWide}>
        <header style={s.header}>
          <button style={s.secondaryBtn} onClick={onReturnToGoals}>Back to Goals</button>
          <div>
            <h1 style={s.title}>Evaluation Results</h1>
            <p style={s.body}>Nice work finishing all 30 questions.</p>
          </div>
        </header>

        <section style={s.section} aria-labelledby="strengths-title">
          <h2 id="strengths-title" style={s.sectionTitle}>Strengths</h2>
          {result.strengths.length === 0 ? <p style={s.body}>The evaluation is still looking for clear strengths.</p> : (
            <div style={s.list}>{result.strengths.map(item => <span key={item.skillId} style={s.pill}>{skillTitle(item.skillId)}</span>)}</div>
          )}
        </section>

        <section style={s.section} aria-labelledby="new-learning-title">
          <h2 id="new-learning-title" style={s.sectionTitle}>New or Unfinished Learning for Goals</h2>
          {newLearning.length === 0 ? <p style={s.body}>No new goal-ready skills stood out yet.</p> : (
            <div style={s.grid}>
              {newLearning.map(candidate => (
                <article key={candidate.skillId} style={s.resultCard}>
                  <h3 style={s.cardTitle}>{candidate.title}</h3>
                  <p style={s.body}>{candidate.state} · {candidate.unseenCount} learning unit{candidate.unseenCount === 1 ? '' : 's'} · {candidate.workload}</p>
                  <p style={s.body}>{candidate.advisory}</p>
                  <p style={s.body}>{Math.round(candidate.confidence * 100)}% recommendation confidence</p>
                  <button style={s.primaryBtn} onClick={() => onSelectGoalSkills([candidate.skillId])}>Continue to Add Goal review</button>
                </article>
              ))}
            </div>
          )}
          {newLearning.length > 1 && (
            <button style={s.secondaryBtn} onClick={() => onSelectGoalSkills(newLearning.slice(0, 3).map(item => item.skillId))}>
              Select top recommendations
            </button>
          )}
        </section>

        <section style={s.section} aria-labelledby="daily-review-title">
          <h2 id="daily-review-title" style={s.sectionTitle}>Review in Daily Review</h2>
          <p style={s.body}>Scheduled practice will appear under Daily Review. These are not Daily New for Goals.</p>
          {review.length === 0 ? <p style={s.body}>No review needs stood out from previous practice.</p> : (
            <div style={s.list}>
              {review.map(item => (
                <span key={item.skillId} style={s.reviewPill}>{item.title}: {item.dueCount} due, {item.weakCount} learning</span>
              ))}
            </div>
          )}
          {review.length > 0 && <button style={s.secondaryBtn} onClick={onGoToDailyReview}>Go to Daily Review</button>}
        </section>

        <button style={s.secondaryBtn} onClick={onReturnToGoals}>Return to Goals</button>
      </div>
    );
  }

  if (!currentItem || !selection || !evaluation) return null;

  const isChoice = currentItem.answerInput === 'choice';
  const progress = Math.round((evaluation.answers.length / ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT) * 100);

  return (
    <div style={s.container}>
      <div style={s.progressWrap} aria-label={`Question ${evaluation.answers.length + 1} of ${ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT}`}>
        <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${progress}%` }} /></div>
        <span style={s.progressText}>{evaluation.answers.length + 1} / {ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT}</span>
        <button style={s.iconBtn} aria-label="Cancel evaluation" onClick={() => setShowCancelConfirm(true)}>x</button>
      </div>

      <div style={s.questionCard}>
        <div style={s.badge}>Adaptive Goal Evaluation</div>
        <QuestionRenderer item={currentItem} mode="practice" showVisual />
        {feedback === 'correct' && <div style={s.feedbackCorrect}>Correct!</div>}
        {feedback === 'wrong' && <div style={s.feedbackWrong}>Nice try. Keep going.</div>}
        {saving && <p style={s.body}>Saving...</p>}
        {saveError && (
          <div role="alert" style={s.errorBox}>
            <p style={s.errorText}>{saveError}</p>
            <button style={s.primaryBtn} onClick={retrySave}>Retry save</button>
          </div>
        )}
      </div>

      {phase === 'active' && (
        <div style={s.inputArea}>
          {isChoice ? (
            <div style={s.choiceRow}>
              {(currentItem.choices ?? []).map(choice => (
                <button key={String(choice)} style={s.choiceBtn} onClick={() => setInput(String(choice))}>{String(choice)}</button>
              ))}
            </div>
          ) : (
            <>
              <div style={s.inputDisplay}>{input || '?'}</div>
              <NumPad value={input} onChange={setInput} allowDecimal={false} onSubmit={submit} />
            </>
          )}
          {input && <button style={s.primaryBtn} disabled={saving} onClick={submit}>Check</button>}
        </div>
      )}

      {phase === 'feedback' && !saveError && (
        <button ref={continueRef} style={s.primaryBtn} disabled={saving} onClick={continueNext}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      )}

      {showCancelConfirm && (
        <div style={s.overlay} role="presentation" onMouseDown={() => setShowCancelConfirm(false)}>
          <div style={s.dialog} role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
            <h2 style={s.sectionTitle}>Cancel evaluation?</h2>
            <p style={s.body}>Your saved answers stay local, and this evaluation will not be offered for resume.</p>
            <button style={s.secondaryBtn} onClick={() => setShowCancelConfirm(false)}>Keep going</button>
            <button style={s.primaryBtn} onClick={confirmCancel}>Cancel evaluation</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  container: { maxWidth: '520px', margin: '0 auto', padding: '16px', minHeight: '100dvh', fontFamily: 'system-ui, sans-serif' },
  containerWide: { maxWidth: '760px', margin: '0 auto', padding: '16px', minHeight: '100dvh', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '20px', display: 'grid', gap: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  title: { fontSize: '26px', fontWeight: 800, margin: 0, color: '#1f2937' },
  body: { fontSize: '14px', color: '#4b5563', margin: 0, lineHeight: 1.45 },
  primaryBtn: { padding: '12px 14px', background: 'var(--primary, #4f46e5)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation' },
  secondaryBtn: { padding: '10px 12px', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation' },
  progressWrap: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  progressBar: { flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--primary, #4f46e5)' },
  progressText: { minWidth: '54px', fontWeight: 700, color: '#4b5563' },
  iconBtn: { width: '34px', height: '34px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: '8px', cursor: 'pointer' },
  questionCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '18px', display: 'grid', gap: '12px', justifyItems: 'center', marginBottom: '14px' },
  badge: { justifySelf: 'start', fontSize: '11px', fontWeight: 800, color: '#155e75', background: '#ecfeff', padding: '4px 8px', borderRadius: '999px' },
  feedbackCorrect: { color: '#15803d', fontWeight: 800, fontSize: '18px' },
  feedbackWrong: { color: '#b45309', fontWeight: 800, fontSize: '17px' },
  inputArea: { display: 'grid', gap: '10px', justifyItems: 'center' },
  inputDisplay: { minHeight: '52px', fontSize: '40px', fontWeight: 800, color: 'var(--primary, #4f46e5)' },
  choiceRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' },
  choiceBtn: { minWidth: '58px', padding: '12px 16px', borderRadius: '8px', border: '2px solid #e5e7eb', background: '#fff', fontSize: '22px', fontWeight: 800, cursor: 'pointer' },
  errorBox: { display: 'grid', gap: '8px', justifyItems: 'center' },
  errorText: { color: '#b91c1c', margin: 0, fontSize: '14px' },
  section: { borderTop: '1px solid #e5e7eb', padding: '16px 0', display: 'grid', gap: '10px' },
  sectionTitle: { fontSize: '19px', margin: 0, color: '#111827' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' },
  resultCard: { border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', display: 'grid', gap: '8px', background: '#fff' },
  cardTitle: { margin: 0, fontSize: '16px', color: '#111827' },
  list: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  pill: { border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', borderRadius: '999px', padding: '6px 10px', fontSize: '13px', fontWeight: 700 },
  reviewPill: { border: '1px solid #fed7aa', background: '#fff7ed', color: '#9a3412', borderRadius: '999px', padding: '6px 10px', fontSize: '13px', fontWeight: 700 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  dialog: { width: 'min(360px, calc(100vw - 32px))', background: '#fff', borderRadius: '8px', padding: '18px', display: 'grid', gap: '10px' },
};
