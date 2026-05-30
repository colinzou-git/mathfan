import { useState, useRef, useEffect } from 'react';
import type { SessionConfig } from '../types/math';

interface Props {
  title: string;
  description?: string;
  defaultCount?: number;
  onStart: (config: Omit<SessionConfig, 'mode'> & Pick<SessionConfig, 'mode'>) => void;
  onBack: () => void;
  mode: SessionConfig['mode'];
}

const MIN = 1;
const MAX = 200;

export function SessionSetup({ title, description, defaultCount = 10, onStart, onBack, mode }: Props) {
  const [count, setCount] = useState(defaultCount);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n));
  const adjust = (d: number) => setCount(c => clamp(c + d));

  const handleInput = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) setCount(clamp(n));
    else if (raw === '') setCount(MIN);
  };

  const handleStart = () => onStart({ mode, sessionLength: clamp(count) });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
    if (e.key === 'Escape') onBack();
  };

  return (
    <div style={s.page} onKeyDown={handleKeyDown}>
      <button style={s.backBtn} onClick={onBack} tabIndex={-1}>← Back</button>

      <div style={s.hero}>
        <div style={{ fontSize: '52px' }}>🧮</div>
        <h2 style={s.title}>{title}</h2>
        {description && <p style={s.desc}>{description}</p>}
      </div>

      <div style={s.countSection}>
        <p style={s.countLabel}>How many questions?</p>

        <div style={s.countRow}>
          <button style={s.adjBtn} onClick={() => adjust(-5)} tabIndex={-1}>−5</button>
          <button style={s.adjBtn} onClick={() => adjust(-1)} tabIndex={-1}>−1</button>
          <input
            ref={inputRef}
            type="number"
            min={MIN}
            max={MAX}
            value={count}
            onChange={e => handleInput(e.target.value)}
            style={s.countInput}
            aria-label="Number of questions"
          />
          <button style={s.adjBtn} onClick={() => adjust(1)} tabIndex={-1}>+1</button>
          <button style={s.adjBtn} onClick={() => adjust(5)} tabIndex={-1}>+5</button>
        </div>

        {/* Quick presets */}
        <div style={s.presets}>
          {[5, 10, 15, 20, 25].map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              tabIndex={-1}
              style={{ ...s.preset, ...(count === n ? s.presetOn : {}) }}
            >
              {n}
            </button>
          ))}
        </div>

        <p style={s.hint}>Type any number · Enter to start · Esc to go back</p>
      </div>

      <button style={s.startBtn} onClick={handleStart}>
        Start — {clamp(count)} questions
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: '440px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  backBtn: { background: 'none', border: 'none', color: '#4f46e5', fontSize: '16px', cursor: 'pointer', padding: '0 0 12px', fontWeight: '500' },
  hero: { textAlign: 'center', marginBottom: '32px' },
  title: { fontSize: '26px', fontWeight: 'bold', margin: '8px 0 6px' },
  desc: { color: '#6b7280', fontSize: '15px', margin: 0 },
  countSection: { background: '#fff', borderRadius: '16px', padding: '24px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '20px' },
  countLabel: { fontSize: '15px', fontWeight: '600', color: '#374151', textAlign: 'center', margin: '0 0 16px' },
  countRow: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '16px' },
  adjBtn: {
    padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px',
    background: '#fff', fontSize: '15px', cursor: 'pointer', fontWeight: '600', color: '#374151',
  },
  countInput: {
    width: '80px', textAlign: 'center', fontSize: '36px', fontWeight: 'bold',
    border: 'none', borderBottom: '3px solid #4f46e5', outline: 'none',
    background: 'transparent', color: '#1f2937', fontVariantNumeric: 'tabular-nums',
    MozAppearance: 'textfield' as never,
  },
  presets: { display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' },
  preset: {
    padding: '6px 14px', border: '2px solid #e5e7eb', borderRadius: '20px',
    background: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: '500',
  },
  presetOn: { borderColor: '#4f46e5', background: '#eef2ff', color: '#4f46e5' },
  hint: { textAlign: 'center', color: '#9ca3af', fontSize: '12px', margin: '12px 0 0' },
  startBtn: {
    width: '100%', padding: '18px', background: '#4f46e5', color: '#fff',
    border: 'none', borderRadius: '14px', fontSize: '19px', fontWeight: 'bold', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
  },
};
