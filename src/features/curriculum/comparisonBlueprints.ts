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
  if (skillId !== 'g4-oa-mult-compare-meaning') {
    if (['g4-oa-multistep-model', 'g4-oa-multistep-solve'].includes(skillId)) return multistepBlueprint(skillId, form, band, seed, rng);
    if (['g4-oa-mult-compare-equations', 'g4-oa-mult-compare-unknowns', 'g4-oa-add-vs-mult-compare'].includes(skillId)) return relationshipBlueprint(skillId, form, band, seed, rng);
    return null;
  }
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

function responseBuilder() {
  const misconceptionAnswers: Record<string, string> = {};
  const numeric = (correct: number, wrong: Array<[number, string]>) => {
    wrong.filter(([value]) => value !== correct).forEach(([value, code]) => { misconceptionAnswers[String(value)] = `foundation:${code}`; });
    return { answer: correct };
  };
  const choose = (correct: string, wrong: Array<[string, string]>) => {
    const options = [...new Set([correct, ...wrong.map(([value]) => value)])];
    wrong.filter(([value]) => value !== correct).forEach(([value, code]) => { misconceptionAnswers[value] = `foundation:${code}`; });
    return { answer: correct, choices: options };
  };
  return { misconceptionAnswers, numeric, choose };
}

