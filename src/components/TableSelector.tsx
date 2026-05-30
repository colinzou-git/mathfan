import { useState, useRef, useEffect } from 'react';
import type { SessionConfig } from '../types/math';
import { TABLE_MIN, TABLE_MAX } from '../features/curriculum/multiplicationItems';

interface Props {
  onStart: (config: SessionConfig) => void;
  onBack: () => void;
}

const TABLES = Array.from({ length: TABLE_MAX - TABLE_MIN + 1 }, (_, i) => i + TABLE_MIN);
const DEFAULT_COUNT = 10;
const MIN_COUNT = 1;
const MAX_COUNT = 200;

export function TableSelector({ onStart, onBack }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [count, setCount] = useState(DEFAULT_COUNT);
  const countRef = useRef<HTMLInputElement>(null);

  // Focus the count input on mount for keyboard-first flow
  useEffect(() => { countRef.current?.select(); }, []);

  const toggle = (t: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const clampedCount = Math.max(MIN_COUNT, Math.min(MAX_COUNT, count));

  const adjust = (delta: number) =>
    setCount(c => Math.max(MIN_COUNT, Math.min(MAX_COUNT, c + delta)));

  const handleCountInput = (raw: string) => {
    const n = parseInt(raw, 10);
    if (raw === '' || raw === '-') { setCount(1); return; }
    if (!isNaN(n)) setCount(Math.max(MIN_COUNT, Math.min(MAX_COUNT, n)));
  };

  const handleStart = () => {
    if (selected.size === 0) return;
    const tables = [...selected].sort((a, b) => a - b);
    onStart({
      mode: tables.length === 1 ? 'single_table' : 'multi_table',
      tables,
      sessionLength: clampedCount,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selected.size > 0) handleStart();
  };

  return (
    <div style={s.page} onKeyDown={handleKeyDown}>
      <button style={s.backBtn} onClick={onBack} tabIndex={-1}>← Back</button>
      <h2 style={s.title}>Times Table Drill</h2>
      <p style={s.sub}>Select one or more tables, then set how many questions.</p>

      <div style={s.controls}>
        <button style={s.textBtn} onClick={() => setSelected(new Set(TABLES))}>All</button>
        <button style={s.textBtn} onClick={() => setSelected(new Set())}>Clear</button>
      </div>

      <div style={s.grid}>
        {TABLES.map(t => (
          <button
            key={t}
            onClick={() => toggle(t)}
            tabIndex={-1}
            style={{ ...s.tableBtn, ...(selected.has(t) ? s.tableBtnOn : {}) }}
          >
            <span style={s.tNum}>{t}×</span>
          </button>
        ))}
      </div>

      {/* Question count */}
      <div style={s.countSection}>
        <p style={s.countLabel}>How many questions?</p>
        <div style={s.countRow}>
          <button style={s.adjBtn} onClick={() => adjust(-5)} tabIndex={-1}>−5</button>
          <button style={s.adjBtn} onClick={() => adjust(-1)} tabIndex={-1}>−1</button>
          <input
            ref={countRef}
            type="number"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={count}
            onChange={e => handleCountInput(e.target.value)}
            style={s.countInput}
            aria-label="Number of questions"
          />
          <button style={s.adjBtn} onClick={() => adjust(1)} tabIndex={-1}>+1</button>
          <button style={s.adjBtn} onClick={() => adjust(5)} tabIndex={+1}>+5</button>
        </div>
        <p style={s.countHint}>Min {MIN_COUNT} · Max {MAX_COUNT} · default {DEFAULT_COUNT}</p>
      </div>

      <button
        style={{ ...s.startBtn, opacity: selected.size === 0 ? 0.4 : 1 }}
        onClick={handleStart}
        disabled={selected.size === 0}
      >
        Start — {clampedCount} questions
        {selected.size > 0 && ` · ${selected.size} table${selected.size > 1 ? 's' : ''}`}
      </button>
      <p style={s.kbHint}>Enter to start</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: '480px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  backBtn: { background: 'none', border: 'none', color: '#4f46e5', fontSize: '16px', cursor: 'pointer', padding: '0 0 12px', fontWeight: '500' },
  title: { fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px' },
  sub: { color: '#6b7280', fontSize: '14px', margin: '0 0 12px' },
  controls: { display: 'flex', gap: '12px', marginBottom: '10px' },
  textBtn: { background: 'none', border: 'none', color: '#4f46e5', fontSize: '14px', cursor: 'pointer', padding: 0, fontWeight: '500' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '24px' },
  tableBtn: {
    padding: '16px 0', border: '2px solid #e5e7eb', borderRadius: '12px',
    background: '#fff', cursor: 'pointer', touchAction: 'manipulation',
    fontSize: '18px', fontWeight: 'bold', color: '#374151', transition: 'all 0.12s',
  },
  tableBtnOn: { borderColor: '#4f46e5', background: '#eef2ff', color: '#4f46e5' },
  tNum: { display: 'block' },
  countSection: { marginBottom: '20px' },
  countLabel: { fontSize: '15px', fontWeight: '600', color: '#374151', margin: '0 0 10px' },
  countRow: { display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' },
  adjBtn: {
    padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px',
    background: '#fff', fontSize: '15px', cursor: 'pointer', fontWeight: '600', color: '#374151',
  },
  countInput: {
    width: '80px', textAlign: 'center', fontSize: '28px', fontWeight: 'bold',
    border: 'none', borderBottom: '3px solid #4f46e5', outline: 'none',
    background: 'transparent', color: '#1f2937', fontVariantNumeric: 'tabular-nums',
    MozAppearance: 'textfield' as never,
  },
  countHint: { textAlign: 'center', color: '#9ca3af', fontSize: '12px', margin: '8px 0 0' },
  startBtn: {
    width: '100%', padding: '16px', background: '#4f46e5', color: '#fff',
    border: 'none', borderRadius: '12px', fontSize: '17px', fontWeight: 'bold', cursor: 'pointer',
  },
  kbHint: { textAlign: 'center', color: '#9ca3af', fontSize: '12px', margin: '8px 0 0' },
};
