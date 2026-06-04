/**
 * QuestionRenderer — a lightweight wrapper that displays a practice prompt,
 * an optional VisualModel, and an optional hint text.
 *
 * This component does NOT replace PracticeScreen. It is an additive component
 * intended for use in new learning flows (diagnostic, scaffolded practice) that
 * want a visual or hint alongside the question.
 *
 * Default behavior (no visual, no hint) is identical to the raw prompt display
 * that PracticeScreen already uses — so it is safe to adopt incrementally.
 */

import type { PracticeItem } from '../../types/math';
import { VisualModel } from '../visuals/VisualModel';

export type LearningRenderMode = 'diagnose' | 'practice' | 'review';

interface Props {
  /** The item currently being asked. */
  item: PracticeItem;
  /** Controls display style (diagnose = scaffolded, practice = standard, review = compact). */
  mode?: LearningRenderMode;
  /** Show the visual model for this item (when one is available). */
  showVisual?: boolean;
  /** Optional hint text to display below the prompt. */
  hintText?: string;
  /** Optional color override for the visual model. */
  visualColor?: string;
}

export function QuestionRenderer({
  item,
  mode = 'practice',
  showVisual = false,
  hintText,
  visualColor,
}: Props) {
  const isCompact = mode === 'review';

  return (
    <div style={{ ...s.wrapper, gap: isCompact ? '8px' : '14px' }}>
      {/* Prompt */}
      <div
        style={{
          ...s.prompt,
          fontSize: isCompact ? '28px' : '36px',
        }}
        aria-live="polite"
      >
        {item.prompt}
      </div>

      {/* Visual model — only shown when explicitly requested and a model exists */}
      {showVisual && (
        <div style={s.visualWrap}>
          <VisualModel item={item} color={visualColor} />
        </div>
      )}

      {/* Hint text — shown in diagnose mode or when explicitly provided */}
      {hintText && (
        <div style={s.hint} role="status">
          💡 {hintText}
        </div>
      )}

      {/* Mode badge (diagnose only) */}
      {mode === 'diagnose' && (
        <div style={s.modeBadge} aria-label="Diagnostic question">
          Diagnostic
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  prompt: {
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  visualWrap: {
    maxWidth: '100%',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
  },
  hint: {
    fontSize: '14px',
    color: '#6b7280',
    background: '#fef9c3',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '8px 14px',
    textAlign: 'center',
    maxWidth: '320px',
    lineHeight: 1.4,
  },
  modeBadge: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#7c3aed',
    background: '#ede9fe',
    padding: '3px 10px',
    borderRadius: '20px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
};
