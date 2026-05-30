import { useEffect, useState } from 'react';
import type { MasteryLevel } from '../types/math';
import { itemStateRepo } from '../db/repositories';

interface Props {
  studentId: string;
}

const LEVEL_COLOR: Record<MasteryLevel, string> = {
  new: '#e5e7eb',
  learning: '#fca5a5',
  developing: '#fcd34d',
  strong: '#86efac',
  mastered: '#22c55e',
};

const LEVEL_LABEL: Record<MasteryLevel, string> = {
  new: 'Not started',
  learning: 'Learning',
  developing: 'Developing',
  strong: 'Strong',
  mastered: 'Mastered',
};

interface CellInfo {
  level: MasteryLevel;
  accuracy: number;
  medianMs: number;
  attempts: number;
}

export function MasteryGrid({ studentId }: Props) {
  const [grid, setGrid] = useState<Map<string, CellInfo>>(new Map());
  const [tooltip, setTooltip] = useState<{ a: number; b: number } | null>(null);

  useEffect(() => {
    itemStateRepo.getForStudent(studentId).then(states => {
      const m = new Map<string, CellInfo>();
      for (const s of states) {
        if (!s.itemId.startsWith('MUL_')) continue;
        m.set(s.itemId, {
          level: s.masteryLevel,
          accuracy: s.attemptCount ? s.correctCount / s.attemptCount : 0,
          medianMs: s.medianLatencyMs,
          attempts: s.attemptCount,
        });
      }
      setGrid(m);
    });
  }, [studentId]);

  const rows = Array.from({ length: 13 }, (_, i) => i);

  return (
    <div style={{ overflowX: 'auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
        Multiplication Mastery Grid
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {rows.map(a => (
          <div key={a} style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <span style={{ width: '24px', textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>
              {a}×
            </span>
            {rows.map(b => {
              const id = `MUL_${a}x${b}`;
              const info = grid.get(id);
              const level: MasteryLevel = info?.level ?? 'new';
              const isActive = tooltip?.a === a && tooltip?.b === b;
              return (
                <div
                  key={b}
                  title={`${a}×${b}=${a * b} — ${LEVEL_LABEL[level]}`}
                  onClick={() => setTooltip(isActive ? null : { a, b })}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '4px',
                    background: LEVEL_COLOR[level],
                    border: isActive ? '2px solid #4f46e5' : '1px solid rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#374151',
                    fontWeight: 500,
                    transition: 'transform 0.1s',
                    transform: isActive ? 'scale(1.2)' : 'scale(1)',
                  }}
                >
                  {a * b > 0 && info?.attempts ? '' : ''}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {tooltip && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          fontSize: '14px',
        }}>
          <strong>{tooltip.a} × {tooltip.b} = {tooltip.a * tooltip.b}</strong>
          {(() => {
            const info = grid.get(`MUL_${tooltip.a}x${tooltip.b}`);
            if (!info || info.attempts === 0) return <p>Not yet practiced.</p>;
            return (
              <>
                <p>Status: {LEVEL_LABEL[info.level]}</p>
                <p>Accuracy: {Math.round(info.accuracy * 100)}%</p>
                <p>Median speed: {(info.medianMs / 1000).toFixed(1)}s</p>
                <p>Attempts: {info.attempts}</p>
              </>
            );
          })()}
        </div>
      )}

      <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {(Object.entries(LEVEL_COLOR) as [MasteryLevel, string][]).map(([level, color]) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <div style={{ width: '14px', height: '14px', background: color, borderRadius: '3px' }} />
            {LEVEL_LABEL[level]}
          </div>
        ))}
      </div>
    </div>
  );
}
