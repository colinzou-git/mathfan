import { useEffect, useState, useMemo } from 'react';
import type { StudentItemState } from '../../types/math';
import { itemStateRepo } from '../../db/repositories';
import { TABLE_MIN, TABLE_MAX, tableFromItemId } from '../curriculum/multiplicationItems';
import { describeItem } from '../curriculum/describeItem';
import { MASTERY_COLORS } from '../../utils/masteryColors';

interface Props { studentId: string }

type SortKey = 'accuracy' | 'wrong' | 'attempts' | 'avgSpeed' | 'bestSpeed';
type TypeFilter = 'all' | 'mul' | 'div' | 'add' | 'sub' | 'frac' | 'word' | 'round' | 'factors' | 'dec';
type StatusFilter = 'all' | 'weak' | 'strong' | 'new';

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

export function FactStatsTable({ studentId }: Props) {
  const [states, setStates] = useState<StudentItemState[]>([]);
  const [sort, setSort] = useState<SortKey>('accuracy');
  const [sortAsc, setSortAsc] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tableFilter, setTableFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    itemStateRepo.getForStudent(studentId).then(s =>
      setStates(s.filter(st => st.attemptCount > 0))
    );
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

  const rows = useMemo(() => {
    let filtered = states.filter(s => {
      if (typeFilter !== 'all' && bucketOf(s.itemId) !== typeFilter) return false;

      if (statusFilter === 'weak' && s.masteryLevel !== 'learning' && s.masteryLevel !== 'developing') return false;
      if (statusFilter === 'strong' && s.masteryLevel !== 'strong' && s.masteryLevel !== 'mastered') return false;
      if (statusFilter === 'new' && s.masteryLevel !== 'new') return false;

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
  }, [states, sort, sortAsc, typeFilter, statusFilter, tableFilter]);

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

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      style={{ ...st.thBtn, color: sort === k ? 'var(--primary)' : '#6b7280' }}
      onClick={() => toggleSort(k)}
    >
      {label}{sort === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </button>
  );

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

      {/* Secondary filters */}
      <div style={st.filterBar}>
        <div style={st.filterGroup}>
          {(['all', 'weak', 'strong'] as StatusFilter[]).map(f => (
            <button key={f} style={{ ...st.chip, ...(statusFilter === f ? st.chipOn : {}) }} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All status' : f === 'weak' ? 'Weak' : 'Strong'}
            </button>
          ))}
        </div>
        {(typeFilter === 'mul' || typeFilter === 'div') && (
          <select
            value={tableFilter}
            onChange={e => setTableFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            style={st.select}
          >
            <option value="all">All tables</option>
            {tables.map(t => <option key={t} value={t}>{t}× table</option>)}
          </select>
        )}
      </div>

      <p style={{ color: '#6b7280', fontSize: '13px', margin: '8px 0 10px' }}>
        {rows.length} fact{rows.length !== 1 ? 's' : ''} shown
      </p>

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
                <th style={st.th}><SortBtn k="attempts" label="Tries" /></th>
                <th style={st.th}><SortBtn k="accuracy" label="Acc%" /></th>
                <th style={st.th}><SortBtn k="wrong" label="Wrong" /></th>
                <th style={st.th}><SortBtn k="avgSpeed" label="Avg" /></th>
                <th style={st.th}><SortBtn k="bestSpeed" label="Best" /></th>
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
                        const mc = MASTERY_COLORS[s.masteryLevel];
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
  filterBar: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' },
  filterGroup: { display: 'flex', gap: '4px' },
  chip: { padding: '5px 10px', border: '1.5px solid #e5e7eb', borderRadius: '20px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  chipOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  select: { padding: '5px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: '#fff', fontSize: '13px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  thead: { background: '#f9fafb' },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: '600', color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  thBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', padding: 0 },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '8px 10px', color: '#111827' },
  tdNum: { padding: '8px 10px', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' },
};
