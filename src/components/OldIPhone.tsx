/* ==========================================================================
   OldIPhone — pixel-art first-generation iPhone exterior, rendered as a single
   SVG. Used as the startup hardware on mobile browsers in place of the
   Macintosh 128K. The App zooms into the screen glass to transition into the
   interactive desktop, exactly as it does for the Mac.

   To keep the App's zoom math device-agnostic, the screen glass is centred
   horizontally (glass cx = viewBox width / 2). The App reads this component's
   glass geometry from its device profile.

     screen 'off'  → dark glass + blinking "click to start" prompt
     screen 'boot' → white glass + Happy Mac welcome (the 128K look)
   ========================================================================== */

type OldIPhoneProps = {
  screen: 'off' | 'boot';
  onPowerClick?: () => void;
  /** Show the blinking "click to start" prompt on the off screen */
  showPrompt?: boolean;
  /** SVG height as a fraction of the viewport (default 0.9) */
  svgVh?: number;
};

export default function OldIPhone({
  screen,
  onPowerClick,
  showPrompt = true,
  svgVh = 0.9,
}: OldIPhoneProps) {
  const off = screen === 'off';
  const interactive = off && !!onPowerClick;

  return (
    <svg
      viewBox="0 0 320 640"
      shapeRendering="crispEdges"
      onClick={interactive ? onPowerClick : undefined}
      style={{
        height: `${svgVh * 100}vh`,
        width: 'auto',
        display: 'block',
        cursor: 'inherit',
      }}
    >
      {/* chrome bezel / body */}
      <rect
        x="40"
        y="20"
        width="240"
        height="600"
        rx="42"
        fill="#c9c9cf"
        stroke="#000000"
        strokeWidth="3"
      />
      {/* black front face */}
      <rect
        x="48"
        y="28"
        width="224"
        height="584"
        rx="34"
        fill="#0b0b0d"
        stroke="#000000"
        strokeWidth="2"
      />

      {/* earpiece speaker + tiny sensor */}
      <rect x="133" y="66" width="54" height="8" rx="4" fill="#2c2c30" />
      <circle cx="205" cy="70" r="3" fill="#2c2c30" />

      {/* screen recess */}
      <rect
        x="68"
        y="116"
        width="184"
        height="272"
        fill="#2a2a28"
        stroke="#000000"
        strokeWidth="2"
      />
      {/* screen glass — 72..248 × 120..384 → centre (160,252) */}
      <rect
        x="72"
        y="120"
        width="176"
        height="264"
        fill={off ? '#1a1a1a' : '#ffffff'}
      />

      {/* --- screen contents ------------------------------------------------ */}
      {off ? (
        showPrompt && (
          <text
            x="160"
            y="256"
            textAnchor="middle"
            className="animate-blink"
            fill="#ffffff"
            fontFamily='"VT323", monospace'
            fontSize="15"
          >
            click to start
          </text>
        )
      ) : (
        <g>
          {/* Happy Mac — the 128K look, centred on the glass */}
          <g transform="translate(135,184) scale(1.05)">
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
            x="160"
            y="332"
            textAnchor="middle"
            fill="#000000"
            fontFamily='"VT323", monospace'
            fontSize="15"
          >
            Welcome to AndyOS
          </text>
        </g>
      )}

      {/* home button — circle with the classic rounded-square glyph */}
      <circle
        cx="160"
        cy="506"
        r="27"
        fill="#101012"
        stroke="#3a3a3e"
        strokeWidth="2"
      />
      <rect
        x="148"
        y="494"
        width="24"
        height="24"
        rx="5"
        fill="none"
        stroke="#55555a"
        strokeWidth="2"
      />
    </svg>
  );
}
