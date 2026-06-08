/* ==========================================================================
   PixelIcons — hand-drawn 1-bit SVG artwork for the System 1 desktop.
   Every icon is pure black & white with crisp (un-antialiased) edges so it
   reads as authentic Macintosh pixel art at any scale.
   ========================================================================== */

type IconProps = { className?: string };

/* Read Me document — a page with a folded corner and text lines */
export function DocumentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      <path
        d="M7 2 H21 L26 7 V30 H7 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      <path d="M21 2 V7 H26" fill="none" stroke="#000000" strokeWidth="2" />
      <g stroke="#000000" strokeWidth="2">
        <line x1="11" y1="13" x2="22" y2="13" />
        <line x1="11" y1="17" x2="22" y2="17" />
        <line x1="11" y1="21" x2="22" y2="21" />
        <line x1="11" y1="25" x2="18" y2="25" />
      </g>
    </svg>
  );
}

/* Classic Macintosh folder */
export function FolderIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      <path
        d="M3 9 H12 L15 12 H29 V27 H3 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      <line
        x1="3"
        y1="14"
        x2="29"
        y2="14"
        stroke="#000000"
        strokeWidth="2"
      />
    </svg>
  );
}

/* Trash can — appears on every desktop */
export function TrashIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* lid */}
      <rect x="7" y="6" width="18" height="3" fill="#000000" />
      <rect x="13" y="3" width="6" height="3" fill="#000000" />
      {/* body */}
      <path
        d="M9 10 H23 L21 30 H11 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      <g stroke="#000000" strokeWidth="2">
        <line x1="13" y1="13" x2="13" y2="27" />
        <line x1="16" y1="13" x2="16" y2="27" />
        <line x1="19" y1="13" x2="19" y2="27" />
      </g>
    </svg>
  );
}

/* Chess knight on a base — the Andy Chess Bot icon */
export function ChessIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* knight head & neck silhouette */}
      <path
        d="M12 28
           V20
           C12 14 14 12 16 10
           L14 7
           L17 5
           L19 8
           C23 10 24 14 24 20
           V28 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* eye */}
      <rect x="18" y="11" width="2" height="2" fill="#000000" />
      {/* mane line */}
      <line x1="16" y1="11" x2="14" y2="18" stroke="#000000" strokeWidth="2" />
      {/* base */}
      <rect
        x="9"
        y="28"
        width="18"
        height="2"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
    </svg>
  );
}

/* The classic "Happy Mac" shown on the boot screen */
export function HappyMac({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 56" className={className} shapeRendering="crispEdges">
      {/* chassis */}
      <rect
        x="4"
        y="2"
        width="40"
        height="52"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* screen recess */}
      <rect
        x="9"
        y="7"
        width="30"
        height="24"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* smiling face */}
      <rect x="15" y="14" width="3" height="5" fill="#000000" />
      <rect x="30" y="14" width="3" height="5" fill="#000000" />
      <path
        d="M15 23 Q24 29 33 23"
        fill="none"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* drive slot + base detail */}
      <rect x="13" y="38" width="22" height="3" fill="#000000" />
      <rect x="13" y="45" width="10" height="3" fill="#000000" />
    </svg>
  );
}

/* Solid 1-bit Apple — used in the menu bar */
export function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* leaf */}
      <path d="M17 3 Q22 3 21 9 Q16 9 17 3 Z" fill="#000000" />
      {/* body with a bite taken from the right */}
      <path
        d="M16 9
           C10 7 4 11 5 19
           C6 27 11 30 14 28
           C15 27 17 27 18 28
           C21 30 26 27 27 19
           C28 12 23 8 18 10
           C20 12 21 15 19 16
           C16 17 14 13 16 9 Z"
        fill="#000000"
      />
    </svg>
  );
}
