import type { PracticeItem } from '../../types/math';
import { mulberry32, shuffled } from '../../utils/rng';
import { FOUNDATION_FORMS, getCurriculumSkill } from './curriculumRegistry';
import type { FoundationForm, FoundationQuestionSpec, FoundationVisual } from './foundationTypes';

export const FOUNDATION_GENERATOR_VERSION = 1;
export function factorPairs(n: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let a = 1; a * a <= n; a++) if (n % a === 0) pairs.push([a, n / a]);
  return pairs;
}
export function numberName(n: number): string {
  const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  if (n < 20) return small[n];
  if (n < 100) return ['','', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'][Math.floor(n / 10)] + (n % 10 ? `-${small[n % 10]}` : '');
  if (n < 1000) return `${small[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberName(n % 100)}` : ''}`;
  if (n < 1000000) return `${numberName(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${numberName(n % 1000)}` : ''}`;
  return 'one million';
}
const format = (n: number) => n.toLocaleString('en-US');
export function expandedParts(n: number): number[] {
  return String(n).split('').map((digit, i, digits) => +digit * 10 ** (digits.length - i - 1)).filter(value => value > 0);
}
export function foundationItemId(skillId: string, form: FoundationForm, band: number, seed: number): string {
  return `G4F1~${skillId}~${form}~${band}~${seed >>> 0}`;
}
export function makeFoundationItem(skillId: string, form: FoundationForm, band: 0 | 1 | 2, seed: number): PracticeItem {
  const skill = getCurriculumSkill(skillId);
  if (skill?.gradeLevel !== 4 || !FOUNDATION_FORMS.includes(form)) throw new Error(`Unregistered foundation blueprint: ${skillId}/${form}`);
  if (![0, 1, 2].includes(band) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid foundation seed or difficulty band');
  // Each form has an independent deterministic stream. Verification is a held-out item family.
  const rng = mulberry32((seed + FOUNDATION_FORMS.indexOf(form) * 0x9e3779b9) >>> 0);
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const pick = <T,>(values: readonly T[]) => values[int(0, values.length - 1)];
  const showModel = form === 'model' || form === 'explain' || form === 'check';
  const explain = form === 'explain', check = form === 'check', transfer = form === 'transfer', verify = form === 'verify';
  const contextFamily = pick(['library', 'garden', 'club'] as const);
  const context = { library: 'The library', garden: 'A school garden', club: 'A craft club' }[contextFamily];
  let prompt = '', answer: string | number = 0, choices: Array<string | number> | undefined;
  let visual: FoundationVisual | undefined;
  let steps: string[] = [], hints: string[] = [];
  const parameters: FoundationQuestionSpec['parameters'] = {};
  const misconceptionAnswers: Record<string, string> = {};
  const choice = (correct: string | number, distractors: Array<string | number>, codes: string[] = []) => {
    answer = correct;
    choices = shuffled([...new Set([correct, ...distractors])], rng);
    distractors.forEach((value, index) => { if (value !== correct && codes[index]) misconceptionAnswers[String(value)] = `foundation:${codes[index]}`; });
  };
  const numeric = (correct: number, wrong: Array<[number, string]> = []) => {
    answer = correct;
    for (const [value, code] of wrong) if (value !== correct) misconceptionAnswers[String(value)] = `foundation:${code}`;
  };
  if (skillId === 'g4-oa-factor-meaning') {
    const a = int(2, band === 0 ? 5 : 10), b = int(2, 10), n = a * b;
    parameters.a = a; parameters.b = b; parameters.n = n;
    visual = { kind: 'rectangles', pairs: [[a, b]], total: n };
    if (explain) { prompt = 'Which equation connects the rectangle sides to its number of squares?'; choice(`${a} × ${b} = ${n}`, [`${a} + ${b} = ${a + b}`, `${n} × ${a} = ${n * a}`], ['factors_vs_multiples', 'factors_vs_multiples']); }
    else if (check) { const invalid = [...Array(9)].map((_, i) => i + 2).find(value => n % value !== 0) ?? n + 1; prompt = `Which length cannot be a whole-number side of a rectangle with ${n} unit squares?`; choice(invalid, [1, a, b], ['factors_vs_multiples', 'factors_vs_multiples', 'factors_vs_multiples']); }
    else { prompt = transfer ? `${context} arranges ${n} tiles in ${a} equal rows. How many tiles are in each row?` : verify ? `A rectangle has ${n} squares and a side of ${b}. What is the other whole-number side?` : `A rectangle has ${n} unit squares and ${a} rows. How many columns?`; numeric(verify ? a : b, [[n + a, 'factors_vs_multiples']]); }
    steps = [`A factor is a whole-number rectangle side.`, `${a} × ${b} = ${n}, so ${a} and ${b} are factors of ${n}.`];
    hints = ['Use equal rows, without gaps or leftover squares.', 'Connect rows × columns to the number of squares.', 'Use the known side as the group size and find its partner.'];
  } else if (skillId === 'g4-oa-factor-pairs') {
    const n = pick(band === 0 ? [1, 12, 16, 18, 20, 24] : band === 1 ? [30, 36, 42, 48, 60, 64] : [72, 81, 84, 90, 96, 100]);
    const pairs = factorPairs(n), text = pairs.map(([a, b]) => `${a} × ${b}`).join('; ');
    parameters.n = n; visual = { kind: 'rectangles', pairs: [pairs[0]], total: n };
    if (explain || check || verify) {
      prompt = `Which list contains every factor pair of ${n}, with no reversed duplicates?`;
      choice(text, [pairs.length > 1 ? pairs.slice(1).map(([a, b]) => `${a} × ${b}`).join('; ') : 'No factor pairs', `${text}; ${n} × 1`], ['omitted_pair', 'reversed_pair']);
    } else { prompt = transfer ? `${context} makes rectangular trays using ${n} squares. Rotating a tray gives the same pair. How many factor pairs are possible?` : `How many factor pairs does ${n} have? Count a square pair once.`; numeric(pairs.length, [[pairs.length * 2, 'reversed_pair'], [Math.max(0, pairs.length - 1), 'omitted_pair']]); }
    steps = [`Try potential small sides from 1 upward. Keep only exact divisions.`, `Stop when the small side exceeds its partner.`, `The complete list is ${text}. There are ${pairs.length} pairs.`];
    hints = ['Start with 1 paired with the whole number.', 'Try small factors in order. A factor leaves no remainder.', 'When the sides reverse a previous pair, you can stop.'];
  } else if (skillId === 'g4-oa-multiples') {
    const step = int(2, 9), count = int(2, Math.floor(100 / step) - 1), n = step * count;
    parameters.step = step; parameters.count = count; parameters.n = n; visual = { kind: 'jumps', step, count: Math.min(count, 6), totalCount: count };
    if (explain) { prompt = `Why is ${n} a multiple of ${step}?`; choice(`${step} × ${count} = ${n}`, [`${n} + ${step} = ${n + step}`, `${n} is smaller than ${step}`], ['factors_vs_multiples', 'factors_vs_multiples']); }
    else if (check || verify) { prompt = `Which number is a multiple of ${step}?`; choice(n, [n + 1, n - 1], ['factors_vs_multiples', 'factors_vs_multiples']); }
    else { prompt = transfer ? `${context} adds ${step} books to each of ${count} shelves. How many books are added?` : `What number do ${count} equal jumps of ${step} reach, starting at 0?`; numeric(n, [[step + count, 'factors_vs_multiples']]); }
    steps = [`Multiples are the landing numbers after equal jumps from zero.`, `${step} × ${count} = ${n}, so ${n} is a multiple of ${step}.`];
    hints = ['Keep every jump the same size.', 'A multiple is a whole number of equal groups.', 'Use jump size × number of jumps.'];
  } else if (skillId === 'g4-oa-prime-composite') {
    const n = pick(band === 0 ? [1, 2, 3, 4, 6, 9, 11] : band === 1 ? [15, 17, 21, 23, 25, 29, 31, 49] : [51, 53, 57, 67, 77, 83, 91, 97, 100]);
    const pairs = factorPairs(n), label = n === 1 ? 'neither' : pairs.length === 1 ? 'prime' : 'composite';
    parameters.n = n; visual = { kind: 'rectangles', pairs: [pairs[0]], total: n };
    if (explain || verify) {
      prompt = `Which statement correctly classifies ${n}?`;
      const correct = label === 'neither' ? 'Neither: it has only one factor' : label === 'prime' ? 'Prime: it has exactly two different factors' : 'Composite: it has more than two factors';
      choice(correct, [label !== 'prime' ? 'Prime: every odd number is prime' : 'Composite: every number has factors', label !== 'neither' ? 'Neither: it is larger than 1' : 'Prime: 1 is prime'], [label !== 'prime' ? 'odd_is_prime' : 'factor_count', label !== 'neither' ? 'factor_count' : 'one_is_prime']);
    } else { prompt = transfer ? `${context} has ${n} tiles. Is this number prime, composite, or neither?` : `Is ${n} prime, composite, or neither?`; const wrong = ['prime', 'composite', 'neither'].filter(value => value !== label); choice(label, wrong, wrong.map(value => value === 'prime' ? n === 1 ? 'one_is_prime' : n % 2 ? 'odd_is_prime' : 'factor_count' : 'factor_count')); }
    steps = [`Check whole-number factor pairs, including 1 × ${n}.`, n === 1 ? '1 has only one factor. It is neither prime nor composite.' : `${n} is ${label}: ${pairs.map(([a, b]) => `${a} × ${b}`).join('; ')}.`];
    hints = ['Think about factors rather than just odd or even.', 'Look for factors from 2 upward before deciding.', 'Prime means exactly two different factors. One has only one factor.'];
  } else if (skillId === 'g4-oa-pattern-rule' || skillId === 'g4-oa-pattern-features') {
    const start = int(1, 9), step = pick([2, 3, 4, 5, 6, 7]), terms = [start, start + step, start + 2 * step];
    parameters.start = start; parameters.step = step; parameters.terms = terms;
    const shape = form === 'model' || (transfer && seed % 2 === 0);
    visual = { kind: 'pattern', terms, shape };
    if (skillId === 'g4-oa-pattern-rule' && band > 0) {
      const multiplier = 2, alternating = band === 2;
      const series = alternating ? [start, start + step, start + 3 * step] : [start, start * multiplier, start * multiplier * multiplier];
      const next = alternating ? start + 4 * step : start * multiplier ** 3;
      const rule = alternating ? `Add ${step}, then add ${2 * step}; repeat these two changes` : `Multiply by ${multiplier} each time`;
      parameters.terms = series; parameters.next = next;
      visual = { kind: 'pattern', terms: series, shape };
      if (explain || check) {
        prompt = `Start at ${start}. Pattern: ${series.join(', ')}. Which rule generates it?`;
        choice(rule, [`Add ${step} each time`, `Add ${start + step} each time`], ['rule_vs_feature', 'rule_vs_feature']);
      } else {
        prompt = `${transfer ? `${context} builds a pattern. ` : ''}Start at ${start}. ${rule}. The counts are ${series.join(', ')}, __. What is the fourth count?`;
        numeric(next, [[series[2] + step, 'rule_vs_feature'], [next + step, 'rule_vs_feature']]);
      }
      steps = [`The stated rule is: ${rule.toLowerCase()}.`, `Apply the rule in order: ${[...series, next].join(', ')}.`];
    } else if (skillId === 'g4-oa-pattern-features' || explain) {
      const oddEven = step % 2 === 0 ? (start % 2 ? 'Every term is odd' : 'Every term is even') : 'Odd and even terms alternate';
      prompt = `Start at ${start} and add ${step} each time. Which feature follows from the rule?`;
      choice(oddEven, ['Every term is odd', 'Every term is even', 'Odd and even terms alternate'].filter(value => value !== oddEven), ['rule_vs_feature', 'rule_vs_feature']);
      steps = [`The rule is add ${step}.`, step % 2 === 0 ? 'Adding an even number preserves odd/even status.' : 'Adding an odd number changes odd to even and even to odd.', oddEven + '.'];
      if (skillId === 'g4-oa-pattern-features' && transfer) {
        const position = int(5, 20), value = start + (position - 1) * step;
        parameters.position = position;
        prompt = `${context} begins a shape pattern with ${start} squares and adds ${step} squares each position. Without building every shape, is the count at position ${position} odd or even?`;
        choice(value % 2 ? 'odd' : 'even', [value % 2 ? 'even' : 'odd', 'The rule cannot predict this'], ['rule_vs_feature', 'rule_vs_feature']);
        steps.push(`Position ${position} has ${start} + ${position - 1} × ${step} = ${value} squares, an ${value % 2 ? 'odd' : 'even'} count.`);
      } else if (skillId === 'g4-oa-pattern-features' && verify) {
        prompt = `Pattern A starts at ${start}; pattern B starts at ${start + 1}. Both add ${step} each time. Which feature holds at matching positions?`;
        choice('Their counts always differ by 1', ['Their counts are always equal', `Their counts always differ by ${step}`], ['rule_vs_feature', 'rule_vs_feature']);
        steps.push('Adding the same amount to both counts preserves their starting difference of 1.');
      } else if (skillId === 'g4-oa-pattern-features' && check) {
        prompt = `The rule is “start at ${start}, add ${step}.” Which is an observed feature rather than a restatement of the rule?`;
        choice(oddEven, [`Add ${step} each time`, `Start at ${start}`], ['rule_vs_feature', 'rule_vs_feature']);
      }
    } else if (check) { prompt = `A pattern starts at ${start}: ${terms.join(', ')}. Which rule builds it?`; choice(`Add ${step}`, [`Add ${start + step}`, `Multiply by ${step}`], ['rule_vs_feature', 'rule_vs_feature']); }
    else { prompt = shape ? `A shape pattern starts with ${start} squares and adds ${step} squares each time. How many squares are in position 4?` : transfer ? `${context} starts with ${start} plants and adds ${step} each week. What is the fourth count (including the starting count)?` : `Start at ${start}, add ${step} each time: ${terms.join(', ')}, __. What comes next?`; numeric(start + 3 * step, [[start + 4 * step, 'rule_vs_feature'], [terms[2] * step, 'rule_vs_feature']]); }
    if (!steps.length) steps = [`Start: ${start}. Rule: add ${step}.`, `The first four terms are ${[...terms, start + 3 * step].join(', ')}.`];
    hints = ['Separate the starting value from the repeating rule.', 'Apply the same change to each successive term.', 'Check the position count, or whether an even/odd jump changes parity.'];
  } else if (skillId === 'g4-nbt-ten-times') {
    const digit = int(1, 9), place = 10 ** int(0, 4), right = digit * place, left = right * 10;
    parameters.digit = digit; parameters.place = place; parameters.right = right; parameters.left = left;
    visual = { kind: 'place_value', values: [left, right], highlightedPlace: place };
    if (explain || verify) { prompt = `Compare the value of ${digit} in ${format(left)} and ${format(right)}. Which relationship is correct?`; choice(`${format(left)} is 10 times ${format(right)}`, [`${format(left)} is 10 more than ${format(right)}`, `${format(right)} is 10 times ${format(left)}`], ['add_ten_instead', 'add_ten_instead']); }
    else if (check) { prompt = `Which number has a ${digit} worth ten times the ${digit} in ${format(right)}?`; choice(left, [right + 10, right], ['add_ten_instead', 'add_ten_instead']); }
    else { prompt = transfer ? `Ten equal bundles each hold ${format(right)} counters. What is their combined value?` : `The digit ${digit} is worth ${format(right)}. What is it worth one place to the left?`; numeric(left, [[right + 10, 'add_ten_instead']]); }
    steps = [`Each place is ten times the place to its right.`, `${format(right)} × 10 = ${format(left)}.`];
    hints = ['Moving left changes the size of a place, not just its label.', 'Exchange ten smaller units for one larger unit.', 'Multiply the old value by 10; do not add 10.'];
  } else if (skillId === 'g4-nbt-read-write') {
    const n = seed % 17 === 0 ? 1000000 : band === 0 ? int(1, 9) * 1000 + int(1, 9) : band === 1 ? int(1, 9) * 10000 + int(1, 9) * 100 + int(0, 9) : int(1, 9) * 100000 + int(1, 9) * 1000 + int(1, 9);
    const parts = expandedParts(n), expansion = parts.map(format).join(' + ');
    parameters.n = n; parameters.parts = parts; visual = { kind: 'place_value', values: [n] };
    if (explain || check) { prompt = `Which expanded form equals ${format(n)}?`; choice(expansion, [expandedParts(Math.floor(n / 10)).map(format).join(' + '), `${expansion} + 10`], ['internal_zero', 'internal_zero']); }
    else if (verify || transfer) { prompt = transfer ? `A museum label says “${numberName(n)}.” Which numeral belongs on the label?` : `Write the numeral for ${numberName(n)}.`; choice(n, [Math.floor(n / 10), n === 1000000 ? 100000 : Number(String(n).replace(/0/g, ''))], ['internal_zero', 'internal_zero']); }
    else { prompt = `Which number name matches ${format(n)}?`; choice(numberName(n), [numberName(Math.floor(n / 10)), numberName(n === 1000000 ? 100000 : Number(String(n).replace(/0/g, '')))], ['internal_zero', 'internal_zero']); }
    steps = [`Read each three-digit group, then its place (thousand or million).`, `${format(n)} = ${expansion}.`, 'Zeros keep columns in position, even when they do not appear in expanded form.'];
    hints = ['Read from the largest place to the smallest.', 'Keep internal zeros in the numeral.', 'Connect each nonzero digit to its place-value contribution.'];
  } else if (skillId === 'g4-nbt-compare-order') {
    const place = 10 ** int(2, 5), base = int(1, 7) * place, a = base + int(0, place - 1), b = base + place + int(0, Math.min(8, place - 1));
    const reversed = seed % 2 === 0, equal = seed % 7 === 0 && !explain && !check && !verify;
    const first = reversed ? b : a, second = equal ? first : reversed ? a : b, relation = first === second ? '=' : first > second ? '>' : '<';
    parameters.a = first; parameters.b = second; visual = { kind: 'place_value', values: [first, second] };
    if (explain) { prompt = `Why is ${format(b)} greater than ${format(a)}?`; choice('Its first differing place from the left is greater', ['Its last digit is always greater', 'The last differing place decides'], ['later_digit_first', 'later_digit_first']); }
    else if (check || verify) { prompt = `Choose the numbers in increasing order.`; choice(`${format(a)}, ${format(b)}, 1,000,000`, [`1,000,000, ${format(b)}, ${format(a)}`, `${format(b)}, ${format(a)}, 1,000,000`], ['later_digit_first', 'later_digit_first']); }
    else { prompt = transfer ? `Two collections have ${format(first)} and ${format(second)} objects. Choose <, =, or > between the counts.` : `${format(first)} __ ${format(second)}. Choose the comparison symbol.`; choice(relation, ['<', '=', '>'].filter(value => value !== relation), ['later_digit_first', 'later_digit_first']); }
    steps = ['Align equal places. Compare from the left.', equal ? `${format(first)} = ${format(second)}: every place is the same.` : `${format(b)} > ${format(a)} because the first differing place from the left is greater.`];
    hints = ['Align equal places first.', 'Begin with the largest place; smaller places cannot outweigh it.', 'Stop at the first differing digit from the left.'];
  } else if (skillId === 'g4-nbt-round-any-place') {
    const place = 10 ** int(1, 5), lower = int(0, Math.floor(999999 / place)) * place;
    const offset = verify ? place / 2 : int(1, place - 1), n = lower + offset, upper = lower + place, rounded = offset >= place / 2 ? upper : lower;
    parameters.n = n; parameters.place = place; parameters.lower = lower; parameters.upper = upper;
    visual = { kind: 'rounding', lower, upper, value: n };
    if (check) { prompt = `Which neighboring multiples of ${format(place)} bound ${format(n)}?`; choice(`${format(lower)} and ${format(upper)}`, [`${format(n - 1)} and ${format(n + 1)}`, `${format(lower)} and ${format(upper + place)}`], ['wrong_place', 'wrong_bound']); }
    else if (explain) { prompt = `Round ${format(n)} to the nearest ${format(place)}. Which reason gives the correct rounded value?`; choice(`${format(rounded)}: choose the closer bound; a midpoint goes up`, [`${format(rounded === lower ? upper : lower)}: always choose the farther bound`, `${format(n)}: keep every digit`], ['wrong_bound', 'wrong_place']); }
    else { prompt = transfer ? `${context} has ${format(n)} visitors. Report this to the nearest ${format(place)}.` : `Round ${format(n)} to the nearest ${format(place)}.`; numeric(rounded, [[rounded === lower ? upper : lower, 'wrong_bound'], [n, 'wrong_place']]); }
    steps = [`Bounds: ${format(lower)} and ${format(upper)}. Midpoint: ${format(lower + place / 2)}.`, `${format(n)} rounds to ${format(rounded)}.`];
    hints = ['Check the requested rounding place.', 'Find the multiple just below and the multiple just above.', 'Compare the number with the midpoint. At the midpoint, choose the upper bound.'];
  } else if (skillId === 'g4-nbt-add-standard' || skillId === 'g4-nbt-sub-standard' || skillId === 'g4-nbt-estimate-check') {
    const subtract = skillId === 'g4-nbt-sub-standard' || (skillId === 'g4-nbt-estimate-check' && seed % 2 === 0);
    const scale = [1000, 10000, 100000][band];
    const a = subtract ? (band === 0 ? int(2, 9) * scale + int(0, 9) : int(2, 9) * scale + (seed % 2 ? int(1, 9) : 0)) : int(scale, 4 * scale) + 78;
    const b = subtract ? int(Math.floor(scale / 10), scale - 1) : int(scale, 4 * scale) + 67;
    const result = subtract ? a - b : a + b, op = subtract ? '−' : '+', place = scale;
    const ra = Math.round(a / place) * place, rb = Math.round(b / place) * place, estimate = subtract ? ra - rb : ra + rb;
    const digitwise = Number(String(a).padStart(String(Math.max(a, b)).length, '0').split('').map((digit, i) => {
      const other = +String(b).padStart(String(Math.max(a, b)).length, '0')[i];
      return subtract ? Math.abs(+digit - other) : (+digit + other) % 10;
    }).join(''));
    parameters.a = a; parameters.b = b; parameters.result = result; parameters.place = place; parameters.estimate = estimate;
    visual = { kind: 'columns', a, b, operation: op, recording: form === 'model' ? 'partial' : 'standard' };
    if (skillId === 'g4-nbt-estimate-check') {
      if (explain || verify) { prompt = `Which calculation exactly checks ${format(a)} ${op} ${format(b)} = ${format(result)}?`; const correct = subtract ? `${format(result)} + ${format(b)} = ${format(a)}` : `${format(result)} − ${format(b)} = ${format(a)}`; choice(correct, [`${format(ra)} ${op} ${format(rb)} = ${format(estimate)}`, `${format(result)} ${op} ${format(b)} = ${format(a)}`], ['estimate_is_exact', 'impossible_magnitude']); }
      else if (check) { prompt = `Is the estimate ${format(estimate)} necessarily the exact value of ${format(a)} ${op} ${format(b)}?`; choice('No: rounding can change the value', ['Yes: estimates are always exact', 'Yes: a large number is always exact'], ['estimate_is_exact', 'estimate_is_exact']); }
      else { prompt = transfer ? `${context} ${subtract ? 'uses' : 'adds'} ${format(b)} supplies from a count of ${format(a)}. Round each count to ${format(place)} before estimating the ${subtract ? 'remaining' : 'combined'} count.` : `Estimate ${format(a)} ${op} ${format(b)} by rounding EACH number to the nearest ${format(place)}.`; numeric(estimate, [[result, 'estimate_is_exact'], [result * 10, 'impossible_magnitude']]); }
      steps = [`Round the operands: ${format(a)} → ${format(ra)}; ${format(b)} → ${format(rb)}.`, `Estimate: ${format(ra)} ${op} ${format(rb)} = ${format(estimate)}.`, `Exact result: ${format(result)}. Use the inverse operation for an exact check.`];
    } else if (explain || check) {
      prompt = `For ${format(a)} ${op} ${format(b)}, which strategy handles regrouping correctly?`;
      choice(subtract ? 'Exchange larger units and record every changed place' : 'Align places and carry each complete group of ten', [subtract ? 'Subtract the smaller digit from the larger in each column' : 'Keep only the ones digit of every column sum', 'Align the first digits on the left regardless of place'], [subtract ? 'smaller_from_larger' : 'lost_carry', 'place_misalignment']);
      steps = [`Align ${format(a)} and ${format(b)} by place.`, subtract ? 'Exchange larger units across each zero as needed. Record changes before subtracting.' : 'Regroup each ten into one unit in the next column.', `${format(a)} ${op} ${format(b)} = ${format(result)}.`, `Estimate ${format(estimate)} and check with the inverse operation.`];
    } else {
      prompt = transfer ? `${context} ${subtract ? 'uses' : 'receives'} ${format(b)} counters ${subtract ? 'from' : 'in addition to'} ${format(a)}. What is the exact ${subtract ? 'remaining' : 'total'} count?` : verify ? `Find the missing count: __ ${subtract ? '+' : '−'} ${format(b)} = ${format(a)}.` : `${format(a)} ${op} ${format(b)} = ?`;
      numeric(result, [[digitwise, subtract ? 'smaller_from_larger' : 'lost_carry'], [result + scale, subtract ? 'across_zero' : 'lost_carry']]);
      steps = [`Align equal places. Work from ones to larger places.`, subtract ? 'Regroup across each intervening zero; do not subtract the smaller digit from the larger.' : 'Carry each complete group of ten into the next column.', `${format(a)} ${op} ${format(b)} = ${format(result)}.`, `A useful estimate is ${format(estimate)}. Check the exact result with the inverse operation.`];
    }
    hints = ['Decide whether the question needs an exact result or an estimate.', 'Align equal places. Rename units before completing a column.', 'Use the inverse operation to check an exact result; a rounded estimate checks magnitude.'];
  }
  if (!prompt || !steps.length || !hints.length) throw new Error(`Incomplete blueprint: ${skillId}/${form}`);
  const representationId = showModel && visual ? visual.kind + (visual.kind === 'columns' ? `:${visual.recording}` : '') : transfer ? 'context' : verify ? 'held_out' : 'symbolic';
  const data: FoundationQuestionSpec = { skillId, form, band, seed, generatorVersion: 1, representationId, parameters,
    ...(transfer ? { contextFamily } : {}),
    ...(showModel && visual ? { visual } : {}), solutionSteps: steps, hints, misconceptionAnswers };
  const schemaId = `${skillId}:${form}:b${band}`;
  return { id: foundationItemId(skillId, form, band, seed), skillId, gradeLevel: 4, standardIds: [...skill.californiaStandardIds],
    itemType: 'foundation', prompt, answer, ...(choices ? { choices, answerInput: 'choice' as const, answerSpec: { kind: 'single_choice' as const, value: answer, options: choices } } : { answerInput: 'numeric' as const, answerSpec: { kind: 'number' as const, value: Number(answer) } }),
    contentSpec: { domain: 'foundation', version: 1, data }, explanation: steps.join(' '), tags: ['grade4', form, skill.domain], difficulty: .25 + band * .25,
    schemaId, cardKey: `template:${schemaId}`, representationId, generatorVersion: 1, seed,
    provenance: { contentSource: 'Original MathFan content', sourceUrl: 'https://github.com/colinzou-git/mathfan', sourceLicense: 'Original; repository license applies', adaptationNote: 'Original questions and visuals aligned to the cited California standards; no curriculum text copied.' } };
}
export function makeFoundationItemFromId(id: string): PracticeItem | null {
  const match = id.match(/^G4F1~(g4-[a-z-]+)~(model|symbolic|explain|check|transfer|verify)~([012])~(\d+)$/);
  if (!match || getCurriculumSkill(match[1])?.gradeLevel !== 4) return null;
  const seed = Number(match[4]); if (!Number.isSafeInteger(seed) || seed > 0xffffffff) return null;
  return makeFoundationItem(match[1], match[2] as FoundationForm, +match[3] as 0 | 1 | 2, seed);
}
export function foundationItemIds(skillId: string, seed = 100): string[] {
  if (getCurriculumSkill(skillId)?.gradeLevel !== 4) return [];
  return [0, 1, 2].flatMap(band => FOUNDATION_FORMS.flatMap(form => [0, 1, 2, 3].map(offset => foundationItemId(skillId, form, band, seed + offset))));
}
export function freshFoundationItem(item: PracticeItem, rng: () => number): PracticeItem {
  const spec = item.contentSpec;
  if (spec?.domain !== 'foundation') return item;
  let seed = Math.floor(rng() * 0x100000000) >>> 0;
  if (seed === spec.data.seed) seed = (seed + 1) >>> 0;
  return makeFoundationItem(item.skillId, spec.data.form, spec.data.band, seed);
}
export function defaultFoundationItemIdForCardKey(cardKey: string): string | null {
  const match = cardKey.match(/^template:(g4-[a-z-]+):(model|symbolic|explain|check|transfer|verify):b([012])$/);
  return match && getCurriculumSkill(match[1])?.gradeLevel === 4 ? foundationItemId(match[1], match[2] as FoundationForm, +match[3], 100) : null;
}
