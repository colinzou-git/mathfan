import type { MasteryLevel } from '../types/math';

/**
 * Color-blind friendly mastery palette.
 * Uses blue (mastered), green (strong), light yellow (developing),
 * orange (learning), gray (new) — avoids red/green confusion.
 * Each level also has a letter indicator for full accessibility.
 */
export interface MasteryColor {
  bg: string;
  text: string;
  border: string;
  letter: string; // shown in grid cells for colorblind users
  label: string;
}

export const MASTERY_COLORS: Record<MasteryLevel, MasteryColor> = {
  new:        { bg: '#e5e7eb', text: '#6b7280', border: '#d1d5db', letter: '·',  label: 'New'        },
  learning:   { bg: '#fed7aa', text: '#7c2d12', border: '#fb923c', letter: 'L',  label: 'Learning'   },
  developing: { bg: '#fef08a', text: '#713f12', border: '#facc15', letter: 'D',  label: 'Developing' },
  strong:     { bg: '#bbf7d0', text: '#14532d', border: '#4ade80', letter: 'S',  label: 'Strong'     },
  mastered:   { bg: '#bfdbfe', text: '#1e3a5f', border: '#60a5fa', letter: 'M',  label: 'Mastered'   },
};
