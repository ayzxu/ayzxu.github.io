/* ==========================================================================
   DesktopIcon — a selectable, draggable, double-clickable desktop icon.
   ========================================================================== */

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
}: DesktopIconProps) {
  return (
    <div
      className={`desktop-icon${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
      style={{ left: x, top: y }}
      onPointerDown={(e) => onPointerDown(id, e)}
      onPointerMove={(e) => onPointerMove(id, e)}
      onPointerUp={(e) => onPointerUp(id, e)}
      role="button"
      aria-label={label}
    >
      <div className="icon-art">{icon}</div>
      <div className="icon-label">{label}</div>
    </div>
  );
}
