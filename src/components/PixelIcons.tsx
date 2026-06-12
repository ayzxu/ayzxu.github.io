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

/* MacTerminal — a tiny CRT with a prompt and cursor block */
export function TerminalIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      <rect
        x="3"
        y="5"
        width="26"
        height="20"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      <rect x="6" y="8" width="20" height="14" fill="#000000" />
      {/* prompt chevron */}
      <path
        d="M9 11 L13 14 L9 17"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
      />
      {/* cursor block */}
      <rect x="15" y="15" width="5" height="3" fill="#ffffff" />
      {/* stand */}
      <rect x="12" y="25" width="8" height="2" fill="#000000" />
      <rect x="9" y="27" width="14" height="2" fill="#000000" />
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

/* Paint brush over a canvas — the Paint app icon */
export function PaintIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* canvas */}
      <rect
        x="3"
        y="8"
        width="22"
        height="20"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* painted squiggle */}
      <path
        d="M6 22 Q10 14 14 19 Q18 24 21 16"
        fill="none"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* brush handle + tip, angled over the corner */}
      <path d="M21 11 L27 3 L30 6 L24 13 Z" fill="#000000" />
      <path d="M19 16 L21 11 L24 13 Z" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
    </svg>
  );
}

/* Pocket calculator — the Calculator desk accessory icon */
export function CalcIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* body */}
      <rect
        x="7"
        y="2"
        width="18"
        height="28"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* display */}
      <rect
        x="10"
        y="5"
        width="12"
        height="5"
        fill="#000000"
      />
      {/* keys — 3×4 grid */}
      <g fill="#000000">
        <rect x="10" y="13" width="3" height="3" />
        <rect x="15" y="13" width="3" height="3" />
        <rect x="20" y="13" width="2" height="3" />
        <rect x="10" y="18" width="3" height="3" />
        <rect x="15" y="18" width="3" height="3" />
        <rect x="20" y="18" width="2" height="3" />
        <rect x="10" y="23" width="3" height="3" />
        <rect x="15" y="23" width="3" height="3" />
        <rect x="20" y="23" width="2" height="3" />
      </g>
    </svg>
  );
}

/* Lined page with a fountain-pen nib — the AndyWrite icon */
export function AndyWriteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* page */}
      <rect
        x="5"
        y="2"
        width="20"
        height="28"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* text lines */}
      <g fill="#000000">
        <rect x="9" y="7" width="12" height="2" />
        <rect x="9" y="11" width="12" height="2" />
        <rect x="9" y="15" width="8" height="2" />
      </g>
      {/* nib writing across the lower page */}
      <path d="M28 14 L31 17 L21 27 L17 28 L18 24 Z" fill="#000000" />
      <path d="M18 24 L20 26 L17 28 Z" fill="#ffffff" />
    </svg>
  );
}

/* Beamed eighth notes — the AndyMusic icon */
export function MusicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* beam — outlined parallelogram, slanting up to the right */}
      <path
        d="M12 7 L27 4 L27 9 L12 12 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* stems */}
      <line x1="13" y1="11" x2="13" y2="24" stroke="#000000" strokeWidth="2.5" />
      <line x1="26" y1="8.5" x2="26" y2="21" stroke="#000000" strokeWidth="2.5" />
      {/* open note heads */}
      <circle cx="9.5" cy="24" r="4" fill="#ffffff" stroke="#000000" strokeWidth="2.5" />
      <circle cx="22.5" cy="21" r="4" fill="#ffffff" stroke="#000000" strokeWidth="2.5" />
    </svg>
  );
}

/* 4×4 tile frame with one missing corner — the Puzzle icon */
export function PuzzleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* frame */}
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* grid lines */}
      <g stroke="#000000" strokeWidth="1.5">
        <line x1="10" y1="4" x2="10" y2="28" />
        <line x1="16" y1="4" x2="16" y2="28" />
        <line x1="22" y1="4" x2="22" y2="22" />
        <line x1="4" y1="10" x2="28" y2="10" />
        <line x1="4" y1="16" x2="28" y2="16" />
        <line x1="4" y1="22" x2="28" y2="22" />
      </g>
      {/* the gap: bottom-right cell filled black */}
      <rect x="23" y="23" width="5" height="5" fill="#000000" />
    </svg>
  );
}