function relationshipBlueprint(skillId: string, form: FoundationForm, band: 0 | 1 | 2, seed: number, rng: () => number): ComparisonBlueprint {
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const context = CONTEXTS[seed % CONTEXTS.length];
  const reference = int(3, [6, 9, 12][band]), multiplier = int(2, [4, 6, 9][band]);
  const contrast = skillId === 'g4-oa-add-vs-mult-compare', additive = contrast && seed % 2 === 0;
  const compared = additive ? reference + multiplier : reference * multiplier;
  const unknown = contrast ? 'result' : (['result', 'reference', 'multiplier'] as const)[band];
  const target = unknown === 'result' ? compared : unknown === 'reference' ? reference : multiplier;
  const values = { reference, multiplier, compared, target, additive: Number(additive) };
  const referenceText = unknown === 'reference' ? 'x' : String(reference);
  const multiplierText = unknown === 'multiplier' ? 'x' : String(multiplier);
  const comparedText = unknown === 'result' ? 'x' : String(compared);
  const equation = additive ? `${comparedText} = ${referenceText} + ${multiplierText}` : `${comparedText} = ${multiplierText} × ${referenceText}`;
  const unknownName = unknown === 'result' ? `the number of ${context.unit} in ${context.second}` : unknown === 'reference' ? `the number of ${context.unit} in ${context.first}` : `how many times as many ${context.unit} ${context.second} has as ${context.first}`;
  const story = unknown === 'result'
    ? `${context.first} has ${reference} ${context.unit}. ${context.second} has ${multiplier} ${additive ? 'more' : 'times as many'} ${context.unit} ${additive ? 'than' : 'as'} ${context.first}.`
    : unknown === 'reference'
      ? `${context.second} has ${compared} ${context.unit}, ${multiplier} times as many as ${context.first}.`
      : `${context.first} has ${reference} ${context.unit}. ${context.second} has ${compared} ${context.unit}.`;
  const calculation = additive ? `${reference} + ${multiplier}` : unknown === 'result' ? `${multiplier} × ${reference}` : unknown === 'reference' ? `${compared} ÷ ${multiplier}` : `${compared} ÷ ${reference}`;
  const plan = additive ? 'Add the extra amount to the reference quantity' : unknown === 'result' ? 'Multiply the reference quantity by the multiplier' : unknown === 'reference' ? 'Divide the compared quantity by the multiplier' : 'Divide the compared quantity by the reference quantity';
  const r = responseBuilder();
  let prompt: string, response: { answer: string | number; choices?: Array<string | number> };
  if (contrast && form === 'verify') {
    prompt = `Story A: a quantity is ${multiplier} more than ${reference}. Story B: a quantity is ${multiplier} times as many as ${reference}. Which operations model the two relationships?`;
    response = r.choose('A: add; B: multiply', [['A: multiply; B: add', 'comparison_operation'], ['A: multiply; B: multiply', 'comparison_operation'], ['A: add; B: add', 'times_means_add']]);
  } else if (form === 'explain') {
    prompt = `${story} We want ${unknownName}. Which strategy matches the relationship?`;
    const wrongPlan = additive ? 'Make equal copies instead of adding an extra amount' : unknown === 'result' ? 'Add the multiplier to the reference quantity' : unknown === 'reference' ? 'Multiply the compared quantity by the multiplier' : 'Multiply the compared quantity by the reference quantity';
    response = r.choose(plan, [[wrongPlan, additive ? 'comparison_operation' : 'unknown_operation'], ['Reverse the reference and compared quantities before choosing an operation', 'reversed_comparison']]);
  } else if (form === 'check') {
    prompt = `${story} Which calculation correctly finds ${unknownName}?`;
    response = r.choose(calculation, [[unknown === 'result' && !additive ? `${reference} + ${multiplier}` : `${compared} × ${reference}`, 'unknown_operation'], [additive ? `${reference} × ${multiplier}` : `${compared} − ${multiplier}`, 'comparison_operation']]);
  } else if (skillId === 'g4-oa-mult-compare-equations') {
    if (form === 'verify') {
      prompt = `The comparison model is ${equation}. Which statement uses x in the matching role?`;
      const statement = `${comparedText} is ${multiplierText} times as many as ${referenceText}`;
      response = r.choose(statement, [[`${referenceText} is ${multiplierText} times as many as ${comparedText}`, 'reversed_comparison'], [`${comparedText} is ${multiplierText} more than ${referenceText}`, 'times_means_add']]);
    } else {
      prompt = `${story} Let x represent ${unknownName}. Which equation models this comparison?`;
      response = r.choose(equation, [[`${comparedText} = ${multiplierText} + ${referenceText}`, 'times_means_add'], [`${referenceText} = ${multiplierText} × ${comparedText}`, 'reversed_comparison']]);
    }
  } else {
    prompt = form === 'verify' ? `A quantity record has the equation ${equation}. What value of x completes this comparison?` : `${story} Find ${unknownName}.`;
    response = r.numeric(target, [[reference + multiplier, 'times_means_add'], [compared * multiplier, 'unknown_operation'], [reference, 'reversed_comparison']]);
  }
  const visual: FoundationVisual = form === 'check' || form === 'explain'
    ? { kind: 'quantity_table', rows: [{ label: 'Reference quantity', value: reference, hidden: unknown === 'reference' }, { label: additive ? 'Extra amount' : 'Times as many', value: multiplier, hidden: unknown === 'multiplier' }, { label: 'Compared quantity', value: compared, hidden: unknown === 'result' }] }
    : { kind: 'comparison_tape', reference, multiplier, compared, unknown, additive };
  return { prompt, ...response, visual, parameters: values, contextFamily: context.family, unknownPosition: unknown,
    steps: [`Identify the reference, the compared quantity and ${additive ? 'the extra amount' : 'the multiplier'}.`, `Model the relationship: ${equation}.`, `${plan}. ${calculation} = ${target}.`],
    hints: ['Name the quantity the question asks for. Keep the reference and compared quantities in their roles.', 'Decide whether the relationship describes an extra amount or equal copies.', 'Choose multiplication for an unknown compared quantity; use division to undo a known multiplicative comparison. For an extra amount, use addition.'],
    misconceptionAnswers: r.misconceptionAnswers };
}

