/**
 * RectilinearAreaModel — SVG L-shape for rectilinear area practice items.
 *
 * Draws two rectangles joined as an L-shape with dimension labels.
 * When revealAnswer=false the individual areas are hidden (answer leakage prevention).
 * When revealAnswer=true each rectangle shows its area value.
 */

const CELL = 20;
const PAD = 26;
const DEFAULT_COLOR = '#4f46e5';

interface Props {
  a1: number;
  b1: number;
  a2: number;
  b2: number;
  color?: string;
  revealAnswer?: boolean;
}

export function RectilinearAreaModel({ a1, b1, a2, b2, color = DEFAULT_COLOR, revealAnswer = false }: Props) {
  // Normalize: the wider rectangle goes on top to produce a consistent L orientation
  const [topA, topB, botA, botB] = b1 >= b2 ? [a1, b1, a2, b2] : [a2, b2, a1, b1];

  const topW = topB * CELL;
  const topH = topA * CELL;
  const botW = botB * CELL;
  const botH = botA * CELL;
  const botX = topW - botW; // bottom rect flush with right edge

  const svgW = topW + PAD * 2;
  const svgH = topH + botH + PAD * 2;

  const fill = color + '22';
  const topArea = topA * topB;
  const botArea = botA * botB;
  const totalArea = topArea + botArea;

  const ariaLabel = revealAnswer
    ? `L-shaped figure: top rectangle ${topB} by ${topA} has area ${topArea}; bottom rectangle ${botB} by ${botA} has area ${botArea}; total area ${totalArea}`
    : `L-shaped figure made of two rectangles: ${topB} by ${topA} and ${botB} by ${botA}`;

  return (
    <div role="img" aria-label={ariaLabel} style={{ display: 'inline-block', padding: '4px' }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} aria-hidden="true" style={{ display: 'block' }}>
        <g transform={`translate(${PAD},${PAD})`}>
          {/* Top rectangle */}
          <rect x={0} y={0} width={topW} height={topH} fill={fill} stroke={color} strokeWidth={2} />
          {/* Bottom rectangle */}
          <rect x={botX} y={topH} width={botW} height={botH} fill={fill} stroke={color} strokeWidth={2} />

          {/* Top rect: width label above, height label to the left */}
          <text x={topW / 2} y={-8} textAnchor="middle" dominantBaseline="auto"
            fill={color} fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">
            {topB}
          </text>
          <text x={-10} y={topH / 2} textAnchor="middle" dominantBaseline="middle"
            fill={color} fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">
            {topA}
          </text>

          {/* Bottom rect: width label below, height label to the right */}
          <text x={botX + botW / 2} y={topH + botH + 18} textAnchor="middle" dominantBaseline="auto"
            fill={color} fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">
            {botB}
          </text>
          <text x={botX + botW + 10} y={topH + botH / 2} textAnchor="start" dominantBaseline="middle"
            fill={color} fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">
            {botA}
          </text>

          {/* Area labels inside each rectangle — only when revealAnswer */}
          {revealAnswer && (
            <>
              <text x={topW / 2} y={topH / 2} textAnchor="middle" dominantBaseline="middle"
                fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">
                {topArea}
              </text>
              <text x={botX + botW / 2} y={topH + botH / 2} textAnchor="middle" dominantBaseline="middle"
                fill={color} fontSize="14" fontWeight="700" fontFamily="system-ui,sans-serif">
                {botArea}
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
