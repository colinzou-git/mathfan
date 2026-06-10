/**
 * Deterministic hint ladder for practice items.
 *
 * Returns escalating hints based on how many wrong attempts the student
 * has made on the current question presentation.
 *
 * Rung 1 (wrongAttempts === 1): restate the question in simpler words
 * Rung 2 (wrongAttempts === 2): suggest a model or strategy
 * Rung 3 (wrongAttempts === 3): show the setup without the final answer
 * Rung 4 (wrongAttempts >= 4): general encouragement + optional "Show Explanation" button
 *
 * IMPORTANT: hints on rungs 1–3 must never reveal the final answer.
 */

import type { PracticeItem } from '../../types/math';

export interface HintResult {
  text: string;
  showExplanationButton: boolean;
}

export function getHint(item: PracticeItem, wrongAttempts: number): HintResult | null {
  if (wrongAttempts <= 0) return null;

  const { itemType, factA, factB } = item;
  const a = factA ?? 0;
  const b = factB ?? 0;

  if (wrongAttempts >= 4) {
    return {
      text: "Keep going — you're getting closer! Try one more time.",
      showExplanationButton: !!item.explanation,
    };
  }

  switch (itemType) {
    case 'multiplication_fact':
      return mulHint(a, b, wrongAttempts);

    case 'unknown_factor':
      return unknownFactorHint(item, wrongAttempts);

    case 'division_fact':
      return divHint(a, b, wrongAttempts);

    case 'addition_fact':
      return addHint(a, b, wrongAttempts);

    case 'subtraction_fact':
      return subHint(a, b, wrongAttempts);

    case 'word_problem':
      return wordProblemHint(item, wrongAttempts);

    case 'measurement_word':
      return measurementWordHint(item, wrongAttempts);

    case 'fraction_equivalent':
      return fracEquivHint(wrongAttempts);

    case 'fraction_compare':
      return fracCmpHint(wrongAttempts);

    case 'fraction_number_line':
      return fracNlHint(b, wrongAttempts);

    case 'area_unit_squares':
      return areaSquaresHint(a, b, wrongAttempts);

    case 'area_rectangle':
      return areaRectHint(a, b, wrongAttempts);

    case 'perimeter_rectangle':
    case 'perimeter_polygon':
    case 'perimeter_unknown_side':
      return perimHint(a, b, wrongAttempts, itemType);

    default:
      return genericHint(wrongAttempts);
  }
}

function hint(text: string): HintResult {
  return { text, showExplanationButton: false };
}

// ── Multiplication ────────────────────────────────────────────────────────────

function mulHint(a: number, b: number, attempt: number): HintResult {
  if (attempt === 1) {
    return hint(`${a} × ${b} means ${a} groups, with ${b} in each group. How many in all?`);
  }
  if (attempt === 2) {
    const smaller = Math.min(a, b), bigger = Math.max(a, b);
    return hint(`Try skip-counting by ${smaller}. Count ${bigger} hops.`);
  }
  // attempt === 3: show setup using a near-fact (no final answer)
  if (b > 1 && a !== 1) {
    return hint(`You know ${a} × ${b - 1} = ${a * (b - 1)}. Add ${a} more to that.`);
  }
  return hint('Any number multiplied by one equals itself.');
}

// ── Unknown factor ────────────────────────────────────────────────────────────

function unknownFactorHint(item: PracticeItem, attempt: number): HintResult {
  // Parse "known × ? = product" from the prompt
  const m = item.prompt.match(/^(\d+) × \? = (\d+)$/);
  const known = m ? +m[1] : (item.factA ?? 1);
  const product = m ? +m[2] : (item.factA ?? 1) * (typeof item.answer === 'number' ? item.answer : 1);
  const answer = typeof item.answer === 'number' ? item.answer : 0;

  // Perfect-square edge case: known === answer, so we cannot mention the known factor
  if (known === answer) {
    if (attempt === 1) return hint(`Think: what number times itself equals ${product}?`);
    if (attempt === 2) return hint(`Find the number that, when multiplied by itself, gives ${product}.`);
    return hint(`Try each number starting from 1: which one times itself reaches ${product}?`);
  }

  if (attempt === 1) return hint(`Think: ${known} × ? = ${product}. What number goes in the blank?`);
  if (attempt === 2) return hint(`Use the related division fact: ${product} ÷ ${known} = ?`);
  // attempt === 3: show first few multiples without reaching the answer
  return hint(`List multiples of ${known}: ${known}, ${2 * known}, ${3 * known}, … Stop when you reach ${product}.`);
}

