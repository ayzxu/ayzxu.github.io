/* ==========================================================================
   useDraggable — pointer-driven dragging for Macintosh windows.
   Returns a position, a setter, a dragging flag and a pointer-down handler to
   attach to a window's title bar. Movement is clamped so a window can never be
   dragged fully off-screen or up behind the 22px menu bar.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';

export type Point = { x: number; y: number };

export function useDraggable(initial: Point) {
  const [pos, setPos] = useState<Point>(initial);
  const [dragging, setDragging] = useState(false);

  // Offset between the pointer and the window's top-left corner at grab time
  const offset = useRef<Point>({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      setDragging(true);
    },
    [pos.x, pos.y],
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const maxX = window.innerWidth - 64;
      const maxY = window.innerHeight - 40;
      const nextX = Math.min(Math.max(e.clientX - offset.current.x, 0), maxX);
      // 23px keeps the title bar clear of the menu bar
      const nextY = Math.min(Math.max(e.clientY - offset.current.y, 23), maxY);
      setPos({ x: nextX, y: nextY });
    };
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  return { pos, setPos, dragging, onPointerDown };
}
