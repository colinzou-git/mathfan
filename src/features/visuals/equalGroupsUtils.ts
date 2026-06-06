/**
 * Utilities for equal-groups drag-and-drop logic.
 * Kept in a separate file (no React components) to comply with fast-refresh rules.
 */

interface DraggableObject {
  id: string;
  groupId: string | null;
}

/**
 * Returns true when every object has been placed AND all groups have the same count > 0.
 */
export function checkEqualGroups(objects: DraggableObject[], groupCount: number): boolean {
  const totalInGroups = objects.filter(o => o.groupId !== null).length;
  if (totalInGroups !== objects.length) return false; // not all placed

  const counts = Array.from({ length: groupCount }, (_, i) =>
    objects.filter(o => o.groupId === `group-${i}`).length
  );
  const first = counts[0] ?? 0;
  return counts.every(c => c === first) && first > 0;
}
