/* ==========================================================================
   Iphone — the phone-sized counterpart to Macintosh.tsx: an iPhone (bitmap
   `iphone.png`) standing on the same lit wooden desk in a dark room. Shown as
   the startup hardware on compact (phone) viewports, where the desktop later
   renders as an iOS-style home screen — so the exterior device matches.

   IMPORTANT — boot-zoom contract (see App.tsx IPHONE_PROFILE):
   The PNG is drawn at (IMG_X, IMG_Y)→IMG_W×IMG_H within the 400×650 viewBox.
   The phone's white screen occupies PNG pixels (123,174)→(719,1238); the GLASS
   rect below is sized a hair larger so our dark screen fully covers the white,
   and is centred horizontally (cx = 200 = viewW/2) so the boot-zoom stays a
   simple vertical translate. These GLASS numbers must match IPHONE_PROFILE in
   App.tsx.

     screen 'off'  → dark glass with a soft glow + blinking "tap to start"
     screen 'boot' → lit glass with the Happy Mac welcome
   ========================================================================== */

import iphoneClipart from '../assets/iphone.png';

/* PNG → viewBox placement. The bitmap is 873×1530 with the chassis at
   x≈76..766 and its foot at y≈1415 (the rest is soft shadow). Scale ≈0.366
   draws it 560 tall; IMG_X centres the *screen* (PNG centre x = 421) on
   viewBox x=200, and IMG_Y rests the foot on the desk at viewBox y≈535. */
const IMG_X = 45.9;
const IMG_Y = 17;
const IMG_W = 319.5; // 873 * 0.366
const IMG_H = 560; // 1530 * 0.366

/* Screen glass in viewBox coords — a touch larger than the bitmap's white
   screen (which lands at ≈90.9..309.4 × 80.7..470.5) so no white halo
   peeks out. Centred at (200,276). */
const GLASS_X = 89;
const GLASS_Y = 79;
const GLASS_W = 222;
const GLASS_H = 394;
const GLASS_CX = GLASS_X + GLASS_W / 2; // = 200
const GLASS_CY = GLASS_Y + GLASS_H / 2; // = 276

type IphoneProps = {
  screen: 'off' | 'boot';
  onPowerClick?: () => void;
  /** Show the blinking "tap to start" prompt on the off screen */
  showPrompt?: boolean;
  /** SVG height as a fraction of the viewport (default 0.9) */
  svgVh?: number;
};

