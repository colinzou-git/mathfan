import { useEffect, useState, useMemo } from 'react';
import type { StudentItemState, SessionConfig } from '../../types/math';
import type { MathFactStatus } from '../learning/learningEvents';
import { itemStateRepo } from '../../db/repositories';
import { db } from '../../db/dexie';
import { TABLE_MIN, TABLE_MAX, tableFromItemId } from '../curriculum/multiplicationItems';
import { describeItem } from '../curriculum/describeItem';
import { FACT_STATUS_COLORS } from '../../utils/masteryColors';

interface Props {
  studentId: string;
  onStartPractice?: (config: SessionConfig) => void;
}

type SortKey = 'accuracy' | 'wrong' | 'attempts' | 'avgSpeed' | 'bestSpeed';
type TypeFilter = 'all' | 'mul' | 'div' | 'add' | 'sub' | 'frac' | 'word' | 'round' | 'factors' | 'dec';

const ALL_FACT_STATUSES: MathFactStatus[] = ['new', 'forgotten', 'weak', 'learning', 'developing', 'strong', 'mastered'];

const OPERATION_TABS: { key: TypeFilter; label: string; icon: string }[] = [
  { key: 'all',     label: 'All',       icon: '∑' },
  { key: 'mul',     label: 'Multiply',  icon: '✖️' },
  { key: 'div',     label: 'Divide',    icon: '➗' },
  { key: 'add',     label: 'Add',       icon: '➕' },
  { key: 'sub',     label: 'Subtract',  icon: '➖' },
  { key: 'frac',    label: 'Fractions', icon: '🍕' },
  { key: 'word',    label: 'Word',      icon: '📖' },
  { key: 'round',   label: 'Rounding',  icon: '🔵' },
  { key: 'factors', label: 'Primes',    icon: '🔢' },
  { key: 'dec',     label: 'Decimals',  icon: '🔟' },
];

/** Bucket an itemId's describe-group into a TypeFilter (unknown-factor counts as multiply). */
function bucketOf(itemId: string): Exclude<TypeFilter, 'all'> | 'other' {
  const g = describeItem(itemId).group;
  if (g === 'mul' || g === 'unk') return 'mul';
  if (g === 'div') return 'div';
  if (g === 'add') return 'add';
  if (g === 'sub') return 'sub';
  if (g === 'frac') return 'frac';
  if (g === 'word') return 'word';
  if (g === 'round') return 'round';
  if (g === 'factors') return 'factors';
  if (g === 'dec') return 'dec';
  return 'other';
}

