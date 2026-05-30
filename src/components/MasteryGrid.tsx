import { useEffect, useState } from 'react';
import type { MasteryLevel } from '../types/math';
import { itemStateRepo } from '../db/repositories';
import { MASTERY_COLORS } from '../utils/masteryColors';

interface Props { studentId: string }

interface CellInfo {
  level: MasteryLevel;
  accuracy: number;
  medianMs: number;
  personalBestMs?: number;
  attempts: number;
}

// Only show the 2–13 range (skip 0 and 1 rows/cols)
const RANGE = Array.from({ length: 12 }, (_, i) => i + 2);

export function MasteryGrid({ studentId }: Props) {
  const [grid, setGrid] = useState<Map<string, CellInfo>>(new Map());
  const [selected, setSelected] = useState<{ a: number; b: number } | null>(null);

  useEffect(() => {
    itemStateRepo.getForStudent(studentId).then(states => {
      const m = new Map<string, CellInfo>();
      for (const s of states) {
        if (!s.itemId.startsWith('MUL_')) continue;
        m.set(s.itemId, {
          level: s.masteryLevel,
          accuracy: s.attemptCount ? s.correctCount / s.attemptCount : 0,
          medianMs: s.medianLatencyMs,
          personalBestMs: s.personalBestMs,
          attempts: s.attemptCount,
        });
      }
      setGrid(m);
    });
  }, [studentId]);

  const masteredCount = [...grid.values()].filter(c => c.level === 'mastered').length;
  const totalPracticed = [...grid.values()].filter(c => c.attempts > 0).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
          Multiplication Mastery (2–13)
        </h2>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          {masteredCount}/{RANGE.length * RANGE.length} mastered · {totalPracticed} practiced
        </span>
      </div>

      {/* Row header */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', minWidth: 'max-content' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '2px', paddingLeft: '28px' }}>
            {RANGE.map(b => (
              <div key={b} style={{ width: '28px', textAlign: 'center', fontSize: '10px', color: '#9ca3af', fontWeight: '600' }}>
                ×{b}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {RANGE.map(a => (
            <div key={a} style={{ display: 'flex', gap: '2px', marginBottom: '2px', alignItems: 'center' }}>
              <span style={{ width: '26px', textAlign: 'right', fontSize: '11px', color: '#6b7280', fontWeight: '600', paddingRight: '2px' }}>
                {a}×
              </span>
              {RANGE.map(b => {
                const id = `MUL_${a}x${b}`;
                const info = grid.get(id);
                const level: MasteryLevel = info?.level ?? 'new';
                const mc = MASTERY_COLORS[level];
                const isSelected = selected?.a === a && selected?.b === b;

                return (
                  <button
                    key={b}
                    onClick={() => setSelected(isSelected ? null : { a, b })}
                    title={`${a}×${b}=${a*b} — ${mc.label}${info?.attempts ? ` (${info.attempts} tries, ${Math.round(info.accuracy*100)}%)` : ''}`}
                    aria-label={`${a} times ${b} equals ${a*b}, ${mc.label}`}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                      background: mc.bg,
                      border: isSelected
                        ? `2px solid var(--primary)`
                        : `1px solid ${mc.border}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: '700',
                      color: mc.text,
                      transition: 'transform 0.1s',
                      transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                      padding: 0,
                    }}
                  >
                    {/* Letter indicator for color-blind accessibility */}
                    {level !== 'new' ? mc.letter : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ marginTop: '14px', padding: '14px', background: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '14px' }}>
          {(() => {
            const info = grid.get(`MUL_${selected.a}x${selected.b}`);
            const mc = MASTERY_COLORS[info?.level ?? 'new'];
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '20px' }}>{selected.a} × {selected.b} = {selected.a * selected.b}</strong>
                  <span style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}`, borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>
                    {mc.letter} {mc.label}
                  </span>
                </div>
                {(!info || info.attempts === 0) ? (
                  <p style={{ color: '#9ca3af', margin: 0 }}>Not yet practiced.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <Stat label="Accuracy" value={`${Math.round(info.accuracy * 100)}%`} color={info.accuracy >= 0.9 ? '#15803d' : info.accuracy >= 0.7 ? '#713f12' : '#7c2d12'} />
                    <Stat label="Attempts" value={String(info.attempts)} />
                    <Stat label="Avg speed" value={info.medianMs ? `${(info.medianMs/1000).toFixed(1)}s` : '—'} />
                    <Stat label="Best speed" value={info.personalBestMs ? `${(info.personalBestMs/1000).toFixed(1)}s` : '—'} color="#1e3a5f" />
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {(Object.entries(MASTERY_COLORS) as [MasteryLevel, typeof MASTERY_COLORS[MasteryLevel]][]).map(([level, mc]) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <div style={{
              width: '20px', height: '20px', background: mc.bg,
              border: `1px solid ${mc.border}`, borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: '700', color: mc.text,
            }}>
              {level !== 'new' ? mc.letter : '·'}
            </div>
            <span style={{ color: '#374151' }}>{mc.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color = '#111827' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: '6px', padding: '6px 10px' }}>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{label}</div>
    </div>
  );
}
