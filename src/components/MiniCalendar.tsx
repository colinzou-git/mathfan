import { useState } from 'react';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD (same as start for single-day)
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  activityDates?: Set<string>; // YYYY-MM-DD strings with practice data
  mode?: 'single' | 'range';
}

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function toYMD(d: Date): string {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  return r;
}

function isoToLocal(iso: string): Date {
  // Parse YYYY-MM-DD as local date
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function MiniCalendar({ value, onChange, activityDates = new Set(), mode = 'range' }: Props) {
  const [viewDate, setViewDate] = useState(() => {
    // Show the month containing the end of the selection
    const d = isoToLocal(value.end);
    d.setDate(1);
    return d;
  });
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = toYMD(new Date());

  // Build the grid: 6 rows × 7 cols
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return toYMD(d);
    }),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDay = (day: string) => {
    if (mode === 'single') {
      onChange({ start: day, end: day });
      return;
    }
    // Range mode
    if (!picking || picking === 'start') {
      // First click always sets start; subsequent clicks set end
      if (picking === 'start') {
        // We already have a tentative start — set end
        const [s, e] = day < value.start ? [day, value.start] : [value.start, day];
        onChange({ start: s, end: e });
        setPicking(null);
      } else {
        onChange({ start: day, end: day });
        setPicking('start');
      }
    }
  };

  const inRange = (day: string) => day >= value.start && day <= value.end;
  const isStart = (day: string) => day === value.start;
  const isEnd = (day: string) => day === value.end;

  return (
    <div style={s.container}>
      {/* Month navigation */}
      <div style={s.nav}>
        <button style={s.navBtn} onClick={() => setViewDate(addMonths(viewDate, -1))}>‹</button>
        <span style={s.monthLabel}>{MONTHS[month]} {year}</span>
        <button style={s.navBtn} onClick={() => setViewDate(addMonths(viewDate, 1))}>›</button>
      </div>

      {/* Day-of-week headers */}
      <div style={s.grid}>
        {DOW.map(d => <div key={d} style={s.dow}>{d}</div>)}

        {/* Day cells */}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const active = activityDates.has(day);
          const inR = inRange(day);
          const start = isStart(day);
          const end = isEnd(day);
          const isToday = day === today;
          const isSingle = value.start === value.end;

          return (
            <button
              key={day}
              onClick={() => handleDay(day)}
              style={{
                ...s.day,
                background: (start || end)
                  ? 'var(--primary)'
                  : inR
                  ? 'var(--primary-light)'
                  : 'transparent',
                color: (start || end) ? '#fff' : isToday ? 'var(--primary)' : '#1f2937',
                fontWeight: (start || end || isToday) ? '700' : '400',
                borderRadius: isSingle
                  ? '50%'
                  : start ? '50% 0 0 50%'
                  : end ? '0 50% 50% 0'
                  : inR ? '0' : '50%',
              }}
            >
              {parseInt(day.slice(8), 10)}
              {active && !start && !end && (
                <span style={{
                  position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
                  width: '4px', height: '4px', borderRadius: '50%',
                  background: inR ? 'var(--primary)' : '#a5b4fc',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {mode === 'range' && (
        <p style={s.hint}>
          {value.start === value.end
            ? value.start
            : `${value.start}  →  ${value.end}`}
        </p>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { background: '#fff', borderRadius: '14px', padding: '12px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', userSelect: 'none' },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  navBtn: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px 10px', color: '#374151', fontWeight: 'bold' },
  monthLabel: { fontSize: '15px', fontWeight: '700', color: '#111827' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' },
  dow: { textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#9ca3af', padding: '4px 0' },
  day: {
    position: 'relative',
    textAlign: 'center',
    fontSize: '13px',
    padding: '6px 0',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.1s',
    lineHeight: 1.4,
  },
  hint: { textAlign: 'center', fontSize: '12px', color: '#6b7280', margin: '8px 0 0' },
};
