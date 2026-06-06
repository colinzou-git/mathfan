import { describe, it, expect } from 'vitest';
import { describeItem, itemPrompt } from '../features/curriculum/describeItem';

describe('describeItem', () => {
  it('parses multiplication', () => {
    expect(describeItem('MUL_7x8')).toMatchObject({ prompt: '7 × 8', group: 'mul' });
  });
  it('parses unknown factor', () => {
    expect(describeItem('UNK_72k8')).toMatchObject({ prompt: '8 × ? = 72', group: 'unk' });
  });
  it('parses division', () => {
    expect(describeItem('DIV_56d8')).toMatchObject({ prompt: '56 ÷ 8', group: 'div' });
  });
  it('parses addition', () => {
    expect(describeItem('ADD_3p5')).toMatchObject({ prompt: '3 + 5', group: 'add' });
  });
  it('parses subtraction', () => {
    expect(describeItem('SUB_9m3')).toMatchObject({ prompt: '9 − 3', group: 'sub' });
  });
  it('parses equivalent fraction', () => {
    expect(describeItem('FEQ_2_3_6')).toMatchObject({ prompt: '2/3 = ?/6', group: 'frac' });
  });
  it('parses compare fraction', () => {
    expect(describeItem('FCMP_1_3_1_2')).toMatchObject({ prompt: '1/3 ▢ 1/2', group: 'frac' });
  });
  it('itemPrompt falls back to the raw id for unknown formats', () => {
    expect(itemPrompt('WEIRD_xyz')).toBe('WEIRD_xyz');
  });

  // ── Area/perimeter items — group 'area' ──────────────────────────────────────

  it('parses AREA_SQ as area group', () => {
    expect(describeItem('AREA_SQ_3x4')).toMatchObject({ itemType: 'area_unit_squares', group: 'area' });
  });

  it('parses AREA_RECT as area group', () => {
    expect(describeItem('AREA_RECT_5x6')).toMatchObject({ itemType: 'area_rectangle', group: 'area' });
  });

  it('parses PERIM_RECT as area group', () => {
    expect(describeItem('PERIM_RECT_4x3')).toMatchObject({ itemType: 'perimeter_rectangle', group: 'area' });
  });

  it('parses PERIM_POLY with correct prompt and group', () => {
    expect(describeItem('PERIM_POLY_3-4-5')).toMatchObject({
      prompt: 'Perimeter of polygon (3, 4, 5)',
      itemType: 'perimeter_polygon',
      group: 'area',
    });
  });

  it('parses PERIM_POLY with four sides', () => {
    expect(describeItem('PERIM_POLY_2-3-4-5')).toMatchObject({
      prompt: 'Perimeter of polygon (2, 3, 4, 5)',
      itemType: 'perimeter_polygon',
      group: 'area',
    });
  });

  it('parses PERIM_UNKSIDE with correct prompt and group', () => {
    expect(describeItem('PERIM_UNKSIDE_12_3-4')).toMatchObject({
      prompt: 'Perimeter: total 12, known sides 3, 4',
      itemType: 'perimeter_unknown_side',
      group: 'area',
    });
  });

  it('parses AREA_PERIM_CMP sadp with correct prompt and group', () => {
    expect(describeItem('AREA_PERIM_CMP_sadp_0')).toMatchObject({
      prompt: 'Area/perimeter compare (sadp #0)',
      itemType: 'area_perimeter_compare',
      group: 'area',
    });
  });

  it('parses AREA_PERIM_CMP spad with correct group', () => {
    expect(describeItem('AREA_PERIM_CMP_spad_2')).toMatchObject({
      prompt: 'Area/perimeter compare (spad #2)',
      itemType: 'area_perimeter_compare',
      group: 'area',
    });
  });

  // ── Grade 3 new groups ────────────────────────────────────────────────────────

  it('parses GEO_ as geometry group', () => {
    expect(describeItem('GEO_SIDES_triangle')).toMatchObject({ itemType: 'geometry_vocabulary', group: 'geometry' });
  });

  it('parses CLCK_ as measurement group', () => {
    expect(describeItem('CLCK_3_15')).toMatchObject({ itemType: 'time_to_minute', group: 'measurement' });
  });

  it('parses ETIME_ as measurement group', () => {
    expect(describeItem('ETIME_9_15_9_45')).toMatchObject({ itemType: 'elapsed_time', group: 'measurement' });
  });

  it('parses MWRD_ as measurement group', () => {
    expect(describeItem('MWRD_addg_250_150')).toMatchObject({ itemType: 'measurement_word', group: 'measurement' });
  });

  it('parses BARG_ as data group', () => {
    expect(describeItem('BARG_5_3')).toMatchObject({ itemType: 'bar_graph_read', group: 'data' });
  });

  it('parses LPLOT_ as data group', () => {
    expect(describeItem('LPLOT_1_2_2_3')).toMatchObject({ itemType: 'line_plot_read', group: 'data' });
  });

  it('parses APAT_ as pattern group', () => {
    expect(describeItem('APAT_2_2_4')).toMatchObject({ itemType: 'arithmetic_pattern', group: 'pattern' });
  });
});
