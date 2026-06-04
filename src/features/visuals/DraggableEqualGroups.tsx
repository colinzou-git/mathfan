/**
 * DraggableEqualGroups — drag-and-drop equal-groups manipulative.
 *
 * Shows N objects that the student can drag into G group containers.
 * The component can check whether all groups have equal numbers of objects.
 *
 * Touch-friendly for iPad. Keyboard accessible via @dnd-kit accessibility utilities.
 * This is a standalone component — not yet wired into the main practice flow.
 */

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraggableObject {
  id: string;
  /** Which group the object currently lives in (null = tray). */
  groupId: string | null;
}

interface Props {
  /** Total number of objects to distribute. */
  totalObjects: number;
  /** Number of group containers. */
  groupCount: number;
  /** Object emoji to display (defaults to a colored circle). */
  objectEmoji?: string;
  /** Called whenever the student changes the distribution. */
  onChange?: (groups: number[]) => void;
}

// ── Draggable object ──────────────────────────────────────────────────────────

function DraggableObject({ id, emoji }: { id: string; emoji: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        fontSize: '24px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none',
        userSelect: 'none',
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
        zIndex: isDragging ? 100 : 'auto',
        position: isDragging ? 'relative' : 'static',
        display: 'inline-block',
        margin: '4px',
        lineHeight: 1,
      }}
      aria-label="Draggable object"
    >
      {emoji}
    </div>
  );
}

// ── Drop zone (group container or tray) ───────────────────────────────────────

function DropZone({
  id,
  label,
  children,
  highlight,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      aria-label={label}
      style={{
        border: `2.5px ${isOver ? 'solid' : 'dashed'} ${isOver ? '#4f46e5' : highlight ? '#7c3aed' : '#d1d5db'}`,
        borderRadius: '12px',
        padding: '10px',
        minWidth: '70px',
        minHeight: '60px',
        background: isOver ? '#ede9fe' : '#f9fafb',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        alignContent: 'flex-start',
        gap: '2px',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ width: '100%', fontSize: '11px', fontWeight: '700', color: '#9ca3af', marginBottom: '4px' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Returns whether all groups have equal count AND every object has been placed.
 */
function checkEqualGroups(objects: DraggableObject[], groupCount: number): boolean {
  const totalInGroups = objects.filter(o => o.groupId !== null).length;
  if (totalInGroups !== objects.length) return false; // not all placed

  const counts = Array.from({ length: groupCount }, (_, i) =>
    objects.filter(o => o.groupId === `group-${i}`).length
  );
  const first = counts[0] ?? 0;
  return counts.every(c => c === first) && first > 0;
}

export function DraggableEqualGroups({
  totalObjects,
  groupCount,
  objectEmoji = '🟣',
  onChange,
}: Props) {
  const n = Math.max(1, Math.min(Math.floor(totalObjects), 24));
  const g = Math.max(1, Math.min(Math.floor(groupCount), 8));

  const [objects, setObjects] = useState<DraggableObject[]>(() =>
    Array.from({ length: n }, (_, i) => ({ id: `obj-${i}`, groupId: null }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const objId = String(active.id);
    const targetId = String(over.id); // 'tray' or 'group-N'

    setObjects(prev => {
      const updated = prev.map(o =>
        o.id === objId
          ? { ...o, groupId: targetId === 'tray' ? null : targetId }
          : o
      );
      if (onChange) {
        const counts = Array.from({ length: g }, (_, i) =>
          updated.filter(o => o.groupId === `group-${i}`).length
        );
        onChange(counts);
      }
      return updated;
    });
  };

  const groupIds = Array.from({ length: g }, (_, i) => `group-${i}`);
  const isEqual = checkEqualGroups(objects, g);
  const allPlaced = objects.every(o => o.groupId !== null);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '480px' }}>
        {/* Groups */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {groupIds.map((gId, idx) => {
            const inGroup = objects.filter(o => o.groupId === gId);
            return (
              <DropZone key={gId} id={gId} label={`Group ${idx + 1}`} highlight>
                {inGroup.map(o => (
                  <DraggableObject key={o.id} id={o.id} emoji={objectEmoji} />
                ))}
              </DropZone>
            );
          })}
        </div>

        {/* Tray */}
        <DropZone id="tray" label="Objects to place">
          {objects
            .filter(o => o.groupId === null)
            .map(o => (
              <DraggableObject key={o.id} id={o.id} emoji={objectEmoji} />
            ))}
        </DropZone>

        {/* Feedback */}
        <div style={{ marginTop: '14px', textAlign: 'center', minHeight: '28px' }}>
          {allPlaced && isEqual && (
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#15803d' }}>
              ✓ All groups are equal!
            </div>
          )}
          {allPlaced && !isEqual && (
            <div style={{ fontSize: '14px', color: '#b45309' }}>
              The groups are not equal yet. Try again!
            </div>
          )}
          {!allPlaced && objects.filter(o => o.groupId === null).length > 0 && (
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>
              Drag the objects into the groups.
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
}

// Note: checkEqualGroups is not exported here to comply with fast-refresh rules.
// It is re-exported from equalGroupsUtils.ts for testing.
