/* ==========================================================================
   TrashWindow — the contents of the Trash. A scatter of "discarded" files,
   each a draggable 1-bit icon. Dragging is hard-clamped to the canvas, so an
   item can never escape the can (the folder body has overflow:hidden too).
   ========================================================================== */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { DocumentIcon, FolderIcon } from '../components/PixelIcons';

type TrashItem = {
  id: string;
  label: string;
  note: string;
  kind: 'doc' | 'folder';
};

const TRASH_ITEMS: TrashItem[] = [
  {
    id: 'node_modules',
    label: 'node_modules',
    note: 'the biggest file of all time',
    kind: 'folder',
  },
  {
    id: 'spoilers',
    label: 'spoilers.txt',
    note: 'Blocked by my extensions, my running hit list',
    kind: 'doc',
  },
  {
    id: 'ranked_loss',
    label: 'ranked.log',
    note: 'Brawl Stars losses. The RL bot is handling it now',
    kind: 'doc',
  }
];

const ITEM_W = 104;
const ITEM_H = 108;
const GAP = 10;

type Pos = { x: number; y: number };
type DragState = { id: string; offX: number; offY: number };

/* Keep a point inside the canvas so an item is never partly outside it. */
function clamp(p: Pos, canvasW: number, canvasH: number): Pos {
  return {
    x: Math.max(0, Math.min(p.x, Math.max(0, canvasW - ITEM_W))),
    y: Math.max(0, Math.min(p.y, Math.max(0, canvasH - ITEM_H))),
  };
}

export default function TrashWindow() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  /* `positions` holds each item's *intended* spot. We never overwrite it on
     resize — we only clamp it at render. So shrinking the window tucks icons
     in, and enlarging restores them to exactly where they were dropped. */
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [canvas, setCanvas] = useState<{ w: number; h: number }>({
    w: 0,
    h: 0,
  });

  /* Track the canvas size so render-time clamping always uses live bounds. */
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () =>
      setCanvas({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Lay items out in a grid the first time we know the canvas width. */
  useLayoutEffect(() => {
    if (canvas.w === 0) return;
    setPositions((prev) => {
      if (Object.keys(prev).length === TRASH_ITEMS.length) return prev;
      const cols = Math.max(1, Math.floor((canvas.w + GAP) / (ITEM_W + GAP)));
      const next: Record<string, Pos> = { ...prev };
      TRASH_ITEMS.forEach((it, i) => {
        if (!next[it.id]) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          next[it.id] = {
            x: col * (ITEM_W + GAP),
            y: row * (ITEM_H + GAP),
          };
        }
      });
      return next;
    });
  }, [canvas.w]);

  const onPointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      /* Use the clamped (on-screen) position so the icon doesn't jump if the
         window had been shrunk away from its intended spot. */
      const p = clamp(
        positions[id] ?? { x: 0, y: 0 },
        el.clientWidth,
        el.clientHeight,
      );
      drag.current = {
        id,
        offX: e.clientX - rect.left - p.x,
        offY: e.clientY - rect.top - p.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [positions],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    const el = canvasRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const raw = {
      x: e.clientX - rect.left - d.offX,
      y: e.clientY - rect.top - d.offY,
    };
    setPositions((prev) => ({
      ...prev,
      [d.id]: clamp(raw, el.clientWidth, el.clientHeight),
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div className="trash-root">
      <p className="trash-intro">
        Recently deleted.
      </p>
      <div ref={canvasRef} className="trash-canvas">
        {TRASH_ITEMS.map((it) => {
          const intended = positions[it.id];
          if (!intended) return null;
          /* Clamp only for display — the stored position is left intact so it
             returns to place when the window is enlarged again. */
          const p = clamp(intended, canvas.w, canvas.h);
          return (
            <div
              key={it.id}
              className="trash-item"
              style={{ left: p.x, top: p.y }}
              title={it.note}
              role="button"
              aria-label={`${it.label} — ${it.note}`}
              onPointerDown={(e) => onPointerDown(it.id, e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="icon-art">
                {it.kind === 'folder' ? (
                  <FolderIcon className="w-full h-full" />
                ) : (
                  <DocumentIcon className="w-full h-full" />
                )}
              </div>
              <div className="icon-label">{it.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
