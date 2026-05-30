import { useEffect, useState, useMemo } from 'react';
import type { StudentItemState } from '../../types/math';
import { itemStateRepo } from '../../db/repositories';
import { ITEM_MAP, TABLE_MIN, TABLE_MAX, tableFromItemId } from '../curriculum/multiplicationItems';
import { MASTERY_COLORS } from '../../utils/masteryColors';

interface Props { studentId: string }

type SortKey = 'accuracy' | 'wrong' | 'attempts' | 'avgSpeed' | 'bestSpeed';
type TypeFilter = 'all' | 'mul' | 'div' | 'unk';
type StatusFilter = 'all' | 'weak' | 'strong' | 'new';

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

  const rows = useMemo(() => {
    let filtered = states.filter(s => {
      const item = ITEM_MAP.get(s.itemId);
      if (!item) return false;

      if (typeFilter === 'mul' && item.itemType !== 'multiplication_fact') return false;
      if (typeFilter === 'div' && item.itemType !== 'division_fact') return false;
      if (typeFilter === 'unk' && item.itemType !== 'unknown_factor') return false;

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
      {/* Filters */}
      <div style={st.filterBar}>
        <div style={st.filterGroup}>
          {(['all', 'mul', 'div', 'unk'] as TypeFilter[]).map(f => (
            <button key={f} style={{ ...st.chip, ...(typeFilter === f ? st.chipOn : {}) }} onClick={() => setTypeFilter(f)}>
              {f === 'all' ? 'All types' : f === 'mul' ? '×' : f === 'div' ? '÷' : '×?'}
            </button>
          ))}
        </div>
        <div style={st.filterGroup}>
          {(['all', 'weak', 'strong'] as StatusFilter[]).map(f => (
            <button key={f} style={{ ...st.chip, ...(statusFilter === f ? st.chipOn : {}) }} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All status' : f === 'weak' ? 'Weak' : 'Strong'}
            </button>
          ))}
        </div>
        <select
          value={tableFilter}
          onChange={e => setTableFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          style={st.select}
        >
          <option value="all">All tables</option>
          {tables.map(t => <option key={t} value={t}>{t}× table</option>)}
        </select>
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
                const item = ITEM_MAP.get(s.itemId)!;
                const acc = Math.round(s.correctCount / s.attemptCount * 100);
                const wrong = s.attemptCount - s.correctCount;
                return (
                  <tr key={s.itemId} style={{
                    ...st.tr,
                    background: wrong > 2 ? '#fff5f5' : s.masteryLevel === 'mastered' ? '#f0fdf4' : '#fff',
                  }}>
                    <td style={{ ...st.td, fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                      {item.prompt}
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

const st: Record<string, React.CSSProperties> = {
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
