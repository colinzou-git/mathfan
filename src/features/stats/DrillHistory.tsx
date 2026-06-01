import { useEffect, useState } from 'react';
import type { PracticeSession, AttemptLog } from '../../types/math';
import type { DateRange } from '../../components/MiniCalendar';
import { sessionRepo, attemptRepo } from '../../db/repositories';
import { appNow } from '../time/clock';
import { derivePracticeMetrics } from '../practice/metrics';

interface Props {
  studentId: string;
  dateRange?: DateRange; // if provided, filter sessions to this range
}

interface SessionRow {
  session: PracticeSession;
  attempts?: AttemptLog[];
}

function modeLabel(s: PracticeSession): string {
  if (s.mode === 'daily_review') return 'Daily Review';
  if (s.mode === 'single_table' && s.tables?.length) return `${s.tables[0]}× Table`;
  if (s.mode === 'multi_table' && s.tables?.length) return `Mixed: ${s.tables.join('×, ')}×`;
  const labels: Record<string, string> = {
    addition: 'Addition', subtraction: 'Subtraction', division: 'Division',
    fraction: 'Fractions', word_problem: 'Word Problems', rounding: 'Rounding',
    factors: 'Primes & Factors', decimals: 'Decimals',
  };
  return labels[s.mode] ?? s.mode;
}

