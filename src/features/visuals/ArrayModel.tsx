/**
 * ArrayModel — shows an a×b rectangular array of dots.
 *
 * Touch-friendly for iPad. No drag-and-drop in this phase.
 */

interface Props {
  rows: number;
  cols: number;
  /** Optional highlight color for dots (defaults to indigo). */
  color?: string;
  /** Max total dots before the component refuses to render (safety cap). */
  maxDots?: number;
  /** Accessible label override. */
  ariaLabel?: string;
}

const DEFAULT_COLOR = '#4f46e5';
const DOT_SIZE = 28;
const DOT_GAP = 8;

export function ArrayModel({ rows, cols, color = DEFAULT_COLOR, maxDots = 144, ariaLabel }: Props) {
  const r = Math.max(1, Math.floor(rows));
  const c = Math.max(1, Math.floor(cols));
  const total = r * c;

  if (total > maxDots) {
    return (
      <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>
        Array: {r} × {c} = {total}
      </div>
    );
  }

  const width = c * DOT_SIZE + (c - 1) * DOT_GAP;
  const height = r * DOT_SIZE + (r - 1) * DOT_GAP;

  const label = ariaLabel ?? `Array of ${r} rows and ${c} columns showing ${total} dots`;

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        display: 'inline-block',
        padding: '12px',
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        style={{ display: 'block', touchAction: 'none' }}
      >
        {Array.from({ length: r }, (_, ri) =>
          Array.from({ length: c }, (_, ci) => {
            const cx = ci * (DOT_SIZE + DOT_GAP) + DOT_SIZE / 2;
            const cy = ri * (DOT_SIZE + DOT_GAP) + DOT_SIZE / 2;
            return (
              <circle
                key={`${ri}-${ci}`}
                cx={cx}
                cy={cy}
                r={DOT_SIZE / 2 - 2}
                fill={color}
                opacity={0.85}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
