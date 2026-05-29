/* ==========================================================================
   MacWindow — a draggable, resizable, closable System 1 window shell.
   Wraps any content in the classic chrome: striped title bar, close box,
   bottom-right size box and an internally scrolling body. Position is owned
   here via useDraggable; size via useResizable; z-order, focus and lifecycle
   are owned by the Desktop.
   ========================================================================== */

import { useDraggable, type Point } from './useDraggable';
import { useResizable } from './useResizable';

type MacWindowProps = {
  title: string;
  initial: Point;
  width: number;
  height: number;
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
  z,
  active,
  onClose,
  onFocus,
  children,
}: MacWindowProps) {
  const { pos, onPointerDown } = useDraggable(initial);
  const { size, onResizeStart } = useResizable({ w: width, h: height });

  return (
    <div
      className="mac-window"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, zIndex: z }}
      onPointerDown={onFocus}
    >
      <div
        className={`title-bar${active ? ' active' : ''}`}
        onPointerDown={onPointerDown}
      >
        {/* Close box — stopPropagation so closing never starts a drag */}
        <div
          className="close-box"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          role="button"
          aria-label={`Close ${title}`}
        />
        <div className="title-bar-text">
          <span>{title}</span>
        </div>
        {/* Spacer balances the close box so the title stays centred */}
        <div style={{ width: 15, flexShrink: 0 }} />
      </div>

      <div className="window-body mac-scroll">{children}</div>

      {/* Size box — drag the bottom-right corner to resize */}
      <div
        className="resize-handle"
        onPointerDown={onResizeStart}
        role="button"
        aria-label="Resize window"
      />
    </div>
  );
}
