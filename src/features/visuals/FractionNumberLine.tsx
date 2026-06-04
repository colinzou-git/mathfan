/**
 * FractionNumberLine — renders a number line from 0 to 1 using Mafs.
 *
 * Shows tick marks based on the denominator. Optionally highlights a
 * selected numerator/denominator position.
 *
 * Display-only in this phase. Later this can become interactive.
 */

import { Mafs, Line, Point, Text } from 'mafs';
import 'mafs/core.css';

interface Props {
  /** The denominator — determines tick mark spacing. */
  denominator: number;
  /** The numerator to highlight (null = display-only, no highlight). */
  numerator?: number | null;
  /** Width in pixels (defaults to 320). */
  width?: number;
  /** Show fraction label at the highlighted point. */
  showLabel?: boolean;
}

const LINE_Y = 0;
const TICK_HEIGHT = 0.15;
const TICK_COLOR = '#6b7280';
const HIGHLIGHT_COLOR = '#4f46e5';
const LABEL_SIZE = 0.2;

export function FractionNumberLine({
  denominator,
  numerator = null,
  width = 320,
  showLabel = true,
}: Props) {
  const d = Math.max(1, Math.min(Math.floor(denominator), 12));
  const hasHighlight = numerator != null && numerator >= 0 && numerator <= d;
  const n = hasHighlight ? Math.floor(numerator!) : null;

  // x coordinate for a fraction a/d (mapped to the [0,1] domain shown in [-0.1, 1.1])
  const xAt = (a: number) => a / d;

  // Tick marks at each a/d for a = 0..d
  const ticks = Array.from({ length: d + 1 }, (_, i) => i);

  return (
    <div style={{ width: `${width}px`, touchAction: 'none', userSelect: 'none' }}>
      <Mafs
        width={width}
        height={Math.round(width * 0.3)}
        viewBox={{ x: [-0.15, 1.15], y: [-0.5, 0.5] }}
        preserveAspectRatio={false}
        pan={false}
        zoom={false}
      >
        {/* Horizontal axis */}
        <Line.Segment
          point1={[0, LINE_Y]}
          point2={[1, LINE_Y]}
          color={TICK_COLOR}
          weight={2}
        />

        {/* Left arrow cap */}
        <Line.Segment
          point1={[0, LINE_Y]}
          point2={[-0.05, LINE_Y]}
          color={TICK_COLOR}
          weight={2}
        />

        {/* Right arrow cap */}
        <Line.Segment
          point1={[1, LINE_Y]}
          point2={[1.05, LINE_Y]}
          color={TICK_COLOR}
          weight={2}
        />

        {/* Tick marks */}
        {ticks.map(a => (
          <Line.Segment
            key={a}
            point1={[xAt(a), LINE_Y - TICK_HEIGHT]}
            point2={[xAt(a), LINE_Y + TICK_HEIGHT]}
            color={a === n ? HIGHLIGHT_COLOR : TICK_COLOR}
            weight={a === n ? 3 : 1.5}
          />
        ))}

        {/* 0 and 1 endpoint labels */}
        <Text x={0} y={-0.35} size={LABEL_SIZE}>0</Text>
        <Text x={1} y={-0.35} size={LABEL_SIZE}>1</Text>

        {/* Highlight point */}
        {hasHighlight && n != null && (
          <>
            <Point
              x={xAt(n)}
              y={LINE_Y}
              color={HIGHLIGHT_COLOR}
              opacity={1}
            />
            {showLabel && (
              <Text
                x={xAt(n)}
                y={0.35}
                size={LABEL_SIZE}
                color={HIGHLIGHT_COLOR}
              >
                {n}/{d}
              </Text>
            )}
          </>
        )}
      </Mafs>
    </div>
  );
}
