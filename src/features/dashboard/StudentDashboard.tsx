import { useEffect, useState } from 'react';
import type { StudentProfile } from '../../types/math';
import { itemStateRepo, attemptRepo, sessionRepo } from '../../db/repositories';
import { computeTodayStats, computeStreak } from '../stats/statsEngine';
import { appNow } from '../time/clock';

export type PracticeOp =
  | 'multiplication' | 'division' | 'addition' | 'subtraction' | 'fraction'
  | 'word' | 'rounding' | 'factors' | 'decimals';

interface Props {
  profile: StudentProfile;
  lastSyncedAt?: string | null;
  onStartDailyReview: () => void;
  onPickOperation: (op: PracticeOp) => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
}

interface QuickStats {
  todayQuestions: number;
  todayAccuracy: number;
  todayMinutes: number;
  streak: number;
  dueCount: number;
}

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
];

export function StudentDashboard({ profile, lastSyncedAt, onStartDailyReview, onPickOperation, onOpenStats, onOpenSettings }: Props) {
  const [quick, setQuick] = useState<QuickStats | null>(null);

  useEffect(() => {
    (async () => {
      const now = appNow();
      const [attempts, states, sessions] = await Promise.all([
        attemptRepo.getAll(profile.id),
        itemStateRepo.getForStudent(profile.id),
        sessionRepo.getAll(profile.id),
      ]);
      const todayStats = computeTodayStats(attempts, sessions, now);
      const streak = computeStreak(attempts, now);
      const dueCount = states.filter(s => s.nextDueAt && s.nextDueAt <= now.toISOString()).length;
      setQuick({
        todayQuestions: todayStats.questionsAnswered,
        todayAccuracy: todayStats.accuracy,
        todayMinutes: todayStats.minutesPracticed,
        streak,
        dueCount,
      });
    })();
  }, [profile.id, lastSyncedAt]);

  return (
    <div style={s.container}>
      {/* Header */}
      <header style={s.header}>
        <div>
          <h1 style={s.name}>Hi, {profile.displayName}!</h1>
          <p style={s.grade}>Grade {profile.gradeLevel}</p>
        </div>
        <button style={s.settingsBtn} onClick={onOpenSettings} title="Settings">⚙️</button>
      </header>

      {/* Quick stats */}
      {quick && (
        <>
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
        </>
      )}

      {/* Primary action */}
      <button style={s.primaryBtn} onClick={onStartDailyReview}>
        Daily Review
      </button>
      {quick && quick.dueCount > 0 && (
        <p style={s.hint}>{quick.dueCount} fact{quick.dueCount > 1 ? 's' : ''} due for review today.</p>
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

      <button style={s.statsBtn} onClick={onOpenStats}>
        📊 Stats &amp; History
      </button>
    </div>
  );
}

function Chip({ label, value, color = '#1f2937' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: '10px', padding: '10px 4px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  name: { fontSize: '26px', fontWeight: 'bold', margin: 0 },
  grade: { fontSize: '14px', color: '#6b7280', margin: '4px 0 0' },
  settingsBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '4px', borderRadius: '8px' },
  quickRow: { display: 'flex', gap: '8px', marginBottom: '20px' },
  primaryBtn: { width: '100%', padding: '18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '14px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '8px', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' },
  statsBtn: { width: '100%', padding: '13px', background: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  hint: { textAlign: 'center', color: '#6b7280', fontSize: '13px', margin: '0 0 8px' },
  sectionLabel: { fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '18px 0 10px' },
  opGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  opBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '16px 0', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '14px', cursor: 'pointer', touchAction: 'manipulation' },
  opIcon: { fontSize: '26px', lineHeight: 1 },
  opLabel: { fontSize: '13px', fontWeight: '600', color: '#374151' },
};
