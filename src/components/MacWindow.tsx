/* ==========================================================================
   MacWindow — a draggable, resizable, closable System 1 window shell.
   Wraps any content in the classic chrome: striped title bar, close box,
   bottom-right size box and an internally scrolling body. Position and size
   are owned together by useWindowGeometry so the window can be resized from
   any edge or corner; z-order, focus and lifecycle are owned by the Desktop.
   ========================================================================== */

import { useWindowGeometry, type Point } from './useWindowGeometry';
import type { Size, Viewport } from '../lib/windowBounds';

type MacWindowProps = {
  title: string;
  initial: Point;
  width: number;
  height: number;
  maxSize: Size;
  viewport: Viewport;
  z: number;
  active: boolean;
  onClose: () => void;
  onFocus: () => void;
  children: React.ReactNode;
};

export default function MacWindow({
  title,
  initial,
  width,
  height,
  maxSize,
  viewport,
  z,
  active,
  onClose,
  onFocus,
  children,
}: MacWindowProps) {
  const { pos, size, onDragStart, onResizeStart } = useWindowGeometry(
    initial,
    { w: width, h: height },
    maxSize,
    viewport,
  );

  return (
    <div
      className="mac-window"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: z }}
      onPointerDown={onFocus}
    >
      <div
        className={`title-bar${active ? ' active' : ''}`}
        onPointerDown={onDragStart}
      >
        <button
          type="button"
          className="close-box"
          aria-label={`Close ${title}`}
          // A real <button> fires `click` reliably on tap across every mobile
          // browser (unlike a <div>, and unlike pointer-capture which iOS Safari
          // drops for touch). The button itself is a generously sized, invisible
          // tap target; the small classic close box is the inner glyph — so it's
          // easy to hit without changing the look. stopPropagation on pointer/
          // mouse down keeps the title-bar drag + focus from kicking in.
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <span className="close-box-glyph" />
        </button>
        <div className="title-bar-text">
          <span>{title}</span>
        </div>
        <div style={{ width: 15, flexShrink: 0 }} />
      </div>

      <div className="window-body mac-scroll">{children}</div>

      {/* Resize zones: four edges + four corners. The bottom-right keeps the
          classic visible "size box"; the rest are invisible grab strips. */}
      <div className="resize-edge resize-n" onPointerDown={onResizeStart('n')} />
      <div className="resize-edge resize-s" onPointerDown={onResizeStart('s')} />
      <div className="resize-edge resize-e" onPointerDown={onResizeStart('e')} />
      <div className="resize-edge resize-w" onPointerDown={onResizeStart('w')} />
      <div className="resize-corner resize-ne" onPointerDown={onResizeStart('ne')} />
      <div className="resize-corner resize-nw" onPointerDown={onResizeStart('nw')} />
      <div className="resize-corner resize-sw" onPointerDown={onResizeStart('sw')} />
      <div
        className="resize-handle"
        onPointerDown={onResizeStart('se')}
        role="button"
        aria-label="Resize window"
      />
    </div>
  );
}
