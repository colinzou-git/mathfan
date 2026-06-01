import type { MultiplicationFactStats, MultiplicationFactKey, MasteryState } from './types';
import { FACT_MIN, FACT_MAX, factKey } from './multiplicationFacts';

interface Props {
  statsMap: Map<MultiplicationFactKey, MultiplicationFactStats>;
}

const COLORS: Record<MasteryState, { bg: string; border: string; label: string }> = {
  new:       { bg: '#ffffff', border: '#d1d5db', label: 'New'       },
  weak:      { bg: '#d1d5db', border: '#9ca3af', label: 'Weak'      },
  learning:  { bg: '#6b7280', border: '#4b5563', label: 'Learning'  },
  strong:    { bg: '#166534', border: '#14532d', label: 'Strong'    },
  mastered:  { bg: '#1e3a8a', border: '#1d4ed8', label: 'Mastered'  },
  forgotten: { bg: '#fbbf24', border: '#f59e0b', label: 'Forgotten' },
};

const RANGE = Array.from({ length: FACT_MAX - FACT_MIN + 1 }, (_, i) => i + FACT_MIN);

export function MultiplicationMasteryGrid({ statsMap }: Props) {
  const masteredCount = [...statsMap.values()].filter(s => s.masteryState === 'mastered').length;
  const testedCount   = [...statsMap.values()].filter(s => s.everTested).length;
  const total = RANGE.length * RANGE.length; // 169

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#6b7280' }}>
        <span>0–12 multiplication grid</span>
        <span>{masteredCount}/{total} mastered · {testedCount} tested</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', minWidth: 'max-content' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', gap: '1px', marginBottom: '1px', paddingLeft: '22px' }}>
            {RANGE.map(b => (
              <div key={b} style={{ width: '22px', textAlign: 'center', fontSize: '9px', color: '#9ca3af', fontWeight: '600' }}>
                {b}
              </div>
            ))}
          </div>

          {RANGE.map(a => (
            <div key={a} style={{ display: 'flex', gap: '1px', marginBottom: '1px', alignItems: 'center' }}>
              <span style={{ width: '20px', textAlign: 'right', fontSize: '9px', color: '#6b7280', fontWeight: '600', paddingRight: '2px' }}>
                {a}
              </span>
              {RANGE.map(b => {
                const key = factKey(a, b);
                const stats = statsMap.get(key);
                const state: MasteryState = stats?.masteryState ?? 'new';
                const mc = COLORS[state];
                const title = `${a}×${b}=${a * b} — ${mc.label}${stats?.totalAttempts ? ` (${Math.round(stats.accuracy * 100)}%, ${stats.totalAttempts} tries)` : ''}`;
                return (
                  <div
                    key={b}
                    title={title}
                    style={{
                      width: '22px', height: '22px',
                      borderRadius: '3px',
                      background: mc.bg,
                      border: `1px solid ${mc.border}`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
        {(Object.entries(COLORS) as [MasteryState, typeof COLORS[MasteryState]][]).map(([state, mc]) => (
          <div key={state} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            <div style={{ width: '12px', height: '12px', background: mc.bg, border: `1px solid ${mc.border}`, borderRadius: '2px' }} />
            <span style={{ color: '#374151' }}>{mc.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
