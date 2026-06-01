import { useEffect, useMemo, useState } from 'react';
import type { MultiplicationFactStats, MultiplicationFactKey, QuizSession } from '../multiplication/types';
import type { DateRange } from '../../components/MiniCalendar';
import { MultiplicationMasteryGrid } from '../multiplication/MultiplicationMasteryGrid';
import { db } from '../../db/dexie';

interface Props {
  studentId: string;
  dateRange: DateRange;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function avgSecStr(ms: number | null): string {
  return ms ? `${(ms / 1000).toFixed(1)}s` : '—';
}

export function QuizStatsView({ studentId, dateRange }: Props) {
  const [allSessions, setAllSessions] = useState<QuizSession[]>([]);
  const [statsMap, setStatsMap] = useState<Map<MultiplicationFactKey, MultiplicationFactStats>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.quizSessions.where('studentId').equals(studentId).toArray(),
      db.multFactStats.where('studentId').equals(studentId).toArray(),
    ]).then(([sess, stats]) => {
      sess.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      setAllSessions(sess);
      setStatsMap(new Map(stats.map(s => [s.key as MultiplicationFactKey, s as MultiplicationFactStats])));
      setLoading(false);
    });
  }, [studentId]);

  const sessions = useMemo(() => {
    const start = dateRange.start + 'T00:00:00';
    const end   = dateRange.end   + 'T23:59:59';
    return allSessions.filter(s => s.startedAt >= start && s.startedAt <= end);
  }, [allSessions, dateRange]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>Loading…</div>;
  }

  return (
    <div>
      {/* Mastery grid */}
      <div style={{ marginBottom: '20px' }}>
        <MultiplicationMasteryGrid statsMap={statsMap} />
      </div>

      {/* Quiz session list */}
      <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px' }}>
        Quiz History ({sessions.length})
      </h3>

      {sessions.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
          No quizzes taken yet. Try the Multiplication Quiz!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.map(s => {
            const acc = Math.round(s.accuracy * 100);
            const accColor = acc >= 80 ? '#16a34a' : acc >= 60 ? '#d97706' : '#dc2626';
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                {/* Row */}
                <button
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                >
                  <span style={{ fontSize: '12px', color: '#9ca3af', flex: '0 0 auto' }}>{fmt(s.startedAt)}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    {s.quizLength}Q · {s.correctCount}/{s.quizLength}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: accColor }}>{acc}%</span>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{avgSecStr(s.averageResponseTimeMs)} avg</span>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: '0 14px 12px', borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {s.forgottenFactsDiscovered.length > 0 && (
                        <FactGroup label="Forgotten" keys={s.forgottenFactsDiscovered} bg="#fef08a" text="#713f12" />
                      )}
                      {s.weakFactsDiscovered.length > 0 && (
                        <FactGroup label="Weak" keys={s.weakFactsDiscovered} bg="#fecdd3" text="#9f1239" />
                      )}
                      {s.recommendedPracticeFacts.length > 0 && (
                        <FactGroup label="Recommended" keys={s.recommendedPracticeFacts} bg="var(--primary-light)" text="var(--primary)" />
                      )}
                    </div>
                    {s.forgottenFactsDiscovered.length === 0 && s.weakFactsDiscovered.length === 0 && (
                      <p style={{ fontSize: '13px', color: '#16a34a', margin: '8px 0 0' }}>Great quiz — no weak or forgotten facts!</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FactGroup({ label, keys, bg, text }: { label: string; keys: MultiplicationFactKey[]; bg: string; text: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {keys.slice(0, 8).map(key => {
          const [l, r] = key.split('x').map(Number);
          return (
            <span key={key} style={{ background: bg, color: text, borderRadius: '6px', padding: '2px 7px', fontSize: '12px', fontWeight: '600' }}>
              {l}×{r}={l * r}
            </span>
          );
        })}
        {keys.length > 8 && (
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>+{keys.length - 8} more</span>
        )}
      </div>
    </div>
  );
}