function dateLabel(iso: string): string {
  const d = new Date(iso);
  const today = appNow();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dStr = d.toDateString();
  if (dStr === today.toDateString()) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (dStr === yesterday.toDateString()) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function durationLabel(s: PracticeSession): string {
  if (!s.endedAt) return '';
  const sec = Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function DrillHistory({ studentId, dateRange }: Props) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE = 20;

  useEffect(() => {
    sessionRepo.getAll(studentId).then(sessions => {
      let filtered = sessions;
      if (dateRange) {
        const start = dateRange.start + 'T00:00:00';
        const end = dateRange.end + 'T23:59:59';
        filtered = sessions.filter(s => s.startedAt >= start && s.startedAt <= end);
      }
      const sorted = [...filtered].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      setRows(sorted.map(s => ({ session: s })));
    });
  }, [studentId, dateRange?.start, dateRange?.end]);

  const loadAttempts = async (sessionId: string) => {
    if (expanded === sessionId) { setExpanded(null); return; }
    const row = rows.find(r => r.session.id === sessionId);
    if (!row) return;
    if (!row.attempts) {
      const attempts = await attemptRepo.getForSession(sessionId);
      setRows(prev => prev.map(r =>
        r.session.id === sessionId ? { ...r, attempts } : r
      ));
    }
    setExpanded(sessionId);
  };

  const pageRows = rows.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(rows.length / PAGE);

  if (rows.length === 0) {
    return <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px' }}>No sessions yet — complete a drill to see history here.</p>;
  }

  return (
    <div>
      <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 12px' }}>
        {rows.length} session{rows.length !== 1 ? 's' : ''} total
      </p>

      {pageRows.map(({ session: s, attempts }) => {
        // firstTryCount is absent on sessions saved before that feature; fall back to
        // correctCount/completedQuestionCount only for those legacy rows.
        const accuracy = s.completedQuestionCount
          ? s.firstTryCount != null
            ? Math.round(s.firstTryCount / s.completedQuestionCount * 100)
            : Math.round(s.correctCount / s.completedQuestionCount * 100)
          : 0;
        const isOpen = expanded === s.id;

        return (
          <div key={s.id} style={st.card}>
            <button style={st.rowBtn} onClick={() => loadAttempts(s.id)}>
              <div style={st.rowLeft}>
                <span style={st.modeTag}>{modeLabel(s)}</span>
                <span style={st.dateText}>{dateLabel(s.startedAt)}</span>
              </div>
              <div style={st.rowRight}>
                <Pill value={s.completedQuestionCount < s.plannedQuestionCount
                  ? `${s.completedQuestionCount}/${s.plannedQuestionCount}Q`
                  : `${s.completedQuestionCount}Q`}
                />
                <Pill
                  value={`${accuracy}%`}
                  color={accuracy >= 90 ? '#22c55e' : accuracy >= 70 ? '#f59e0b' : '#ef4444'}
                />
                {s.averageLatencyMs > 0 && (
                  <Pill value={`${(s.averageLatencyMs / 1000).toFixed(1)}s`} />
                )}
                {s.endedAt && <Pill value={durationLabel(s)} />}
                <span style={{ color: '#9ca3af', fontSize: '14px' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && attempts && (
              <AttemptDetail attempts={attempts} session={s} />
            )}
          </div>
        );
      })}

      {totalPages > 1 && (
        <div style={st.pager}>
          <button style={st.pgBtn} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</button>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>{page + 1} / {totalPages}</span>
          <button style={st.pgBtn} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}>Next →</button>
        </div>
      )}
    </div>
  );
}

function AttemptDetail({ attempts, session }: { attempts: AttemptLog[], session: PracticeSession }) {
  const m = derivePracticeMetrics(attempts);
  const firstTryPct = m.completedItemCount ? Math.round(m.firstTryAccuracy * 100) : 0;
  const attemptAccPct = m.attemptCount ? Math.round(m.completedItemCount / m.attemptCount * 100) : 0;
  const eventualPct = session.plannedQuestionCount
    ? Math.round(m.completedItemCount / session.plannedQuestionCount * 100) : 100;

  // Group by item for per-fact breakdown
  const byItem = new Map<string, { prompt: string; correct: number; wrong: number; latencies: number[] }>();
  for (const a of attempts) {
    const existing = byItem.get(a.itemId) ?? { prompt: a.promptShown, correct: 0, wrong: 0, latencies: [] };
    if (a.isCorrect) { existing.correct++; existing.latencies.push(a.latencyMs); }
    else existing.wrong++;
    byItem.set(a.itemId, existing);
  }
  const items = [...byItem.values()].sort((a, b) => {
    const accA = a.correct / (a.correct + a.wrong);
    const accB = b.correct / (b.correct + b.wrong);
    return accA - accB; // worst first
  });

  const showAttemptAcc = attemptAccPct !== firstTryPct;
  const showEventual = eventualPct < 100;

  return (
    <div style={st.detail}>
      <div style={st.metricsRow}>
        <MetricChip label="First-try" value={`${firstTryPct}%`}
          color={firstTryPct >= 90 ? '#15803d' : firstTryPct >= 70 ? '#b45309' : '#b91c1c'} />
        {showAttemptAcc && (
          <MetricChip label="Attempt acc." value={`${attemptAccPct}%`} color="#6b7280" />
        )}
        {showEventual && (
          <MetricChip label="Completed" value={`${m.completedItemCount}/${session.plannedQuestionCount}`} color="#6b7280" />
        )}
      </div>
      <div style={st.detailHeader}>
        <span>Fact</span><span>✓</span><span>✗</span><span>Avg</span>
      </div>
      {items.map((item, i) => {
        const avg = item.latencies.length
          ? Math.round(item.latencies.reduce((s, v) => s + v, 0) / item.latencies.length)
          : 0;
        const acc = item.correct / (item.correct + item.wrong);
        return (
          <div key={i} style={{
            ...st.detailRow,
            background: item.wrong > 0 ? '#fff5f5' : acc === 1 ? '#f0fdf4' : undefined,
          }}>
            <span style={{ fontWeight: '600', color: '#111827' }}>{item.prompt}</span>
            <span style={{ color: '#22c55e', fontWeight: '600' }}>{item.correct}</span>
            <span style={{ color: item.wrong > 0 ? '#ef4444' : '#9ca3af', fontWeight: item.wrong > 0 ? '600' : 'normal' }}>{item.wrong}</span>
            <span style={{ color: '#6b7280' }}>{avg ? `${(avg / 1000).toFixed(1)}s` : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '72px' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{label}</div>
    </div>
  );
}

function Pill({ value, color = '#6b7280' }: { value: string; color?: string }) {
  return (
    <span style={{ fontSize: '12px', fontWeight: '600', color, background: '#f3f4f6', borderRadius: '6px', padding: '2px 7px' }}>
      {value}
    </span>
  );
}

const st: Record<string, React.CSSProperties> = {
  card: { background: '#fff', borderRadius: '10px', marginBottom: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  rowBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', gap: '8px', flexWrap: 'wrap' },
  rowLeft: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: '120px' },
  modeTag: { fontSize: '14px', fontWeight: '600', color: '#111827' },
  dateText: { fontSize: '12px', color: '#9ca3af' },
  rowRight: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  detail: { borderTop: '1px solid #f3f4f6', padding: '8px 14px 12px' },
  metricsRow: { display: 'flex', gap: '16px', padding: '6px 4px 10px', borderBottom: '1px solid #f3f4f6', marginBottom: '8px' },
  detailHeader: { display: 'grid', gridTemplateColumns: '1fr 40px 40px 60px', fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', padding: '4px 0 6px', letterSpacing: '0.05em' },
  detailRow: { display: 'grid', gridTemplateColumns: '1fr 40px 40px 60px', fontSize: '13px', padding: '5px 6px', borderRadius: '6px' },
  pager: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '12px' },
  pgBtn: { padding: '6px 14px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px' },
};
