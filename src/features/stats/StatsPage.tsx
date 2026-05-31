import { useState, useEffect, useMemo } from 'react';
import { DrillHistory } from './DrillHistory';
import { FactStatsTable } from './FactStatsTable';
import { GrowthView } from './GrowthView';
import { MasteryGrid } from '../../components/MasteryGrid';
import { MiniCalendar, type DateRange } from '../../components/MiniCalendar';
import { StatsGraph, type DayPoint } from '../../components/StatsGraph';
import { computeDayStats, addDays, startOfLocalDay, startOfWeek, startOfMonth, localDateStr } from '../stats/statsEngine';
import { attemptRepo, sessionRepo } from '../../db/repositories';
import { appNow } from '../time/clock';
import type { AttemptLog, PracticeSession } from '../../types/math';

interface Props {
  studentId: string;
  lastSyncedAt?: string | null;
  onBack: () => void;
}

type PeriodPreset = 'today' | 'week' | 'month' | 'custom';
type DetailTab = 'growth' | 'sessions' | 'facts' | 'grid';

function toYMD(d: Date): string { return localDateStr(d.toISOString()); }

function buildRange(preset: PeriodPreset, customRange?: DateRange): DateRange {
  const now = appNow();
  const today = toYMD(now);
  if (preset === 'today') return { start: today, end: today };
  if (preset === 'week') {
    const mon = startOfWeek(now);
    return { start: toYMD(mon), end: today };
  }
  if (preset === 'month') {
    const first = startOfMonth(now);
    return { start: toYMD(first), end: today };
  }
  return customRange ?? { start: today, end: today };
}

