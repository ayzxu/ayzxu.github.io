/* ==========================================================================
   Macintosh — pixel-art Macintosh exterior, rendered as a single SVG.
   The App component zooms into the screen glass (centred at viewBox 235,140 →
   transform-origin "50% ~27%") to transition into the interactive desktop.

   The chassis is intentionally wider than the historical Mac 128K so that the
   screen-glass aspect (~16:9) matches modern viewports — when zoomed it can
   fill the screen on BOTH axes rather than letterboxing horizontally.

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
      viewBox="0 0 470 520"
      shapeRendering="crispEdges"
      onClick={interactive ? onPowerClick : undefined}
      style={{
        height: `${svgVh * 100}vh`,
        width: 'auto',
        display: 'block',
        cursor: 'inherit',
      }}
    >
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

      {/* --- screen contents ------------------------------------------------ */}
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
    </svg>
  );
}
