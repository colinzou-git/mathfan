/**
 * FractionBar — shows a horizontal bar divided into `denominator` equal parts,
 * with `numerator` parts shaded.
 *
 * Touch-friendly for iPad. Display-only in this phase.
 */

interface Props {
  numerator: number;
  denominator: number;
  /** Color for shaded (filled) parts (defaults to indigo). */
  fillColor?: string;
  /** Bar width in pixels (responsive: uses 100% if not set). */
  width?: number;
  /** Bar height in pixels. */
  height?: number;
  /** Show fraction label below the bar. */
  showLabel?: boolean;
  /** Accessible label override. */
  ariaLabel?: string;
}

const DEFAULT_FILL = '#4f46e5';
const DEFAULT_HEIGHT = 36;

export function FractionBar({
  numerator,
  denominator,
  fillColor = DEFAULT_FILL,
  width,
  height = DEFAULT_HEIGHT,
  showLabel = true,
  ariaLabel,
}: Props) {
  const n = Math.max(0, Math.floor(numerator));
  const d = Math.max(1, Math.floor(denominator));
  // Clamp numerator to denominator
  const shaded = Math.min(n, d);

  const label = ariaLabel ?? `Fraction bar showing ${n}/${d}`;

  return (
    <div
      role="img"
      aria-label={label}
      style={{ display: 'inline-block', width: width ? `${width}px` : '100%' }}
    >
      {/* Bar */}
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          height: `${height}px`,
          borderRadius: '6px',
          overflow: 'hidden',
          border: `2px solid ${fillColor}`,
        }}
      >
        {Array.from({ length: d }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: i < shaded ? fillColor : 'transparent',
              borderRight: i < d - 1 ? `1.5px solid ${fillColor}` : 'none',
            }}
          />
        ))}
      </div>

      {/* Label */}
      {showLabel && (
        <div
          aria-hidden="true"
          style={{
            textAlign: 'center',
            marginTop: '6px',
            fontSize: '16px',
            fontWeight: '700',
            color: fillColor,
          }}
        >
          {n}/{d}
        </div>
      )}
    </div>
  );
}