function daysBetween(start: string, end: string): number {
  return Math.round((new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000) + 1;
}

export function StatsPage({ studentId, lastSyncedAt, onBack }: Props) {
  const [preset, setPreset] = useState<PeriodPreset>('week');
  const [customRange, setCustomRange] = useState<DateRange>(() => {
    const today = toYMD(appNow());
    return { start: today, end: today };
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('growth');
  const [attempts, setAttempts] = useState<AttemptLog[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);

  useEffect(() => {
    Promise.all([
      attemptRepo.getAll(studentId),
      sessionRepo.getAll(studentId),
    ]).then(([a, s]) => { setAttempts(a); setSessions(s); });
  }, [studentId, lastSyncedAt]);

  const range = buildRange(preset, customRange);

  // Activity dates for the calendar (days with any practice)
  const activityDates = useMemo(() => {
    return new Set(attempts.map(a => localDateStr(a.createdAt)));
  }, [attempts]);

  // Build day-by-day data for the selected range
  const graphData = useMemo((): DayPoint[] => {
    const days = daysBetween(range.start, range.end);
    const startDate = startOfLocalDay(new Date(range.start + 'T12:00:00'));
    return Array.from({ length: days }, (_, i) => {
      const d = addDays(startDate, i);
      const ds = computeDayStats(d, attempts, sessions);
      return {
        date: ds.date,
        questions: ds.questionsAnswered,
        correct: ds.correctCount,
        accuracy: ds.accuracy,
      };
    });
  }, [range.start, range.end, attempts, sessions]);

  // Period totals
  const totals = useMemo(() => {
    const inRange = attempts.filter(a => {
      const d = localDateStr(a.createdAt);
      return d >= range.start && d <= range.end;
    });
    const correct = inRange.filter(a => a.isCorrect);
    return {
      questions: inRange.length,
      correct: correct.length,
      accuracy: inRange.length ? Math.round(correct.length / inRange.length * 100) : 0,
      daysActive: new Set(inRange.map(a => localDateStr(a.createdAt))).size,
      avgSpeed: correct.length
        ? Math.round(correct.reduce((s, a) => s + a.latencyMs, 0) / correct.length / 100) / 10
        : 0,
    };
  }, [range, attempts]);

  const PRESETS: { key: PeriodPreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
  ];

  const rangeLabel = range.start === range.end
    ? range.start
    : `${range.start} → ${range.end} (${daysBetween(range.start, range.end)} days)`;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button style={s.back} onClick={onBack}>← Back</button>
        <h2 style={s.title}>Stats & History</h2>
      </div>

      {/* Period presets */}
      <div style={s.presets}>
        {PRESETS.map(p => (
          <button
            key={p.key}
            style={{ ...s.preset, ...(preset === p.key ? s.presetOn : {}) }}
            onClick={() => {
              setPreset(p.key);
              setShowCalendar(p.key === 'custom');
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Calendar toggle & display */}
      {preset !== 'custom' && (
        <button style={s.calToggle} onClick={() => setShowCalendar(v => !v)}>
          📅 {showCalendar ? 'Hide calendar' : 'Show calendar'}
        </button>
      )}

      {showCalendar && (
        <div style={{ marginBottom: '12px' }}>
          <MiniCalendar
            value={preset === 'custom' ? customRange : range}
            onChange={r => {
              setCustomRange(r);
              if (preset !== 'custom') setPreset('custom');
            }}
            activityDates={activityDates}
            mode="range"
          />
        </div>
      )}

      {/* Range label */}
      <p style={s.rangeLabel}>{rangeLabel}</p>

      {/* Summary pills */}
      <div style={s.pills}>
        <SummaryPill label="Questions" value={String(totals.questions)} />
        <SummaryPill
          label="Accuracy"
          value={totals.questions ? `${totals.accuracy}%` : '—'}
          color={totals.accuracy >= 80 ? '#22c55e' : totals.accuracy >= 60 ? '#f59e0b' : '#ef4444'}
        />
        <SummaryPill label="Days active" value={String(totals.daysActive)} />
        <SummaryPill label="Avg speed" value={totals.avgSpeed ? `${totals.avgSpeed}s` : '—'} />
      </div>

      {/* Graph */}
      <div style={s.graphBox}>
        <StatsGraph data={graphData} height={180} />
      </div>

      {/* Detail tabs */}
      <div style={s.tabs}>
        {(['growth', 'sessions', 'facts', 'grid'] as DetailTab[]).map(t => (
          <button
            key={t}
            style={{ ...s.tab, ...(detailTab === t ? s.tabOn : {}) }}
            onClick={() => setDetailTab(t)}
          >
            {t === 'growth' ? '📈 Growth' : t === 'sessions' ? '📋 Sessions' : t === 'facts' ? '📊 Facts' : '🔲 Grid'}
          </button>
        ))}
      </div>

      <div style={s.detail}>
        {detailTab === 'growth' && (
          <GrowthView studentId={studentId} />
        )}
        {detailTab === 'sessions' && (
          <DrillHistory studentId={studentId} dateRange={range} />
        )}
        {detailTab === 'facts' && (
          <FactStatsTable studentId={studentId} />
        )}
        {detailTab === 'grid' && (
          <MasteryGrid studentId={studentId} />
        )}
      </div>
    </div>
  );
}

function SummaryPill({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, background: '#fff', borderRadius: '10px', padding: '10px 4px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: '640px', margin: '0 auto', padding: '12px 16px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  back: { background: 'none', border: 'none', color: 'var(--primary)', fontSize: '16px', cursor: 'pointer', fontWeight: '500', padding: 0 },
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
  presets: { display: 'flex', gap: '6px', marginBottom: '8px' },
  preset: { flex: 1, padding: '8px 4px', border: '2px solid #e5e7eb', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  presetOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  calToggle: { background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', padding: '4px 0 8px', fontWeight: '500' },
  rangeLabel: { fontSize: '12px', color: '#6b7280', margin: '0 0 10px', textAlign: 'center' },
  pills: { display: 'flex', gap: '8px', marginBottom: '12px' },
  graphBox: { background: '#fff', borderRadius: '14px', padding: '12px 8px 8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px' },
  tabs: { display: 'flex', gap: '6px', marginBottom: '12px' },
  tab: { flex: 1, padding: '9px 2px', border: '2px solid #e5e7eb', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' },
  tabOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  detail: { minHeight: '200px' },
};
