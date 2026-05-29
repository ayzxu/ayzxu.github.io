/* ==========================================================================
   useResizable — pointer-driven resizing for the bottom-right size box of a
   Macintosh window. Mirrors useDraggable in shape so the two read alike.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';

export type Size = { w: number; h: number };

const DEFAULT_MIN: Size = { w: 240, h: 160 };

function clampSize(size: Size, min: Size, max: Size): Size {
  return {
    w: Math.min(max.w, Math.max(min.w, size.w)),
    h: Math.min(max.h, Math.max(min.h, size.h)),
  };
}

export function useResizable(
  initial: Size,
  maxSize: Size,
  min: Size = DEFAULT_MIN,
) {
  const [size, setSize] = useState<Size>(() =>
    clampSize(initial, min, maxSize),
  );
  const [resizing, setResizing] = useState(false);

  // Pointer + size at grab time, so the drag is anchored to the corner
  const start = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 });

  // Shrink (or grow max) when the viewport changes — never expand past new max
  useEffect(() => {
    setSize((s) => clampSize(s, min, maxSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- w/h fields only
  }, [maxSize.w, maxSize.h, min.w, min.h]);

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

    document.body.classList.add('no-select');

    const onMove = (e: PointerEvent) => {
      const dw = e.clientX - start.current.mouseX;
      const dh = e.clientY - start.current.mouseY;
      setSize(
        clampSize(
          {
            w: start.current.w + dw,
            h: start.current.h + dh,
          },
          min,
          maxSize,
        ),
      );
    };
    const onUp = () => setResizing(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('no-select');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- w/h fields only
  }, [resizing, min.w, min.h, maxSize.w, maxSize.h]);

  return { size, onResizeStart, resizing };
}
