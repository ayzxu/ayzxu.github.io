/* StartupScene — the shared stage for the startup hardware, lit like a
   product shot: a dark void with a soft fall of light behind the machine, a
   faint pool of light on the floor beneath it, and the machine floating
   above that pool on its own soft shadow, its cable hanging down out of
   frame.

   It's built as layers so App can move each one every frame without
   repainting the others:

     floor    → the light falloff, the floor pool, and the screen's light on
                the floor (follows --screen-light, 0–1, set on an ancestor)
     shadow   → the contact shadow (scaled and faded as the machine bobs)
     machine  → the chassis, the plug, the dark screen glass and the bloom the
                lit picture throws across the bezel (bobbed and rolled)
     cable    → the cable, its afterglow, and the pulse of power that runs
                along it (path rebuilt every frame from where the plug is)

   The lit picture itself isn't drawn here: it's the live desktop, laid over
   the glass by App and moved by the same transforms.

     screen 'off' → dark glass, optionally with a blinking power prompt
     screen 'on'  → dark glass under the raster App lays on top */

import type { ReactNode, RefObject } from 'react';
import type { DeviceGeometry } from '../lib/startupGeometry';

/** The layers App animates */
export type SceneRig = {
  machine: RefObject<HTMLDivElement | null>;
  shadow: RefObject<HTMLDivElement | null>;
  cable: RefObject<SVGSVGElement | null>;
};

export type StartupDeviceProps = {
  screen: 'off' | 'on';
  onPowerClick?: () => void;
  /** Show the blinking power prompt on the off screen */
  showPrompt?: boolean;
  /** Scene height in px — the camera maths is done in px, so no vh here */
  height: number;
  rig: SceneRig;
};

type StartupSceneProps = StartupDeviceProps & {
  geometry: DeviceGeometry;
  /** The device artwork */
  chassis: ReactNode;
  /** The cable's plug, drawn on the machine so it floats with it */
  plug: ReactNode;
  /** Cable colours: its shaded edge and its body, and the body's width */
  cable: { edge: string; body: string; width: number };
  prompt: string;
  glassRx: number;
  /** Drawn over the chassis, under the screen light */
  children?: ReactNode;
};

export default function StartupScene({
  screen,
  onPowerClick,
  showPrompt = false,
  height,
  rig,
  geometry,
  chassis,
  plug,
  cable,
  prompt,
  glassRx,
  children,
}: StartupSceneProps) {
  const { viewW, viewH, glass, floor } = geometry;
  const off = screen === 'off';
  const cx = glass.x + glass.w / 2;
  const cy = glass.y + glass.h / 2;
  const viewBox = `0 0 ${viewW} ${viewH}`;
  const glassRect = {
    x: glass.x,
    y: glass.y,
    width: glass.w,
    height: glass.h,
    rx: glassRx,
  };
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div
      className="scene"
      onClick={off ? onPowerClick : undefined}
      style={{ width: `${(height * viewW) / viewH}px`, height: `${height}px` }}
    >
      {/* Floor: drawn past the scene's edges (overflow visible) and faded by
          its gradients alone, so it has no edges anywhere */}
      <svg className="scene-layer" viewBox={viewBox} aria-hidden="true">
        <defs>
          <radialGradient id="roomFalloff">
            <stop offset="0%" stopColor="#262c31" stopOpacity="0.62" />
            <stop offset="55%" stopColor="#15191c" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="floorPool">
            <stop offset="0%" stopColor="#8f9aa4" stopOpacity="0.24" />
            <stop offset="50%" stopColor="#5c656d" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="floorSpill">
            <stop offset="0%" stopColor="#d6e2f5" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#d6e2f5" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={cx} cy={cy + 150} rx={viewW * 0.95} ry={viewH * 0.72} fill="url(#roomFalloff)" />
        <ellipse cx={cx} cy={floor.y + 4} rx={floor.shadowW * 1.05} ry={62} fill="url(#floorPool)" />
        <ellipse
          cx={cx}
          cy={floor.y}
          rx={floor.shadowW * 0.8}
          ry={46}
          fill="url(#floorSpill)"
          style={{ opacity: 'var(--screen-light, 0)', mixBlendMode: 'screen' }}
        />
      </svg>

      <div
        ref={rig.shadow}
        className="scene-shadow"
        style={{
          left: pct(cx - floor.shadowW / 2, viewW),
          top: pct(floor.y - floor.shadowH / 2, viewH),
          width: pct(floor.shadowW, viewW),
          height: pct(floor.shadowH, viewH),
        }}
      />

      {/* The machine floats about its glass centre, like the camera pivots */}
      <div
        ref={rig.machine}
        className="scene-machine"
        style={{ transformOrigin: `50% ${pct(cy, viewH)}` }}
      >
        <svg className="scene-layer" viewBox={viewBox}>
          <defs>
            <radialGradient id="phosphor" cx="50%" cy="46%" r="62%">
              <stop offset="0%" stopColor="#1d2620" />
              <stop offset="70%" stopColor="#0c100d" />
              <stop offset="100%" stopColor="#050706" />
            </radialGradient>
            <radialGradient id="screenBloom" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#dfe9ff" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#c9d6ee" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#9fb0c8" stopOpacity="0" />
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
          </defs>

          {chassis}
          {plug}

          <rect {...glassRect} fill="url(#phosphor)" />
          {off && showPrompt && (
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
          )}
          <rect {...glassRect} fill="url(#scan)" opacity="0.5" />

          {children}

          {/* Light thrown by the lit picture across the glass and bezel,
              screen-blended so it only brightens */}
          <ellipse
            cx={cx}
            cy={cy}
            rx={glass.w * 0.82}
            ry={glass.h * 0.9}
            fill="url(#screenBloom)"
            style={{ opacity: 'var(--screen-light, 0)', mixBlendMode: 'screen' }}
          />
        </svg>
      </div>

      {/* The cable: App sets every path's `d` each frame */}
      <svg ref={rig.cable} className="scene-layer scene-cable" viewBox={viewBox} aria-hidden="true">
        <defs>
          <filter id="cableGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
        </defs>
        <path data-cable="edge" stroke={cable.edge} strokeWidth={cable.width + 1.6} />
        <path data-cable="body" stroke={cable.body} strokeWidth={cable.width} />
        <path
          data-cable="glow"
          stroke="#d7e5ff"
          strokeWidth={cable.width + 4}
          filter="url(#cableGlow)"
          opacity="0"
        />
        <path
          data-cable="halo"
          stroke="#cfe0ff"
          strokeWidth={cable.width + 8}
          strokeLinecap="round"
          filter="url(#cableGlow)"
          opacity="0"
        />
        <path
          data-cable="core"
          stroke="#ffffff"
          strokeWidth={cable.width + 0.6}
          strokeLinecap="round"
          opacity="0"
        />
      </svg>
    </div>
  );
}
