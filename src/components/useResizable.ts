/* ==========================================================================
   useResizable — pointer-driven resizing for the bottom-right size box of a
   Macintosh window. Mirrors useDraggable in shape so the two read alike.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';

export type Size = { w: number; h: number };

const DEFAULT_MIN: Size = { w: 240, h: 160 };

export function useResizable(initial: Size, min: Size = DEFAULT_MIN) {
  const [size, setSize] = useState<Size>(initial);
  const [resizing, setResizing] = useState(false);

  // Pointer + size at grab time, so the drag is anchored to the corner
  const start = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      start.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        w: size.w,
        h: size.h,
      };
      setResizing(true);
    },
    [size.w, size.h],
  );

  useEffect(() => {
    if (!resizing) return;

    // Suppress text-selection on the whole document while we drag the corner —
    // otherwise the browser will start grabbing text in any window we cross.
    document.body.classList.add('no-select');

    const onMove = (e: PointerEvent) => {
      const dw = e.clientX - start.current.mouseX;
      const dh = e.clientY - start.current.mouseY;
      // Clamp to a sensible minimum and the current viewport
      const maxW = window.innerWidth - 16;
      const maxH = window.innerHeight - 16;
      setSize({
        w: Math.min(maxW, Math.max(min.w, start.current.w + dw)),
        h: Math.min(maxH, Math.max(min.h, start.current.h + dh)),
      });
    };
    const onUp = () => setResizing(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('no-select');
    };
  }, [resizing, min.w, min.h]);

  return { size, onResizeStart, resizing };
}
