/* ==========================================================================
   useWindowGeometry — unified pointer-driven move + resize for a System 1
   window. Owns BOTH position and size in one place so an edge or corner
   resize can pin the opposite edge: dragging the top or left edge grows the
   window while sliding its origin, exactly like the real Finder. Movement and
   resizing are clamped to the viewport and kept below the menu bar.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampWindowPosition,
  MENU_TOP,
  type Point,
  type Size,
  type Viewport,
} from '../lib/windowBounds';

export type { Point };

/** Resize directions: edges (n/s/e/w) and corners (combinations). */
export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const DEFAULT_MIN: Size = { w: 240, h: 160 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clampSize(size: Size, min: Size, max: Size): Size {
  return {
    w: clamp(size.w, min.w, max.w),
    h: clamp(size.h, min.h, max.h),
  };
}

export function useWindowGeometry(
  initialPos: Point,
  initialSize: Size,
  maxSize: Size,
  viewport: Viewport,
  min: Size = DEFAULT_MIN,
) {
  const [size, setSize] = useState<Size>(() =>
    clampSize(initialSize, min, maxSize),
  );
  const [pos, setPos] = useState<Point>(() =>
    clampWindowPosition(initialPos, clampSize(initialSize, min, maxSize), viewport),
  );
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  // Pointer-down anchors, captured at grab time.
  const dragOffset = useRef<Point>({ x: 0, y: 0 });
  const resizeStart = useRef({
    mouseX: 0,
    mouseY: 0,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    dir: 'se' as ResizeDir,
  });

  // Re-clamp to a changed viewport / max — but never while interacting.
  useEffect(() => {
    if (dragging || resizing) return;
    setSize((s) => clampSize(s, min, maxSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- w/h fields only
  }, [maxSize.w, maxSize.h, min.w, min.h, dragging, resizing]);

  useEffect(() => {
    if (dragging || resizing) return;
    setPos((p) => clampWindowPosition(p, size, viewport));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- w/h fields only
  }, [viewport.w, viewport.h, size.w, size.h, dragging, resizing]);

  /* --- Move (title-bar drag) ------------------------------------------- */
  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      setDragging(true);
    },
    [pos.x, pos.y],
  );

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add('no-select');

    const onMove = (e: PointerEvent) => {
      setPos(
        clampWindowPosition(
          {
            x: e.clientX - dragOffset.current.x,
            y: e.clientY - dragOffset.current.y,
          },
          size,
          viewport,
        ),
      );
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
  }, [dragging, size.w, size.h, viewport.w, viewport.h]);

  /* --- Resize (edges + corners) ---------------------------------------- */
  const onResizeStart = useCallback(
    (dir: ResizeDir) => (e: React.PointerEvent) => {
      resizeStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: pos.x,
        y: pos.y,
        w: size.w,
        h: size.h,
        dir,
      };
      setResizing(true);
    },
    [pos.x, pos.y, size.w, size.h],
  );

  useEffect(() => {
    if (!resizing) return;
    document.body.classList.add('no-select');

    const onMove = (e: PointerEvent) => {
      const s = resizeStart.current;
      const dx = e.clientX - s.mouseX;
      const dy = e.clientY - s.mouseY;
      let { x, y, w, h } = { x: s.x, y: s.y, w: s.w, h: s.h };

      // East / South grow toward the bottom-right; cap at the viewport edge.
      if (s.dir.includes('e')) {
        w = clamp(s.w + dx, min.w, Math.min(maxSize.w, viewport.w - s.x));
      }
      if (s.dir.includes('s')) {
        h = clamp(s.h + dy, min.h, Math.min(maxSize.h, viewport.h - s.y));
      }
      // West / North pin the opposite edge, so the origin slides as they grow.
      if (s.dir.includes('w')) {
        const right = s.x + s.w;
        x = clamp(s.x + dx, Math.max(0, right - maxSize.w), right - min.w);
        w = right - x;
      }
      if (s.dir.includes('n')) {
        const bottom = s.y + s.h;
        y = clamp(s.y + dy, Math.max(MENU_TOP, bottom - maxSize.h), bottom - min.h);
        h = bottom - y;
      }

      setSize({ w, h });
      setPos({ x, y });
    };
    const onUp = () => setResizing(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('no-select');
    };
  }, [resizing, min.w, min.h, maxSize.w, maxSize.h, viewport.w, viewport.h]);

  return { pos, size, dragging, resizing, onDragStart, onResizeStart };
}
