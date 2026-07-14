import { useEffect, useRef, useState } from 'react';
import type { StudentProfile, SessionConfig, StudentSettings } from './types/math';
import { studentRepo, sessionRepo } from './db/repositories';
import { ProfileSetup } from './features/dashboard/ProfileSetup';
import { StudentDashboard, type PracticeOp } from './features/dashboard/StudentDashboard';
import { PracticeScreen } from './features/practice/PracticeScreen';
import { SessionSetup } from './components/SessionSetup';
import { RangeSetup } from './components/RangeSetup';
import { specFor } from './components/opSpecs';
import { StatsPage } from './features/stats/StatsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { MultiplicationQuizPage } from './features/multiplication/MultiplicationQuizPage';
import { TodayAchievementDetail } from './features/stats/TodayAchievementDetail';
import type { AchievementFilter, TodayAchievementData } from './features/stats/todayAchievement';
import { Grade3MasteryMapPage } from './features/mastery/Grade3MasteryMapPage';
import { DiagnosticSession } from './features/diagnosis/DiagnosticSession';
import { GoalsPage } from './features/goals/GoalsPage';
import { GoalEvaluationSession } from './features/goals/GoalEvaluationSession';
import { preloadVoices } from './features/audio/speech';
import { useSync, initAuth } from './features/sync/useSync';
import { pushLocal, pullAndMerge } from './features/sync/driveSync';
import { currentState as authState, hasPersistedGrant } from './features/auth/googleAuth';
import { applyTheme } from './features/theme/themes';
import { syncDiagnosticCompletionIfSignedIn } from './features/diagnosis/diagnosticCompletion';
import { resolvePracticeDoneDestination } from './features/practice/practiceNavigation';
import { bootstrapProfiles, loadActiveProfileSelection, saveActiveProfileSelection, resolveSelectedProfile } from './features/profile/profileBootstrap';
import type { RestoreState } from './features/dashboard/ProfileSetup';

