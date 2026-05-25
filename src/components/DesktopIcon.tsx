/* ==========================================================================
   DesktopIcon — a selectable / double-clickable icon on the System 1 desktop.
   Single click selects (art + label invert); double click opens the window.
   ========================================================================== */

type DesktopIconProps = {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  style?: React.CSSProperties;
};

export default function DesktopIcon({
  label,
  icon,
  selected,
  onSelect,
  onOpen,
  style,
}: DesktopIconProps) {
  return (
    <div
      className={`desktop-icon${selected ? ' selected' : ''}`}
      style={{ position: 'absolute', ...style }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      role="button"
      aria-label={label}
    >
      <div className="icon-art">{icon}</div>
      <div className="icon-label">{label}</div>
    </div>
  );
}