export function FactStatsTable({ studentId, onStartPractice }: Props) {
  const [states, setStates] = useState<StudentItemState[]>([]);
  // Quiz-system status map: itemId → MathFactStatus (covers weak/forgotten from quiz events).
  const [quizStatusMap, setQuizStatusMap] = useState<Map<string, MathFactStatus>>(new Map());
  const [sort, setSort] = useState<SortKey>('accuracy');
  const [sortAsc, setSortAsc] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  // Empty set = no filter (show all levels). Non-empty = show only selected levels.
  const [statusFilter, setStatusFilter] = useState<Set<MathFactStatus>>(new Set());
  const [tableFilter, setTableFilter] = useState<number | 'all'>('all');
  const [practiceRounds, setPracticeRounds] = useState(3);
  const [showPracticeSetup, setShowPracticeSetup] = useState(false);

  useEffect(() => {
    // itemStateRepo: derived cache of practice events + FSRS scheduling state.
    // quizStatusMap: quiz mastery state from multFactStats (can include weak/forgotten).
    // Ground truth for both: mathAnswerEvents. See rebuildItemStatesFromEvents().
    Promise.all([
      itemStateRepo.getForStudent(studentId),
      db.multFactStats.where('studentId').equals(studentId).toArray(),
    ]).then(([s, quizStats]) => {
      setStates(s.filter(st => st.attemptCount > 0));
      setQuizStatusMap(new Map(quizStats.map(qs => [
        `MUL_${qs.key}`,
        qs.masteryState as MathFactStatus,
      ])));
    });
  }, [studentId]);

  // Count of practiced facts per operation, for the tab badges
  const groupCounts = useMemo(() => {
    const c: Record<string, number> = { all: states.length };
    for (const s of states) {
      const b = bucketOf(s.itemId);
      c[b] = (c[b] ?? 0) + 1;
    }
    return c;
  }, [states]);

  // Quiz status (weak/forgotten) takes precedence over FSRS level for MUL_ items.
  const effectiveStatus = (s: StudentItemState): MathFactStatus =>
    quizStatusMap.get(s.itemId) ?? s.masteryLevel;

  const toggleStatus = (level: MathFactStatus) => {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      return next;
    });
  };

  const rows = useMemo(() => {
    const filtered = states.filter(s => {
      if (typeFilter !== 'all' && bucketOf(s.itemId) !== typeFilter) return false;
      const status = quizStatusMap.get(s.itemId) ?? s.masteryLevel;
      if (statusFilter.size > 0 && !statusFilter.has(status)) return false;
      if (tableFilter !== 'all') {
        const t = tableFromItemId(s.itemId);
        if (t !== tableFilter) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      let va = 0, vb = 0;
      if (sort === 'accuracy') {
        va = a.correctCount / a.attemptCount;
        vb = b.correctCount / b.attemptCount;
      } else if (sort === 'wrong') {
        va = a.attemptCount - a.correctCount;
        vb = b.attemptCount - b.correctCount;
      } else if (sort === 'attempts') {
        va = a.attemptCount; vb = b.attemptCount;
      } else if (sort === 'avgSpeed') {
        va = a.medianLatencyMs || 99999;
        vb = b.medianLatencyMs || 99999;
      } else if (sort === 'bestSpeed') {
        va = a.personalBestMs ?? 99999;
        vb = b.personalBestMs ?? 99999;
      }
      return sortAsc ? va - vb : vb - va;
    });

    return filtered;
  }, [states, sort, sortAsc, typeFilter, statusFilter, tableFilter, quizStatusMap]);

  // Summary for the selected operation (ignores status/table filters)
  const summary = useMemo(() => {
    const opStates = typeFilter === 'all'
      ? states
      : states.filter(s => bucketOf(s.itemId) === typeFilter);
    const attempts = opStates.reduce((sum, s) => sum + s.attemptCount, 0);
    const correct = opStates.reduce((sum, s) => sum + s.correctCount, 0);
    const speeds = opStates.map(s => s.medianLatencyMs).filter(Boolean);
    const avgMs = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const mastered = opStates.filter(s => s.masteryLevel === 'mastered' || s.masteryLevel === 'strong').length;
    return {
      facts: opStates.length,
      attempts,
      accuracy: attempts ? Math.round(correct / attempts * 100) : 0,
      avgMs,
      mastered,
    };
  }, [states, typeFilter]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(a => !a);
    else { setSort(key); setSortAsc(true); }
  };

  const startPractice = () => {
    if (!onStartPractice || rows.length === 0) return;
    const specificItemIds = rows.map(r => r.itemId);
    const sessionLength = Math.min(specificItemIds.length * practiceRounds, 100);
    onStartPractice({ mode: 'multi_table', specificItemIds, sessionLength });
  };

  const tables = Array.from({ length: TABLE_MAX - TABLE_MIN + 1 }, (_, i) => i + TABLE_MIN);

  return (
    <div>
      {/* Operation tabs */}
      <div style={st.opTabs}>
        {OPERATION_TABS.map(t => {
          const count = groupCounts[t.key] ?? 0;
          const active = typeFilter === t.key;
          return (
            <button
              key={t.key}
              style={{ ...st.opTab, ...(active ? st.opTabOn : {}) }}
              onClick={() => { setTypeFilter(t.key); setTableFilter('all'); }}
            >
              <span style={st.opTabIcon}>{t.icon}</span>
              <span style={st.opTabLabel}>{t.label}</span>
              <span style={{ ...st.opTabCount, ...(active ? { color: 'var(--primary)' } : {}) }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Per-operation summary */}
      {summary.facts > 0 && (
        <div style={st.summary}>
          <SummaryStat label="Facts" value={String(summary.facts)} />
          <SummaryStat label="Answered" value={String(summary.attempts)} />
          <SummaryStat label="Accuracy" value={`${summary.accuracy}%`}
            color={summary.accuracy >= 90 ? '#15803d' : summary.accuracy >= 70 ? '#b45309' : '#b91c1c'} />
          <SummaryStat label="Avg speed" value={summary.avgMs ? `${(summary.avgMs / 1000).toFixed(1)}s` : '—'} />
          <SummaryStat label="Strong+" value={String(summary.mastered)} color="#15803d" />
        </div>
      )}

      {/* Status filter — multi-select mastery levels */}
      <div style={st.filterBar}>
        <button
          style={{ ...st.chip, ...(statusFilter.size === 0 ? st.chipOn : {}) }}
          onClick={() => setStatusFilter(new Set())}
        >
          All
        </button>
        {ALL_FACT_STATUSES.map(level => {
          const mc = FACT_STATUS_COLORS[level];
          const active = statusFilter.has(level);
          return (
            <button
              key={level}
              onClick={() => toggleStatus(level)}
              style={{
                ...st.chip,
                background: active ? mc.bg : '#fff',
                color: active ? mc.text : '#374151',
                borderColor: active ? mc.border : '#e5e7eb',
                fontWeight: active ? '700' : '500',
              }}
            >
              {mc.label}
            </button>
          );
        })}
      </div>

      {/* Table filter for mul/div */}
      {(typeFilter === 'mul' || typeFilter === 'div') && (
        <div style={{ marginBottom: '6px' }}>
          <select
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            style={st.select}
          >
            <option value="all">All tables</option>
            {tables.map(t => <option key={t} value={t}>{t}× table</option>)}
          </select>
        </div>
      )}

      {/* Count + Practice button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 10px', flexWrap: 'wrap' }}>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: 0, flex: '1 1 auto' }}>
          {rows.length} fact{rows.length !== 1 ? 's' : ''} shown
        </p>
        {onStartPractice && rows.length > 0 && (
          showPracticeSetup ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>Rounds:</span>
              <input
                type="number" min={1} max={10} value={practiceRounds}
                onChange={e => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) setPracticeRounds(Math.max(1, Math.min(10, n)));
                }}
                style={{ width: '48px', padding: '4px 6px', fontSize: '14px', textAlign: 'center', border: '1.5px solid #d1d5db', borderRadius: '6px' }}
              />
              <button onClick={startPractice} style={st.practiceBtn}>
                Start →
              </button>
              <button onClick={() => setShowPracticeSetup(false)} style={st.cancelBtn}>
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setShowPracticeSetup(true)} style={st.practiceBtn}>
              Practice {rows.length} facts
            </button>
          )
        )}
      </div>

      {rows.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px' }}>
          No facts match the current filter.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={st.table}>
            <thead>
              <tr style={st.thead}>
                <th style={st.th}>Fact</th>
                <th style={st.th}><SortBtn k="attempts" label="Tries" sort={sort} sortAsc={sortAsc} toggleSort={toggleSort} /></th>
                <th style={st.th}><SortBtn k="accuracy" label="Acc%" sort={sort} sortAsc={sortAsc} toggleSort={toggleSort} /></th>
                <th style={st.th}><SortBtn k="wrong" label="Wrong" sort={sort} sortAsc={sortAsc} toggleSort={toggleSort} /></th>
                <th style={st.th}><SortBtn k="avgSpeed" label="Avg" sort={sort} sortAsc={sortAsc} toggleSort={toggleSort} /></th>
                <th style={st.th}><SortBtn k="bestSpeed" label="Best" sort={sort} sortAsc={sortAsc} toggleSort={toggleSort} /></th>
                <th style={st.th}>Level</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const desc = describeItem(s.itemId);
                const acc = Math.round(s.correctCount / s.attemptCount * 100);
                const wrong = s.attemptCount - s.correctCount;
                return (
                  <tr key={s.itemId} style={{
                    ...st.tr,
                    background: wrong > 2 ? '#fff5f5' : s.masteryLevel === 'mastered' ? '#f0fdf4' : '#fff',
                  }}>
                    <td style={{ ...st.td, fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                      {desc.prompt}
                    </td>
                    <td style={st.tdNum}>{s.attemptCount}</td>
                    <td style={{ ...st.tdNum, color: acc >= 90 ? '#22c55e' : acc >= 70 ? '#f59e0b' : '#ef4444', fontWeight: '600' }}>
                      {acc}%
                    </td>
                    <td style={{ ...st.tdNum, color: wrong > 0 ? '#ef4444' : '#9ca3af', fontWeight: wrong > 0 ? '600' : 'normal' }}>
                      {wrong}
                    </td>
                    <td style={st.tdNum}>
                      {s.medianLatencyMs ? `${(s.medianLatencyMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td style={{ ...st.tdNum, color: s.personalBestMs ? '#f59e0b' : '#9ca3af' }}>
                      {s.personalBestMs ? `${(s.personalBestMs / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td style={st.td}>
                      {(() => {
                        const mc = FACT_STATUS_COLORS[effectiveStatus(s)];
                        return (
                          <span style={{ fontSize: '11px', fontWeight: '700', color: mc.text, background: mc.bg, border: `1px solid ${mc.border}`, borderRadius: '4px', padding: '2px 6px' }}>
                            {mc.letter} {mc.label}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortBtn({ k, label, sort, sortAsc, toggleSort }: {
  k: SortKey; label: string; sort: SortKey; sortAsc: boolean; toggleSort: (k: SortKey) => void;
}) {
  return (
    <button
      style={{ ...st.thBtn, color: sort === k ? 'var(--primary)' : '#6b7280' }}
      onClick={() => toggleSort(k)}
    >
      {label}{sort === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </button>
  );
}

function SummaryStat({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  return (
    <div style={st.summaryStat}>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '10px', color: '#9ca3af' }}>{label}</div>
    </div>
  );
}

const st: Record<string, React.CSSProperties> = {
  opTabs: { display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '10px' },
  opTab: {
    flex: '1 0 auto', minWidth: '58px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
    padding: '8px 6px', border: '2px solid #e5e7eb', borderRadius: '10px', background: '#fff',
    cursor: 'pointer', touchAction: 'manipulation',
  },
  opTabOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)' },
  opTabIcon: { fontSize: '18px', lineHeight: 1 },
  opTabLabel: { fontSize: '11px', fontWeight: '600', color: '#374151' },
  opTabCount: { fontSize: '11px', fontWeight: '700', color: '#9ca3af' },
  summary: {
    display: 'flex', gap: '6px', background: '#f9fafb', borderRadius: '10px',
    padding: '10px 6px', marginBottom: '10px',
  },
  summaryStat: { flex: 1, textAlign: 'center' },
  filterBar: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' },
  chip: { padding: '4px 10px', border: '1.5px solid #e5e7eb', borderRadius: '20px', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '500' },
  chipOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  select: { padding: '5px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer' },
  practiceBtn: { background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', color: '#6b7280', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  thead: { background: '#f9fafb' },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  thBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', padding: 0 },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '8px 10px', color: '#111827' },
  tdNum: { padding: '8px 10px', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
};
