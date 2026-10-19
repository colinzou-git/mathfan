import type { FoundationForm, FoundationQuestionSpec, FoundationVisual } from './foundationTypes';

export interface ComparisonBlueprint {
  prompt: string;
  answer: string | number;
  choices?: Array<string | number>;
  visual: FoundationVisual;
  parameters: FoundationQuestionSpec['parameters'];
  steps: string[];
  hints: string[];
  misconceptionAnswers: Record<string, string>;
  contextFamily: NonNullable<FoundationQuestionSpec['contextFamily']>;
  unknownPosition: NonNullable<FoundationQuestionSpec['unknownPosition']>;
}

const CONTEXTS = [
  { family: 'library', first: 'Shelf A', second: 'Shelf B', unit: 'books' },
  { family: 'garden', first: 'Bed A', second: 'Bed B', unit: 'plants' },
  { family: 'club', first: 'Team A', second: 'Team B', unit: 'beads' },
  { family: 'sports', first: 'Box A', second: 'Box B', unit: 'balls' },
] as const;

/** Mathematics-only blueprints; foundationItems owns IDs, card identity and answer tagging. */
export function comparisonBlueprint(skillId: string, form: FoundationForm, band: 0 | 1 | 2, seed: number, rng: () => number): ComparisonBlueprint | null {
  if (skillId !== 'g4-oa-mult-compare-meaning') return null;
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const context = CONTEXTS[seed % CONTEXTS.length];
  const a = int(3, [6, 9, 12][band]), multiplier = int(2, [4, 6, 9][band]), compared = a * multiplier;
  const parameters = { reference: a, multiplier, compared };
  const misconceptions: Record<string, string> = {};
  let prompt: string, answer: string | number, choices: Array<string | number> | undefined;
  const choose = (correct: string, wrong: Array<[string, string]>) => {
    answer = correct; choices = [correct, ...wrong.map(([value]) => value)];
    wrong.forEach(([value, code]) => { misconceptions[value] = `foundation:${code}`; });
  };
  const story = `${context.first} has ${a} ${context.unit}. ${context.second} has ${multiplier} times as many ${context.unit} as ${context.first}.`;
  if (form === 'explain') {
    prompt = `${story} What does “${multiplier} times as many” mean?`;
    choose(`${multiplier} equal groups of ${a}`, [[`${multiplier} more than ${a}`, 'times_means_add'], [`${a} equal groups of ${compared}`, 'reversed_comparison']]);
  } else if (form === 'check') {
    prompt = `${story} A learner adds ${a} + ${multiplier}. Which explanation repairs the model?`;
    choose(`Use ${multiplier} equal groups of ${a}, because the comparison is multiplicative`, [[`Add ${multiplier}, because “times” means “more”`, 'times_means_add'], [`Use ${compared} equal groups of ${a}`, 'reversed_comparison']]);
  } else if (form === 'verify') {
    prompt = `A quantity comparison is recorded as ${compared} = ${multiplier} × ${a}. Which statement gives the matching comparison?`;
    choose(`${compared} is ${multiplier} times as many as ${a}`, [[`${compared} is ${multiplier} more than ${a}`, 'times_means_add'], [`${a} is ${multiplier} times as many as ${compared}`, 'reversed_comparison']]);
  } else {
    prompt = `${story} How many ${context.unit} are in ${context.second}?`;
    answer = compared;
    misconceptions[String(a + multiplier)] = 'foundation:times_means_add';
    misconceptions[String(a)] = 'foundation:reversed_comparison';
  }
  const visual: FoundationVisual = form === 'explain' || form === 'check'
    ? { kind: 'quantity_table', rows: [{ label: 'Reference quantity', value: a }, { label: 'Times as many', value: multiplier }, { label: 'Compared quantity', value: compared, hidden: true }] }
    : { kind: 'comparison_tape', reference: a, multiplier, compared, unknown: 'result' };
  return { prompt, answer: answer!, choices, visual, parameters,
    steps: [`The reference quantity is ${a} ${context.unit}.`, `“${multiplier} times as many” means ${multiplier} equal copies of that reference quantity.`, `${multiplier} × ${a} = ${compared}, so the compared quantity is ${compared} ${context.unit}.`],
    hints: ['Find the quantity being used as one equal unit.', '“Times as many” describes equal copies of that unit.', 'Use the number of copies × the size of one copy. Adding the multiplier describes a different relationship.'],
    misconceptionAnswers: misconceptions, contextFamily: context.family, unknownPosition: 'result' };
}
