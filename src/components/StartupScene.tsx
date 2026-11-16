/* StartupScene — the shared stage for the startup hardware: a dark room, a lit
   wooden desk that dissolves into black at its edges, the device chassis, and
   a screen we draw ourselves over the chassis's glass so the boot dive has
   something live to zoom into.

     screen 'off'  → dark glass, optionally with a blinking power prompt
     screen 'boot' → lit glass with the Happy Mac welcome */

import type { ReactNode } from 'react';
import type { DeviceGeometry } from '../lib/startupGeometry';

export type StartupDeviceProps = {
  screen: 'off' | 'boot';
  onPowerClick?: () => void;
  /** Show the blinking power prompt on the off screen */
  showPrompt?: boolean;
  /** Scene height as a fraction of the viewport */
  svgVh: number;
};

type Rect = { x: number; y: number; w: number; h: number };

type StartupSceneProps = StartupDeviceProps & {
  geometry: DeviceGeometry;
  /** The device artwork, drawn on the desk beneath the live screen */
  chassis: ReactNode;
  prompt: string;
  glassRx: number;
  /** Centre Y and X-radius of the pool of light on the desk */
  pool: { cy: number; rx: number };
  /** Width of the left/right fades into darkness */
  sideFade: number;
  /** Soft contact shadow, for artwork that doesn't bring its own */
  footShadow?: Rect;
  /** Drawn last, over the chassis and screen */
  children?: ReactNode;
};

const BLEED = 60;

export default function StartupScene({
  screen,
  onPowerClick,
  showPrompt = false,
  svgVh,
  geometry,
  chassis,
  prompt,
  glassRx,
  pool,
  sideFade,
  footShadow,
  children,
}: StartupSceneProps) {
  const { viewW, viewH, glass } = geometry;
  const off = screen === 'off';
  const cx = glass.x + glass.w / 2;
  const cy = glass.y + glass.h / 2;
  const fullW = viewW + BLEED * 2;
  const right = viewW + BLEED;
  const glassRect = {
    x: glass.x,
    y: glass.y,
    width: glass.w,
    height: glass.h,
    rx: glassRx,
  };

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      onClick={off ? onPowerClick : undefined}
      style={{ height: `${svgVh * 100}vh`, width: 'auto', display: 'block' }}
    >
      <defs>
        <radialGradient id="deskPool" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#a9793f" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#6f4f29" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
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
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2412" />
          <stop offset="100%" stopColor="#150b04" />
        </linearGradient>
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
          <rect width="4" height="1.4" fill="#000000" fillOpacity="0.22" />
        </pattern>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="footShadow" x="-25%" y="-60%" width="150%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Room and desk */}
      <rect x={-BLEED} y={-BLEED} width={fullW} height={viewH + BLEED * 2} fill="#000000" />
      <rect x={-BLEED} y="430" width={fullW} height="232" fill="url(#wood)" />
      <rect x={-BLEED} y="430" width={fullW} height="3" fill="#5a3a1e" opacity="0.55" />
      <g stroke="#0c0702" strokeOpacity="0.5" strokeWidth="1.5">
        <line x1={-BLEED} y1="470" x2={right} y2="474" />
        <line x1={-BLEED} y1="512" x2={right} y2="506" />
        <line x1={-BLEED} y1="556" x2={right} y2="564" />
        <line x1={-BLEED} y1="606" x2={right} y2="598" />
      </g>
      <g stroke="#6b4827" strokeOpacity="0.22" strokeWidth="1">
        <line x1={-BLEED} y1="450" x2={right} y2="454" />
        <line x1={-BLEED} y1="534" x2={right} y2="530" />
        <line x1={-BLEED} y1="582" x2={right} y2="586" />
      </g>
      <ellipse cx={viewW / 2} cy={pool.cy} rx={pool.rx} ry="115" fill="url(#deskPool)" />

      {/* Dissolve the desk to solid black exactly at the scene's edges, so it
          never shows a hard cut against the page. Drawn before the chassis so
          the fades don't darken it. */}
      <rect x="0" y={-BLEED} width={sideFade} height={viewH + BLEED * 2} fill="url(#fadeL)" />
      <rect x={viewW - sideFade} y={-BLEED} width={sideFade} height={viewH + BLEED * 2} fill="url(#fadeR)" />
      <rect x={-BLEED} y="590" width={fullW} height="60" fill="url(#fadeB)" />

      {footShadow && (
        <rect
          x={footShadow.x}
          y={footShadow.y}
          width={footShadow.w}
          height={footShadow.h}
          rx={footShadow.h / 2}
          fill="#000000"
          opacity="0.5"
          filter="url(#footShadow)"
        />
      )}

      {chassis}

      <rect {...glassRect} fill={off ? 'url(#phosphor)' : 'url(#phosphorOn)'} />
      {off ? (
        showPrompt && (
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            className="animate-blink"
            fill="#7dffb0"
            filter="url(#glow)"
            fontFamily='"VT323", monospace'
            fontSize="24"
            letterSpacing="1"
          >
            {prompt}
          </text>
        )
      ) : (
        <>
          <g transform={`translate(${cx - 31},${cy - 62}) scale(1.3)`}>
            <rect x="4" y="2" width="40" height="52" fill="#ffffff" stroke="#000000" strokeWidth="2" />
            <rect x="9" y="7" width="30" height="24" fill="#ffffff" stroke="#000000" strokeWidth="2" />
            <rect x="15" y="14" width="3" height="5" fill="#000000" />
            <rect x="30" y="14" width="3" height="5" fill="#000000" />
            <path d="M15 23 Q24 29 33 23" fill="none" stroke="#000000" strokeWidth="2" />
            <rect x="13" y="38" width="22" height="3" fill="#000000" />
            <rect x="13" y="45" width="10" height="3" fill="#000000" />
          </g>
          <text
            x={cx}
            y={cy + 38}
            textAnchor="middle"
            fill="#000000"
            fontFamily='"VT323", monospace'
            fontSize="19"
          >
            Welcome to AndyOS
          </text>
        </>
      )}
      <rect {...glassRect} fill="url(#scan)" opacity={off ? 0.5 : 0.35} />

      {children}
    </svg>
  );
}
