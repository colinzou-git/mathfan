import { useEffect, useState } from 'react';
import type { StudentProfile, SessionConfig } from '../../types/math';
import { itemStateRepo, mathAnswerEventRepo, sessionRepo } from '../../db/repositories';
import { computeTodayStats, computeStreak, eventsToAttemptLogs } from '../stats/statsEngine';
import { appNow } from '../time/clock';
import { describeItem } from '../curriculum/describeItem';
import { TodayAchievementSection } from '../stats/TodayAchievementSection';
import type { AchievementFilter, TodayAchievementData } from '../stats/todayAchievement';

export type PracticeOp =
  | 'multiplication' | 'division' | 'addition' | 'subtraction' | 'fraction'
  | 'word' | 'rounding' | 'factors' | 'decimals';

interface Props {
  profile: StudentProfile;
  lastSyncedAt?: string | null;
  onStartDailyReview: (config: SessionConfig) => void;
  onPickOperation: (op: PracticeOp) => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onStartQuiz: () => void;
  onOpenAchievementDetail: (filter: AchievementFilter, data: TodayAchievementData) => void;
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
  mul:     { label: 'Multiply',  icon: '✖️' },
  div:     { label: 'Divide',    icon: '➗' },
  add:     { label: 'Add',       icon: '➕' },
  sub:     { label: 'Subtract',  icon: '➖' },
  frac:    { label: 'Fractions', icon: '🍕' },
  word:    { label: 'Word',      icon: '📖' },
  round:   { label: 'Rounding',  icon: '🔵' },
  factors: { label: 'Primes',    icon: '🔢' },
  dec:     { label: 'Decimals',  icon: '🔟' },
  other:   { label: 'Other',     icon: '📝' },
};

const GROUP_ORDER = ['mul', 'div', 'add', 'sub', 'frac', 'word', 'round', 'factors', 'dec', 'other'];

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

export function StudentDashboard({ profile, lastSyncedAt, onStartDailyReview, onPickOperation, onOpenStats, onOpenSettings, onStartQuiz, onOpenAchievementDetail }: Props) {
  const [quick, setQuick] = useState<QuickStats | null>(null);
  const [dueByGroup, setDueByGroup] = useState<Record<string, DueGroup>>({});
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [practiceRounds, setPracticeRounds] = useState(3);

  useEffect(() => {
    (async () => {
      const now = appNow();
      const nowStr = now.toISOString();
      const [events, states, sessions] = await Promise.all([
        mathAnswerEventRepo.getAll(profile.id),
        itemStateRepo.getForStudent(profile.id),
        sessionRepo.getAll(profile.id),
      ]);
      const attempts = eventsToAttemptLogs(events);
      const todayStats = computeTodayStats(attempts, sessions, now);
      const streak = computeStreak(attempts, now);

      const dueStates = states.filter(s => s.nextDueAt && s.nextDueAt <= nowStr);

      const byGroup: Record<string, DueGroup> = {};
      for (const state of dueStates) {
        const { group } = describeItem(state.itemId);
        const key = group === 'unk' ? 'mul' : group;
        if (!byGroup[key]) {
          const d = GROUP_DISPLAY[key] ?? GROUP_DISPLAY.other;
          byGroup[key] = { label: d.label, icon: d.icon, ids: [] };
        }
        byGroup[key].ids.push(state.itemId);
      }
      setDueByGroup(byGroup);

      setQuick({
        todayQuestions: todayStats.questionsAnswered,
        todayAccuracy: todayStats.accuracy,
        todayMinutes: todayStats.minutesPracticed,
        streak,
        dueCount: dueStates.length,
      });
    })();
  }, [profile.id, lastSyncedAt]);

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
    });
    setSelectedGroup(null);
  };

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
                onClick={() => { setSelectedGroup(key); setPracticeRounds(3); }}
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

      {/* Multiplication quiz */}
      <button style={s.quizBtn} onClick={onStartQuiz}>
        ✏️ Multiplication Quiz
      </button>

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
            <div style={s.modalCountRow}>
              <button style={s.adjBtn} onClick={() => setPracticeRounds(r => Math.max(1, r - 1))}>−</button>
              <span style={s.modalCount}>{practiceRounds}</span>
              <button style={s.adjBtn} onClick={() => setPracticeRounds(r => r + 1)}>+</button>
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
  statsBtn: { width: '100%', padding: '13px', background: '#f9fafb', color: '#374151', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  quizBtn: { width: '100%', padding: '14px', background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
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
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: '20px', padding: '28px 24px', maxWidth: '300px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  modalTitle: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px', color: '#1f2937' },
  modalSub: { fontSize: '14px', color: '#6b7280', margin: '0 0 20px' },
  modalLabel: { fontSize: '14px', fontWeight: '600', color: '#374151', margin: '0 0 10px' },
  modalCountRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '10px' },
  adjBtn: { width: '38px', height: '38px', border: '2px solid #e5e7eb', borderRadius: '8px', background: '#fff', fontSize: '20px', cursor: 'pointer', fontWeight: '600', color: '#374151' },
  modalCount: { fontSize: '34px', fontWeight: 'bold', color: '#1f2937', minWidth: '44px', display: 'inline-block' },
  modalTotal: { fontSize: '13px', color: '#6b7280', margin: '0 0 18px' },
  modalStart: { width: '100%', padding: '13px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '8px' },
  modalCancel: { width: '100%', padding: '8px', background: 'none', color: '#9ca3af', border: 'none', fontSize: '14px', cursor: 'pointer' },
};
