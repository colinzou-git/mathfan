import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { StudentProfile, StudentItemState } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
import type { GoalRecommendation } from './goalRecommendationEngine';
import type { GoalSkillTarget, GoalTargetReason, LearningGoal } from './types';
import {
  goalEventRepo,
  itemStateRepo,
  learningGoalRepo,
  mathAnswerEventRepo,
} from '../../db/repositories';
import { generateId } from '../../utils/id';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { GRADE3_MASTERY_MAP, getGrade3Skill } from '../mastery/grade3MasteryMap';
import { deriveGrade3SkillSummaries } from '../mastery/skillMasteryEngine';
import { appNow } from '../time/clock';
import {
  applyGoalTargetEdits,
  buildGoalSkillTarget,
  calculateGoalProgress,
  captureGoalBaseline,
  localDateInTimeZone,
  suggestedTargetDefaults,
  type GoalEvidenceInput,
  type GoalProgress,
  type GoalTargetEditDraft,
} from './goalEngine';
import {
  estimateGoalWorkload,
  recommendLearningGoals,
} from './goalRecommendationEngine';
import {
  cancelGoal,
  endGoal,
  evaluateGoalLifecycleAndPersist,
  pauseGoal,
  resumeGoal,
  updateGoal,
} from './goalLifecycleService';

interface Props {
  profile: StudentProfile;
  lastSyncedAt?: string | null;
  onBack: () => void;
  onStartEvaluation: () => void;
}

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: GoalsData };

interface GoalsData {
  goals: LearningGoal[];
  events: MathAnswerEvent[];
  itemStates: StudentItemState[];
  skillSummaries: StudentSkillSummary[];
  now: string;
}

interface GoalView {
  goal: LearningGoal;
  progress: GoalProgress;
}

type WizardMode = { kind: 'create' } | { kind: 'edit'; goal: LearningGoal };
type ConfirmAction = { kind: 'end' | 'cancel'; goal: LearningGoal } | null;