type Screen =
  | 'loading' | 'setup' | 'dashboard'
  | 'daily-setup' | 'range-setup' | 'practice'
  | 'stats' | 'settings' | 'quiz' | 'today-detail' | 'mastery-map' | 'diagnostic' | 'goals' | 'goal-evaluation';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [existingProfiles, setExistingProfiles] = useState<StudentProfile[]>([]);
  const [restoreState, setRestoreState] = useState<RestoreState>('idle');
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [selectedOp, setSelectedOp] = useState<PracticeOp>('multiplication');
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('total');
  const [achievementData, setAchievementData] = useState<TodayAchievementData | null>(null);
  const { auth, syncStatus, lastSyncedAt, syncError, handleSignIn, handleSignOut, manualSync } = useSync();
  const [practiceReturn, setPracticeReturn] = useState<Screen>('dashboard');
  const [initialGoalSkillIds, setInitialGoalSkillIds] = useState<string[] | null>(null);

  const selectProfile = (p: StudentProfile) => {
    setProfile(p);
    saveActiveProfileSelection(p);
    applyTheme(p.settings.theme ?? 'indigo');
    sessionRepo.deleteEmpty(p.id).catch(() => {});
    setScreen('dashboard');
  };

  const runBootstrap = async () => {
    const grantPersisted = hasPersistedGrant();
    setRestoreState(grantPersisted ? 'checking' : 'idle');
    const result = await bootstrapProfiles({
      loadLocalProfiles: () => studentRepo.getAll(),
      hasPersistedGrant: grantPersisted,
      attemptRestore: () => pullAndMerge(),
      loadActiveSelection: loadActiveProfileSelection,
    });
    if (result.status === 'ready') {
      selectProfile(result.selected);
      return;
    }
    if (result.status === 'choose') {
      setExistingProfiles(result.profiles);
      setRestoreState('idle');
      setScreen('setup');
      return;
    }
    if (result.status === 'restore_available') {
      setExistingProfiles([]);
      setRestoreState('unavailable');
      setScreen('setup');
      return;
    }
    setExistingProfiles([]);
    setRestoreState('idle');
    setScreen('setup');
  };

  // After a successful sync, re-resolve the active profile from DB. This handles
  // the case where a duplicate-learnerKey merge (see snapshot.ts) changed which
  // profile id represents this learner.
  const syncRefreshGuard = useRef(true);
  useEffect(() => {
    if (syncRefreshGuard.current) { syncRefreshGuard.current = false; return; }
    if (!lastSyncedAt) return;
    studentRepo.getAll().then(all => {
      if (all.length === 0) return;
      const current = profile ? all.find(p => p.id === profile.id) : undefined;
      const resolved = current ?? resolveSelectedProfile(all, loadActiveProfileSelection());
      const best = resolved ?? all[0];
      setProfile(best);
      saveActiveProfileSelection(best);
      applyTheme(best.settings.theme ?? 'indigo');
      setScreen(s => (s === 'setup' || s === 'loading') ? 'dashboard' : s);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncedAt]);

  const pickOperation = (op: PracticeOp) => {
    setSelectedOp(op);
    setScreen('range-setup');
  };

  useEffect(() => {
    preloadVoices();
    initAuth();
    // Deferred to a microtask so the first setState happens outside the effect body itself.
    Promise.resolve().then(runBootstrap);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateProfile = async (updated: StudentProfile) => {
    const withTimestamp = { ...updated, updatedAt: new Date().toISOString() };
    setProfile(withTimestamp);
    await studentRepo.save(withTimestamp);
  };

  const updateSettings = async (settings: StudentSettings) => {
    if (!profile) return;
    await updateProfile({ ...profile, settings });
  };

  const handleSessionDone = () => {
    if (authState().signedIn) pushLocal().catch(console.warn);
    setScreen(resolvePracticeDoneDestination(practiceReturn));
  };

  // Quiz always returns to dashboard. Using handleSessionDone would read a stale
  // practiceReturn left over from an earlier practice session launched from mastery-map or stats.
  const handleQuizDone = () => {
    if (authState().signedIn) pushLocal().catch(console.warn);
    setScreen('dashboard');
  };

  const startPractice = (cfg: SessionConfig) => {
    setPracticeReturn(screen);
    setSessionConfig(cfg);
    setScreen('practice');
  };

  if (screen === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '48px' }}>🧮</div>
      </div>
    );
  }

  if (screen === 'setup') {
    return (
      <ProfileSetup
        existingProfiles={existingProfiles}
        restoreState={restoreState}
        onSelectExisting={selectProfile}
        onCreate={async p => {
          await studentRepo.saveNew(p);
          selectProfile(p);
        }}
        onRestore={async () => {
          setRestoreState('checking');
          await pullAndMerge();
          await runBootstrap();
        }}
      />
    );
  }

  if (!profile) return null;

  if (screen === 'settings') {
    return (
      <SettingsPage
        profile={profile}
        onUpdateProfile={updateProfile}
        onBack={() => setScreen('dashboard')}
        onSwitchStudent={() => {
          studentRepo.getAll().then(all => {
            setExistingProfiles(all);
            setRestoreState('idle');
            setScreen('setup');
          });
        }}
        auth={auth}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        syncError={syncError}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onManualSync={manualSync}
      />
    );
  }

  if (screen === 'today-detail' && achievementData) {
    return (
      <TodayAchievementDetail
        filter={achievementFilter}
        data={achievementData}
        onBack={() => setScreen('dashboard')}
      />
    );
  }

  if (screen === 'stats') {
    return (
      <StatsPage
        studentId={profile.id}
        lastSyncedAt={lastSyncedAt}
        onBack={() => setScreen('dashboard')}
        onStartPractice={startPractice}
      />
    );
  }

  if (screen === 'quiz') {
    return (
      <MultiplicationQuizPage
        studentId={profile.id}
        settings={profile.settings}
        onDone={handleQuizDone}
        onStartPractice={startPractice}
      />
    );
  }

  if (screen === 'daily-setup') {
    return (
      <SessionSetup
        title="Daily Review"
        description="Adaptive practice — focuses on facts you need most."
        defaultCount={profile.settings.sessionLength ?? 10}
        mode="daily_review"
        onBack={() => setScreen('dashboard')}
        onStart={startPractice}
      />
    );
  }

  if (screen === 'range-setup') {
    return (
      <RangeSetup
        spec={specFor(selectedOp, profile.gradeLevel)}
        defaultCount={profile.settings.sessionLength ?? 10}
        onBack={() => setScreen('dashboard')}
        onStart={startPractice}
      />
    );
  }

  if (screen === 'practice' && sessionConfig) {
    const backToScreen: Screen | null =
      practiceReturn === 'mastery-map' || practiceReturn === 'stats' ? practiceReturn : null;
    return (
      <PracticeScreen
        studentId={profile.id}
        config={sessionConfig}
        settings={profile.settings}
        onUpdateSettings={updateSettings}
        onDone={handleSessionDone}
        onOpenSettings={() => setScreen('settings')}
        onPlayAgain={() => {
          setScreen('loading');
          setTimeout(() => setScreen('practice'), 40);
        }}
        onBack={backToScreen
          ? () => {
              if (authState().signedIn) pushLocal().catch(console.warn);
              setScreen(backToScreen);
            }
          : undefined}
      />
    );
  }

  if (screen === 'diagnostic') {
    return (
      <DiagnosticSession
        studentId={profile.id}
        onComplete={async () => {
          try {
            await syncDiagnosticCompletionIfSignedIn(authState().signedIn);
          } catch (err) {
            console.warn('[App] diagnostic sync failed', err);
          }
          setScreen('mastery-map');
        }}
        onCancel={() => setScreen('mastery-map')}
      />
    );
  }

  if (screen === 'mastery-map') {
    return (
      <Grade3MasteryMapPage
        profile={profile}
        onBack={() => setScreen('dashboard')}
        onStartPractice={startPractice}
        onStartDiagnostic={() => setScreen('diagnostic')}
      />
    );
  }

  if (screen === 'goal-evaluation') {
    return (
      <GoalEvaluationSession
        studentId={profile.id}
        onCancel={() => setScreen('goals')}
        onReturnToGoals={() => setScreen('goals')}
        onSelectGoalSkills={skillIds => {
          setInitialGoalSkillIds(skillIds);
          setScreen('goals');
        }}
        onGoToDailyReview={() => setScreen('dashboard')}
      />
    );
  }

  if (screen === 'goals') {
    return (
      <GoalsPage
        profile={profile}
        lastSyncedAt={lastSyncedAt}
        initialGoalSkillIds={initialGoalSkillIds}
        onInitialGoalSkillsHandled={() => setInitialGoalSkillIds(null)}
        onUpdateProfile={updateProfile}
        onBack={() => setScreen('dashboard')}
        onStartEvaluation={() => setScreen('goal-evaluation')}
      />
    );
  }

  return (
    <StudentDashboard
      profile={profile}
      lastSyncedAt={lastSyncedAt}
      onStartDailyReview={startPractice}
      onPickOperation={pickOperation}
      onOpenStats={() => setScreen('stats')}
      onOpenSettings={() => setScreen('settings')}
      onStartQuiz={() => setScreen('quiz')}
      onOpenAchievementDetail={(filter, data) => {
        setAchievementFilter(filter);
        setAchievementData(data);
        setScreen('today-detail');
      }}
      onOpenMasteryMap={() => setScreen('mastery-map')}
      onOpenGoals={() => setScreen('goals')}
    />
  );
}
