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
    case 'unknown_factor':
      return mulHint(a, b, wrongAttempts);

    case 'division_fact':
      return divHint(a, b, wrongAttempts);

    case 'addition_fact':
      return addHint(a, b, wrongAttempts);

    case 'subtraction_fact':
      return subHint(a, b, wrongAttempts);

    case 'word_problem':
      return wordHint(wrongAttempts);

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
  if (b > 1) {
    return hint(`You know ${a} × ${b - 1} = ${a * (b - 1)}. Add ${a} more to that.`);
  }
  return hint(`${a} × 1 is just ${a} itself.`);
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

// ── Word problem ──────────────────────────────────────────────────────────────

function wordHint(attempt: number): HintResult {
  if (attempt === 1) {
    return hint('Read the problem again slowly. What is it asking you to find?');
  }
  if (attempt === 2) {
    return hint('Look for clue words: "total" or "in all" → add; "left" or "difference" → subtract; "each group" → multiply; "shared equally" → divide.');
  }
  return hint('Write out the number sentence using the numbers from the problem. Fill in the operation.');
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
