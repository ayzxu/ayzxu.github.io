/* DesktopIcon — a selectable, draggable, double-clickable desktop icon.
   It is also a real keyboard control: Tab reaches it, focus selects it the
   way a click would, and Enter or Space opens it like a double-click. */

import type { DesktopIconId } from '../lib/iconLayout';

type DesktopIconProps = {
  id: DesktopIconId;
  label: string;
  icon: React.ReactNode;
  x: number;
  y: number;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (id: DesktopIconId, e: React.PointerEvent) => void;
  onPointerMove: (id: DesktopIconId, e: React.PointerEvent) => void;
  onPointerUp: (id: DesktopIconId, e: React.PointerEvent) => void;
  onKeyboardSelect: (id: DesktopIconId) => void;
  onOpen: (id: DesktopIconId) => void;
};

export default function DesktopIcon({
  id,
  label,
  icon,
  x,
  y,
  selected,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyboardSelect,
  onOpen,
}: DesktopIconProps) {
  return (
    <div
      className={`desktop-icon${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
      style={{ left: x, top: y }}
      onPointerDown={(e) => onPointerDown(id, e)}
      onPointerMove={(e) => onPointerMove(id, e)}
      onPointerUp={(e) => onPointerUp(id, e)}
      // Only keyboard focus selects: a mouse press also focuses the icon, and
      // selecting there would collapse a marquee selection before a group drag.
      onFocus={(e) => {
        if (e.currentTarget.matches(':focus-visible')) onKeyboardSelect(id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(id);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <div className="icon-art">{icon}</div>
      <div className="icon-label">{label}</div>
    </div>
  );
}
