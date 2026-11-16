/* Geometry of the startup hardware scenes and the camera moves built on it.
   Each scene is an SVG with a "screen glass" rect; the boot dive scales the
   scene until that glass fills the viewport. The glass must stay centred
   horizontally (x + w/2 === viewW/2) so the dive only needs a vertical
   translate. */

import type { Viewport } from './windowBounds';

export type DeviceGeometry = {
  viewW: number;
  viewH: number;
  glass: { x: number; y: number; w: number; h: number };
};

export const MAC_GEOMETRY: DeviceGeometry = {
  viewW: 620,
  viewH: 650,
  glass: { x: 160, y: 91, w: 300, h: 204 },
};

export const IPHONE_GEOMETRY: DeviceGeometry = {
  viewW: 400,
  viewH: 650,
  glass: { x: 89, y: 79, w: 222, h: 394 },
};

export type StartupLayout = {
  /** Scene height as a fraction of the viewport height */
  svgVh: number;
  /** Glass-centre Y as a percentage of the scene — the transform origin */
  originYPct: number;
  /** Scale at which the glass exactly fits inside the viewport */
  fitScale: number;
  /** Vertical shift (vh) that brings the glass centre to the viewport centre */
  zoomTranslateY: number;
};

export function computeStartupLayout(
  device: DeviceGeometry,
  { w, h }: Viewport,
): StartupLayout {
  // The scene is sized by height, so on portrait screens cap the height to
  // keep its width within ~94% of the viewport.
  const aspect = device.viewW / device.viewH;
  const svgVh = Math.min(w < 480 ? 0.85 : 0.9, (0.94 * w) / (h * aspect));

  const { glass } = device;
  const originY = (glass.y + glass.h / 2) / device.viewH;
  const svgH = svgVh * h;
  const pxPerUnit = svgH / device.viewH;

  return {
    svgVh,
    originYPct: originY * 100,
    // Fit on the tighter axis so the Happy Mac is never cropped.
    fitScale: Math.min(w / (glass.w * pxPerUnit), h / (glass.h * pxPerUnit)),
    zoomTranslateY: 50 - ((100 - svgVh * 100) / 2 + svgVh * originY * 100),
  };
}

/* --- Opening flight ---------------------------------------------------------
   One unbroken camera move from first frame to the glass filling the viewport:
   the scene fades in small and a little up and to the left, banks gently
   through a shallow arc that dips under its mark, and keeps closing straight
   on into the screen. The arc and the bank are kept small on purpose: the
   move should read as a glide in, not a stunt.

   It is paced in two halves that share a speed where they meet, so it never
   stops: a quick approach up to life size, then a slower push into the glass
   that eases off as it passes life size — long enough to read the welcome on
   the screen, which comes on during the approach. Scale is geometric in
   progress, so even speed reads as a steady closing speed. At t = 1 the pose
   is exactly the zoomed-in resting transform. */

export const FLIGHT_MS = 2700;

/** Share of the flight spent on the approach, up to life size */
const APPROACH_SHARE = 1 / 3;
/** Speed where the two halves meet, relative to the push's average */
const HANDOVER_SPEED = 0.6;
const FAR_SCALE = 0.25;
/** The screen comes on once the machine is this close */
const LIT_SCALE = 0.55;
/** Bank at the start of the arc, levelling out as it is flown */
const MAX_ROLL_DEG = 8;
/** Peak of the small counter-roll as the machine levels out — the wobble on
    arrival. Much past a couple of degrees it reads as the machine rocking. */
const SETTLE_ROLL_DEG = 2;

/** Cubic Hermite from 0 to 1 over x ∈ [0,1] with the given end slopes. */
function hermite(x: number, slope0: number, slope1: number): number {
  const x2 = x * x;
  const x3 = x2 * x;
  return (x3 - 2 * x2 + x) * slope0 + (3 * x2 - 2 * x3) + (x3 - x2) * slope1;
}

/** The stage's transform and opacity at flight progress t (0–1), and whether
    the screen should be on yet. */
export function flightPose(
  t: number,
  { w, h }: Viewport,
  layout: StartupLayout,
): { transform: string; opacity: number; lit: boolean } {
  // Progress through the zoom range, in log-scale terms; `lifeSize` is where
  // the scene passes scale 1.
  const range = Math.log(layout.fitScale / FAR_SCALE);
  const lifeSize = Math.log(1 / FAR_SCALE) / range;
  const speed = (HANDOVER_SPEED * (1 - lifeSize)) / (1 - APPROACH_SHARE);
  const u =
    t < APPROACH_SHARE
      ? lifeSize *
        hermite(t / APPROACH_SHARE, 0, (speed * APPROACH_SHARE) / lifeSize)
      : lifeSize +
        (1 - lifeSize) *
          hermite((t - APPROACH_SHARE) / (1 - APPROACH_SHARE), HANDOVER_SPEED, 0);
  const scale = FAR_SCALE * Math.exp(range * u);

  // The arc is flown out a little past life size, so the rest of the push is
  // straight into the glass.
  const a = 1 - (1 - Math.min(1, u / (lifeSize * 1.3))) ** 2;
  const b = 1 - a;
  // Bézier from the entry point, through the dip, to rest at the origin.
  // The last x term is the sideways overshoot past centre before it settles.
  const x = w * (-0.155 * b ** 3 - 0.375 * b * b * a + 0.06 * b * a * a);
  const y = h * (-0.18 * b ** 3 + 0.33 * b * b * a + 0.285 * b * a * a);
  const lift = layout.zoomTranslateY * u;
  const roll = -MAX_ROLL_DEG * b + SETTLE_ROLL_DEG * Math.sin(Math.PI * a * a);
  return {
    transform: `translate(${x.toFixed(1)}px, calc(${y.toFixed(1)}px + ${lift.toFixed(3)}vh)) rotate(${roll.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
    opacity: Math.min(1, t / 0.1),
    lit: scale >= LIT_SCALE,
  };
}
