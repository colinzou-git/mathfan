/**
 * Diagnostic planner for multiplication and division.
 *
 * Builds a short diagnostic session (10–12 questions) that covers:
 * - easy multiplication facts (×2, ×5)
 * - harder multiplication facts (×7, ×8)
 * - division facts
 * - equal-groups word problem
 * - array meaning word problem
 *
 * Records answers into mathAnswerEvents so the skill mastery engine
 * can derive updated skill summaries.
 */

import type { PracticeItem } from '../../types/math';
import { makeMultiplicationItem } from '../curriculum/multiplicationItems';
import { makeDivisionItem } from '../curriculum/arithmeticItems';
import { makeWordProblem } from '../curriculum/wordProblemItems';

export interface DiagnosticPlan {
  sessionId: string;
  items: PracticeItem[];
  /** Human-readable description of what is being diagnosed. */
  description: string;
}

/**
 * Build a diagnostic plan for Grade 3 multiplication/division.
 *
 * The set of questions is deterministic given the same sessionId seed,
 * so the planner is easily testable.
 */
export function buildDiagnosticPlan(sessionId: string): DiagnosticPlan {
  const items: PracticeItem[] = [];

  // ── Easy multiplication facts (×2, ×5) ──────────────────────────────────
  items.push(makeMultiplicationItem(2, 4));    // 2 × 4
  items.push(makeMultiplicationItem(5, 3));    // 5 × 3
  items.push(makeMultiplicationItem(2, 6));    // 2 × 6

  // ── Harder multiplication facts (×7, ×8) ────────────────────────────────
  items.push(makeMultiplicationItem(7, 4));    // 7 × 4
  items.push(makeMultiplicationItem(8, 6));    // 8 × 6

  // ── Division facts — credits to g3-div-within-100 (÷3) and g3-div-mul-relationship (÷7)
  items.push(makeDivisionItem(12, 3));    // 12 ÷ 3
  items.push(makeDivisionItem(42, 7));    // 42 ÷ 7

  // ── Equal-groups word problems ────────────────────────────────────────────
  items.push(makeWordProblem('eg', 4, 6));     // 4 groups × 6 each
  items.push(makeWordProblem('eg', 3, 8));     // 3 groups × 8 each

  // ── Array word problems ───────────────────────────────────────────────────
  items.push(makeWordProblem('ar', 5, 4));     // 5 rows × 4 cols
  items.push(makeWordProblem('ar', 3, 7));     // 3 rows × 7 cols

  return {
    sessionId,
    items,
    description:
      'Quick check of times tables, division facts, and multiplication word problems.',
  };
}

/**
 * Return the Grade 3 skill ID that a diagnostic result for a given item
 * contributes to. Returns null for items not mapped to a skill.
 */
export function diagnosticItemSkillId(item: PracticeItem): string | null {
  const { itemType, factA, factB, id } = item;

  if (itemType === 'multiplication_fact') {
    const big = Math.max(factA ?? 0, factB ?? 0);
    return big <= 5 ? 'g3-mul-tables-basic' : 'g3-mul-tables-advanced';
  }
  if (itemType === 'division_fact') {
    // factB holds the divisor for DIV_{product}d{divisor} items.
    const divisor = factB ?? 0;
    return divisor <= 5 ? 'g3-div-within-100' : 'g3-div-mul-relationship';
  }
  if (itemType === 'word_problem') {
    if (id.startsWith('WORD_eg_') || id.startsWith('WORD_ar_')) return 'g3-mul-meaning';
    if (id.startsWith('WORD_dv_')) return 'g3-div-meaning';
  }
  return null;
}
