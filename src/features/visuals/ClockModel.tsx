interface Props {
  hour: number;   // 1-12
  minute: number; // 0-59
  size?: number;  // viewBox side length (default 120)
}

export function ClockModel({ hour, minute, size = 120 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  // Hour hand: points to (hour + minute/60) * 30 degrees from 12 o'clock
  const hourDeg = ((hour % 12) + minute / 60) * 30;
  const hourRad = (hourDeg - 90) * (Math.PI / 180);
  const hourLen = r * 0.55;
  const hx = cx + hourLen * Math.cos(hourRad);
  const hy = cy + hourLen * Math.sin(hourRad);

  // Minute hand: minute * 6 degrees from 12 o'clock
  const minDeg = minute * 6;
  const minRad = (minDeg - 90) * (Math.PI / 180);
  const minLen = r * 0.8;
  const mx = cx + minLen * Math.cos(minRad);
  const my = cy + minLen * Math.sin(minRad);

  // Tick marks at 5-minute intervals (every 30 degrees)
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 - 90) * (Math.PI / 180);
    const isHour = i % 3 === 0;
    const inner = r * (isHour ? 0.82 : 0.88);
    return {
      x1: cx + inner * Math.cos(a),
      y1: cy + inner * Math.sin(a),
      x2: cx + r * Math.cos(a),
      y2: cy + r * Math.sin(a),
      strokeWidth: isHour ? 2 : 1,
    };
  });

  // Cardinal hour numbers: 12, 3, 6, 9
  const cardinals = [
    { n: 12, x: cx,      y: cy - r * 0.68 },
    { n:  3, x: cx + r * 0.68, y: cy + 3   },
    { n:  6, x: cx,      y: cy + r * 0.72  },
    { n:  9, x: cx - r * 0.68, y: cy + 3   },
  ];

  const fs = size * 0.09; // font size

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Clock showing ${hour}:${minute.toString().padStart(2, '0')}`}
    >
      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#374151" strokeWidth="2" />
      {/* Ticks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1}
          x2={t.x2} y2={t.y2}
          stroke="#6b7280"
          strokeWidth={t.strokeWidth}
        />
      ))}
      {/* Hour numbers */}
      {cardinals.map(({ n, x, y }) => (
        <text
          key={n}
          x={x} y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fs}
          fontWeight="600"
          fill="#111827"
        >
          {n}
        </text>
      ))}
      {/* Hour hand (thick, dark) */}
      <line
        x1={cx} y1={cy}
        x2={hx} y2={hy}
        stroke="#1f2937"
        strokeWidth={size * 0.025}
        strokeLinecap="round"
      />
      {/* Minute hand (thin, indigo) */}
      <line
        x1={cx} y1={cy}
        x2={mx} y2={my}
        stroke="#4f46e5"
        strokeWidth={size * 0.018}
        strokeLinecap="round"
      />
      {/* Center pivot */}
      <circle cx={cx} cy={cy} r={size * 0.025} fill="#1f2937" />
    </svg>
  );
}
