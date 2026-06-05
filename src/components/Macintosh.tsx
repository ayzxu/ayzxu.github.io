/* ==========================================================================
   Macintosh — a Mac Plus (clipart PNG) planted on a wooden desk that dissolves
   into a dark room. Rendered as one self-contained, fully responsive SVG.

   The chassis is the bitmap `mac-clipart.png`; everything else (the dark room,
   the lit wooden desk, the glowing CRT screen and the blinking prompt) is drawn
   in SVG on top, so the screen is fully under our control for the boot-zoom.

   IMPORTANT — boot-zoom contract (see App.tsx MAC_PROFILE):
   The PNG is drawn at (IMG_X, IMG_Y)→IMG_W×IMG_H within the 620×650 viewBox.
   The clipart's screen occupies PNG pixels (212,96)→336×222, which lands at the
   GLASS rect below — centred at (≈310,≈175). The glass is kept centred
   horizontally (cx ≈ 310 = viewW/2) so the boot-zoom stays a simple vertical
   translate. These GLASS numbers must match MAC_PROFILE in App.tsx.

     screen 'off'  → dark CRT glass with a soft phosphor glow + blinking prompt
     screen 'boot' → lit glass with the Happy Mac welcome
   ========================================================================== */

import macClipart from '../assets/mac-clipart.png';

/* PNG → viewBox placement. The clipart has been pre-trimmed to just the chassis
   (its 472×616 bounding box, with the baked-in drop shadow removed) so we fully
   control the grounding. Scale 0.877 makes it ~414 wide; the offsets centre it
   on x=310 and rest the flat foot on the desk at viewBox y≈560. */
const IMG_X = 103;
const IMG_Y = 19.7;
const IMG_W = 414; // 472 * 0.877
const IMG_H = 540.3; // 616 * 0.877

/* Screen glass in viewBox coords (trimmed screen 68..404 × 92..314 @ scale). */
const GLASS_X = 163;
const GLASS_Y = 100;
const GLASS_W = 295;
const GLASS_H = 195;
const GLASS_CX = GLASS_X + GLASS_W / 2; // ≈ 310.5
const GLASS_CY = GLASS_Y + GLASS_H / 2; // ≈ 197.5

type MacintoshProps = {
  screen: 'off' | 'boot';
  onPowerClick?: () => void;
  /** Show the blinking "click to start" prompt on the off screen */
  showPrompt?: boolean;
  /** SVG height as a fraction of the viewport (default 0.9) */
  svgVh?: number;
};

