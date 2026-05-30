import { useState, useRef, useEffect } from 'react';
import type { SessionConfig, SessionMode } from '../types/math';

interface Props {
  mode: Extract<SessionMode, 'addition' | 'subtraction' | 'division'>;
  onStart: (config: SessionConfig) => void;
  onBack: () => void;
}

const META: Record<Props['mode'], { title: string; icon: string; symbol: string; defMin: number; defMax: number; desc: string }> = {
  addition:    { title: 'Addition',    icon: '➕', symbol: '+', defMin: 0, defMax: 20,  desc: 'Add two numbers in your chosen range.' },
  subtraction: { title: 'Subtraction', icon: '➖', symbol: '−', defMin: 0, defMax: 20,  desc: 'Subtract — answers are never negative.' },
  division:    { title: 'Division',    icon: '➗', symbol: '÷', defMin: 2, defMax: 12,  desc: 'Whole-number division (no remainders).' },
};

const COUNT_MIN = 1, COUNT_MAX = 200;
const OPERAND_MAX = 10000;

export function ArithmeticSetup({ mode, onStart, onBack }: Props) {
  const meta = META[mode];
  const [min, setMin] = useState(meta.defMin);
  const [max, setMax] = useState(meta.defMax);
  const [count, setCount] = useState(10);
  const countRef = useRef<HTMLInputElement>(null);

  useEffect(() => { countRef.current?.select(); }, []);

  const clampCount = (n: number) => Math.max(COUNT_MIN, Math.min(COUNT_MAX, n));
  const clampOperand = (n: number) => Math.max(0, Math.min(OPERAND_MAX, n));

  const effMin = clampOperand(min);
  const effMax = Math.max(effMin + (mode === 'division' ? 1 : 0), clampOperand(max));

  const handleStart = () => {
    onStart({
      mode,
      sessionLength: clampCount(count),
      operandMin: mode === 'division' ? Math.max(2, effMin) : effMin,
      operandMax: effMax,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
    if (e.key === 'Escape') onBack();
  };

  // Example problem preview
  const example = mode === 'division'
    ? `${effMax * 2} ${meta.symbol} ${Math.max(2, effMin)} = ?`
    : `${effMax} ${meta.symbol} ${effMin} = ?`;

  return (
    <div style={s.page} onKeyDown={handleKeyDown}>
      <button style={s.back} onClick={onBack} tabIndex={-1}>← Back</button>

      <div style={s.hero}>
        <div style={{ fontSize: '48px' }}>{meta.icon}</div>
        <h2 style={s.title}>{meta.title}</h2>
        <p style={s.desc}>{meta.desc}</p>
      </div>

      {/* Operand range */}
      <div style={s.card}>
        <p style={s.cardLabel}>Number range</p>
        <div style={s.rangeRow}>
          <div style={s.rangeField}>
            <span style={s.rangeCap}>{mode === 'division' ? 'Smallest divisor/quotient' : 'Smallest'}</span>
            <input
              type="number" min={0} max={OPERAND_MAX} value={min}
              onChange={e => setMin(clampOperand(parseInt(e.target.value) || 0))}
              style={s.numInput}
            />
          </div>
          <span style={s.toLabel}>to</span>
          <div style={s.rangeField}>
            <span style={s.rangeCap}>{mode === 'division' ? 'Largest divisor/quotient' : 'Largest'}</span>
            <input
              type="number" min={0} max={OPERAND_MAX} value={max}
              onChange={e => setMax(clampOperand(parseInt(e.target.value) || 0))}
              style={s.numInput}
            />
          </div>
        </div>

        {/* Quick presets */}
        <div style={s.presets}>
          {presetsFor(mode).map(([lo, hi]) => (
            <button
              key={`${lo}-${hi}`}
              tabIndex={-1}
              onClick={() => { setMin(lo); setMax(hi); }}
              style={{ ...s.preset, ...(effMin === lo && effMax === hi ? s.presetOn : {}) }}
            >
              {labelFor(mode, lo, hi)}
            </button>
          ))}
        </div>

        <p style={s.example}>Example: <strong>{example}</strong></p>
      </div>

      {/* Question count */}
      <div style={s.card}>
        <p style={s.cardLabel}>How many questions?</p>
        <div style={s.countRow}>
          <button style={s.adjBtn} tabIndex={-1} onClick={() => setCount(c => clampCount(c - 5))}>−5</button>
          <input
            ref={countRef}
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

function presetsFor(mode: Props['mode']): [number, number][] {
  if (mode === 'division') return [[2, 5], [2, 10], [2, 12], [5, 20]];
  return [[0, 10], [0, 20], [0, 100], [10, 1000]];
}
function labelFor(mode: Props['mode'], lo: number, hi: number): string {
  if (mode === 'division') return `${lo}–${hi}`;
  return `to ${hi}`;
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: '440px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  back: { background: 'none', border: 'none', color: 'var(--primary)', fontSize: '16px', cursor: 'pointer', padding: '0 0 12px', fontWeight: '500' },
  hero: { textAlign: 'center', marginBottom: '20px' },
  title: { fontSize: '24px', fontWeight: 'bold', margin: '6px 0 4px' },
  desc: { color: '#6b7280', fontSize: '14px', margin: 0 },
  card: { background: '#fff', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '14px' },
  cardLabel: { fontSize: '14px', fontWeight: '600', color: '#374151', textAlign: 'center', margin: '0 0 14px' },
  rangeRow: { display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '12px', marginBottom: '14px' },
  rangeField: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 },
  rangeCap: { fontSize: '11px', color: '#9ca3af', textAlign: 'center', minHeight: '26px' },
  toLabel: { fontSize: '14px', color: '#9ca3af', paddingBottom: '12px' },
  numInput: {
    width: '100%', maxWidth: '90px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold',
    border: 'none', borderBottom: '3px solid var(--primary)', outline: 'none', background: 'transparent',
    color: '#1f2937', MozAppearance: 'textfield' as never,
  },
  presets: { display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' },
  preset: { padding: '6px 12px', border: '2px solid #e5e7eb', borderRadius: '20px', background: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: '500' },
  presetOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  example: { textAlign: 'center', fontSize: '13px', color: '#6b7280', margin: '4px 0 0' },
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
