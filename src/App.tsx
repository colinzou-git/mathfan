import { useEffect, useRef, useState } from 'react';
import type { StudentProfile, SessionConfig, StudentSettings } from './types/math';
import { studentRepo, sessionRepo, mathAnswerEventRepo } from './db/repositories';
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
import { preloadVoices } from './features/audio/speech';
import { useSync, initAuth } from './features/sync/useSync';
import { pushLocal } from './features/sync/driveSync';
import { currentState as authState } from './features/auth/googleAuth';
import { applyTheme } from './features/theme/themes';

type Screen =
  | 'loading' | 'setup' | 'dashboard'
  | 'daily-setup' | 'range-setup' | 'practice'
  | 'stats' | 'settings' | 'quiz' | 'today-detail' | 'mastery-map';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [selectedOp, setSelectedOp] = useState<PracticeOp>('multiplication');
  const [achievementFilter, setAchievementFilter] = useState<AchievementFilter>('total');
  const [achievementData, setAchievementData] = useState<TodayAchievementData | null>(null);
  const { auth, syncStatus, lastSyncedAt, syncError, handleSignIn, handleSignOut, manualSync } = useSync();

  // After a successful sync, refresh the profile from DB.
  // This handles the case where Drive data was merged back onto a fresh install:
  // the local empty student and the Drive student have different IDs, so we pick
  // the student with the most events (i.e. the restored Drive profile).
  const syncRefreshGuard = useRef(true);
  useEffect(() => {
    if (syncRefreshGuard.current) { syncRefreshGuard.current = false; return; }
    if (!lastSyncedAt) return;
    studentRepo.getAll().then(async all => {
      if (all.length === 0) return;
      let best = all[0];
      if (all.length > 1) {
        const counts = await Promise.all(all.map(s => mathAnswerEventRepo.getAll(s.id).then(ev => ev.length)));
        best = all[counts.indexOf(Math.max(...counts))];
      }
      setProfile(best);
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
    studentRepo.getAll().then(all => {
      if (all.length === 0) {
        setScreen('setup');
      } else {
        const p = all[0];
        setProfile(p);
        // Apply saved theme immediately
        applyTheme(p.settings.theme ?? 'indigo');
        // Clean up any leftover empty sessions from earlier versions / abandoned starts
        sessionRepo.deleteEmpty(p.id).catch(() => {});
        setScreen('dashboard');
      }
    });
  }, []);

  const updateProfile = async (updated: StudentProfile) => {
    setProfile(updated);
    await studentRepo.save(updated);
  };

  const updateSettings = async (settings: StudentSettings) => {
    if (!profile) return;
    await updateProfile({ ...profile, settings });
  };

  const handleSessionDone = () => {
    if (authState().signedIn) pushLocal().catch(console.warn);
    setScreen('dashboard');
  };

  const startPractice = (cfg: SessionConfig) => {
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
        onCreated={p => {
          setProfile(p);
          applyTheme(p.settings.theme ?? 'indigo');
          setScreen('dashboard');
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
        onSwitchStudent={() => setScreen('setup')}
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
        onStartPractice={cfg => { setSessionConfig(cfg); setScreen('practice'); }}
      />
    );
  }

  if (screen === 'quiz') {
    return (
      <MultiplicationQuizPage
        studentId={profile.id}
        settings={profile.settings}
        onDone={handleSessionDone}
        onStartPractice={cfg => { setSessionConfig(cfg); setScreen('practice'); }}
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
        onStart={cfg => { setSessionConfig(cfg); setScreen('practice'); }}
      />
    );
  }

  if (screen === 'range-setup') {
    return (
      <RangeSetup
        spec={specFor(selectedOp, profile.gradeLevel)}
        defaultCount={profile.settings.sessionLength ?? 10}
        onBack={() => setScreen('dashboard')}
        onStart={cfg => { setSessionConfig(cfg); setScreen('practice'); }}
      />
    );
  }

  if (screen === 'practice' && sessionConfig) {
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
      />
    );
  }

  if (screen === 'mastery-map') {
    return (
      <Grade3MasteryMapPage
        profile={profile}
        onBack={() => setScreen('dashboard')}
        onStartPractice={startPractice}
      />
    );
  }

  return (
    <StudentDashboard
      profile={profile}
      lastSyncedAt={lastSyncedAt}
      onStartDailyReview={(cfg) => { setSessionConfig(cfg); setScreen('practice'); }}
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
    />
  );
}
