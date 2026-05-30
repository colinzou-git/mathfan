import { useEffect, useState } from 'react';
import type { StudentProfile, SessionConfig, StudentSettings } from './types/math';
import { studentRepo, sessionRepo } from './db/repositories';
import { ProfileSetup } from './features/dashboard/ProfileSetup';
import { StudentDashboard, type PracticeOp } from './features/dashboard/StudentDashboard';
import { PracticeScreen } from './features/practice/PracticeScreen';
import { TableSelector } from './components/TableSelector';
import { SessionSetup } from './components/SessionSetup';
import { ArithmeticSetup } from './components/ArithmeticSetup';
import { FractionSetup } from './components/FractionSetup';
import { StatsPage } from './features/stats/StatsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { preloadVoices } from './features/audio/speech';
import { initAuth } from './features/sync/useSync';
import { pushLocal } from './features/sync/driveSync';
import { currentState as authState } from './features/auth/googleAuth';
import { applyTheme } from './features/theme/themes';

type Screen =
  | 'loading' | 'setup' | 'dashboard'
  | 'daily-setup' | 'table-selector' | 'arith-setup' | 'fraction-setup' | 'simple-setup' | 'practice'
  | 'stats' | 'settings';

type ArithMode = 'addition' | 'subtraction' | 'division';
type SimpleMode = 'word_problem' | 'rounding' | 'factors' | 'decimals';

const SIMPLE_META: Record<SimpleMode, { title: string; description: string }> = {
  word_problem: { title: 'Word Problems', description: 'Read the story and type the number answer.' },
  rounding:     { title: 'Rounding',      description: 'Round numbers to the nearest ten, hundred, or thousand.' },
  factors:      { title: 'Primes & Factors', description: 'Prime or composite? Is one number a factor of another?' },
  decimals:     { title: 'Decimals',      description: 'Add and subtract decimal numbers.' },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [arithMode, setArithMode] = useState<ArithMode>('addition');
  const [simpleMode, setSimpleMode] = useState<SimpleMode>('word_problem');

  const pickOperation = (op: PracticeOp) => {
    if (op === 'multiplication') { setScreen('table-selector'); return; }
    if (op === 'fraction') { setScreen('fraction-setup'); return; }
    if (op === 'addition' || op === 'subtraction' || op === 'division') {
      setArithMode(op);
      setScreen('arith-setup');
      return;
    }
    // word | rounding | factors | decimals → generic count-only setup
    setSimpleMode(op === 'word' ? 'word_problem' : op);
    setScreen('simple-setup');
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
      />
    );
  }

  if (screen === 'stats') {
    return (
      <StatsPage
        studentId={profile.id}
        onBack={() => setScreen('dashboard')}
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

  if (screen === 'table-selector') {
    return (
      <TableSelector
        onBack={() => setScreen('dashboard')}
        onStart={cfg => { setSessionConfig(cfg); setScreen('practice'); }}
      />
    );
  }

  if (screen === 'arith-setup') {
    return (
      <ArithmeticSetup
        mode={arithMode}
        onBack={() => setScreen('dashboard')}
        onStart={cfg => { setSessionConfig(cfg); setScreen('practice'); }}
      />
    );
  }

  if (screen === 'simple-setup') {
    const meta = SIMPLE_META[simpleMode];
    return (
      <SessionSetup
        title={meta.title}
        description={meta.description}
        mode={simpleMode}
        defaultCount={profile.settings.sessionLength ?? 10}
        onBack={() => setScreen('dashboard')}
        onStart={cfg => {
          setSessionConfig({ ...cfg, grade: profile.gradeLevel });
          setScreen('practice');
        }}
      />
    );
  }

  if (screen === 'fraction-setup') {
    return (
      <FractionSetup
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

  return (
    <StudentDashboard
      profile={profile}
      onStartDailyReview={() => setScreen('daily-setup')}
      onPickOperation={pickOperation}
      onOpenStats={() => setScreen('stats')}
      onOpenSettings={() => setScreen('settings')}
    />
  );
}
