/**
 * EqualGroupsModel — shows G groups, each containing N objects.
 *
 * Touch-friendly for iPad. No drag-and-drop in this phase.
 */

interface Props {
  groups: number;
  itemsPerGroup: number;
  /** Object emoji or character to display (defaults to a filled circle). */
  objectChar?: string;
  /** Color for the group container border. */
  groupColor?: string;
  /** Accessible label override. */
  ariaLabel?: string;
  /** When false (default), omit the computed total from aria-label to avoid answer leakage. */
  revealAnswer?: boolean;
}

const DEFAULT_GROUP_COLOR = '#7c3aed';

export function EqualGroupsModel({
  groups,
  itemsPerGroup,
  objectChar = '●',
  groupColor = DEFAULT_GROUP_COLOR,
  ariaLabel,
  revealAnswer = false,
}: Props) {
  const g = Math.max(1, Math.min(Math.floor(groups), 12));
  const n = Math.max(1, Math.min(Math.floor(itemsPerGroup), 12));
  const total = g * n;

  const label = ariaLabel ?? (
    revealAnswer
      ? `${g} equal groups with ${n} object${n !== 1 ? 's' : ''} in each group, ${total} total`
      : `${g} equal groups with ${n} object${n !== 1 ? 's' : ''} in each group`
  );

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '12px',
        justifyContent: 'flex-start',
      }}
    >
      {Array.from({ length: g }, (_, gi) => (
        <div
          key={gi}
          style={{
            border: `2.5px solid ${groupColor}`,
            borderRadius: '12px',
            padding: '8px',
            minWidth: '48px',
            background: groupColor + '12',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            alignContent: 'flex-start',
            justifyContent: 'center',
          }}
          aria-hidden="true"
        >
          {Array.from({ length: n }, (_, oi) => (
            <span
              key={oi}
              style={{
                fontSize: '18px',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              {objectChar}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