const DEFAULT_DURATION_DAYS = 7;
const MIN_DURATION_DAYS = 1;
const MAX_DURATION_DAYS = 30;
const STATUS_LABELS: Record<LearningGoal['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DURATION_DAYS;
  return Math.max(MIN_DURATION_DAYS, Math.min(MAX_DURATION_DAYS, Math.round(value)));
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function targetDateFor(startDate: string, durationDays: number): string {
  return addDays(startDate, Math.max(0, durationDays - 1));
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function skillTitle(skillId: string): string {
  return getGrade3Skill(skillId)?.title ?? skillId;
}

function reasonForSummary(summary?: StudentSkillSummary): GoalTargetReason {
  if (!summary || summary.status === 'new') return 'needs_evaluation';
  if (summary.status === 'review_due') return 'review_due';
  if (summary.status === 'needs_practice') return 'needs_practice';
  if (summary.status === 'strong') return 'continue_progress';
  return 'ready_next';
}

function buildCompleteSummaries(studentId: string, summaries: StudentSkillSummary[]): StudentSkillSummary[] {
  const byId = new Map(summaries.map(summary => [summary.skillId, summary]));
  return GRADE3_MASTERY_MAP.map(skill => byId.get(skill.id) ?? {
    studentId,
    skillId: skill.id,
    status: 'new',
    attemptCount: 0,
    correctCount: 0,
    accuracy: 0,
    dueItemCount: 0,
    itemCount: 0,
    mistakePatterns: [],
  });
}

function directFirstAttempts(events: MathAnswerEvent[], studentId: string): MathAnswerEvent[] {
  return events.filter(event => event.studentId === studentId && !event.isRetry && !event.relatedEvidence);
}

function goalPracticeEvents(events: MathAnswerEvent[], studentId: string): MathAnswerEvent[] {
  return directFirstAttempts(events, studentId).filter(event => event.goalId);
}

function activeLearningDays(events: MathAnswerEvent[], studentId: string, timezone: string): number {
  return new Set(goalPracticeEvents(events, studentId).map(event => localDateInTimeZone(event.createdAt, timezone))).size;
}

function evidenceInput(data: GoalsData, profile: StudentProfile): GoalEvidenceInput {
  return {
    studentId: profile.id,
    events: data.events,
    itemStates: data.itemStates,
    skillSummaries: data.skillSummaries,
    now: data.now,
    timezone: profile.timezone,
  };
}

async function loadGoalsData(profile: StudentProfile): Promise<GoalsData> {
  const now = appNow().toISOString();
  const [goals, events, itemStates] = await Promise.all([
    learningGoalRepo.list(profile.id),
    mathAnswerEventRepo.getAll(profile.id),
    itemStateRepo.getForStudent(profile.id),
  ]);
  const derived = deriveGrade3SkillSummaries({
    studentId: profile.id,
    items: makeItemFromId,
    mathAnswerEvents: events,
    itemStates,
    now,
  });
  return {
    goals,
    events,
    itemStates,
    skillSummaries: buildCompleteSummaries(profile.id, derived),
    now,
  };
}

function sectionedViews(data: GoalsData, profile: StudentProfile): {
  active: GoalView[];
  paused: GoalView[];
  history: GoalView[];
} {
  const input = evidenceInput(data, profile);
  const views = data.goals
    .map(goal => ({ goal, progress: calculateGoalProgress(goal, input) }))
    .sort((a, b) => b.goal.updatedAt.localeCompare(a.goal.updatedAt));
  return {
    active: views.filter(view => view.goal.status === 'active'),
    paused: views.filter(view => view.goal.status === 'paused'),
    history: views.filter(view => view.goal.status === 'completed' || view.goal.status === 'ended' || view.goal.status === 'cancelled'),
  };
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={s.summaryCard}>
      <div style={s.summaryValue}>{value}</div>
      <div style={s.summaryLabel}>{label}</div>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p style={s.empty}>{children}</p>;
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div style={s.progressHeader}>
        <span>{label}</span>
        <strong>{percent(value)}</strong>
      </div>
      <div style={s.progressTrack} aria-hidden="true">
        <div style={{ ...s.progressFill, width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function GoalCard({
  view,
  history,
  onEdit,
  onPause,
  onResume,
  onEnd,
  onCancel,
}: {
  view: GoalView;
  history?: boolean;
  onEdit: (goal: LearningGoal) => void;
  onPause: (goal: LearningGoal) => void;
  onResume: (goal: LearningGoal) => void;
  onEnd: (goal: LearningGoal) => void;
  onCancel: (goal: LearningGoal) => void;
}) {
  const { goal, progress } = view;
  const attempts = progress.targets.reduce((sum, target) => sum + target.firstAttemptCount, 0);
  const correct = progress.targets.reduce((sum, target) => sum + target.correctCount, 0);
  const today = progress.targets.reduce((sum, target) => sum + target.questionsCompletedToday, 0);
  const unmetPrereqs = Array.from(new Set(goal.targets.flatMap(target => {
    const node = getGrade3Skill(target.skillId);
    if (!node) return [];
    return node.prerequisites
      .filter(prereq => !goal.targets.some(t => t.skillId === prereq))
      .map(skillTitle);
  })));
  const finalDate = goal.completedAt ?? goal.endedAt ?? goal.updatedAt;

  return (
    <article style={s.goalCard}>
      <div style={s.goalTop}>
        <div>
          <h3 style={s.goalTitle}>{goal.title}</h3>
          <p style={s.goalMeta}>
            {STATUS_LABELS[goal.status]} · {goal.startDate} to {goal.targetDate}
            {!history && ` · ${Math.max(0, progress.daysRemaining)} day${Math.max(0, progress.daysRemaining) === 1 ? '' : 's'} left`}
          </p>
        </div>
        <span style={s.statusPill}>{STATUS_LABELS[goal.status]}</span>
      </div>

      <ProgressBar value={progress.overallProgress} label="Overall progress" />

      <div style={s.factRow}>
        <span>{attempts} questions since start</span>
        <span>{today} today</span>
        <span>{attempts ? percent(correct / attempts) : 'No accuracy yet'}</span>
      </div>

      {unmetPrereqs.length > 0 && (
        <p role="note" style={s.advisory}>
          This goal may feel easier after reviewing: {unmetPrereqs.join(', ')}.
        </p>
      )}

      <div style={s.targetList}>
        {progress.targets.map(target => (
          <div key={target.target.id} style={s.targetRow}>
            <div>
              <strong>{skillTitle(target.skillId)}</strong>
              <span style={s.targetSub}>
                {target.firstAttemptCount}/{target.target.minFirstAttempts} questions · {target.distinctItemCount}/{target.target.minDistinctItems} items · {percent(target.accuracy)}
              </span>
            </div>
            <span style={s.targetPct}>{percent(target.displayScore)}</span>
          </div>
        ))}
      </div>

      {history ? (
        <p style={s.historyText}>
          Final evidence: {progress.completedTargetCount} of {progress.totalTargetCount} targets complete, {attempts} goal-practice questions. Closed {finalDate.slice(0, 10)}.
        </p>
      ) : (
        <div style={s.actions}>
          <button style={s.secondaryBtn} onClick={() => onEdit(goal)}>Edit</button>
          {goal.status === 'paused'
            ? <button style={s.secondaryBtn} onClick={() => onResume(goal)}>Resume</button>
            : <button style={s.secondaryBtn} onClick={() => onPause(goal)}>Pause</button>}
          <button style={s.secondaryBtn} onClick={() => onEnd(goal)}>End</button>
          <button style={s.textDangerBtn} onClick={() => onCancel(goal)}>Cancel</button>
        </div>
      )}
    </article>
  );
}

export function GoalsPage({ profile, lastSyncedAt, onBack, onStartEvaluation }: Props) {
  const [page, setPage] = useState<PageState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [wizard, setWizard] = useState<WizardMode | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const refresh = () => {
    setPage({ status: 'loading' });
    setRefreshKey(key => key + 1);
  };

  useEffect(() => {
    let alive = true;
    loadGoalsData(profile)
      .then(async data => {
        const input = evidenceInput(data, profile);
        const goalEvents = await goalEventRepo.getForStudent(profile.id);
        let changed = false;
        for (const goal of data.goals.filter(g => g.status === 'active')) {
          const next = await evaluateGoalLifecycleAndPersist(
            goal,
            calculateGoalProgress(goal, input),
            goalEvents,
            data.now,
          );
          changed = changed || next.status !== goal.status || next.updatedAt !== goal.updatedAt;
        }
        const latest = changed ? await loadGoalsData(profile) : data;
        if (alive) setPage({ status: 'ready', data: latest });
      })
      .catch(err => {
        if (alive) setPage({ status: 'error', message: err instanceof Error ? err.message : 'Could not load goals.' });
      });
    return () => { alive = false; };
  }, [profile, lastSyncedAt, refreshKey]);

  const ready = page.status === 'ready' ? page.data : null;
  const views = useMemo(() => ready ? sectionedViews(ready, profile) : null, [ready, profile]);

  const handleTransition = async (goal: LearningGoal, action: 'pause' | 'resume' | 'end' | 'cancel') => {
    const now = appNow().toISOString();
    try {
      if (action === 'pause') await pauseGoal(goal, now);
      if (action === 'resume') await resumeGoal(goal, now);
      if (action === 'end') await endGoal(goal, now);
      if (action === 'cancel') await cancelGoal(goal, now);
      refresh();
    } catch (err) {
      setPage({ status: 'error', message: err instanceof Error ? err.message : 'Could not update this goal.' });
    }
  };

  const summary = ready ? {
    active: ready.goals.filter(goal => goal.status === 'active').length,
    completed: ready.goals.filter(goal => goal.status === 'completed').length,
    questions: goalPracticeEvents(ready.events, profile.id).length,
    activeDays: activeLearningDays(ready.events, profile.id, profile.timezone),
  } : null;

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={onBack}>Back</button>
        <div>
          <h1 style={s.title}>Goals</h1>
          <p style={s.subtitle}>Set learning goals and see your recommended plan.</p>
        </div>
      </header>

      {page.status === 'loading' && <p style={s.loading}>Loading goals...</p>}

      {page.status === 'error' && (
        <div role="alert" style={s.errorBox}>
          <p style={s.errorTitle}>Goals could not load.</p>
          <p style={s.errorText}>{page.message}</p>
          <button style={s.primaryBtn} onClick={refresh}>Try again</button>
        </div>
      )}

      {ready && views && summary && (
        <>
          <div style={s.summaryGrid} aria-label="Goals summary">
            <SummaryCard label="Active goals" value={summary.active} />
            <SummaryCard label="Completed goals" value={summary.completed} />
            <SummaryCard label="Goal-practice questions" value={summary.questions} />
            <SummaryCard label="Active learning days" value={summary.activeDays} />
          </div>

          <div style={s.toolbar}>
            <button style={s.primaryBtn} onClick={() => setWizard({ kind: 'create' })}>Add Goal</button>
            <button style={s.secondaryBtn} onClick={onStartEvaluation}>Evaluation</button>
            <button style={s.secondaryBtn} onClick={refresh}>Refresh</button>
          </div>

          <section aria-labelledby="active-goals">
            <h2 id="active-goals" style={s.sectionTitle}>Active Goals</h2>
            {views.active.length === 0 ? (
              <EmptyState>No active goals yet. Add one when you are ready to practice with a target.</EmptyState>
            ) : views.active.map(view => (
              <GoalCard
                key={view.goal.id}
                view={view}
                onEdit={goal => setWizard({ kind: 'edit', goal })}
                onPause={goal => handleTransition(goal, 'pause')}
                onResume={goal => handleTransition(goal, 'resume')}
                onEnd={goal => setConfirmAction({ kind: 'end', goal })}
                onCancel={goal => setConfirmAction({ kind: 'cancel', goal })}
              />
            ))}
          </section>

          <section aria-labelledby="paused-goals">
            <h2 id="paused-goals" style={s.sectionTitle}>Paused Goals</h2>
            {views.paused.length === 0 ? (
              <EmptyState>No paused goals.</EmptyState>
            ) : views.paused.map(view => (
              <GoalCard
                key={view.goal.id}
                view={view}
                onEdit={goal => setWizard({ kind: 'edit', goal })}
                onPause={goal => handleTransition(goal, 'pause')}
                onResume={goal => handleTransition(goal, 'resume')}
                onEnd={goal => setConfirmAction({ kind: 'end', goal })}
                onCancel={goal => setConfirmAction({ kind: 'cancel', goal })}
              />
            ))}
          </section>

          <section aria-labelledby="goal-history">
            <h2 id="goal-history" style={s.sectionTitle}>Goal History</h2>
            {views.history.length === 0 ? (
              <EmptyState>No goal history yet.</EmptyState>
            ) : views.history.map(view => (
              <GoalCard
                key={view.goal.id}
                view={view}
                history
                onEdit={() => {}}
                onPause={() => {}}
                onResume={() => {}}
                onEnd={() => {}}
                onCancel={() => {}}
              />
            ))}
          </section>
        </>
      )}

      {wizard && ready && (
        <GoalWizard
          mode={wizard}
          profile={profile}
          data={ready}
          onStartEvaluation={onStartEvaluation}
          onClose={() => setWizard(null)}
          onSaved={() => {
            setWizard(null);
            refresh();
          }}
        />
      )}

      {confirmAction && (
        <ConfirmDialog
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction;
            setConfirmAction(null);
            handleTransition(action.goal, action.kind);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDialog({ action, onClose, onConfirm }: {
  action: NonNullable<ConfirmAction>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={s.overlay} role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        style={s.dialog}
        onMouseDown={event => event.stopPropagation()}
      >
        <h2 id="confirm-title" style={s.dialogTitle}>
          {action.kind === 'end' ? 'End this goal?' : 'Cancel this goal?'}
        </h2>
        <p style={s.dialogText}>
          This keeps the goal in history with its current evidence. Nothing is deleted.
        </p>
        <div style={s.actions}>
          <button style={s.secondaryBtn} onClick={onClose}>Keep goal</button>
          <button style={s.dangerBtn} onClick={onConfirm}>
            {action.kind === 'end' ? 'End goal' : 'Cancel goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoalWizard({
  mode,
  profile,
  data,
  onStartEvaluation,
  onClose,
  onSaved,
}: {
  mode: WizardMode;
  profile: StudentProfile;
  data: GoalsData;
  onStartEvaluation: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const nowDate = data.now.slice(0, 10);
  const editing = mode.kind === 'edit' ? mode.goal : null;
  const [step, setStep] = useState(1);
  const [durationDays, setDurationDays] = useState(editing?.durationDays ?? DEFAULT_DURATION_DAYS);
  const [startDate, setStartDate] = useState(editing?.startDate ?? nowDate);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [selectedRecommendation, setSelectedRecommendation] = useState<GoalRecommendation | null>(null);
  const [browseAll, setBrowseAll] = useState(Boolean(editing));
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(editing?.targets.map(target => target.skillId) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capacity = estimateGoalWorkload({
    studentId: profile.id,
    skillSummaries: data.skillSummaries,
    events: data.events,
    itemStates: data.itemStates,
    activeGoals: data.goals.filter(goal => goal.status === 'active' && goal.id !== editing?.id),
    settings: profile.settings,
    durationDays,
    now: data.now,
    timezone: profile.timezone,
  });
  const recommendationResult = recommendLearningGoals({
    studentId: profile.id,
    skillSummaries: data.skillSummaries,
    events: data.events,
    itemStates: data.itemStates,
    activeGoals: data.goals.filter(goal => goal.status === 'active' && goal.id !== editing?.id),
    settings: profile.settings,
    durationDays,
    now: data.now,
    timezone: profile.timezone,
  });
  const maxSkills = durationDays <= 1 ? 1 : durationDays <= 7 ? 2 : 3;
  const targetDate = targetDateFor(startDate, durationDays);

  useEffect(() => {
    const firstButton = dialogRef.current?.querySelector('button, input') as HTMLElement | null;
    firstButton?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled])') ?? []);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggleSkill = (skillId: string) => {
    setSelectedRecommendation(null);
    setSelectedSkillIds(current => {
      if (current.includes(skillId)) return current.filter(id => id !== skillId);
      if (current.length >= maxSkills) return current;
      return [...current, skillId];
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const now = appNow().toISOString();
    const input = evidenceInput(data, profile);
    const makeTargetFromSkill = (skillId: string): GoalTargetEditDraft => {
      const existingTarget = editing?.targets.find(target => target.skillId === skillId);
      if (existingTarget) return existingTarget;
      const summary = data.skillSummaries.find(item => item.skillId === skillId);
      const reason = reasonForSummary(summary);
      const baseline = captureGoalBaseline(input, skillId);
      return {
        skillId,
        reason,
        baseline,
        ...suggestedTargetDefaults(reason, baseline),
      };
    };
    const drafts: GoalTargetEditDraft[] = selectedRecommendation
      ? selectedRecommendation.targets.map(target => ({
          skillId: target.skillId,
          reason: target.reason,
          baseline: target.baseline,
          ...target.thresholds,
        }))
      : selectedSkillIds.map(makeTargetFromSkill);

    if (drafts.length === 0) {
      setSaving(false);
      setError('Choose at least one skill for this goal.');
      return;
    }

    try {
      if (editing) {
        const targets = applyGoalTargetEdits(
          editing.targets,
          drafts,
          skillId => captureGoalBaseline(input, skillId),
          generateId,
        );
        await updateGoal(editing, {
          title: title.trim() || editing.title,
          durationDays,
          startDate,
          targetDate,
          targets,
        }, now);
      } else {
        const targets: GoalSkillTarget[] = drafts.map(draft =>
          buildGoalSkillTarget(draft, draft.baseline ?? captureGoalBaseline(input, draft.skillId), generateId())
        );
        const goal: LearningGoal = {
          id: generateId(),
          studentId: profile.id,
          title: title.trim() || (selectedRecommendation?.title ?? 'Learning Goal'),
          source: selectedRecommendation ? 'recommended' : 'manual',
          status: 'active',
          durationDays,
          startDate,
          targetDate,
          targets,
          createdAt: now,
          updatedAt: now,
        };
        await learningGoalRepo.create(goal, now);
        await goalEventRepo.append({
          id: generateId(),
          studentId: profile.id,
          goalId: goal.id,
          type: 'created',
          createdAt: now,
          message: 'Goal created',
        });
      }
      onSaved();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Could not save this goal.');
    }
  };

  return (
    <div style={s.overlay} role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-wizard-title"
        style={s.wizard}
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div style={s.wizardTop}>
          <h2 id="goal-wizard-title" style={s.dialogTitle}>{editing ? 'Edit Goal' : 'Add Goal'}</h2>
          <button style={s.iconBtn} aria-label="Close goal wizard" onClick={onClose}>x</button>
        </div>
        <p style={s.stepText}>Step {step} of 3</p>

        {step === 1 && (
          <div>
            <label style={s.label} htmlFor="goal-duration">Duration</label>
            <input
              id="goal-duration"
              aria-label="Goal duration in days"
              type="number"
              min={MIN_DURATION_DAYS}
              max={MAX_DURATION_DAYS}
              value={durationDays}
              onChange={event => setDurationDays(clampDuration(Number(event.target.value)))}
              style={s.input}
            />
            <div style={s.quickDurations}>
              {[1, DEFAULT_DURATION_DAYS, 30].map(days => (
                <button key={days} style={s.secondaryBtn} onClick={() => setDurationDays(days)}>
                  {days} day{days === 1 ? '' : 's'}
                </button>
              ))}
            </div>
            <p style={s.dialogText}>
              Starts {startDate}. Target date {targetDateFor(startDate, durationDays)}.
            </p>
            <p style={s.advisory}>
              Plan size: about {capacity.questionsPerDay} questions/day, {capacity.minutesPerDay} minutes/day, {capacity.totalQuestions} total questions.
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={s.recommendationHeader}>
              <h3 style={s.innerTitle}>Recommendations</h3>
              <button style={s.secondaryBtn} onClick={() => setBrowseAll(value => !value)}>Browse all skills</button>
            </div>
            {recommendationResult.recommendations.length === 0 ? (
              <EmptyState>No recommendations yet. A quick evaluation can help find a good starting point.</EmptyState>
            ) : (
              <div style={s.recommendationList}>
                {recommendationResult.recommendations.map(rec => {
                  const selected = selectedRecommendation === rec;
                  return (
                    <button
                      key={rec.skillIds.join('|')}
                      type="button"
                      style={{ ...s.recommendationCard, borderColor: selected ? 'var(--primary)' : '#e5e7eb' }}
                      onClick={() => {
                        setSelectedRecommendation(rec);
                        setSelectedSkillIds(rec.skillIds);
                        setTitle(rec.title);
                      }}
                    >
                      <strong>{rec.title}</strong>
                      <span>{rec.primaryReason}: {rec.explanation}</span>
                      <span>Skills: {rec.skillIds.map(skillTitle).join(', ')}</span>
                      <span>Target: {rec.targets.map(target => `${target.thresholds.minFirstAttempts} questions`).join(', ')}</span>
                      <span>{rec.estimatedTotalQuestions} total · {rec.estimatedQuestionsPerDay}/day · {rec.estimatedMinutesPerDay} min/day · {percent(rec.confidence)} confidence</span>
                      {rec.isStretch && <span style={s.stretch}>Stretch plan</span>}
                      {rec.prerequisiteAdvisories.length > 0 && <span style={s.advisoryInline}>Review nearby: {rec.prerequisiteAdvisories.join(', ')}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {browseAll && (
              <fieldset style={s.skillPicker}>
                <legend style={s.legend}>Choose up to {maxSkills} skill{maxSkills === 1 ? '' : 's'}</legend>
                {GRADE3_MASTERY_MAP.map(skill => {
                  const checked = selectedSkillIds.includes(skill.id);
                  const disabled = !checked && selectedSkillIds.length >= maxSkills;
                  return (
                    <label key={skill.id} style={s.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSkill(skill.id)}
                      />
                      <span>{skill.title}</span>
                    </label>
                  );
                })}
              </fieldset>
            )}
            <button style={s.secondaryBtn} onClick={onStartEvaluation}>Evaluation</button>
          </div>
        )}

        {step === 3 && (
          <div>
            <label style={s.label} htmlFor="goal-title">Goal title</label>
            <input
              id="goal-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              style={s.input}
            />
            <label style={s.label} htmlFor="goal-start">Start date</label>
            <input
              id="goal-start"
              type="date"
              value={startDate}
              onChange={event => setStartDate(event.target.value || nowDate)}
              style={s.input}
            />
            <p style={s.dialogText}>
              Target date {targetDate}. Selected skills: {selectedSkillIds.length ? selectedSkillIds.map(skillTitle).join(', ') : 'none yet'}.
            </p>
            <div style={s.targetList}>
              {(selectedRecommendation?.targets ?? selectedSkillIds.map(skillId => {
                const baseline = captureGoalBaseline(evidenceInput(data, profile), skillId);
                const reason = reasonForSummary(data.skillSummaries.find(summary => summary.skillId === skillId));
                return { skillId, reason, baseline, thresholds: suggestedTargetDefaults(reason, baseline) };
              })).map(target => (
                <div key={target.skillId} style={s.targetRow}>
                  <strong>{skillTitle(target.skillId)}</strong>
                  <span style={s.targetSub}>
                    {target.thresholds.minFirstAttempts} questions · {target.thresholds.minDistinctItems} items · {percent(target.thresholds.targetAccuracy)} accuracy
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p role="alert" style={s.errorText}>{error}</p>}

        <div style={s.actions}>
          <button style={s.secondaryBtn} onClick={step === 1 ? onClose : () => setStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button style={s.primaryBtn} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button style={s.primaryBtn} disabled={saving} onClick={save}>
              {saving ? 'Saving...' : 'Save Goal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  container: { maxWidth: '760px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '18px' },
  backBtn: { border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', borderRadius: '10px', padding: '9px 12px', fontWeight: 700, cursor: 'pointer' },
  title: { margin: 0, fontSize: '28px', lineHeight: 1.1, color: '#111827' },
  subtitle: { margin: '5px 0 0', color: '#6b7280', fontSize: '14px' },
  loading: { padding: '22px', textAlign: 'center', color: '#6b7280' },
  errorBox: { border: '1.5px solid #fecaca', background: '#fef2f2', borderRadius: '12px', padding: '16px' },
  errorTitle: { margin: '0 0 4px', fontWeight: 800, color: '#991b1b' },
  errorText: { margin: '4px 0 12px', color: '#991b1b', fontSize: '14px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' },
  summaryCard: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'center' },
  summaryValue: { fontSize: '24px', fontWeight: 800, color: '#111827' },
  summaryLabel: { fontSize: '12px', color: '#6b7280', marginTop: '2px' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '10px 0 18px' },
  primaryBtn: { background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 14px', fontWeight: 800, cursor: 'pointer' },
  secondaryBtn: { background: '#fff', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '9px 12px', fontWeight: 700, cursor: 'pointer' },
  dangerBtn: { background: '#dc2626', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 12px', fontWeight: 800, cursor: 'pointer' },
  textDangerBtn: { background: 'transparent', color: '#b91c1c', border: 'none', padding: '9px 8px', fontWeight: 700, cursor: 'pointer' },
  sectionTitle: { fontSize: '18px', margin: '18px 0 8px', color: '#111827' },
  empty: { border: '1.5px dashed #d1d5db', borderRadius: '8px', padding: '14px', color: '#6b7280', background: '#f9fafb', margin: 0 },
  goalCard: { border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '14px', background: '#fff', marginBottom: '10px' },
  goalTop: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' },
  goalTitle: { margin: 0, color: '#111827', fontSize: '17px' },
  goalMeta: { margin: '4px 0 0', color: '#6b7280', fontSize: '13px' },
  statusPill: { flex: '0 0 auto', border: '1px solid #bfdbfe', color: '#1d4ed8', background: '#eff6ff', borderRadius: '999px', padding: '3px 8px', fontSize: '12px', fontWeight: 700 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#374151', marginBottom: '4px' },
  progressTrack: { height: '8px', borderRadius: '999px', background: '#e5e7eb', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '999px', background: 'var(--primary)' },
  factRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', color: '#4b5563', fontSize: '13px' },
  advisory: { border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '8px', padding: '9px', color: '#92400e', fontSize: '13px', margin: '10px 0 0' },
  advisoryInline: { color: '#92400e' },
  targetList: { display: 'grid', gap: '8px', marginTop: '10px' },
  targetRow: { display: 'flex', justifyContent: 'space-between', gap: '10px', border: '1px solid #f3f4f6', borderRadius: '8px', padding: '8px', fontSize: '13px' },
  targetSub: { display: 'block', color: '#6b7280', marginTop: '2px' },
  targetPct: { fontWeight: 800, color: '#111827' },
  historyText: { margin: '10px 0 0', color: '#6b7280', fontSize: '13px' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px', alignItems: 'center' },
  overlay: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px' },
  dialog: { width: 'min(420px, 100%)', background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 18px 60px rgba(0,0,0,0.22)' },
  wizard: { width: 'min(680px, 100%)', maxHeight: '92dvh', overflow: 'auto', background: '#fff', borderRadius: '12px', padding: '18px', boxShadow: '0 18px 60px rgba(0,0,0,0.22)' },
  wizardTop: { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' },
  dialogTitle: { margin: 0, fontSize: '21px', color: '#111827' },
  dialogText: { color: '#4b5563', fontSize: '14px', margin: '10px 0' },
  iconBtn: { border: '1.5px solid #e5e7eb', background: '#fff', borderRadius: '8px', width: '34px', height: '34px', cursor: 'pointer', fontWeight: 800 },
  stepText: { color: '#6b7280', fontSize: '13px', margin: '4px 0 14px' },
  label: { display: 'block', color: '#374151', fontWeight: 800, fontSize: '13px', margin: '10px 0 5px' },
  input: { width: '100%', boxSizing: 'border-box', border: '1.5px solid #d1d5db', borderRadius: '10px', padding: '10px', font: 'inherit' },
  quickDurations: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
  recommendationHeader: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '8px' },
  innerTitle: { margin: 0, fontSize: '16px', color: '#111827' },
  recommendationList: { display: 'grid', gap: '8px' },
  recommendationCard: { display: 'grid', gap: '4px', width: '100%', textAlign: 'left', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '10px', cursor: 'pointer', color: '#374151' },
  stretch: { display: 'inline-block', color: '#7c2d12', fontWeight: 800 },
  skillPicker: { border: '1.5px solid #e5e7eb', borderRadius: '8px', margin: '12px 0', padding: '10px', maxHeight: '240px', overflow: 'auto' },
  legend: { padding: '0 6px', fontWeight: 800, color: '#374151' },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '14px' },
};