export default function Macintosh({
  screen,
  onPowerClick,
  showPrompt = true,
  svgVh = 0.9,
}: MacintoshProps) {
  const off = screen === 'off';
  const interactive = off && !!onPowerClick;

  return (
    <svg
      viewBox="0 0 620 650"
      onClick={interactive ? onPowerClick : undefined}
      style={{
        height: `${svgVh * 100}vh`,
        width: 'auto',
        display: 'block',
        cursor: 'inherit',
      }}
    >
      <defs>
        {/* ---- desk lighting ------------------------------------------- */}
        <radialGradient id="deskPool" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a9793f" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#6f4f29" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* ---- desk edge fades (dissolve the desk into darkness) -------- */}
        <linearGradient id="fadeL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fadeR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fadeB" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* ---- wood ---------------------------------------------------- */}
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2412" />
          <stop offset="100%" stopColor="#150b04" />
        </linearGradient>

        {/* ---- CRT ----------------------------------------------------- */}
        <radialGradient id="phosphor" cx="50%" cy="46%" r="62%">
          <stop offset="0%" stopColor="#1d2620" />
          <stop offset="70%" stopColor="#0c100d" />
          <stop offset="100%" stopColor="#050706" />
        </radialGradient>
        <radialGradient id="phosphorOn" cx="50%" cy="44%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="80%" stopColor="#eef3ec" />
          <stop offset="100%" stopColor="#cdd6cc" />
        </radialGradient>
        <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#000000" fillOpacity="0" />
          <rect width="4" height="1.4" fill="#000000" fillOpacity="0.22" />
        </pattern>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ===== Dark room =================================================== */}
      <rect x="-60" y="-60" width="740" height="770" fill="#040404" />

      {/* ===== Desk ======================================================== */}
      <rect x="-60" y="430" width="740" height="232" fill="url(#wood)" />
      <rect x="-60" y="430" width="740" height="3" fill="#5a3a1e" opacity="0.55" />
      <g stroke="#0c0702" strokeOpacity="0.5" strokeWidth="1.5">
        <line x1="-60" y1="470" x2="680" y2="474" />
        <line x1="-60" y1="512" x2="680" y2="506" />
        <line x1="-60" y1="556" x2="680" y2="564" />
        <line x1="-60" y1="606" x2="680" y2="598" />
      </g>
      <g stroke="#6b4827" strokeOpacity="0.22" strokeWidth="1">
        <line x1="-60" y1="450" x2="680" y2="454" />
        <line x1="-60" y1="534" x2="680" y2="530" />
        <line x1="-60" y1="582" x2="680" y2="586" />
      </g>
      <ellipse cx="310" cy="520" rx="300" ry="110" fill="url(#deskPool)" />

      {/* dissolve the desk into darkness at its edges — no hard cut anywhere */}
      <rect x="-60" y="425" width="250" height="240" fill="url(#fadeL)" />
      <rect x="430" y="425" width="250" height="240" fill="url(#fadeR)" />
      <rect x="-60" y="556" width="740" height="110" fill="url(#fadeB)" />

      {/* single tight grounding shadow right at the flat foot (y≈560) so the
          Mac reads as resting on the desk, not floating */}
      <ellipse cx="310" cy="561" rx="176" ry="11" fill="#000000" opacity="0.5" />

      {/* ===== Macintosh clipart ========================================== */}
      <image
        href={macClipart}
        x={IMG_X}
        y={IMG_Y}
        width={IMG_W}
        height={IMG_H}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* ===== Glowing CRT screen drawn over the clipart's glass ========== */}
      <rect
        x={GLASS_X}
        y={GLASS_Y}
        width={GLASS_W}
        height={GLASS_H}
        rx="9"
        fill={off ? 'url(#phosphor)' : 'url(#phosphorOn)'}
      />

      {off ? (
        <g>
          <rect x={GLASS_X} y={GLASS_Y} width={GLASS_W} height={GLASS_H} rx="9" fill="url(#scan)" opacity="0.5" />
          {showPrompt && (
            <text
              x={GLASS_CX}
              y={GLASS_CY + 8}
              textAnchor="middle"
              className="animate-blink"
              fill="#7dffb0"
              filter="url(#glow)"
              fontFamily='"VT323", monospace'
              fontSize="24"
              letterSpacing="1"
            >
              click to start
            </text>
          )}
          <path
            d={`M${GLASS_X + 6} ${GLASS_Y + 8} Q${GLASS_CX - 40} ${GLASS_Y - 4} ${GLASS_CX} ${GLASS_Y - 2} Q${GLASS_CX - 60} ${GLASS_Y + 18} ${GLASS_X + 28} ${GLASS_Y + 26} Z`}
            fill="#ffffff"
            opacity="0.05"
          />
        </g>
      ) : (
        <g>
          <g transform={`translate(${GLASS_CX - 32},${GLASS_Y + 26}) scale(1.3)`}>
            <rect x="4" y="2" width="40" height="52" fill="#ffffff" stroke="#000000" strokeWidth="2" />
            <rect x="9" y="7" width="30" height="24" fill="#ffffff" stroke="#000000" strokeWidth="2" />
            <rect x="15" y="14" width="3" height="5" fill="#000000" />
            <rect x="30" y="14" width="3" height="5" fill="#000000" />
            <path d="M15 23 Q24 29 33 23" fill="none" stroke="#000000" strokeWidth="2" />
            <rect x="13" y="38" width="22" height="3" fill="#000000" />
            <rect x="13" y="45" width="10" height="3" fill="#000000" />
          </g>
          <text
            x={GLASS_CX}
            y={GLASS_Y + GLASS_H - 18}
            textAnchor="middle"
            fill="#000000"
            fontFamily='"VT323", monospace'
            fontSize="19"
          >
            Welcome to AndyOS
          </text>
          <rect x={GLASS_X} y={GLASS_Y} width={GLASS_W} height={GLASS_H} rx="9" fill="url(#scan)" opacity="0.35" />
        </g>
      )}

      {/* ===== AndyOS wordmark on the front face (below the screen) ======= */}
      <g transform="translate(150,332) scale(0.62)">
        <path d="M17 3 Q22 3 21 9 Q16 9 17 3 Z" fill="#4a4438" />
        <path
          d="M16 9 C10 7 4 11 5 19 C6 27 11 30 14 28 C15 27 17 27 18 28
             C21 30 26 27 27 19 C28 12 23 8 18 10 C20 12 21 15 19 16
             C16 17 14 13 16 9 Z"
          fill="#4a4438"
        />
      </g>
      <text
        x="194"
        y="349"
        fill="#4a4438"
        fontFamily='"Press Start 2P", monospace'
        fontSize="11"
      >
        AndyOS
      </text>
    </svg>
  );
}
