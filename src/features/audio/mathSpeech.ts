// Math-aware speech normalization. Kept separate from speech.ts so the spoken
// forms (fractions, symbols) can be unit-tested and reused by visual components
// for accessible labels.

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Cardinal number words for the elementary range (0–999); falls back to digits beyond. */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  n = Math.floor(n);
  if (n < 0) return `negative ${numberToWords(-n)}`;
  if (n < 20) return ONES[n];
  if (n < 100) {
    const o = n % 10;
    return o === 0 ? TENS[Math.floor(n / 10)] : `${TENS[Math.floor(n / 10)]}-${ONES[o]}`;
  }
  if (n < 1000) {
    const rest = n % 100;
    return rest === 0
      ? `${ONES[Math.floor(n / 100)]} hundred`
      : `${ONES[Math.floor(n / 100)]} hundred ${numberToWords(rest)}`;
  }
  return String(n);
}

// Singular / plural ordinal denominator words for friendly fraction speech.
const ORDINAL_DENOMINATORS: Record<number, [string, string]> = {
  2: ['half', 'halves'],
  3: ['third', 'thirds'],
  4: ['fourth', 'fourths'],
  5: ['fifth', 'fifths'],
  6: ['sixth', 'sixths'],
  7: ['seventh', 'sevenths'],
  8: ['eighth', 'eighths'],
  9: ['ninth', 'ninths'],
  10: ['tenth', 'tenths'],
  11: ['eleventh', 'elevenths'],
  12: ['twelfth', 'twelfths'],
  100: ['hundredth', 'hundredths'],
};

const UNKNOWN = new Set(['?', '▢']);

/**
 * Natural speech for a fraction.
 * - Complete numeric fractions use ordinal speech: 3/4 → "three fourths".
 * - Unknown parts use clearer "over" speech: ?/6 → "what number over six",
 *   2/? → "two over what number".
 */
export function fractionToWords(numerator: number | string, denominator: number | string): string {
  const numStr = String(numerator).trim();
  const denStr = String(denominator).trim();
  const numUnknown = UNKNOWN.has(numStr);
  const denUnknown = UNKNOWN.has(denStr);
  const numNum = Number(numStr);
  const denNum = Number(denStr);

  if (numUnknown || denUnknown || !Number.isInteger(numNum) || !Number.isInteger(denNum)) {
    const numWords = numUnknown ? 'what number' : numberToWords(numNum);
    const denWords = denUnknown ? 'what number' : numberToWords(denNum);
    return `${numWords} over ${denWords}`;
  }

  const ord = ORDINAL_DENOMINATORS[denNum];
  if (!ord) return `${numberToWords(numNum)} over ${numberToWords(denNum)}`;
  return `${numberToWords(numNum)} ${numNum === 1 ? ord[0] : ord[1]}`;
}

/**
 * Rewrites a math prompt into words the TTS engine reads naturally.
 * Fractions are normalized BEFORE standalone '?' is replaced, otherwise '?/6'
 * would become 'what/6' and lose its fraction shape.
 */
export function normalizeMathForSpeech(text: string): string {
  return text
    .replace(/(\d+|\?|▢)\s*\/\s*(\d+|\?|▢)/g, (_m, num, den) => ` ${fractionToWords(num, den)} `)
    .replace(/×/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/−/g, ' minus ')
    .replace(/▢/g, ' blank ')
    // A '?' is the unknown in an equation ("6 × 7 = ?" → "what"), but a '?'
    // ending a word-problem sentence is punctuation — keep it (a letter precedes
    // it) so TTS uses natural question intonation instead of saying "what".
    .replace(/([A-Za-z])\?|\?/g, (_m, letter) => (letter ? `${letter}?` : ' what '))
    .replace(/\s+/g, ' ')
    .trim();
}
