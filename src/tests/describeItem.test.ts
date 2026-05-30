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
});
