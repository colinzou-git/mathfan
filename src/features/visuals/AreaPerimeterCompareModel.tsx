/**
 * AreaPerimeterCompareModel — two rectangles side by side, for "same area,
 * different perimeter" / "same perimeter, different area" comparison items
 * (issue #30).
 */
import type { RectSpec } from './types';

interface Props {
  rectangles: RectSpec[];
  comparison: 'same_area' | 'same_perimeter';
  color?: string;
  revealAnswer?: boolean;
}

const DEFAULT_COLOR = '#4f46e5';
const SCALE = 14;
const PAD = 24;
const GAP = 20;

export function AreaPerimeterCompareModel({ rectangles, comparison, color = DEFAULT_COLOR, revealAnswer = false }: Props) {
  if (rectangles.length === 0) return null;

  const boxes = rectangles.map((r, index) => ({
    w: r.width * SCALE,
    h: r.length * SCALE,
    r,
    x: PAD + rectangles.slice(0, index).reduce((sum, prior) => sum + prior.width * SCALE + GAP, 0),
  }));
  const maxH = Math.max(...boxes.map(b => b.h));
  const totalW = boxes.reduce((s, b) => s + b.w, 0) + GAP * (boxes.length - 1);
  const svgW = totalW + PAD * 2;
  const svgH = maxH + PAD * 2 + 20;

  const areas = rectangles.map(r => r.length * r.width);
  const perims = rectangles.map(r => 2 * (r.length + r.width));
  const ariaLabel = revealAnswer
    ? `${rectangles.length} rectangles compared by ${comparison === 'same_area' ? 'area' : 'perimeter'}: areas ${areas.join(', ')}, perimeters ${perims.join(', ')}`
    : `${rectangles.length} rectangles to compare`;

  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'inline-block', padding: '4px' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} aria-hidden="true" style={{ display: 'block' }}>
        {boxes.map((b, i) => {
          const rectX = b.x;
          const rectY = PAD + (maxH - b.h);
          const label = b.r.label ?? String.fromCharCode(65 + i);
          return (
            <g key={i}>
              <rect x={rectX} y={rectY} width={b.w} height={b.h} fill={color + '22'} stroke={color} strokeWidth={2} />
              <text x={rectX + b.w / 2} y={rectY + b.h + 16} textAnchor="middle"
                fill={color} fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">
                {label}: {b.r.width}×{b.r.length}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
