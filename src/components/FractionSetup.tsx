import { useState } from 'react';
import type { SessionConfig, FractionMode } from '../types/math';

interface Props {
  onStart: (config: SessionConfig) => void;
  onBack: () => void;
}

const COUNT_MIN = 1, COUNT_MAX = 200;

const MODES: { key: FractionMode; title: string; example: string; desc: string }[] = [
  { key: 'equivalent', title: 'Equivalent Fractions', example: '2/3 = ?/6', desc: 'Fill in the missing number to make an equal fraction.' },
  { key: 'compare',    title: 'Compare Fractions',    example: '2/3 ▢ 3/4', desc: 'Choose ‹, =, or › to compare two fractions.' },
];

export function FractionSetup({ onStart, onBack }: Props) {
  const [fractionMode, setFractionMode] = useState<FractionMode>('equivalent');
  const [count, setCount] = useState(10);

  const clampCount = (n: number) => Math.max(COUNT_MIN, Math.min(COUNT_MAX, n));

  const handleStart = () => onStart({ mode: 'fraction', fractionMode, sessionLength: clampCount(count) });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
    if (e.key === 'Escape') onBack();
  };

  return (
    <div style={s.page} onKeyDown={handleKeyDown}>
      <button style={s.back} onClick={onBack} tabIndex={-1}>← Back</button>

      <div style={s.hero}>
        <div style={{ fontSize: '48px' }}>🍕</div>
        <h2 style={s.title}>Fractions</h2>
      </div>

      <div style={s.modeList}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setFractionMode(m.key)}
            style={{ ...s.modeCard, ...(fractionMode === m.key ? s.modeOn : {}) }}
          >
            <div style={s.modeHead}>
              <span style={s.modeTitle}>{m.title}</span>
              <span style={s.modeExample}>{m.example}</span>
            </div>
            <span style={s.modeDesc}>{m.desc}</span>
          </button>
        ))}
      </div>

      <div style={s.card}>
        <p style={s.cardLabel}>How many questions?</p>
        <div style={s.countRow}>
          <button style={s.adjBtn} tabIndex={-1} onClick={() => setCount(c => clampCount(c - 5))}>−5</button>
          <input
            type="number" min={COUNT_MIN} max={COUNT_MAX} value={count}
            onChange={e => setCount(clampCount(parseInt(e.target.value) || COUNT_MIN))}
            style={s.countInput}
          />
          <button style={s.adjBtn} tabIndex={-1} onClick={() => setCount(c => clampCount(c + 5))}>+5</button>
        </div>
      </div>

      <button style={s.startBtn} onClick={handleStart}>
        Start — {clampCount(count)} questions
      </button>
      <p style={s.kbHint}>Enter to start · Esc to go back</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: '440px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  back: { background: 'none', border: 'none', color: 'var(--primary)', fontSize: '16px', cursor: 'pointer', padding: '0 0 12px', fontWeight: '500' },
  hero: { textAlign: 'center', marginBottom: '18px' },
  title: { fontSize: '24px', fontWeight: 'bold', margin: '6px 0 0' },
  modeList: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' },
  modeCard: { textAlign: 'left', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' },
  modeOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)' },
  modeHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modeTitle: { fontSize: '16px', fontWeight: '700', color: '#111827' },
  modeExample: { fontSize: '16px', fontWeight: '600', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' },
  modeDesc: { fontSize: '13px', color: '#6b7280' },
  card: { background: '#fff', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '14px' },
  cardLabel: { fontSize: '14px', fontWeight: '600', color: '#374151', textAlign: 'center', margin: '0 0 14px' },
  countRow: { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' },
  adjBtn: { padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', background: '#fff', fontSize: '15px', cursor: 'pointer', fontWeight: '600', color: '#374151' },
  countInput: {
    width: '80px', textAlign: 'center', fontSize: '32px', fontWeight: 'bold',
    border: 'none', borderBottom: '3px solid var(--primary)', outline: 'none', background: 'transparent',
    color: '#1f2937', MozAppearance: 'textfield' as never,
  },
  startBtn: {
    width: '100%', padding: '18px', background: 'var(--primary)', color: '#fff',
    border: 'none', borderRadius: '14px', fontSize: '19px', fontWeight: 'bold', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
  },
  kbHint: { textAlign: 'center', color: '#9ca3af', fontSize: '12px', margin: '8px 0 0' },
};
