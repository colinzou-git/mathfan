/**
 * RectangleMeasureModel — labeled rectangle that visually emphasizes either
 * the interior (area) or the boundary (perimeter), for operation-selection
 * questions (issue #30: "would you use area or perimeter?").
 */
interface Props {
  length: number;
  width: number;
  emphasize: 'inside' | 'boundary' | 'neutral';
  color?: string;
  revealAnswer?: boolean;
}

const DEFAULT_COLOR = '#4f46e5';

export function RectangleMeasureModel({ length, width, emphasize, color = DEFAULT_COLOR, revealAnswer = false }: Props) {
  const wPx = Math.max(50, Math.min(180, Math.round(length * 18)));
  const hPx = Math.max(40, Math.min(110, Math.round(width * 12)));
  const LP = 26;
  const svgW = wPx + LP * 2;
  const svgH = hPx + LP * 2;

  const fill = emphasize === 'inside' ? color + '3a' : 'none';
  const strokeWidth = emphasize === 'boundary' ? 4 : 2;

  const revealedMeasurement = emphasize === 'inside'
    ? `, area ${length * width} square units`
    : emphasize === 'boundary' ? `, perimeter ${2 * (length + width)} units` : '';
  const ariaLabel = emphasize === 'inside'
    ? `Rectangle ${length} by ${width}, with the inside space highlighted${revealAnswer ? revealedMeasurement : ''}`
    : emphasize === 'boundary'
      ? `Rectangle ${length} by ${width}, with the outside boundary highlighted${revealAnswer ? revealedMeasurement : ''}`
      : `Rectangle ${length} by ${width}`;

  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'inline-block', padding: '4px' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} aria-hidden="true" style={{ display: 'block' }}>
        <rect x={LP} y={LP} width={wPx} height={hPx} fill={fill} stroke={color} strokeWidth={strokeWidth} rx={2} />
        <text x={LP + wPx / 2} y={LP + hPx + 18} textAnchor="middle"
          fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">{length}</text>
        <text x={LP + wPx + 14} y={LP + hPx / 2} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">{width}</text>
      </svg>
    </div>
  );
}