// ── Division ──────────────────────────────────────────────────────────────────

function divHint(dividend: number, divisor: number, attempt: number): HintResult {
  if (attempt === 1) {
    return hint(`Think: how many groups of ${divisor} fit in ${dividend}? Or: ${divisor} × ? = ${dividend}.`);
  }
  if (attempt === 2) {
    return hint(`Use your ${divisor} times table. List the multiples: ${divisor}, ${2 * divisor}, ${3 * divisor}… Stop at ${dividend}.`);
  }
  // attempt === 3: show the multiplication connection
  return hint(`Find the missing factor: ${divisor} × __ = ${dividend}. Check your ${divisor} times table.`);
}

// ── Addition ──────────────────────────────────────────────────────────────────

function addHint(a: number, b: number, attempt: number): HintResult {
  if (attempt === 1) {
    return hint('Add the ones column first, then carry to the tens if needed.');
  }
  if (attempt === 2) {
    return hint('Line up the numbers by place value. Add ones, then tens, then hundreds.');
  }
  // attempt === 3
  if (a < 20 && b < 20) {
    return hint(`Start at ${Math.max(a, b)} and count up ${Math.min(a, b)} more.`);
  }
  const onesSum = (a % 10) + (b % 10);
  const carry = onesSum >= 10 ? ' (carry 1)' : '';
  return hint(`Ones: ${a % 10} + ${b % 10} = ${onesSum % 10}${carry}. Now add the tens digits.`);
}

// ── Subtraction ───────────────────────────────────────────────────────────────

function subHint(a: number, b: number, attempt: number): HintResult {
  if (attempt === 1) {
    return hint('Subtract the ones column first. Borrow from the tens if the bottom digit is larger.');
  }
  if (attempt === 2) {
    return hint(`Think of it as: ${b} + ? = ${a}. Count up from ${b} to ${a}.`);
  }
  // attempt === 3
  if (a < 20 && b < 20) {
    return hint(`Start at ${a} and count back ${b} steps.`);
  }
  const borrow = (a % 10) < (b % 10);
  return hint(
    borrow
      ? `Ones: ${a % 10} is less than ${b % 10}, so borrow from the tens. Then subtract.`
      : `Ones: ${a % 10} − ${b % 10} = ${a % 10 - b % 10}. Now subtract the tens.`
  );
}

// ── Word problems (schema-specific) ─────────────────────────────────────────────
//
// Schema is parsed from the deterministic item ID (WORD_{schema}_{a}_{b} for
// single-step, WRD2_{schema}_{a}_{b}_{c} for two-step). Single-step problems are
// one operation, so the early rungs guide the strategy WITHOUT computing the
// product/quotient (which is the final answer). Two-step problems may reveal the
// FIRST step's result on rung 3 — that is an intermediate value, not the final
// answer, and is the most useful nudge toward the second step.

function wordProblemHint(item: PracticeItem, attempt: number): HintResult {
  const single = item.id.match(/^WORD_([a-z]+)_(\d+)_(\d+)$/);
  if (single) return singleStepWordHint(single[1], +single[2], +single[3], attempt);
  const two = item.id.match(/^WRD2_([a-z]+)_(\d+)_(\d+)_(\d+)$/);
  if (two) return twoStepWordHint(two[1], +two[2], +two[3], +two[4], attempt);
  return genericWordHint(attempt);
}

