import { useEffect, useState } from 'react';
import type { StudentProfile } from '../../types/math';
import { itemStateRepo, attemptRepo } from '../../db/repositories';
import { computeTodayStats, computeStreak } from '../stats/statsEngine';

interface Props {
  profile: StudentProfile;
  onStartDailyReview: () => void;
  onStartTableDrill: () => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
}

interface QuickStats {
  todayQuestions: number;
  todayAccuracy: number;
  streak: number;
  dueCount: number;
}

export function StudentDashboard({ profile, onStartDailyReview, onStartTableDrill, onOpenStats, onOpenSettings }: Props) {
  const [quick, setQuick] = useState<QuickStats | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const [attempts, states] = await Promise.all([
        attemptRepo.getAll(profile.id),
        itemStateRepo.getForStudent(profile.id),
      ]);
      const todayStats = computeTodayStats(attempts, [], now);
      const streak = computeStreak(attempts, now);
      const dueCount = states.filter(s => s.nextDueAt && s.nextDueAt <= now.toISOString()).length;
      setQuick({
        todayQuestions: todayStats.questionsAnswered,
        todayAccuracy: todayStats.accuracy,
        streak,
        dueCount,
      });
    })();
  }, [profile.id]);

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
        <div style={s.quickRow}>
          <Chip label="Today" value={`${quick.todayQuestions} Q`} />
          <Chip
            label="Accuracy"
            value={quick.todayQuestions ? `${Math.round(quick.todayAccuracy * 100)}%` : '—'}
          />
          <Chip label="Streak" value={`${quick.streak}d`} color="var(--primary)" />
          <Chip
            label="Due"
            value={String(quick.dueCount)}
            color={quick.dueCount > 0 ? '#f59e0b' : '#22c55e'}
          />
        </div>
      )}

      {/* Primary actions */}
      <button style={s.primaryBtn} onClick={onStartDailyReview}>
        Daily Review
      </button>
      {quick && quick.dueCount > 0 && (
        <p style={s.hint}>{quick.dueCount} fact{quick.dueCount > 1 ? 's' : ''} due for review today.</p>
      )}

      <button style={s.secondaryBtn} onClick={onStartTableDrill}>
        Times Table Drill
      </button>

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
  secondaryBtn: { width: '100%', padding: '16px', background: '#fff', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '14px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px', marginBottom: '8px' },
  statsBtn: { width: '100%', padding: '13px', background: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' },
  hint: { textAlign: 'center', color: '#6b7280', fontSize: '13px', margin: '0 0 8px' },
};
