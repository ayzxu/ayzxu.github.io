/* ==========================================================================
   MacWindow — a draggable, closable System 1 window shell.
   Wraps any content in the classic chrome: striped title bar, close box and an
   internally scrolling body. Position is owned here via useDraggable; z-order,
   focus and lifecycle are owned by the Desktop.
   ========================================================================== */

import { useDraggable, type Point } from './useDraggable';

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

  return (
    <div
      className="mac-window"
      style={{ left: pos.x, top: pos.y, width, height, zIndex: z }}
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
        <div style={{ width: 12, flexShrink: 0 }} />
      </div>

      <div className="window-body mac-scroll">{children}</div>
    </div>
  );
}
