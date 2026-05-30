import { useEffect, useState } from 'react';
import type { DayStats, PeriodComparison } from '../../types/math';
import { computeTodayStats, computeDailyHistory, computePeriodComparison } from '../stats/statsEngine';
import { attemptRepo, sessionRepo } from '../../db/repositories';

interface Props { studentId: string }

type Tab = 'week' | 'month';

export function StatsPanel({ studentId }: Props) {
  const [tab, setTab] = useState<Tab>('week');
  const [today, setToday] = useState<DayStats | null>(null);
  const [history, setHistory] = useState<DayStats[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);

  useEffect(() => {
    (async () => {
      const [attempts, sessions] = await Promise.all([
        attemptRepo.getAll(studentId),
        sessionRepo.getAll(studentId),
      ]);
      const now = new Date();
      setToday(computeTodayStats(attempts, sessions, now));
      setHistory(computeDailyHistory(attempts, sessions, tab === 'week' ? 7 : 30, now));
      setComparison(computePeriodComparison(attempts, sessions, now));
    })();
  }, [studentId, tab]);

  if (!today || !comparison) {
    return <div style={{ padding: '16px', color: '#9ca3af' }}>Loading stats…</div>;
  }

  const period = tab === 'week' ? comparison.thisWeek : comparison.thisMonth;
  const prev = tab === 'week' ? comparison.lastWeek : comparison.lastMonth;
  const questionsDelta = period.questions - prev.questions;
  const accuracyDelta = Math.round((period.accuracy - prev.accuracy) * 100);
  const maxQ = Math.max(...history.map(d => d.questionsAnswered), 1);

  return (
    <div style={s.container}>
      {/* Today row */}
      <div style={s.todayRow}>
        <TodayChip label="Today" value={`${today.questionsAnswered} Q`} />
        <TodayChip label="Correct" value={`${Math.round(today.accuracy * 100)}%`} />
        <TodayChip
          label="Avg speed"
          value={today.averageCorrectLatencyMs ? `${(today.averageCorrectLatencyMs / 1000).toFixed(1)}s` : '—'}
        />
        <TodayChip label="Sessions" value={String(today.sessionCount)} />
      </div>

      {/* Tab switcher */}
      <div style={s.tabRow}>
        {(['week', 'month'] as Tab[]).map(t => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div style={s.chart}>
        {history.map((d, i) => {
          const pct = (d.questionsAnswered / maxQ) * 100;
          const isToday = i === history.length - 1;
          return (
            <div key={d.date} style={s.barCol} title={`${d.date}: ${d.questionsAnswered} Q, ${Math.round(d.accuracy * 100)}%`}>
              <div style={s.barWrap}>
                <div style={{
                  ...s.bar,
                  height: `${Math.max(pct, d.questionsAnswered > 0 ? 4 : 0)}%`,
                  background: isToday ? '#4f46e5' : '#a5b4fc',
                }} />
              </div>
              <div style={s.barLabel}>
                {tab === 'week'
                  ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'][new Date(d.date + 'T12:00:00').getDay() === 0 ? 6 : new Date(d.date + 'T12:00:00').getDay() - 1]
                  : d.date.slice(8)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Period summary */}
      <div style={s.summary}>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>{tab === 'week' ? 'This week' : 'This month'}</span>
          <span style={s.summaryValue}>{period.questions} questions</span>
          <span style={{ ...s.delta, color: questionsDelta >= 0 ? '#22c55e' : '#ef4444' }}>
            {questionsDelta >= 0 ? '+' : ''}{questionsDelta} vs {tab === 'week' ? 'last week' : 'last month'}
          </span>
        </div>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>Accuracy</span>
          <span style={s.summaryValue}>{Math.round(period.accuracy * 100)}%</span>
          <span style={{ ...s.delta, color: accuracyDelta >= 0 ? '#22c55e' : '#ef4444' }}>
            {accuracyDelta >= 0 ? '+' : ''}{accuracyDelta}% vs {tab === 'week' ? 'last week' : 'last month'}
          </span>
        </div>
        <div style={s.summaryRow}>
          <span style={s.summaryLabel}>Days active</span>
          <span style={s.summaryValue}>{period.daysActive} days</span>
        </div>
        {period.averageCorrectLatencyMs > 0 && (
          <div style={s.summaryRow}>
            <span style={s.summaryLabel}>Avg speed</span>
            <span style={s.summaryValue}>{(period.averageCorrectLatencyMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TodayChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      flex: 1,
      background: '#fff',
      borderRadius: '10px',
      padding: '10px 6px',
      textAlign: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { padding: '0 0 8px' },
  todayRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tab: {
    flex: 1, padding: '8px', border: '2px solid #e5e7eb', borderRadius: '8px',
    background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500',
  },
  tabActive: { borderColor: '#4f46e5', background: '#eef2ff', color: '#4f46e5' },
  chart: {
    display: 'flex',
    gap: '4px',
    height: '80px',
    alignItems: 'flex-end',
    marginBottom: '16px',
    padding: '0 2px',
  },
  barCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  barWrap: { flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' },
  bar: { width: '100%', borderRadius: '3px 3px 0 0', minHeight: '0', transition: 'height 0.3s' },
  barLabel: { fontSize: '10px', color: '#9ca3af' },
  summary: { background: '#fff', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' },
  summaryRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' },
  summaryLabel: { color: '#6b7280', minWidth: '80px' },
  summaryValue: { fontWeight: '600', color: '#1f2937', flex: 1 },
  delta: { fontSize: '13px', fontWeight: '500' },
};
