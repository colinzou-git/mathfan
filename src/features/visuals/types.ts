export interface Point {
  x: number;
  y: number;
}

export interface RectSpec {
  length: number;
  width: number;
  /** Optional label override; defaults to "A", "B", … by position when omitted. */
  label?: string;
}

/**
 * Structured visual payload for a PracticeItem (issue #30). Prefer this over
 * prompt/ID parsing for new item types — see VisualModel(), which checks
 * `item.visualSpec` first and falls back to itemType/id parsing only for
 * legacy items that predate this field.
 */
export type VisualSpec =
  | { kind: 'area_grid'; rows: number; cols: number; showTiles: boolean }
  | { kind: 'perimeter_path'; vertices: Point[]; sideLabels: Array<number | null> }
  | { kind: 'rectangle_measure'; length: number; width: number; emphasize: 'inside' | 'boundary' | 'neutral' }
  | { kind: 'rectilinear_area'; rectangles: RectSpec[]; showDecomposition?: boolean }
  | { kind: 'area_perimeter_compare'; rectangles: RectSpec[]; comparison: 'same_area' | 'same_perimeter' };