function singleStepWordHint(schema: string, a: number, b: number, attempt: number): HintResult {
  switch (schema) {
    case 'eg': // equal groups: a groups of b each
      if (attempt === 1) return hint(`This is an equal-groups story: ${a} groups with ${b} in each group. To find the total, combine the equal groups.`);
      if (attempt === 2) return hint(`Equal groups means multiply. Count ${b}, then count it ${a} times — or work out ${a} × ${b}.`);
      return hint(`Set up the multiplication ${a} × ${b} and use your times tables.`);
    case 'ar': // array: a rows of b
      if (attempt === 1) return hint(`Picture an array: ${a} rows with ${b} in each row. How many altogether?`);
      if (attempt === 2) return hint(`Rows × how-many-in-each-row gives the total. Multiply ${a} × ${b}.`);
      return hint(`Skip-count by ${b}, ${a} times — or set up ${a} × ${b}.`);
    case 'cmp': // comparison: a times as many as b
      if (attempt === 1) return hint(`"Times as many" means equal groups: one amount is ${b}, the other is ${a} times that much.`);
      if (attempt === 2) return hint(`To find "${a} times as many", multiply: ${a} × ${b}.`);
      return hint(`Set up ${a} groups of ${b}: ${a} × ${b}. Use your times tables.`);
    case 'dv': { // division: (a*b) shared equally into a groups → b each
      const total = a * b;
      if (attempt === 1) return hint(`This is sharing equally: ${total} shared into ${a} equal groups. How many go in each group?`);
      if (attempt === 2) return hint(`Sharing equally means divide: ${total} ÷ ${a}.`);
      return hint(`Think ${a} × ? = ${total}. Use your times tables to find how many are in each group.`);
    }
    default:
      return genericWordHint(attempt);
  }
}

function twoStepWordHint(schema: string, a: number, b: number, c: number, attempt: number): HintResult {
  switch (schema) {
    case 'muls': // (a × b) − c
      if (attempt === 1) return hint(`Two steps. First find the total: ${a} groups of ${b}. Then take ${c} away.`);
      if (attempt === 2) return hint(`Step 1: multiply ${a} × ${b}. Step 2: subtract ${c} from that product.`);
      return hint(`First, ${a} × ${b} = ${a * b}. Now subtract ${c} from ${a * b}.`);
    case 'mula': // (a × b) + c
      if (attempt === 1) return hint(`Two steps. First find ${a} rows of ${b}. Then ${c} more are added.`);
      if (attempt === 2) return hint(`Step 1: multiply ${a} × ${b}. Step 2: add ${c}.`);
      return hint(`First, ${a} × ${b} = ${a * b}. Now add ${c} to ${a * b}.`);
    case 'diva': { // (a ÷ b) + c
      if (attempt === 1) return hint(`Two steps. First share ${a} equally among ${b}. Then each one gets ${c} more.`);
      if (attempt === 2) return hint(`Step 1: divide ${a} ÷ ${b}. Step 2: add ${c} to each share.`);
      const q = b ? a / b : 0;
      return hint(`First, ${a} ÷ ${b} = ${q}. Now add ${c} to ${q}.`);
    }
    case 'divs': { // (a ÷ b) − c
      if (attempt === 1) return hint(`Two steps. First share ${a} equally among ${b}. Then each one gives away ${c}.`);
      if (attempt === 2) return hint(`Step 1: divide ${a} ÷ ${b}. Step 2: subtract ${c}.`);
      const q = b ? a / b : 0;
      return hint(`First, ${a} ÷ ${b} = ${q}. Now subtract ${c} from ${q}.`);
    }
    default:
      return genericWordHint(attempt);
  }
}

function genericWordHint(attempt: number): HintResult {
  if (attempt === 1) {
    return hint('Read the problem again slowly. What is it asking you to find?');
  }
  if (attempt === 2) {
    return hint('Look for clue words: "total" or "in all" → add; "left" or "difference" → subtract; "each group" → multiply; "shared equally" → divide.');
  }
  return hint('Write out the number sentence using the numbers from the problem. Fill in the operation.');
}

// ── Measurement word problems ───────────────────────────────────────────────────
//
// MWRD_{schema}_{a}_{b}: schema starts with "add" (combine, a + b) or "sub"
// (remove, a − b). Early rungs name the operation and set it up without giving
// the sum/difference.

function measurementWordHint(item: PracticeItem, attempt: number): HintResult {
  const m = item.id.match(/^MWRD_([a-z]+)_(\d+)_(\d+)$/);
  const schema = m ? m[1] : '';
  const a = item.factA ?? (m ? +m[2] : 0);
  const b = item.factB ?? (m ? +m[3] : 0);
  const isAdd = schema.startsWith('add');

  if (attempt === 1) {
    return hint(isAdd
      ? 'This measurement story combines two amounts. Look for "in all" or "altogether".'
      : 'This measurement story asks how much is left after removing some. Look for "remain" or "remove".');
  }
  if (attempt === 2) {
    return hint(isAdd
      ? `Combine the amounts by adding: ${a} + ${b}. Line the numbers up by place value.`
      : `Subtract to find what remains: ${a} − ${b}. Line the numbers up by place value.`);
  }
  // attempt === 3
  return hint(isAdd
    ? `Add ${a} + ${b}: add the ones first, then the tens, then the hundreds.`
    : `Subtract ${a} − ${b}: subtract the ones first, borrowing from the tens if needed.`);
}

