export interface FractionValue {
  numerator: number;
  denominator: number;
}

export type FractionComparisonStrategy =
  | 'same_denominator'
  | 'same_numerator'
  | 'benchmark_half'
  | 'general';

export type FractionQuestionSpec =
  | { kind: 'unit_fraction_model'; value: FractionValue }
  | { kind: 'locate_number_line'; value: FractionValue; interval: [number, number]; subdivisions: number }
  | {
      kind: 'equivalent_visual';
      left: FractionValue;
      right: FractionValue;
      missing: 'none' | 'right_numerator' | 'right_denominator';
      multiplier: number;
    }
  | {
      kind: 'compare';
      left: FractionValue;
      right: FractionValue;
      strategy: FractionComparisonStrategy;
      explanationChoice?: { choices: string[]; correct: string };
    }
  | { kind: 'choose_equivalent_model'; target: FractionValue; options: FractionValue[] };
