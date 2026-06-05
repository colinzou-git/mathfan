/**
 * ShapeModel — SVG diagram of a named 2D shape.
 * Squares and rectangles include right-angle corner markers.
 */
import type { ReactNode } from 'react';

export type ShapeName = 'triangle' | 'square' | 'rectangle' | 'pentagon' | 'hexagon' | 'quadrilateral';

interface Props {
  shape: ShapeName;
  color?: string;
  size?: number;
}

const DEFAULT_COLOR = '#4f46e5';

function pts(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

function regularPoly(n: number, cx: number, cy: number, r: number, startAngle: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = startAngle + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

function rightAnglePath(
  corner: [number, number],
  dir1: [number, number],
  dir2: [number, number],
  size: number,
): string {
  const [cx, cy] = corner;
  const p1 = [cx + dir1[0] * size, cy + dir1[1] * size];
  const mid = [p1[0] + dir2[0] * size, p1[1] + dir2[1] * size];
  const p3 = [cx + dir2[0] * size, cy + dir2[1] * size];
  return `M ${p1[0].toFixed(1)},${p1[1].toFixed(1)} L ${mid[0].toFixed(1)},${mid[1].toFixed(1)} L ${p3[0].toFixed(1)},${p3[1].toFixed(1)}`;
}

function SVGWrap({ size, label, children }: { size: number; label: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={`Diagram of a ${label}`} style={{ display: 'inline-block', padding: '4px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ display: 'block' }}>
        {children}
      </svg>
    </div>
  );
}

export function ShapeModel({ shape, color = DEFAULT_COLOR, size = 150 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.37;
  const fill = color + '20'; // ~12% opacity
  const MARK = 10;

  if (shape === 'triangle') {
    const points = regularPoly(3, cx, cy, R, -Math.PI / 2);
    return (
      <SVGWrap size={size} label="triangle">
        <polygon points={pts(points)} fill={fill} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      </SVGWrap>
    );
  }

  if (shape === 'square') {
    const points = regularPoly(4, cx, cy, R, -Math.PI / 4);
    const side = Math.sqrt((points[1][0] - points[0][0]) ** 2 + (points[1][1] - points[0][1]) ** 2);
    const markers = points.map((p, i) => {
      const next = points[(i + 1) % 4];
      const prev = points[(i + 3) % 4];
      const d1: [number, number] = [(next[0] - p[0]) / side, (next[1] - p[1]) / side];
      const d2: [number, number] = [(prev[0] - p[0]) / side, (prev[1] - p[1]) / side];
      return rightAnglePath(p, d1, d2, MARK);
    });
    return (
      <SVGWrap size={size} label="square with right angles at each corner">
        <polygon points={pts(points)} fill={fill} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        {markers.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.5} />)}
      </SVGWrap>
    );
  }

  if (shape === 'rectangle') {
    const rw = R * 1.45;
    const rh = R * 0.85;
    const x = cx - rw, y = cy - rh;
    const w = rw * 2, h = rh * 2;
    const corners: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const dirs: [[number, number], [number, number]][] = [
      [[1, 0], [0, 1]],
      [[0, 1], [-1, 0]],
      [[-1, 0], [0, -1]],
      [[0, -1], [1, 0]],
    ];
    const markers = corners.map((p, i) => rightAnglePath(p, dirs[i][0], dirs[i][1], MARK));
    return (
      <SVGWrap size={size} label="rectangle with right angles at each corner">
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={color} strokeWidth={2.5} rx={2} />
        {markers.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.5} />)}
      </SVGWrap>
    );
  }

  if (shape === 'pentagon') {
    const points = regularPoly(5, cx, cy, R, -Math.PI / 2);
    return (
      <SVGWrap size={size} label="pentagon">
        <polygon points={pts(points)} fill={fill} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      </SVGWrap>
    );
  }

  if (shape === 'hexagon') {
    const points = regularPoly(6, cx, cy, R, -Math.PI / 2);
    return (
      <SVGWrap size={size} label="hexagon">
        <polygon points={pts(points)} fill={fill} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      </SVGWrap>
    );
  }

  // quadrilateral: an irregular shape (clearly not a square or rectangle)
  const qPts: [number, number][] = [
    [cx - R * 0.35, cy - R * 0.58],
    [cx + R * 0.78, cy - R * 0.32],
    [cx + R * 0.52, cy + R * 0.62],
    [cx - R * 0.72, cy + R * 0.38],
  ];
  return (
    <SVGWrap size={size} label="quadrilateral (4-sided polygon)">
      <polygon points={pts(qPts)} fill={fill} stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
    </SVGWrap>
  );
}
