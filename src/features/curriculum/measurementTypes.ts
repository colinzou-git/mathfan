export interface ClockTime { hour: number; minute: number }
export type BarGraphQuestionKind = 'read_value' | 'greatest' | 'least' | 'compare' | 'total' | 'missing' | 'match_graph';
export type LinePlotQuestionKind = 'count_at_value' | 'total_count' | 'range' | 'count_in_range' | 'total_measurement' | 'update';

export type MeasurementDataSpec =
  | { kind: 'clock_read'; time: ClockTime; minuteIncrement: 1 | 5 | 15 }
  | { kind: 'elapsed_time'; start: ClockTime; end: ClockTime; crossesHour: boolean; durationMinutes: number }
  | { kind: 'bar_graph'; title: string; categories: string[]; values: number[]; scale: number; question: BarGraphQuestionKind; comparedIndices?: number[]; requestedIndex?: number }
  | { kind: 'line_plot'; unit: string; denominator: 1 | 2 | 4; valuesInTicks: number[]; question: LinePlotQuestionKind; targetTick?: number; rangeTicks?: [number, number] }
  | { kind: 'measurement_context'; unit: 'g' | 'kg' | 'mL' | 'L' | 'cm' | 'm'; operation: 'add' | 'subtract' | 'compare'; values: number[] };

export type MeasurementSchema = 'clock_to_5_minutes' | 'clock_to_minute' | 'elapsed_same_hour' | 'elapsed_cross_hour'
  | 'bar_read_value' | 'bar_compare' | 'bar_total' | 'bar_missing'
  | 'line_plot_count' | 'line_plot_range' | 'line_plot_fractional'
  | 'measurement_add' | 'measurement_subtract' | 'measurement_compare';
