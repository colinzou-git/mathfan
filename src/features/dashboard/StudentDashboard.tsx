import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PersistedDailyLessonPlan, StudentProfile, SessionConfig } from '../../types/math';
import { itemStateRepo, learningGoalRepo, mathAnswerEventRepo, sessionRepo } from '../../db/repositories';
import { computeTodayStats, computeStreak, eventsToAttemptLogs } from '../stats/statsEngine';
import { appNow } from '../time/clock';
import { describeItem } from '../curriculum/describeItem';
import { TodayAchievementSection } from '../stats/TodayAchievementSection';
import type { AchievementFilter, TodayAchievementData } from '../stats/todayAchievement';
import { deriveGrade3SkillSummaries, type StudentSkillSummary } from '../mastery/skillMasteryEngine';
import { GRADE3_MASTERY_MAP } from '../mastery/grade3MasteryMap';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { planDailyNewForGoals, type DailyNewGoalPlan, type DailyNewGoalTile } from '../goals/dailyNewGoalPlanner';
import { mulberry32 } from '../../utils/rng';
import { getOrCreateDailyLessonPlan, reconcileDailyLessonProgress } from '../learningPlan/dailyLessonPersistence';
import { regenerateDailyLessonPlan } from '../learningPlan/dailyLessonPersistence';
import type { PlanDailyLessonArgs } from '../learningPlan/dailyLessonPlanner';
import { learnerLocalDateKey } from '../time/localDate';
import { retryRecentRelatedEvidenceRepairs } from '../adaptive/relatedEvidenceRepair';

export type PracticeOp =
  | 'multiplication' | 'division' | 'addition' | 'subtraction' | 'fraction'
  | 'word' | 'rounding' | 'factors' | 'decimals'
  | 'area' | 'geometry' | 'measurement' | 'data' | 'pattern';

interface Props {
  profile: StudentProfile;
  lastSyncedAt?: string | null;
  onStartDailyReview: (config: SessionConfig) => void;
  onPickOperation: (op: PracticeOp) => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onStartQuiz: () => void;
  onOpenAchievementDetail: (filter: AchievementFilter, data: TodayAchievementData) => void;
  onOpenMasteryMap?: () => void;
  onOpenGoals?: () => void;
}

interface QuickStats {
  todayQuestions: number;
  todayAccuracy: number;
  todayMinutes: number;
  streak: number;
  dueCount: number;
}

interface DueGroup {
  label: string;
  icon: string;
  ids: string[];
}

const GROUP_DISPLAY: Record<string, { label: string; icon: string }> = {
  mul:         { label: 'Multiply',    icon: '✖️' },
  div:         { label: 'Divide',      icon: '➗' },
  add:         { label: 'Add',         icon: '➕' },
  sub:         { label: 'Subtract',    icon: '➖' },
  frac:        { label: 'Fractions',   icon: '🍕' },
  word:        { label: 'Word',        icon: '📖' },
  round:       { label: 'Rounding',    icon: '🔵' },
  factors:     { label: 'Primes',      icon: '🔢' },
  dec:         { label: 'Decimals',    icon: '🔟' },
  area:        { label: 'Area',        icon: '📐' },
  geometry:    { label: 'Geometry',    icon: '🔷' },
  measurement: { label: 'Measure',     icon: '⏰' },
  data:        { label: 'Data',        icon: '📊' },
  pattern:     { label: 'Patterns',    icon: '🔁' },
  other:       { label: 'Other',       icon: '📝' },
};

const GROUP_ORDER = ['mul', 'div', 'add', 'sub', 'frac', 'word', 'round', 'factors', 'dec', 'area', 'geometry', 'measurement', 'data', 'pattern', 'other'];

const OPERATIONS: { op: PracticeOp; label: string; icon: string }[] = [
  { op: 'multiplication', label: 'Multiply',  icon: '✖️' },
  { op: 'division',       label: 'Divide',    icon: '➗' },
  { op: 'addition',       label: 'Add',       icon: '➕' },
  { op: 'subtraction',    label: 'Subtract',  icon: '➖' },
  { op: 'fraction',       label: 'Fractions', icon: '🍕' },
  { op: 'word',           label: 'Word',      icon: '📖' },
  { op: 'rounding',       label: 'Rounding',  icon: '🔵' },
  { op: 'factors',        label: 'Primes',    icon: '🔢' },
  { op: 'decimals',       label: 'Decimals',  icon: '🔟' },
  { op: 'area',           label: 'Area',      icon: '📐' },
  { op: 'geometry',       label: 'Geometry',  icon: '🔷' },
  { op: 'measurement',    label: 'Measure',   icon: '⏰' },
  { op: 'data',           label: 'Data',      icon: '📊' },
  { op: 'pattern',        label: 'Patterns',  icon: '🔁' },
];