export default function Iphone({
  screen,
  onPowerClick,
  showPrompt = true,
  svgVh = 0.9,
}: IphoneProps) {
  const off = screen === 'off';
  const interactive = off && !!onPowerClick;

  return (
    <svg
      viewBox="0 0 400 650"
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
        <radialGradient id="ipDeskPool" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a9793f" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#6f4f29" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* ---- desk edge fades (dissolve the desk into darkness) -------- */}
        <linearGradient id="ipFadeL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ipFadeR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ipFadeB" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* ---- wood ---------------------------------------------------- */}
        <linearGradient id="ipWood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2412" />
          <stop offset="100%" stopColor="#150b04" />
        </linearGradient>

        {/* ---- screen -------------------------------------------------- */}
        <radialGradient id="ipPhosphor" cx="50%" cy="46%" r="62%">
          <stop offset="0%" stopColor="#1d2620" />
          <stop offset="70%" stopColor="#0c100d" />
          <stop offset="100%" stopColor="#050706" />
        </radialGradient>
        <radialGradient id="ipPhosphorOn" cx="50%" cy="44%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="80%" stopColor="#eef3ec" />
          <stop offset="100%" stopColor="#cdd6cc" />
        </radialGradient>
        <pattern id="ipScan" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#000000" fillOpacity="0" />
          <rect width="4" height="1.4" fill="#000000" fillOpacity="0.22" />
        </pattern>
        <filter id="ipGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ipFootShadow" x="-25%" y="-60%" width="150%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ===== Dark room =================================================== */}
      <rect x="-60" y="-60" width="520" height="770" fill="#040404" />

      {/* ===== Desk ======================================================== */}
      <rect x="-60" y="430" width="520" height="232" fill="url(#ipWood)" />
      <rect x="-60" y="430" width="520" height="3" fill="#5a3a1e" opacity="0.55" />
      <g stroke="#0c0702" strokeOpacity="0.5" strokeWidth="1.5">
        <line x1="-60" y1="470" x2="460" y2="474" />
        <line x1="-60" y1="512" x2="460" y2="506" />
        <line x1="-60" y1="556" x2="460" y2="564" />
        <line x1="-60" y1="606" x2="460" y2="598" />
      </g>
      <g stroke="#6b4827" strokeOpacity="0.22" strokeWidth="1">
        <line x1="-60" y1="450" x2="460" y2="454" />
        <line x1="-60" y1="534" x2="460" y2="530" />
        <line x1="-60" y1="582" x2="460" y2="586" />
      </g>
      <ellipse cx="200" cy="500" rx="220" ry="115" fill="url(#ipDeskPool)" />

      {/* Dissolve the scene into pure black at the left/right edges — solid
          black exactly at the viewBox boundary, drawn before the phone so they
          never darken the chassis itself. */}
      <rect x="0" y="-60" width="120" height="770" fill="url(#ipFadeL)" />
      <rect x="280" y="-60" width="120" height="770" fill="url(#ipFadeR)" />
      {/* Only the very front lip of the desk fades out */}
      <rect x="-60" y="622" width="520" height="60" fill="url(#ipFadeB)" />

      {/* grounding shadow following the phone's footprint */}
      <rect
        x="84"
        y="529"
        width="232"
        height="13"
        rx="6"
        fill="#000000"
        opacity="0.5"
        filter="url(#ipFootShadow)"
      />

      {/* ===== iPhone clipart ============================================= */}
      <image
        href={iphoneClipart}
        x={IMG_X}
        y={IMG_Y}
        width={IMG_W}
        height={IMG_H}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* ===== Glowing screen drawn over the clipart's glass ============== */}
      <rect
        x={GLASS_X}
        y={GLASS_Y}
        width={GLASS_W}
        height={GLASS_H}
        rx="4"
        fill={off ? 'url(#ipPhosphor)' : 'url(#ipPhosphorOn)'}
      />

      {off ? (
        <g>
          <rect x={GLASS_X} y={GLASS_Y} width={GLASS_W} height={GLASS_H} rx="4" fill="url(#ipScan)" opacity="0.5" />
          {showPrompt && (
            <text
              x={GLASS_CX}
              y={GLASS_CY + 8}
              textAnchor="middle"
              className="animate-blink"
              fill="#7dffb0"
              filter="url(#ipGlow)"
              fontFamily='"VT323", monospace'
              fontSize="24"
              letterSpacing="1"
            >
              tap to start
            </text>
          )}
          <path
            d={`M${GLASS_X + 6} ${GLASS_Y + 10} Q${GLASS_CX - 30} ${GLASS_Y - 2} ${GLASS_CX} ${GLASS_Y} Q${GLASS_CX - 44} ${GLASS_Y + 22} ${GLASS_X + 22} ${GLASS_Y + 32} Z`}
            fill="#ffffff"
            opacity="0.05"
          />
        </g>
      ) : (
        <g>
          <g transform={`translate(${GLASS_CX - 32},${GLASS_Y + 92}) scale(1.3)`}>
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
            y={GLASS_Y + GLASS_H - 110}
            textAnchor="middle"
            fill="#000000"
            fontFamily='"VT323", monospace'
            fontSize="19"
          >
            Welcome to AndyOS
          </text>
          <rect x={GLASS_X} y={GLASS_Y} width={GLASS_W} height={GLASS_H} rx="4" fill="url(#ipScan)" opacity="0.35" />
        </g>
      )}
    </svg>
  );
}