// ── Fraction: equivalent ──────────────────────────────────────────────────────

function fracEquivHint(attempt: number): HintResult {
  if (attempt === 1) {
    return hint('Equivalent fractions look different but are the same size. Multiply top and bottom by the same number.');
  }
  if (attempt === 2) {
    return hint('Ask: what number times the old denominator equals the new denominator? Use that same number for the numerator.');
  }
  return hint('Example: 1/2 = ?/6. Since 2 × 3 = 6, multiply the top too: 1 × 3 = 3. So 1/2 = 3/6.');
}

// ── Fraction: compare ─────────────────────────────────────────────────────────

function fracCmpHint(attempt: number): HintResult {
  if (attempt === 1) {
    return hint('To compare fractions, look at the size of the parts (denominator) and how many parts (numerator).');
  }
  if (attempt === 2) {
    return hint('Same denominator? The bigger numerator wins. Same numerator? The bigger denominator means smaller pieces.');
  }
  return hint('Picture a pie cut into equal slices. Which fraction takes up more of the pie?');
}

// ── Fraction: number line ─────────────────────────────────────────────────────

function fracNlHint(denominator: number, attempt: number): HintResult {
  const d = denominator > 0 ? denominator : 4;
  if (attempt === 1) {
    return hint(`The number line goes from 0 to 1. The denominator (${d}) tells you how many equal parts to make.`);
  }
  if (attempt === 2) {
    return hint(`Divide the line into ${d} equal parts. Each jump is 1/${d}. Count the numerator's jumps from 0.`);
  }
  return hint(`Mark ${d} equal tick marks between 0 and 1. Each tick is 1/${d}. Count from the left to your fraction.`);
}

// ── Area: unit squares ────────────────────────────────────────────────────────

function areaSquaresHint(rows: number, cols: number, attempt: number): HintResult {
  if (attempt === 1) {
    return hint('Count all the unit squares inside the rectangle.');
  }
  if (attempt === 2) {
    return hint(`Count how many squares are in one row, then count the rows. Multiply the two numbers.`);
  }
  return hint(`There are ${rows} rows and ${cols} squares in each row. ${rows} × ${cols} = ?`);
}

// ── Area: rectangle by formula ────────────────────────────────────────────────

function areaRectHint(length: number, width: number, attempt: number): HintResult {
  if (attempt === 1) {
    return hint('Area = length × width. Multiply the two side lengths.');
  }
  if (attempt === 2) {
    return hint(`The length is ${length} and the width is ${width}. Use your multiplication facts.`);
  }
  return hint(`Set up the multiplication: ${length} × ${width} = ?`);
}

// ── Perimeter ────────────────────────────────────────────────────────────────

function perimHint(a: number, b: number, attempt: number, itemType: string): HintResult {
  if (attempt === 1) {
    return hint('Perimeter is the total distance around the outside of the shape. Add up all the side lengths.');
  }
  if (attempt === 2) {
    if (itemType === 'perimeter_rectangle') {
      return hint(`A rectangle has 4 sides. Two sides have the same length and two sides have the same width.`);
    }
    return hint('Write down each side length. Add them all together one step at a time.');
  }
  // attempt === 3
  if (itemType === 'perimeter_rectangle' && a > 0 && b > 0) {
    return hint(`Two long sides: ${a} + ${a} = ${2 * a}. Two short sides: ${b} + ${b} = ${2 * b}. Now add those two results.`);
  }
  return hint('List all the sides: write each length, then add them step by step.');
}

// ── Generic fallback ──────────────────────────────────────────────────────────

function genericHint(attempt: number): HintResult {
  if (attempt === 1) return hint('Read the question carefully. What is it asking you to find?');
  if (attempt === 2) return hint('Think about what operation or strategy fits this type of problem.');
  return hint('Try writing out each step. What do you know? What do you need to find?');
}
