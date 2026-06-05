/**
 * AreaGrid — SVG visual for area and perimeter practice items.
 *
 * mode 'unit_squares': draws a rows × cols grid of unit cells with visible borders.
 * mode 'rectangle':   draws a filled rectangle with width/height labels (area problems).
 * mode 'perimeter':   draws a rectangle outline with all 4 side labels (perimeter problems).
 */

interface Props {
  rows: number;   // factA
  cols: number;   // factB
  mode: 'unit_squares' | 'rectangle' | 'perimeter';
  color?: string;
}

const DEFAULT_COLOR = '#4f46e5';

export function AreaGrid({ rows, cols, mode, color = DEFAULT_COLOR }: Props) {
  const r = Math.max(1, Math.min(rows, 10));
  const c = Math.max(1, Math.min(cols, 10));

  if (mode === 'unit_squares') {
    const CELL = Math.min(32, Math.max(20, Math.floor(200 / Math.max(r, c))));
    const gridW = c * CELL;
    const gridH = r * CELL;
    const fill = color + '2a'; // ~17% opacity

    return (
      <div
        role="img"
        aria-label={`Grid of ${r} rows and ${c} columns of unit squares, ${r * c} total`}
        style={{ display: 'inline-block', padding: '8px' }}
      >
        <svg width={gridW} height={gridH} viewBox={`0 0 ${gridW} ${gridH}`} aria-hidden="true" style={{ display: 'block' }}>
          <rect x={0} y={0} width={gridW} height={gridH} fill={fill} />
          {Array.from({ length: r + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * CELL} x2={gridW} y2={i * CELL}
              stroke={color} strokeWidth={i === 0 || i === r ? 2 : 0.8} />
          ))}
          {Array.from({ length: c + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={gridH}
              stroke={color} strokeWidth={i === 0 || i === c ? 2 : 0.8} />
          ))}
        </svg>
      </div>
    );
  }

  // rectangle or perimeter: labeled rectangle
  const wPx = Math.max(50, Math.min(180, Math.round(c * 18)));
  const hPx = Math.max(40, Math.min(110, Math.round(r * 12)));
  const LP = 26; // label padding on each side
  const svgW = wPx + LP * 2;
  const svgH = hPx + LP * 2;
  const fill = mode === 'rectangle' ? color + '22' : 'none';
  const ariaLabel = mode === 'rectangle'
    ? `Rectangle ${c} units wide by ${r} units tall, area ${r * c} square units`
    : `Rectangle with length ${c} and width ${r}, perimeter ${2 * (r + c)} units`;

  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'inline-block', padding: '4px' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} aria-hidden="true" style={{ display: 'block' }}>
        <rect x={LP} y={LP} width={wPx} height={hPx} fill={fill} stroke={color} strokeWidth={2} rx={2} />

        {/* Bottom label */}
        <text x={LP + wPx / 2} y={LP + hPx + LP - 5} textAnchor="middle"
          fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">{c}</text>

        {/* Right label */}
        <text x={LP + wPx + LP / 2} y={LP + hPx / 2} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">{r}</text>

        {/* Top and left labels for perimeter */}
        {mode === 'perimeter' && (
          <>
            <text x={LP + wPx / 2} y={LP - 8} textAnchor="middle" dominantBaseline="auto"
              fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">{c}</text>
            <text x={LP / 2} y={LP + hPx / 2} textAnchor="middle" dominantBaseline="middle"
              fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">{r}</text>
          </>
        )}
      </svg>
    </div>
  );
}
