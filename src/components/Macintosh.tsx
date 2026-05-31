/* ==========================================================================
   Macintosh — pixel-art Macintosh exterior on a desk, rendered as a single SVG.
   The machine sits on a simple flat desk, viewed head-on. The dark room is
   preserved as the background; only the desk surface is added beneath the
   computer.

   The App component zooms into the screen glass (centred at SVG-coords
   310,160 within the 620×650 viewBox) to transition into the interactive
   desktop. The Mac itself is drawn inside a group translated by (75,20) so the
   screen glass stays horizontally centred (cx = viewBox width / 2 = 310),
   which keeps the boot-zoom math a simple vertical translate.

     screen 'off'  → dark glass + blinking "click to start" prompt
     screen 'boot' → white glass + Happy Mac welcome
   ========================================================================== */

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
      shapeRendering="crispEdges"
      onClick={interactive ? onPowerClick : undefined}
      style={{
        height: `${svgVh * 100}vh`,
        width: 'auto',
        display: 'block',
        cursor: 'inherit',
      }}
    >
      {/* ===== Desk — a simple flat surface beneath the computer =============
          A plain rectangular desktop (no perspective trapezoid). The dark room
          above the back edge is left as the background. */}
      <rect
        x="0"
        y="440"
        width="620"
        height="160"
        fill="#8f8775"
        stroke="#000000"
        strokeWidth="2.5"
      />
      {/* front apron — the desk's thickness, darker for depth */}
      <rect
        x="0"
        y="600"
        width="620"
        height="34"
        fill="#5f594b"
        stroke="#000000"
        strokeWidth="2"
      />

      {/* grounding shadow so the Mac sits on the surface rather than float */}
      <ellipse cx="310" cy="524" rx="208" ry="20" fill="rgba(0,0,0,0.22)" />

      {/* ===== Macintosh — translated so the screen glass is centred ======== */}
      <g transform="translate(75,20)">
        {/* carry-handle slot on top — centred on chassis */}
        <rect x="203" y="16" width="64" height="9" fill="#b3ab8e" />

        {/* main chassis */}
        <rect
          x="42"
          y="24"
          width="386"
          height="392"
          fill="#d6cfb8"
          stroke="#000000"
          strokeWidth="3"
        />
        {/* front face inset for a little depth */}
        <rect
          x="54"
          y="36"
          width="362"
          height="368"
          fill="#e8e2cd"
          stroke="#000000"
          strokeWidth="1.5"
        />

        {/* screen recess */}
        <rect
          x="74"
          y="50"
          width="322"
          height="182"
          fill="#4a4a44"
          stroke="#000000"
          strokeWidth="2"
        />
        {/* screen glass — 84..386 × 56..224 → centre (235,140), aspect ≈ 16:9 */}
        <rect x="84" y="56" width="302" height="168" fill={off ? '#1a1a1a' : '#ffffff'} />

        {/* --- screen contents --------------------------------------------- */}
        {off ? (
          showPrompt && (
            <text
              x="235"
              y="146"
              textAnchor="middle"
              className="animate-blink"
              fill="#ffffff"
              fontFamily='"VT323", monospace'
              fontSize="20"
            >
              click to start
            </text>
          )
        ) : (
          <g>
            {/* Happy Mac — drawn inline so it scales with the screen
                (centred on glass: glass cx 235 - happy half-width 23 ≈ 207) */}
            <g transform="translate(207,92) scale(1.15)">
              <rect
                x="4"
                y="2"
                width="40"
                height="52"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="2"
              />
              <rect
                x="9"
                y="7"
                width="30"
                height="24"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="2"
              />
              <rect x="15" y="14" width="3" height="5" fill="#000000" />
              <rect x="30" y="14" width="3" height="5" fill="#000000" />
              <path
                d="M15 23 Q24 29 33 23"
                fill="none"
                stroke="#000000"
                strokeWidth="2"
              />
              <rect x="13" y="38" width="22" height="3" fill="#000000" />
              <rect x="13" y="45" width="10" height="3" fill="#000000" />
            </g>
            <text
              x="235"
              y="196"
              textAnchor="middle"
              fill="#000000"
              fontFamily='"VT323", monospace'
              fontSize="18"
            >
              Welcome to AndyOS
            </text>
          </g>
        )}

        {/* Apple badge below the screen, left bezel */}
        <g transform="translate(76,244) scale(0.6)">
          <path d="M17 3 Q22 3 21 9 Q16 9 17 3 Z" fill="#000000" />
          <path
            d="M16 9 C10 7 4 11 5 19 C6 27 11 30 14 28 C15 27 17 27 18 28
               C21 30 26 27 27 19 C28 12 23 8 18 10 C20 12 21 15 19 16
               C16 17 14 13 16 9 Z"
            fill="#000000"
          />
        </g>
        <text
          x="100"
          y="262"
          fill="#000000"
          fontFamily='"Press Start 2P", monospace'
          fontSize="11"
        >
          AndyOS
        </text>

        {/* floppy disk drive slot — right bezel */}
        <rect x="306" y="300" width="88" height="11" fill="#2a2a26" />
        <rect x="342" y="296" width="16" height="4" fill="#2a2a26" />

        {/* base / foot */}
        <rect
          x="42"
          y="416"
          width="386"
          height="88"
          fill="#d6cfb8"
          stroke="#000000"
          strokeWidth="3"
        />
        <rect
          x="66"
          y="432"
          width="338"
          height="56"
          fill="#cdc6ac"
          stroke="#000000"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}
