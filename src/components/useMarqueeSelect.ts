/* ==========================================================================
   useMarqueeSelect — rubber-band selection on the desktop (classic Mac).
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  iconsInMarquee,
  marqueeFromPoints,
  type DesktopIconId,
  type IconPositions,
  type MarqueeRect,
} from '../lib/iconLayout';

const MARQUEE_THRESHOLD = 4;

type UseMarqueeSelectOptions = {
  iconPositions: IconPositions;
  onSelectionChange: (ids: Set<DesktopIconId>) => void;
  /** Disable while icons are being dragged */
  disabled?: boolean;
};

export function useMarqueeSelect({
  iconPositions,
  onSelectionChange,
  disabled = false,
}: UseMarqueeSelectOptions) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [active, setActive] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const started = useRef(false);

  const layerPoint = useCallback((clientX: number, clientY: number) => {
    const el = layerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  const onSurfacePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || e.button !== 0) return;
      if (e.target !== e.currentTarget) return;

      const p = layerPoint(e.clientX, e.clientY);
      start.current = p;
      started.current = false;
      setActive(true);
      setMarquee(null);
      onSelectionChange(new Set());
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [disabled, layerPoint, onSelectionChange],
  );

  useEffect(() => {
    if (!active) return;

    document.body.classList.add('no-select');

    const onMove = (e: PointerEvent) => {
      const s = start.current;
      if (!s) return;
      const p = layerPoint(e.clientX, e.clientY);
      if (
        !started.current &&
        Math.hypot(p.x - s.x, p.y - s.y) < MARQUEE_THRESHOLD
      ) {
        return;
      }
      started.current = true;
      const rect = marqueeFromPoints(s.x, s.y, p.x, p.y);
      setMarquee(rect);
      onSelectionChange(new Set(iconsInMarquee(rect, iconPositions)));
    };

    const onUp = () => {
      start.current = null;
      started.current = false;
      setActive(false);
      setMarquee(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('no-select');
    };
  }, [active, iconPositions, layerPoint, onSelectionChange]);

  return {
    layerRef,
    marquee,
    onSurfacePointerDown,
  };
}