function multistepBlueprint(skillId: string, form: FoundationForm, band: 0 | 1 | 2, seed: number, rng: () => number): ComparisonBlueprint {
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const context = CONTEXTS[seed % CONTEXTS.length];
  const reference = int(3, [6, 12, 25][band]), multiplier = int(2, [4, 6, 9][band]);
  const intermediate = reference * multiplier, change = int(2, Math.min([8, 15, 30][band], intermediate - 1));
  const subtract = seed % 2 === 0, total = subtract ? intermediate - change : intermediate + change;
  const unknown = (['result', 'reference', 'change'] as const)[band];
  const target = unknown === 'result' ? total : unknown === 'reference' ? reference : change;
  const sign = subtract ? '−' : '+', action = subtract ? 'removed' : 'added';
  const equation = `${unknown === 'result' ? 'x' : total} = ${multiplier} × ${unknown === 'reference' ? 'x' : reference} ${sign} ${unknown === 'change' ? 'x' : change}`;
  const asked = unknown === 'result' ? `the final number of ${context.unit} in ${context.second}` : unknown === 'reference' ? `the number of ${context.unit} in ${context.first}` : `the number of ${context.unit} ${action}`;
  const relation = `${context.second} starts with ${multiplier} times as many ${context.unit} as ${context.first}.`;
  const story = `${unknown !== 'reference' ? `${context.first} holds ${reference} ${context.unit}. ` : ''}${relation} Then ${unknown === 'change' ? 'some' : change} ${context.unit} are ${action}. ${unknown !== 'result' ? `${context.second} now has ${total} ${context.unit}. ` : ''}`;
  const irrelevant = band === 2 ? int(2, 9) : 0;
  const contextStory = `${story}${irrelevant ? `An unopened packet contains ${irrelevant} labels that are not included in these counts. ` : ''}`;
  const plan = unknown === 'result' ? `First find ${multiplier} copies of ${reference}, then ${subtract ? 'subtract' : 'add'} ${change}`
    : unknown === 'reference' ? `First undo the change to the final count, then divide by ${multiplier}`
      : `First find ${multiplier} copies of ${reference}, then compare with the final count`;
  const r = responseBuilder();
  let prompt: string, response: { answer: string | number; choices?: Array<string | number> };
  if (form === 'explain') {
    prompt = `${contextStory}We want ${asked}. Which plan keeps both steps connected?`;
    response = r.choose(plan, [['Add every number mentioned in the story', 'irrelevant_quantity'], ['Change the reference quantity before making equal copies', 'step_order']]);
  } else if (form === 'check' && skillId === 'g4-oa-multistep-solve') {
    const estimate = Math.round(total / 10) * 10;
    prompt = `${contextStory}Which statement provides an exact check of the final count?`;
    response = r.choose(`${multiplier} × ${reference} ${sign} ${change} = ${total}`, [[`The rounded estimate ${estimate} proves the exact count without checking the steps`, 'estimate_is_exact'], [`${multiplier} × ${reference} = ${total}`, 'lost_step']]);
  } else if (skillId === 'g4-oa-multistep-model') {
    prompt = form === 'verify' ? `A quantity record describes this situation: ${contextStory}Let x be ${asked}. Select the matching two-step equation.` : `${contextStory}Let x represent ${asked}. Which equation models both steps?`;
    const left = unknown === 'result' ? 'x' : total, a = unknown === 'reference' ? 'x' : reference, e = unknown === 'change' ? 'x' : change;
    response = r.choose(equation, [[`${left} = ${multiplier} + ${a} ${sign} ${e}`, 'lost_step'], [`${left} = ${multiplier} × (${a} ${sign} ${e})`, 'step_order']]);
  } else {
    prompt = form === 'verify' ? `A two-step quantity record is ${equation}. Find the value of x and check it in the record.` : `${contextStory}Find ${asked}.`;
    response = r.numeric(target, [[intermediate, 'lost_step'], [total * multiplier, 'step_order'], [target + irrelevant, 'irrelevant_quantity']]);
  }
  const visual: FoundationVisual = form === 'model'
    ? { kind: 'comparison_steps', reference, multiplier, compared: intermediate, change, total, subtract, unknown }
    : { kind: 'quantity_table', rows: [{ label: 'Reference quantity', value: reference, hidden: unknown === 'reference' }, { label: 'Times as many initially', value: multiplier }, { label: `Amount ${action}`, value: change, hidden: unknown === 'change' }, { label: 'Final count', value: total, hidden: unknown === 'result' }] };
  const solving = unknown === 'result' ? `${intermediate} ${sign} ${change} = ${total}` : unknown === 'reference' ? `Undo the change: ${total} ${subtract ? '+' : '−'} ${change} = ${intermediate}; then ${intermediate} ÷ ${multiplier} = ${reference}` : `The initial count is ${intermediate}. The difference between ${intermediate} and ${total} is ${change}`;
  return { prompt, ...response, visual, contextFamily: context.family, unknownPosition: unknown,
    parameters: { reference, multiplier, intermediate, change, total, subtractChange: Number(subtract), target, irrelevant },
    steps: [`Identify the asked quantity and the quantities that describe equal copies and the later change.`, `Equation: ${equation}. ${plan}.`, `${solving}. The requested count is ${target} ${context.unit}.`, 'Check the result in the original relationship; a rounded estimate checks size, not exact equality.'],
    hints: ['Name the asked quantity and ignore information outside the stated counts.', 'Keep the equal-copy relationship separate from the later addition or removal.', 'For an unknown starting quantity, undo the later change before dividing. For an unknown change, compare the initial and final counts.'],
    misconceptionAnswers: r.misconceptionAnswers };
}
