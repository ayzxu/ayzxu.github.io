/* ==========================================================================
   useIconDrag — pointer drag for desktop icons with click / double-click.
   Supports moving every icon in the current selection together.
   ========================================================================== */

import { useCallback, useRef, useState } from 'react';
import { MENU_TOP, type Viewport } from '../lib/windowBounds';
import {
  clampIconPosition,
  findIconDropTarget,
  type DesktopIconId,
  type IconPositions,
} from '../lib/iconLayout';

const DRAG_THRESHOLD = 5;

type DragState = {
  anchorId: DesktopIconId;
  /** Icons moving together */
  ids: DesktopIconId[];
  origins: IconPositions;
  anchorOffsetX: number;
  anchorOffsetY: number;
  moved: boolean;
};

type UseIconDragOptions = {
  positions: IconPositions;
  setPositions: React.Dispatch<React.SetStateAction<IconPositions>>;
  viewport: Viewport;
  selectedIcons: Set<DesktopIconId>;
  onSelectSingle: (id: DesktopIconId) => void;
  onOpen: (id: DesktopIconId) => void;
  onDropOnTarget: () => void;
};

export function useIconDrag({
  positions,
  setPositions,
  viewport,
  selectedIcons,
  onSelectSingle,
  onOpen,
  onDropOnTarget,
}: UseIconDragOptions) {
  const [draggingIds, setDraggingIds] = useState<Set<DesktopIconId>>(
    () => new Set(),
  );
  const drag = useRef<DragState | null>(null);
  const lastClick = useRef<{ id: DesktopIconId; time: number } | null>(null);

  const onIconPointerDown = useCallback(
    (id: DesktopIconId, e: React.PointerEvent) => {
      e.stopPropagation();
      const pos = positions[id];

      const ids =
        selectedIcons.has(id) && selectedIcons.size > 1
          ? [...selectedIcons]
          : [id];

      if (ids.length === 1) {
        onSelectSingle(id);
      }

      const origins = {} as IconPositions;
      for (const dragId of ids) {
        origins[dragId] = { ...positions[dragId] };
      }

      drag.current = {
        anchorId: id,
        ids,
        origins,
        anchorOffsetX: e.clientX - pos.x,
        anchorOffsetY: e.clientY - MENU_TOP - pos.y,
        moved: false,
      };
      setDraggingIds(new Set(ids));
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [positions, selectedIcons, onSelectSingle],
  );

  const onIconPointerMove = useCallback(
    (id: DesktopIconId, e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.anchorId !== id) return;

      const nx = e.clientX - d.anchorOffsetX;
      const ny = e.clientY - MENU_TOP - d.anchorOffsetY;
      const dx = nx - d.origins[id].x;
      const dy = ny - d.origins[id].y;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      d.moved = true;
      setPositions((prev) => {
        const next = { ...prev };
        for (const dragId of d.ids) {
          const origin = d.origins[dragId];
          next[dragId] = clampIconPosition(
            { x: origin.x + dx, y: origin.y + dy },
            viewport,
          );
        }
        return next;
      });
    },
    [setPositions, viewport],
  );

  const onIconPointerUp = useCallback(
    (id: DesktopIconId, e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || d.anchorId !== id) return;

      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

      if (d.moved) {
        const anchorPos = positions[id];
        const targetId = findIconDropTarget(id, anchorPos, positions);
        if (targetId) {
          setPositions((prev) => ({ ...prev, ...d.origins }));
          onDropOnTarget();
        }
      } else {
        const now = Date.now();
        const prev = lastClick.current;
        if (prev && prev.id === id && now - prev.time < 400) {
          lastClick.current = null;
          onOpen(id);
        } else {
          lastClick.current = { id, time: now };
        }
      }

      drag.current = null;
      setDraggingIds(new Set());
    },
    [positions, setPositions, onOpen, onDropOnTarget],
  );

  return {
    draggingIds,
    onIconPointerDown,
    onIconPointerMove,
    onIconPointerUp,
  };
}