/* Loving cup on a plinth — the Achievements icon */
export function TrophyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* cup bowl */}
      <path
        d="M9 4 H23 V12 Q23 18 16 18 Q9 18 9 12 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* handles */}
      <path
        d="M9 6 H4 Q4 13 9 13"
        fill="none"
        stroke="#000000"
        strokeWidth="2"
      />
      <path
        d="M23 6 H28 Q28 13 23 13"
        fill="none"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* star on the bowl */}
      <rect x="15" y="8" width="2" height="2" fill="#000000" />
      <rect x="13" y="10" width="6" height="2" fill="#000000" />
      {/* stem + base */}
      <rect x="14" y="18" width="4" height="5" fill="#000000" />
      <rect x="9" y="23" width="14" height="3" fill="#ffffff" stroke="#000000" strokeWidth="2" />
      <rect x="7" y="27" width="18" height="3" fill="#000000" />
    </svg>
  );
}

/* Round bomb with a fuse — the Minesweeper icon */
export function MineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* spikes */}
      <g stroke="#000000" strokeWidth="2">
        <line x1="16" y1="6" x2="16" y2="28" />
        <line x1="5" y1="17" x2="27" y2="17" />
        <line x1="8" y1="9" x2="24" y2="25" />
        <line x1="24" y1="9" x2="8" y2="25" />
      </g>
      {/* body */}
      <circle cx="16" cy="17" r="8" fill="#000000" />
      {/* glint */}
      <rect x="13" y="14" width="3" height="3" fill="#ffffff" />
      {/* fuse */}
      <path d="M20 9 Q24 5 28 7" fill="none" stroke="#000000" strokeWidth="2" />
    </svg>
  );
}

/* Coiled snake — the Snake icon */
export function SnakeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* blocky snake path, drawn as the classic grid segments */}
      <g fill="#000000">
        <rect x="4" y="22" width="16" height="4" />
        <rect x="16" y="14" width="4" height="12" />
        <rect x="8" y="14" width="12" height="4" />
        <rect x="8" y="6" width="4" height="12" />
        <rect x="8" y="6" width="14" height="4" />
      </g>
      {/* head + eye */}
      <rect x="22" y="4" width="6" height="8" fill="#000000" />
      <rect x="25" y="6" width="2" height="2" fill="#ffffff" />
      {/* apple */}
      <rect x="26" y="24" width="4" height="4" fill="#000000" />
      <rect x="27" y="22" width="2" height="2" fill="#000000" />
    </svg>
  );
}

/* Newspaper — the News reader icon */
export function NewsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* folded paper */}
      <path
        d="M4 5 H24 V27 H4 Z"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* rolled right edge */}
      <path
        d="M24 9 H28 V25 Q28 27 26 27 H24"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* masthead */}
      <rect x="7" y="8" width="14" height="3" fill="#000000" />
      {/* photo block + column lines */}
      <rect
        x="7"
        y="14"
        width="6"
        height="6"
        fill="#ffffff"
        stroke="#000000"
        strokeWidth="2"
      />
      <g stroke="#000000" strokeWidth="2">
        <line x1="16" y1="15" x2="21" y2="15" />
        <line x1="16" y1="19" x2="21" y2="19" />
        <line x1="7" y1="23" x2="21" y2="23" />
      </g>
    </svg>
  );
}

/* Speaker (sound on) — used by the menu-bar SFX toggle */
export function SpeakerOnIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* speaker body + cone */}
      <path d="M4 12 H10 L17 5 V27 L10 20 H4 Z" fill="currentColor" />
      {/* sound waves */}
      <g stroke="currentColor" strokeWidth="2" fill="none">
        <path d="M21 12 Q23 16 21 20" />
        <path d="M25 9 Q29 16 25 23" />
      </g>
    </svg>
  );
}

/* Speaker (muted) — speaker with a strike-through X */
export function SpeakerOffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} shapeRendering="crispEdges">
      {/* speaker body + cone */}
      <path d="M4 12 H10 L17 5 V27 L10 20 H4 Z" fill="currentColor" />
      {/* mute X */}
      <g stroke="currentColor" strokeWidth="2.5">
        <line x1="21" y1="12" x2="29" y2="20" />
        <line x1="29" y1="12" x2="21" y2="20" />
      </g>
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
