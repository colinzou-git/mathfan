import { useEffect, useState } from 'react';
import type { AchievementFilter, TodayAchievementData, TodaySummary } from './todayAchievement';
import { computeTodayAchievement } from './todayAchievement';
import { mathAnswerEventRepo, sessionRepo } from '../../db/repositories';
import { startOfLocalDay, addDays } from './statsEngine';
import { appNow } from '../time/clock';

interface Props {
  studentId: string;
  onOpenDetail: (filter: AchievementFilter, data: TodayAchievementData) => void;
  lastSyncedAt?: string | null;
}

interface TileConfig {
  filter: AchievementFilter;
  title: string;
  color: string;
  bg: string;
  border: string;
}

const TILES: TileConfig[] = [
  { filter: 'total',      title: 'Total',      color: '#1f2937', bg: '#f9fafb', border: '#e5e7eb' },
  { filter: 'due',        title: 'Reviewed',    color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  { filter: 'practice',   title: 'Practice',    color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  { filter: 'quiz',       title: 'Quiz',        color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  { filter: 'improved',   title: 'Improved',    color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7' },
  { filter: 'needsFocus', title: 'Need Focus',  color: '#7f1d1d', bg: '#fef2f2', border: '#fca5a5' },
];

function AchievementTile({
  cfg, summary, onClick,
}: { cfg: TileConfig; summary: TodaySummary; onClick: () => void }) {
  return (
    <button
      style={{
        ...s.tile,
        color: cfg.color,
        background: cfg.bg,
        borderColor: cfg.border,
      }}
      onClick={onClick}
    >
      <span style={{ ...s.tileCount, color: cfg.color }}>{summary.count}</span>
      <span style={s.tileTitle}>{cfg.title}</span>
      <span style={{ ...s.tileAcc, color: cfg.color }}>
        {Math.round(summary.accuracy * 100)}%
      </span>
    </button>
  );
}

export function TodayAchievementSection({ studentId, onOpenDetail, lastSyncedAt }: Props) {
  const [data, setData] = useState<TodayAchievementData | null>(null);

  useEffect(() => {
    (async () => {
      const now = appNow();
      const todayStart = startOfLocalDay(now);
      const todayEnd = addDays(todayStart, 1);

      const [todayEvents, allSessions] = await Promise.all([
        mathAnswerEventRepo.getForDateRange(studentId, todayStart, todayEnd),
        sessionRepo.getAll(studentId),
      ]);

      // With no activity today, show all tiles at zero rather than hiding the
      // section. computeTodayAchievement returns zero-count summaries for empty input.
      if (todayEvents.length === 0) {
        setData(computeTodayAchievement([], [], allSessions));
        return;
      }

      // Fetch all events before today to build prior-performance comparisons.
      // Uses the compound index [studentId+createdAt] for efficiency.
      const priorEvents = await mathAnswerEventRepo.getForDateRange(
        studentId,
        new Date(0),
        todayStart,
      );

      const achievement = computeTodayAchievement(todayEvents, priorEvents, allSessions);
      setData(achievement);
    })();
  }, [studentId, lastSyncedAt]);

  if (!data) return null;

  return (
    <div>
      <p style={s.sectionLabel}>Today's Achievement</p>
      <div style={s.tilesRow}>
        {TILES.map(cfg => {
          const summary = data[cfg.filter];
          return (
            <AchievementTile
              key={cfg.filter}
              cfg={cfg}
              summary={summary}
              onClick={() => onOpenDetail(cfg.filter, data)}
            />
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  sectionLabel: {
    fontSize: '13px', fontWeight: '700', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.05em', margin: '18px 0 10px',
  },
  tilesRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' },
  tile: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '10px 14px', border: '1.5px solid', borderRadius: '12px',
    cursor: 'pointer', minWidth: '82px', touchAction: 'manipulation',
    fontFamily: 'inherit',
  },
  tileCount: { fontSize: '22px', fontWeight: 'bold', lineHeight: 1.1 },
  tileTitle: { fontSize: '11px', fontWeight: '600', color: '#6b7280' },
  tileAcc: { fontSize: '12px', fontWeight: '700', opacity: 0.85 },
};
