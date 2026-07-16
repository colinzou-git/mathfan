import type { MeasurementDataSpec } from '../curriculum/measurementTypes';
import { buildBarGraphGeometry } from './barGraphGeometry';
type Spec = Extract<MeasurementDataSpec, { kind: 'bar_graph' }>;

export function ScaledBarGraphModel({ spec, revealAnswer = false }: { spec: Spec; revealAnswer?: boolean }) {
  const geometry = buildBarGraphGeometry(spec.values, spec.scale);
  const hiddenIndex = spec.question === 'missing' && !revealAnswer ? spec.requestedIndex : undefined;
  const describedBars = spec.categories
    .map((category, index) => index === hiddenIndex ? `${category}: missing` : `${category}: ${spec.values[index]}`)
    .join(', ');
  const width = 420;
  const height = 250;
  const plot = { left: 48, right: 12, top: 16, bottom: 52 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const slotWidth = plotWidth / spec.values.length;
  const barWidth = Math.min(62, slotWidth * 0.56);

  return <figure
    aria-label={`Scaled bar graph titled ${spec.title}. Scale counts by ${spec.scale} from 0 to ${geometry.maxValue}. ${describedBars}.`}
    style={{ margin: '1rem auto', width: '100%', maxWidth: 440, color: 'var(--text, currentColor)' }}
  >
    <svg role="img" aria-hidden="true" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', width: '100%', minWidth: 280, overflow: 'visible' }}>
      {geometry.tickValues.map(tick => {
        const y = plot.top + plotHeight - tick / geometry.maxValue * plotHeight;
        return <g key={tick}>
          <line x1={plot.left} x2={width - plot.right} y1={y} y2={y} stroke="currentColor" strokeOpacity={tick === 0 ? 1 : 0.32} strokeWidth={tick === 0 ? 2 : 1} />
          <line x1={plot.left - 5} x2={plot.left} y1={y} y2={y} stroke="currentColor" strokeWidth="2" />
          <text x={plot.left - 9} y={y + 4} textAnchor="end" fill="currentColor" fontSize="12">{tick}</text>
        </g>;
      })}
      <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.top + plotHeight} stroke="currentColor" strokeWidth="2" />
      {spec.values.map((_, index) => {
        const x = plot.left + slotWidth * index + (slotWidth - barWidth) / 2;
        const isHidden = index === hiddenIndex;
        const barHeight = geometry.barHeightsPct[index] / 100 * plotHeight;
        return <g key={spec.categories[index]}>
          {isHidden
            ? <rect x={x} y={plot.top + plotHeight - 18} width={barWidth} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
            : <rect x={x} y={plot.top + plotHeight - barHeight} width={barWidth} height={barHeight} rx="4" fill="var(--accent, #315edb)" stroke="currentColor" strokeWidth="1.5" />}
          <text x={x + barWidth / 2} y={height - 28} textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="600">{spec.categories[index]}</text>
          {isHidden && <text x={x + barWidth / 2} y={plot.top + plotHeight - 4} textAnchor="middle" fill="currentColor" fontSize="14">?</text>}
        </g>;
      })}
      <text x={12} y={plot.top + plotHeight / 2} transform={`rotate(-90 12 ${plot.top + plotHeight / 2})`} textAnchor="middle" fill="currentColor" fontSize="12">Value</text>
    </svg>
    <figcaption style={{ textAlign: 'center', fontWeight: 600 }}>{spec.title} · Scale: {spec.scale} per grid step</figcaption>
  </figure>;
}
