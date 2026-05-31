import { useState, useRef, useEffect } from 'react';
import type { SessionConfig } from '../types/math';
import type { RangeSetupSpec, RangeVal } from './opSpecs';

interface Props {
  spec: RangeSetupSpec;
  defaultCount?: number;
  onStart: (config: SessionConfig) => void;
  onBack: () => void;
}

const COUNT_MIN = 1, COUNT_MAX = 200;

export function RangeSetup({ spec, defaultCount = 10, onStart, onBack }: Props) {
  const [vals, setVals] = useState<RangeVal[]>(
    spec.ranges.map(r => ({ lo: r.defLo, hi: r.defHi })),
  );
  const [subMode, setSubMode] = useState(spec.subModes?.[0]?.value ?? '');
  const [count, setCount] = useState(defaultCount);
  const [prevSpec, setPrevSpec] = useState(spec);
  const countRef = useRef<HTMLInputElement>(null);

  // Reset form fields when the operation changes (spec identity changes).
  if (prevSpec !== spec) {
    setPrevSpec(spec);
    setVals(spec.ranges.map(r => ({ lo: r.defLo, hi: r.defHi })));
    setSubMode(spec.subModes?.[0]?.value ?? '');
  }

  useEffect(() => { countRef.current?.select(); }, []);

  const clampCount = (n: number) => Math.max(COUNT_MIN, Math.min(COUNT_MAX, n));

  const setField = (i: number, edge: 'lo' | 'hi', raw: number) => {
    const r = spec.ranges[i];
    const v = Math.max(r.min, Math.min(r.max, isNaN(raw) ? r.min : Math.floor(raw)));
    setVals(prev => prev.map((rv, idx) => (idx === i ? { ...rv, [edge]: v } : rv)));
  };

  // Normalise lo ≤ hi before building the config / example.
  const ordered: RangeVal[] = vals.map(rv => ({
    lo: Math.min(rv.lo, rv.hi),
    hi: Math.max(rv.lo, rv.hi),
  }));

  const handleStart = () =>
    onStart(spec.buildConfig(ordered, subMode, clampCount(count)));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
    if (e.key === 'Escape') onBack();
  };

  return (
    <div style={s.page} onKeyDown={handleKeyDown}>
      <button style={s.back} onClick={onBack} tabIndex={-1}>← Back</button>

      <div style={s.hero}>
        <div style={{ fontSize: '48px' }}>{spec.icon}</div>
        <h2 style={s.title}>{spec.title}</h2>
        <p style={s.desc}>{spec.description}</p>
      </div>

      {/* Sub-type chooser (e.g. fractions) */}
      {spec.subModes && (
        <div style={s.modeList}>
          {spec.subModes.map(m => (
            <button
              key={m.value}
              onClick={() => setSubMode(m.value)}
              style={{ ...s.modeCard, ...(subMode === m.value ? s.modeOn : {}) }}
            >
              <div style={s.modeHead}>
                <span style={s.modeTitle}>{m.label}</span>
                <span style={s.modeExample}>{m.example}</span>
              </div>
              <span style={s.modeDesc}>{m.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Range fields */}
      <div style={s.card}>
        <p style={s.cardLabel}>Number range{spec.ranges.length > 1 ? 's' : ''}</p>
        {spec.ranges.map((r, i) => (
          <div key={r.caption} style={s.rangeBlock}>
            <span style={s.rangeCap}>{r.caption}</span>
            <div style={s.rangeRow}>
              <input
                type="number" min={r.min} max={r.max} value={vals[i].lo}
                onChange={e => setField(i, 'lo', parseInt(e.target.value))}
                style={s.numInput} aria-label={`${r.caption} smallest`}
              />
              <span style={s.toLabel}>to</span>
              <input
                type="number" min={r.min} max={r.max} value={vals[i].hi}
                onChange={e => setField(i, 'hi', parseInt(e.target.value))}
                style={s.numInput} aria-label={`${r.caption} largest`}
              />
            </div>
          </div>
        ))}
        <p style={s.example}>{spec.example(ordered, subMode)}</p>
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
            style={s.countInput} aria-label="Number of questions"
          />
          <button style={s.adjBtn} tabIndex={-1} onClick={() => setCount(c => clampCount(c + 5))}>+5</button>
        </div>
        <div style={s.presets}>
          {[5, 10, 15, 20, 25].map(n => (
            <button
              key={n} tabIndex={-1} onClick={() => setCount(n)}
              style={{ ...s.preset, ...(count === n ? s.presetOn : {}) }}
            >
              {n}
            </button>
          ))}
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
  page: { maxWidth: '460px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  back: { background: 'none', border: 'none', color: 'var(--primary)', fontSize: '16px', cursor: 'pointer', padding: '0 0 12px', fontWeight: '500' },
  hero: { textAlign: 'center', marginBottom: '18px' },
  title: { fontSize: '24px', fontWeight: 'bold', margin: '6px 0 4px' },
  desc: { color: '#6b7280', fontSize: '14px', margin: '0 auto', maxWidth: '380px' },
  modeList: { display: 'flex', gap: '10px', marginBottom: '14px' },
  modeCard: { flex: 1, textAlign: 'left', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '14px', padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' },
  modeOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)' },
  modeHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' },
  modeTitle: { fontSize: '15px', fontWeight: '700', color: '#111827' },
  modeExample: { fontSize: '14px', fontWeight: '600', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' },
  modeDesc: { fontSize: '12px', color: '#6b7280' },
  card: { background: '#fff', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '14px' },
  cardLabel: { fontSize: '14px', fontWeight: '600', color: '#374151', textAlign: 'center', margin: '0 0 14px' },
  rangeBlock: { marginBottom: '12px' },
  rangeCap: { display: 'block', fontSize: '12px', color: '#6b7280', textAlign: 'center', marginBottom: '6px', fontWeight: '600' },
  rangeRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' },
  toLabel: { fontSize: '14px', color: '#9ca3af' },
  numInput: {
    width: '100px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold',
    border: 'none', borderBottom: '3px solid var(--primary)', outline: 'none', background: 'transparent',
    color: '#1f2937', MozAppearance: 'textfield' as never,
  },
  example: { textAlign: 'center', fontSize: '13px', color: '#6b7280', margin: '8px 0 0', fontVariantNumeric: 'tabular-nums' },
  countRow: { display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '12px' },
  adjBtn: { padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: '8px', background: '#fff', fontSize: '15px', cursor: 'pointer', fontWeight: '600', color: '#374151' },
  countInput: {
    width: '80px', textAlign: 'center', fontSize: '32px', fontWeight: 'bold',
    border: 'none', borderBottom: '3px solid var(--primary)', outline: 'none', background: 'transparent',
    color: '#1f2937', MozAppearance: 'textfield' as never,
  },
  presets: { display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' },
  preset: { padding: '6px 14px', border: '2px solid #e5e7eb', borderRadius: '20px', background: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
  presetOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  startBtn: {
    width: '100%', padding: '18px', background: 'var(--primary)', color: '#fff',
    border: 'none', borderRadius: '14px', fontSize: '19px', fontWeight: 'bold', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
  },
  kbHint: { textAlign: 'center', color: '#9ca3af', fontSize: '12px', margin: '8px 0 0' },
};
