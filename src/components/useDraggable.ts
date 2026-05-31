/* ==========================================================================
   useDraggable — pointer-driven dragging for Macintosh windows.
   Returns a position, a setter, a dragging flag and a pointer-down handler to
   attach to a window's title bar. Movement is clamped so a window can never be
   dragged fully off-screen or up behind the menu bar.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampWindowPosition,
  type Point,
  type Size,
  type Viewport,
} from '../lib/windowBounds';

export type { Point };

export function useDraggable(
  initial: Point,
  windowSize: Size,
  viewport: Viewport,
) {
  const [pos, setPos] = useState<Point>(() =>
    clampWindowPosition(initial, windowSize, viewport),
  );
  const [dragging, setDragging] = useState(false);

  const offset = useRef<Point>({ x: 0, y: 0 });

  // Re-clamp when the viewport or window size changes (not while dragging)
  useEffect(() => {
    if (dragging) return;
    setPos((p) => clampWindowPosition(p, windowSize, viewport));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- w/h fields only
  }, [viewport.w, viewport.h, windowSize.w, windowSize.h, dragging]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      setDragging(true);
    },
    [pos.x, pos.y],
  );

  useEffect(() => {
    if (!dragging) return;

    document.body.classList.add('no-select');

    const onMove = (e: PointerEvent) => {
      const next = clampWindowPosition(
        {
          x: e.clientX - offset.current.x,
          y: e.clientY - offset.current.y,
        },
        windowSize,
        viewport,
      );
      setPos(next);
    };
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('no-select');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- w/h fields only
  }, [dragging, windowSize.w, windowSize.h, viewport.w, viewport.h]);

  return { pos, setPos, dragging, onPointerDown };
}
