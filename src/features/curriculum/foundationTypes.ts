/** Versioned mathematical payload. Renderers never recover mathematics from prompt text. */
export type FoundationForm = 'model' | 'symbolic' | 'explain' | 'check' | 'transfer' | 'verify';
export type FoundationVisual =
  | { kind: 'rectangles'; pairs: Array<[number, number]>; total: number }
  | { kind: 'jumps'; step: number; count: number; totalCount: number }
  | { kind: 'pattern'; terms: number[]; shape?: boolean }
  | { kind: 'place_value'; values: number[]; highlightedPlace?: number }
  | { kind: 'rounding'; lower: number; upper: number; value: number }
  | { kind: 'columns'; a: number; b: number; operation: '+' | '−'; recording: 'partial' | 'standard' };

export interface FoundationQuestionSpec {
  skillId: string;
  form: FoundationForm;
  band: 0 | 1 | 2;
  seed: number;
  generatorVersion: 1;
  representationId: string;
  contextFamily?: 'library' | 'garden' | 'club';
  parameters: Record<string, number | number[]>;
  visual?: FoundationVisual;
  solutionSteps: string[];
  hints: string[];
  /** Exact response → plausible hypothesis; confirmation belongs to the evidence engine. */
  misconceptionAnswers: Record<string, string>;
}

export type TaggedAnswer =
  | { kind: 'number'; value: number }
  | { kind: 'single_choice'; value: string | number; options: Array<string | number> };
