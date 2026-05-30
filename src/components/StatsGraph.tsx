export interface DayPoint {
  date: string;      // YYYY-MM-DD
  questions: number;
  correct: number;
  accuracy: number;  // 0–1
}

interface Props {
  data: DayPoint[];
  height?: number;
}

// Layout constants
const ML = 44; // margin left (Y axis labels)
const MR = 44; // margin right (accuracy Y axis)
const MT = 12; // margin top
const MB = 32; // margin bottom (X axis labels)

export function StatsGraph({ data, height = 200 }: Props) {
  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '14px' }}>
        No data for this period
      </div>
    );
  }

  const W = 320; // SVG inner width (scales via viewBox)
  const H = height;
  const innerW = W - ML - MR;
  const innerH = H - MT - MB;

  const maxQ = Math.max(...data.map(d => d.questions), 1);
  // Round up to a nice number
  const yMax = Math.ceil(maxQ / 5) * 5 || 5;

  const barW = Math.max(2, Math.floor(innerW / data.length) - 2);
  const barGap = innerW / data.length;

  // Determine X label density (avoid crowding)
  const labelEvery = data.length <= 7 ? 1 : data.length <= 14 ? 2 : data.length <= 31 ? 4 : 7;

  // Y grid lines (5 lines)
  const yLines = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: MT + innerH * (1 - t),
    label: Math.round(yMax * t),
  }));

  // Accuracy line points
  const accPoints = data
    .map((d, i) => {
      const cx = ML + barGap * i + barGap / 2;
      const cy = MT + innerH * (1 - d.accuracy);
      return `${cx},${cy}`;
    })
    .join(' ');

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label="Daily practice chart"
      >
        {/* Y-axis grid lines + labels */}
        {yLines.map(({ y, label }) => (
          <g key={label}>
            <line x1={ML} y1={y} x2={ML + innerW} y2={y}
              stroke="#e5e7eb" strokeWidth={0.5} />
            <text x={ML - 5} y={y + 4} textAnchor="end"
              fontSize={9} fill="#9ca3af">{label}</text>
          </g>
        ))}

        {/* Right Y-axis labels (accuracy %) */}
        {[0, 50, 100].map(pct => {
          const y = MT + innerH * (1 - pct / 100);
          return (
            <text key={pct} x={ML + innerW + 5} y={y + 4} textAnchor="start"
              fontSize={9} fill="#f97316">{pct}%</text>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = ML + barGap * i + (barGap - barW) / 2;
          const barH = d.questions === 0 ? 0 : Math.max(2, innerH * (d.questions / yMax));
          const y = MT + innerH - barH;
          return (
            <g key={d.date}>
              <rect
                x={x} y={y} width={barW} height={barH}
                fill="var(--primary)" opacity={0.85} rx={1}
              />
              {/* Tooltip title */}
              <title>{`${d.date}: ${d.questions} Q, ${Math.round(d.accuracy * 100)}% acc`}</title>
            </g>
          );
        })}

        {/* Accuracy line */}
        {data.some(d => d.questions > 0) && (
          <polyline
            points={accPoints}
            fill="none"
            stroke="#f97316"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Accuracy dots */}
        {data.map((d, i) => {
          if (d.questions === 0) return null;
          const cx = ML + barGap * i + barGap / 2;
          const cy = MT + innerH * (1 - d.accuracy);
          return (
            <circle key={`dot-${i}`} cx={cx} cy={cy} r={2.5}
              fill="#f97316" stroke="#fff" strokeWidth={1} />
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (i % labelEvery !== 0) return null;
          const x = ML + barGap * i + barGap / 2;
          const label = xLabel(d.date, data.length);
          return (
            <text key={`xl-${i}`} x={x} y={H - 4} textAnchor="middle"
              fontSize={9} fill="#9ca3af">{label}</text>
          );
        })}

        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + innerH} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={ML} y1={MT + innerH} x2={ML + innerW} y2={MT + innerH} stroke="#e5e7eb" strokeWidth={1} />
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '4px', fontSize: '12px', color: '#6b7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '10px', background: 'var(--primary)', borderRadius: '2px', display: 'inline-block', opacity: 0.85 }} />
          Questions
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '12px', height: '2px', background: '#f97316', display: 'inline-block' }} />
          <span style={{ width: '6px', height: '6px', background: '#f97316', borderRadius: '50%', display: 'inline-block' }} />
          Accuracy %
        </span>
      </div>
    </div>
  );
}

function xLabel(date: string, total: number): string {
  const d = new Date(date + 'T12:00:00');
  if (total <= 7) {
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
  }
  if (total <= 31) {
    return String(d.getDate());
  }
  // Weekly aggregate fallback
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