export function StudentDashboard({ profile, lastSyncedAt, onStartDailyReview, onPickOperation, onOpenStats, onOpenSettings, onStartQuiz, onOpenAchievementDetail, onOpenMasteryMap, onOpenGoals }: Props) {
  const [quick, setQuick] = useState<QuickStats | null>(null);
  const [dueByGroup, setDueByGroup] = useState<Record<string, DueGroup>>({});
  const [dailyNewPlan, setDailyNewPlan] = useState<DailyNewGoalPlan | null>(null);
  const [dailyNewError, setDailyNewError] = useState<string | null>(null);
  const [lessonPlan, setLessonPlan] = useState<PersistedDailyLessonPlan | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [lessonDetailsOpen, setLessonDetailsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [practiceRounds, setPracticeRounds] = useState(1);
  const [extraOpen, setExtraOpen] = useState(false);
  const [selectedExtraId, setSelectedExtraId] = useState<string | null>(null);
  const roundsInputRef = useRef<HTMLInputElement>(null);
  const lessonArgsRef = useRef<PlanDailyLessonArgs | null>(null);
  const [regeneratingLesson, setRegeneratingLesson] = useState(false);

  useEffect(() => {
    void retryRecentRelatedEvidenceRepairs(profile.id).catch(() => undefined);
  }, [profile.id]);

  // Focus and select the rounds input when the modal opens so keyboard users
  // can type a count immediately.
  useEffect(() => {
    if (selectedGroup) {
      const el = roundsInputRef.current;
      if (el) { el.focus(); el.select(); }
    }
  }, [selectedGroup]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const now = appNow();
      const nowStr = now.toISOString();
      const [events, states, sessions, goals] = await Promise.all([
        mathAnswerEventRepo.getAll(profile.id),
        itemStateRepo.getForStudent(profile.id),
        sessionRepo.getAll(profile.id),
        learningGoalRepo.list(profile.id),
      ]);
      if (!alive) return;
      const attempts = eventsToAttemptLogs(events);
      const todayStats = computeTodayStats(attempts, sessions, now, profile.timezone);
      const streak = computeStreak(attempts, now, profile.timezone);

      const dueStates = states.filter(s => s.nextDueAt && s.nextDueAt <= nowStr);

      const byGroup: Record<string, DueGroup> = {};
      for (const state of dueStates) {
        const itemId = state.lastItemId ?? state.cardKey;
        const { group } = describeItem(itemId);
        const key = group === 'unk' ? 'mul' : group;
        if (!byGroup[key]) {
          const d = GROUP_DISPLAY[key] ?? GROUP_DISPLAY.other;
          byGroup[key] = { label: d.label, icon: d.icon, ids: [] };
        }
        byGroup[key].ids.push(itemId);
      }
      setDueByGroup(byGroup);

      setQuick({
        todayQuestions: todayStats.questionsAnswered,
        todayAccuracy: todayStats.accuracy,
        todayMinutes: todayStats.minutesPracticed,
        streak,
        dueCount: dueStates.length,
      });

      try {
        const derived = deriveGrade3SkillSummaries({
          studentId: profile.id,
          items: makeItemFromId,
          mathAnswerEvents: events,
          itemStates: states,
          now: now.toISOString(),
        });
        const completeSummaries = completeSkillSummaries(profile.id, derived);
        setDailyNewPlan(planDailyNewForGoals({
          studentId: profile.id,
          goals,
          events,
          itemStates: states,
          skillSummaries: completeSummaries,
          now: now.toISOString(),
          timezone: profile.timezone,
          dailyNewGoalQuestionLimits: profile.settings.dailyNewGoalQuestionLimits,
        }));
        setDailyNewError(null);
        if (profile.gradeLevel === 3) {
          try {
            const localDate = learnerLocalDateKey(now, profile.timezone);
            const seed = [...`${profile.id}:${localDate}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
            const lessonArgs = { studentId: profile.id, gradeLevel: profile.gradeLevel, now: nowStr, timezone: profile.timezone, settings: profile.settings, events, itemStates: states, skillSummaries: completeSummaries, goals, rng: mulberry32(seed) };
            lessonArgsRef.current = lessonArgs;
            const storedLesson = await getOrCreateDailyLessonPlan(lessonArgs);
            const lesson = await reconcileDailyLessonProgress(profile.id, storedLesson.id) ?? storedLesson;
            if (!alive) return;
            setLessonPlan(lesson.items.length ? lesson : null); setLessonError(lesson.items.length ? null : 'Not enough valid content for an adaptive lesson yet.');
          } catch (lessonFailure) {
            console.warn('[StudentDashboard] Today’s Lesson failed', lessonFailure);
            setLessonPlan(null); setLessonError('Today’s lesson could not load. Existing practice options are still available.');
          }
        } else {
          lessonArgsRef.current = null;
          setLessonPlan(null);
          setLessonError(null);
        }
      } catch (err) {
        console.warn('[StudentDashboard] Daily New for Goals failed', err);
        setDailyNewPlan(null);
        setDailyNewError(err instanceof Error ? err.message : 'Daily New for Goals could not load.');
      }
    })();
    return () => { alive = false; };
  }, [profile.id, profile.gradeLevel, profile.timezone, profile.settings, lastSyncedAt]);

  const sortedGroups = GROUP_ORDER.filter(k => dueByGroup[k]);

  const handleStartReview = () => {
    if (!selectedGroup) return;
    const group = dueByGroup[selectedGroup];
    if (!group) return;
    const rounds = Math.max(1, practiceRounds);
    onStartDailyReview({
      mode: 'daily_review',
      specificItemIds: group.ids,
      sessionLength: group.ids.length * rounds,
      repeatPolicy: 'user_requested_rounds',
      rounds,
    });
    setSelectedGroup(null);
  };

  const startDailyNewTile = (tile: DailyNewGoalTile) => {
    onStartDailyReview(tile.config);
  };

  const startAdaptiveLesson = () => {
    if (!lessonPlan) return;
    const completed = new Set(lessonPlan.completedItemInstanceIds);
    const remainingItems = lessonPlan.items.filter(value => !completed.has(value.item.instanceKey ?? value.item.id));
    if (remainingItems.length === 0) return;
    const contributingGoals = lessonPlan.focusSkillId ? (dailyNewPlan?.tiles.find(tile => tile.skillId === lessonPlan.focusSkillId)?.goalIds ?? []) : [];
    const contributingTargets = lessonPlan.focusSkillId ? (dailyNewPlan?.tiles.find(tile => tile.skillId === lessonPlan.focusSkillId)?.targetIds ?? []) : [];
    onStartDailyReview({
      mode: 'adaptive_lesson',
      sessionLength: remainingItems.length,
      plannedPracticeItems: remainingItems.map(value => ({
        item: value.item,
        schedulingEligible: value.schedulingEligible,
        selection: value.selection ?? {
          origin: value.segment === 'retrieval' ? 'due_retrieval' : value.segment === 'focus' ? 'focus_skill' : 'transfer',
          plannerVersion: 'daily-lesson-v1',
          rationaleCodes: [value.rationale],
          lessonPlanId: lessonPlan.id,
          lessonSegment: value.segment,
        },
      })),
      initialScheduledCardKeys: lessonPlan.scheduledCardKeys ?? [],
      lessonPlanId: lessonPlan.id, lessonKind: 'adaptive_daily_lesson', focusSkillId: lessonPlan.focusSkillId,
      lessonSegments: (['retrieval', 'focus', 'transfer'] as const).map(kind => ({ kind, itemInstanceIds: remainingItems.filter(value => value.segment === kind).map(value => value.item.id) })),
      lessonRationales: Object.fromEntries(remainingItems.map(value => [value.item.id, value.rationale])),
      goalIds: contributingGoals, goalTargetIds: contributingTargets,
    });
  };

  const regenerateLesson = async () => {
    if (!lessonArgsRef.current || regeneratingLesson) return;
    setRegeneratingLesson(true);
    try {
      const next = await regenerateDailyLessonPlan(lessonArgsRef.current);
      setLessonPlan(next);
      setLessonError(null);
    } catch (error) {
      console.warn('[StudentDashboard] Today’s Lesson regeneration failed', error);
      setLessonError('Today’s lesson could not be refreshed yet. Your current plan is still saved.');
    } finally {
      setRegeneratingLesson(false);
    }
  };

  const openExtra = () => {
    const first = dailyNewPlan?.extraChoices[0] ?? null;
    setSelectedExtraId(first?.id ?? null);
    setExtraOpen(true);
  };

  const selectedExtra = dailyNewPlan?.extraChoices.find(tile => tile.id === selectedExtraId) ?? dailyNewPlan?.extraChoices[0] ?? null;
  const lessonRemainingCount = lessonPlan?.items.filter(value => !lessonPlan.completedItemInstanceIds.includes(value.item.instanceKey ?? value.item.id)).length ?? 0;

  return (
    <div style={s.container}>
      {/* Header */}
      <header style={s.header}>
        <div>
          <h1 style={s.name}>Hi, {profile.displayName}!</h1>
          <p style={s.grade}>Grade {profile.gradeLevel}</p>
        </div>
        <button data-testid="open-settings" style={s.settingsBtn} onClick={onOpenSettings} title="Settings">⚙️</button>
      </header>

      {/* Quick stats */}
      {quick && (
        <div style={s.quickRow}>
          <Chip label="Today" value={`${quick.todayQuestions} Q`} />
          <Chip
            label="Accuracy"
            value={quick.todayQuestions ? `${Math.round(quick.todayAccuracy * 100)}%` : '—'}
          />
          <Chip label="Min today" value={`${quick.todayMinutes}`} />
          <Chip label="Streak" value={`${quick.streak}d`} color="var(--primary)" />
          <Chip
            label="Due"
            value={String(quick.dueCount)}
            color={quick.dueCount > 0 ? '#f59e0b' : '#22c55e'}
          />
        </div>
      )}

      {/* Today's Achievement */}
      <TodayAchievementSection
        studentId={profile.id}
        lastSyncedAt={lastSyncedAt}
        onOpenDetail={onOpenAchievementDetail}
      />

      {/* Separate adaptive lesson experiment; existing Today Plan controls remain below. */}
      <p style={s.sectionLabel}>Today&apos;s Lesson</p>
      <section aria-label="Start Today’s Lesson" style={s.dailyNewSection}>
        <h2 style={s.tileTitle}>Start Today&apos;s Lesson</h2>
        {lessonPlan ? <>
          <p style={s.dailyNewCopy}>{lessonPlan.estimatedMinutes} min · {lessonPlan.items.filter(value => value.segment === 'retrieval').length} due review · Focus: {lessonPlan.focusSkillTitle ?? 'mixed practice'} · {lessonPlan.items.filter(value => value.segment === 'transfer').length} transfer</p>
          <div style={s.actions}><button style={s.dailyNewStart} disabled={lessonRemainingCount === 0} onClick={startAdaptiveLesson}>{lessonRemainingCount === 0 ? 'Completed today' : lessonPlan.completedItemInstanceIds.length ? 'Resume lesson' : 'Start lesson'}</button><button style={s.secondaryBtn} aria-expanded={lessonDetailsOpen} onClick={() => setLessonDetailsOpen(value => !value)}>See plan</button></div>
          {lessonDetailsOpen && <div role="note" style={s.dailyNewNotice}><strong>Why this plan?</strong><p>It uses only genuinely due retrieval cards, one priority focus skill, and learned transfer contexts.</p><p>Plan date {lessonPlan.localDate} · revision {lessonPlan.revision}</p><button style={s.secondaryBtn} disabled={regeneratingLesson} onClick={regenerateLesson}>{regeneratingLesson ? 'Refreshing...' : 'Regenerate plan'}</button>{lessonPlan.warnings.map(warning => <p key={warning.code}>{warning.message}</p>)}</div>}
        </> : <div role="status" style={s.dailyNewNotice}>{lessonError ?? 'Building today’s lesson...'}</div>}
      </section>

      {/* Daily Review */}
      <p style={s.sectionLabel}>Daily Review</p>
      {sortedGroups.length > 0 ? (
        <div style={s.dueGrid}>
          {sortedGroups.map(key => {
            const { label, icon, ids } = dueByGroup[key];
            return (
              <button
                key={key}
                style={s.dueBtn}
                onClick={() => { setSelectedGroup(key); setPracticeRounds(1); }}
              >
                <span style={s.dueIcon}>{icon}</span>
                <span style={s.dueLabel}>{label}</span>
                <span style={s.dueBadge}>{ids.length}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <button style={s.dueBtnEmpty} disabled>
          Daily Review due (0)
        </button>
      )}

      {/* Daily New for Goals */}
      <p style={s.sectionLabel}>Daily New for Goals</p>
      <section style={s.dailyNewSection} aria-label="Daily New for Goals">
        <p style={s.dailyNewCopy}>Learn new goal skills here. Previously learned items appear in Daily Review when they are due.</p>
        {dailyNewError && (
          <div role="alert" style={s.dailyNewNotice}>
            Daily New for Goals could not load.
          </div>
        )}
        {!dailyNewError && !dailyNewPlan && (
          <div style={s.dailyNewNotice}>Loading Daily New for Goals...</div>
        )}
        {dailyNewPlan?.warnings.map((warning, index) => (
          <p key={`${warning.code}:${warning.goalId ?? warning.skillId ?? index}`} style={s.dailyNewWarning}>
            {warning.message}
          </p>
        ))}
        {dailyNewPlan?.emptyReason === 'no_active_goals' && (
          <div style={s.dailyNewNotice}>
            <p style={s.noticeText}>Set a goal to get a daily new-learning plan.</p>
            {onOpenGoals && <button style={s.dailyNewStart} onClick={onOpenGoals}>Set a Goal</button>}
          </div>
        )}
        {dailyNewPlan?.emptyReason === 'no_unseen_items' && (
          <div style={s.dailyNewNotice}>
            <p style={s.noticeText}>Your new goal material is finished for now. Use Daily Review for scheduled practice.</p>
          </div>
        )}
        {dailyNewPlan && dailyNewPlan.tiles.length > 0 && (
          <div style={s.dailyNewGrid}>
            {dailyNewPlan.tiles.map(tile => (
              <article key={tile.id} style={s.dailyNewTile}>
                <div style={s.tileTop}>
                  <div>
                    <h3 style={s.tileTitle}>{tile.skillTitle}</h3>
                    <p style={s.tileSub}>{tile.goalTitles.length > 1 ? `${tile.goalTitles.length} goals` : tile.goalTitles[0]}</p>
                  </div>
                  <span style={tile.isComplete ? s.completeBadge : s.newBadge}>
                    {tile.isComplete ? 'Completed' : tile.kind === 'new_skill' ? 'New' : 'Continue'}
                  </span>
                </div>
                <p style={s.tileReason}>{tile.reason}</p>
                <div style={s.tileMeta}>
                  <span>{tile.questionCount} Q</span>
                  <span>{tile.estimatedMinutes} min</span>
                  <span>{Math.round(tile.progress * 100)}%</span>
                  <span>{Math.max(0, tile.daysRemaining)}d left</span>
                </div>
                <button style={s.dailyNewStart} disabled={tile.isComplete} onClick={() => startDailyNewTile(tile)}>
                  {tile.isComplete ? 'Done today' : 'Start'}
                </button>
              </article>
            ))}
          </div>
        )}
        {dailyNewPlan && dailyNewPlan.emptyReason !== 'no_active_goals' && (
          <>
            <button
              style={s.extraBtn}
              disabled={dailyNewPlan.extraChoices.length === 0}
              onClick={openExtra}
            >
              Learn Extra
            </button>
            {dailyNewPlan.extraChoices.length === 0 && (
              <p style={s.noticeText}>No more new goal items right now. Check Daily Review for scheduled practice.</p>
            )}
          </>
        )}
      </section>

      {/* Grade 3 Math Map */}
      {onOpenMasteryMap && (
        <button style={s.masteryMapBtn} onClick={onOpenMasteryMap}>
          <div style={s.masteryMapTitle}>🗺 Grade 3 Math Map</div>
          <div style={s.masteryMapSub}>See what is strong, learning, and ready to review.</div>
        </button>
      )}

      {onOpenGoals && (
        <button style={s.goalsBtn} onClick={onOpenGoals}>
          <div style={s.goalsTitle}>🎯 Goals</div>
          <div style={s.goalsSub}>Set learning goals and see your recommended plan.</div>
        </button>
      )}

      {/* Operation picker */}
      <p style={s.sectionLabel}>Practice an operation</p>
      <div style={s.opGrid}>
        {OPERATIONS.map(({ op, label, icon }) => (
          <button key={op} style={s.opBtn} onClick={() => onPickOperation(op)}>
            <span style={s.opIcon}>{icon}</span>
            <span style={s.opLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* Multiplication quiz */}
      <button style={s.quizBtn} onClick={onStartQuiz}>
        ✏️ Multiplication Quiz
      </button>

      <button style={s.statsBtn} onClick={onOpenStats}>
        📊 Stats &amp; History
      </button>

      {/* Rounds modal */}
      {selectedGroup && dueByGroup[selectedGroup] && (
        <div style={s.overlay} onClick={() => setSelectedGroup(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <p style={s.modalTitle}>
              {dueByGroup[selectedGroup].icon} {dueByGroup[selectedGroup].label}
            </p>
            <p style={s.modalSub}>
              {dueByGroup[selectedGroup].ids.length} question{dueByGroup[selectedGroup].ids.length !== 1 ? 's' : ''} due
            </p>
            <p style={s.modalLabel}>How many rounds?</p>
            <p style={s.modalHint}>Rounds repeat these cards in this session. Only the first presentation updates long-term review timing.</p>
            <div style={s.modalCountRow}>
              <button style={s.adjBtn} aria-label="Fewer rounds" onClick={() => setPracticeRounds(r => Math.max(1, r - 1))}>−</button>
              <input
                ref={roundsInputRef}
                type="number"
                min={1}
                aria-label="Number of rounds"
                style={s.modalCount}
                value={practiceRounds}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  setPracticeRounds(Number.isNaN(n) ? 1 : Math.max(1, n));
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleStartReview(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setSelectedGroup(null); }
                }}
              />
              <button style={s.adjBtn} aria-label="More rounds" onClick={() => setPracticeRounds(r => r + 1)}>+</button>
            </div>
            <p style={s.modalTotal}>
              {dueByGroup[selectedGroup].ids.length} × {practiceRounds} ={' '}
              <strong>{dueByGroup[selectedGroup].ids.length * practiceRounds}</strong> questions
            </p>
            <button style={s.modalStart} onClick={handleStartReview}>
              Start
            </button>
            <button style={s.modalCancel} onClick={() => setSelectedGroup(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {extraOpen && dailyNewPlan && (
        <div style={s.overlay} onClick={() => setExtraOpen(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <p style={s.modalTitle}>Learn Extra</p>
            {dailyNewPlan.extraChoices.length === 0 ? (
              <p style={s.modalSub}>No more new goal items right now. Check Daily Review for scheduled practice.</p>
            ) : (
              <>
                <div style={s.extraList}>
                  {dailyNewPlan.extraChoices.map(tile => (
                    <button
                      key={tile.id}
                      style={{ ...s.extraChoice, borderColor: selectedExtraId === tile.id ? 'var(--primary)' : '#e5e7eb' }}
                      onClick={() => setSelectedExtraId(tile.id)}
                    >
                      <strong>{tile.skillTitle}</strong>
                      <span>{tile.questionCount} unseen questions · {tile.goalTitles.length > 1 ? `${tile.goalTitles.length} goals` : tile.goalTitles[0]}</span>
                    </button>
                  ))}
                </div>
                <button
                  style={s.modalStart}
                  disabled={!selectedExtra}
                  onClick={() => {
                    if (selectedExtra) startDailyNewTile(selectedExtra);
                    setExtraOpen(false);
                  }}
                >
                  Start Extra
                </button>
              </>
            )}
            <button style={s.modalCancel} onClick={() => setExtraOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function completeSkillSummaries(studentId: string, summaries: StudentSkillSummary[]): StudentSkillSummary[] {
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

function Chip({ label, value, color = '#1f2937' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: '10px', padding: '10px 4px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{label}</div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  name: { fontSize: '26px', fontWeight: 'bold', margin: 0 },
  grade: { fontSize: '14px', color: '#6b7280', margin: '4px 0 0' },
  settingsBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '4px', borderRadius: '8px' },
  quickRow: { display: 'flex', gap: '8px', marginBottom: '20px' },
  statsBtn: { width: '100%', padding: '13px', background: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  quizBtn: { width: '100%', padding: '14px', background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  masteryMapBtn: { width: '100%', padding: '14px 16px', background: '#f5f3ff', color: '#5b21b6', border: '1.5px solid #c4b5fd', borderRadius: '12px', cursor: 'pointer', marginTop: '8px', textAlign: 'left', touchAction: 'manipulation' },
  masteryMapTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '3px' },
  masteryMapSub: { fontSize: '13px', color: '#7c3aed', fontWeight: '400' },
  goalsBtn: { width: '100%', padding: '14px 16px', background: '#ecfeff', color: '#155e75', border: '1.5px solid #67e8f9', borderRadius: '12px', cursor: 'pointer', marginTop: '8px', textAlign: 'left', touchAction: 'manipulation' },
  goalsTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '3px' },
  goalsSub: { fontSize: '13px', color: '#0e7490', fontWeight: '400' },
  sectionLabel: { fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '18px 0 10px' },
  opGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  opBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '16px 0', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '14px', cursor: 'pointer', touchAction: 'manipulation' },
  opIcon: { fontSize: '26px', lineHeight: 1 },
  opLabel: { fontSize: '13px', fontWeight: '600', color: '#374151' },
  // Daily review
  dueGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' },
  dueBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '12px 14px', background: '#fff', border: '2px solid #fde68a', borderRadius: '12px', cursor: 'pointer', minWidth: '76px', touchAction: 'manipulation' },
  dueIcon: { fontSize: '20px' },
  dueLabel: { fontSize: '11px', fontWeight: '600', color: '#374151' },
  dueBadge: { fontSize: '17px', fontWeight: 'bold', color: '#d97706', background: '#fef3c7', borderRadius: '20px', padding: '1px 8px' },
  dueBtnEmpty: { width: '100%', padding: '14px', background: '#f9fafb', color: '#9ca3af', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'default', marginBottom: '4px' },
  dailyNewSection: { display: 'grid', gap: '10px', marginBottom: '4px' },
  dailyNewCopy: { fontSize: '13px', color: '#4b5563', margin: 0, lineHeight: 1.45 },
  dailyNewNotice: { background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '12px', display: 'grid', gap: '8px' },
  dailyNewWarning: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 10px', color: '#92400e', fontSize: '13px', margin: '8px 0' },
  noticeText: { margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: 1.4 },
  dailyNewGrid: { display: 'grid', gap: '8px' },
  dailyNewTile: { background: '#fff', border: '1.5px solid #bae6fd', borderRadius: '8px', padding: '12px', display: 'grid', gap: '8px' },
  tileTop: { display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' },
  tileTitle: { margin: 0, fontSize: '15px', color: '#111827' },
  tileSub: { margin: '2px 0 0', fontSize: '12px', color: '#0369a1' },
  tileReason: { margin: 0, fontSize: '13px', color: '#4b5563' },
  tileMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '12px', color: '#374151' },
  newBadge: { fontSize: '11px', fontWeight: '800', color: '#075985', background: '#e0f2fe', borderRadius: '999px', padding: '3px 8px' },
  completeBadge: { fontSize: '11px', fontWeight: '800', color: '#166534', background: '#dcfce7', borderRadius: '999px', padding: '3px 8px' },
  dailyNewStart: { padding: '10px 12px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  extraBtn: { padding: '10px 12px', background: '#fff', color: '#075985', border: '1.5px solid #7dd3fc', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  extraList: { display: 'grid', gap: '8px', marginBottom: '12px' },
  extraChoice: { display: 'grid', gap: '3px', textAlign: 'left', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '8px', padding: '10px', color: '#1f2937', cursor: 'pointer' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: '20px', padding: '28px 24px', maxWidth: '300px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  modalTitle: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px', color: '#1f2937' },
  modalSub: { fontSize: '14px', color: '#6b7280', margin: '0 0 20px' },
  modalLabel: { fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 10px' },
  modalHint: { fontSize: '12px', color: '#6b7280', margin: '-4px 0 12px', lineHeight: 1.4 },
  modalCountRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '10px' },
  adjBtn: { width: '38px', height: '38px', border: '2px solid #e5e7eb', borderRadius: '8px', background: '#fff', fontSize: '20px', cursor: 'pointer', fontWeight: '600', color: '#374151' },
  modalCount: { fontSize: '34px', fontWeight: 'bold', color: '#1f2937', width: '80px', textAlign: 'center', border: '2px solid #e5e7eb', borderRadius: '10px', padding: '2px 0', background: '#fff', fontFamily: 'inherit' },
  modalTotal: { fontSize: '13px', color: '#6b7280', margin: '0 0 18px' },
  modalStart: { width: '100%', padding: '13px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '8px' },
  modalCancel: { width: '100%', padding: '8px', background: 'none', color: '#9ca3af', border: 'none', fontSize: '14px', cursor: 'pointer' },
};
