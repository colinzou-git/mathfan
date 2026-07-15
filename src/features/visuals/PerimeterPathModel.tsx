/**
 * PerimeterPathModel — SVG for an irregular polygon boundary (issue #30).
 *
 * Renders each vertex-to-vertex boundary segment exactly once, labeled with
 * its length when known and "?" when it is the unknown side being solved for.
 * Does not reveal the total perimeter or the missing-side answer in the
 * accessible label unless revealAnswer is set.
 */
import type { Point } from './types';

interface Props {
  vertices: Point[];
  sideLabels: Array<number | null>;
  color?: string;
  revealAnswer?: boolean;
  /** Numeric answer for the missing side, shown only when revealAnswer is true. */
  missingSideAnswer?: number;
}

const DEFAULT_COLOR = '#4f46e5';
const PAD = 24;

function boundsOf(vertices: Point[]) {
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export function PerimeterPathModel({ vertices, sideLabels, color = DEFAULT_COLOR, revealAnswer = false, missingSideAnswer }: Props) {
  if (vertices.length < 3) return null;

  const { minX, maxX, minY, maxY } = boundsOf(vertices);
  const scale = 24;
  const w = (maxX - minX) * scale;
  const h = (maxY - minY) * scale;
  const svgW = w + PAD * 2;
  const svgH = h + PAD * 2;

  const toSvg = (p: Point) => ({
    x: PAD + (p.x - minX) * scale,
    y: PAD + (p.y - minY) * scale,
  });

  const points = vertices.map(toSvg);
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  const knownCount = sideLabels.filter(s => s != null).length;
  const unknownCount = sideLabels.length - knownCount;
  const ariaLabel = revealAnswer && missingSideAnswer != null
    ? `Polygon with ${vertices.length} sides. Known sides: ${sideLabels.filter((s): s is number => s != null).join(', ')}. Missing side: ${missingSideAnswer}.`
    : `Polygon with ${vertices.length} sides. ${knownCount} side${knownCount === 1 ? '' : 's'} labeled, ${unknownCount} unknown.`;

  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'inline-block', padding: '4px' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} aria-hidden="true" style={{ display: 'block' }}>
        <path d={pathD} fill={color + '18'} stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => {
          // Each boundary segment (vertex i -> vertex i+1) labeled exactly once, at its midpoint.
          const next = points[(i + 1) % points.length];
          const mx = (p.x + next.x) / 2;
          const my = (p.y + next.y) / 2;
          const label = sideLabels[i];
          return (
            <text
              key={`side-${i}`}
              x={mx} y={my}
              textAnchor="middle" dominantBaseline="middle"
              fill={color} fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif"
              style={{ paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 }}
            >
              {label != null ? label : '?'}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
