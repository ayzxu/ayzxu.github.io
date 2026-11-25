/* Geometry of the startup hardware scenes and the one camera that films them.

   Each scene is an SVG with a "screen glass" rect. Inside the glass sits the
   raster: the lit picture, which is the live desktop itself, drawn at the
   viewport's aspect ratio and shrunk to fit inside the glass (the dark border
   around it is the CRT's unlit margin). The camera pivots on the glass
   centre; when it has pushed in far enough that the raster is exactly the
   viewport, the desktop is at 1:1 and the intro can let go of it without a
   single pixel changing.

   The glass must stay centred horizontally (x + w/2 === viewW/2) so the camera
   only ever needs a vertical shift. */

import type { Viewport } from './windowBounds';
import type { Tether } from './tether';

export type DeviceGeometry = {
  viewW: number;
  viewH: number;
  glass: { x: number; y: number; w: number; h: number };
  /** Unlit margin between the glass edge and the raster, in scene units */
  rasterInset: number;
  /** A tube that switches on and off as a line (Mac), or a backlight that
      simply fades (iPhone) */
  crt: boolean;
  /** The cable hanging from the machine */
  tether: Tether;
};

export const MAC_GEOMETRY: DeviceGeometry = {
  viewW: 620,
  viewH: 650,
  glass: { x: 160, y: 91, w: 300, h: 204 },
  rasterInset: 9,
  crt: true,
  // The coiled keyboard cord, from the RJ-11 port on the front of the base.
  tether: {
    port: { x: 466.5, y: 555 },
    drop: 40,
    sag: { x: 498, y: 668 },
    end: { x: 700, y: 790 },
    coil: { radius: 4.2, pitch: 6.4 },
    lead: 9,
  },
};

export const IPHONE_GEOMETRY: DeviceGeometry = {
  viewW: 400,
  viewH: 650,
  glass: { x: 89, y: 79, w: 222, h: 394 },
  rasterInset: 2,
  crt: false,
  // A charging cable from the port on its bottom edge.
  tether: {
    port: { x: 199, y: 545 },
    drop: 34,
    sag: { x: 186, y: 640 },
    end: { x: 40, y: 790 },
    coil: { radius: 0, pitch: 1 },
    lead: 0,
  },
};

export type StartupLayout = {
  /** Scene height as a fraction of the viewport height */
  svgVh: number;
  /** Glass-centre Y as a percentage of the scene: the camera's pivot */
  originYPct: number;
  /** Glass-centre Y in viewport px, with the camera at rest */
  glassCenterY: number;
  /** Raster width ÷ viewport width, with the camera at rest */
  rasterScale: number;
  /** Viewport px per scene unit, with the camera at rest */
  pxPerUnit: number;
  /** Vertical shift (px) that brings the glass centre to the viewport centre */
  landLift: number;
  vw: number;
  vh: number;
};

export function computeStartupLayout(
  device: DeviceGeometry,
  { w, h }: Viewport,
): StartupLayout {
  // The scene is sized by height, so on portrait screens cap the height to
  // keep its width within ~94% of the viewport.
  const aspect = device.viewW / device.viewH;
  const svgVh = Math.min(w < 480 ? 0.85 : 0.9, (0.94 * w) / (h * aspect));

  const { glass, rasterInset } = device;
  const originY = (glass.y + glass.h / 2) / device.viewH;
  const svgH = svgVh * h;
  const pxPerUnit = svgH / device.viewH;

  // The biggest viewport-shaped rect inside the glass, less its margin.
  const room = {
    w: (glass.w - rasterInset * 2) * pxPerUnit,
    h: (glass.h - rasterInset * 2) * pxPerUnit,
  };
  const rasterW = Math.min(room.w, room.h * (w / h));
  const glassCenterY = (h - svgH) / 2 + originY * svgH;

  return {
    svgVh,
    originYPct: originY * 100,
    glassCenterY,
    rasterScale: rasterW / w,
    pxPerUnit,
    landLift: h / 2 - glassCenterY,
    vw: w,
    vh: h,
  };
}

/** Where the camera is: a zoom (as a natural log, so equal steps read as an
    equal closing speed) and how far the glass centre has been lifted toward
    the viewport centre (0 = at rest, 1 = landed). */
export type CameraPose = { logScale: number; lift: number };

/** How the machine floats: its height above its resting place (scene units,
    up is positive) and its roll about the glass centre (degrees). */
export type Hover = { rise: number; roll: number };

export const STILL: Hover = { rise: 0, roll: 0 };

/** CSS transform (in the scene's own px, origin at the glass centre) that
    floats the machine inside the camera's frame */
export function hoverTransform(hover: Hover, layout: StartupLayout): string {
  return `translate(0, ${(-hover.rise * layout.pxPerUnit).toFixed(3)}px) rotate(${hover.roll.toFixed(4)}deg)`;
}

/** Where a point on the machine (scene units, at rest) is, once floated */
export function hoverPoint(
  p: { x: number; y: number },
  hover: Hover,
  device: DeviceGeometry,
): { x: number; y: number } {
  const cx = device.glass.x + device.glass.w / 2;
  const cy = device.glass.y + device.glass.h / 2;
  const a = (hover.roll * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return {
    x: cx + dx * Math.cos(a) - dy * Math.sin(a),
    y: cy + dx * Math.sin(a) + dy * Math.cos(a) - hover.rise,
  };
}

/** The zoom at which the raster exactly fills the viewport */
export function landedLogScale(layout: StartupLayout): number {
  return -Math.log(layout.rasterScale);
}

/** CSS transform for the scene, which pivots on the glass centre */
export function stageTransform(pose: CameraPose, layout: StartupLayout): string {
  const s = Math.exp(pose.logScale);
  const ty = pose.lift * layout.landLift;
  return `translate(0, ${ty.toFixed(2)}px) scale(${s.toFixed(5)})`;
}

/** The raster's on-screen scale: 1 means the desktop is at exactly 1:1 */
export function rasterZoom(pose: CameraPose, layout: StartupLayout): number {
  return Math.exp(pose.logScale) * layout.rasterScale;
}

/** CSS transform (origin 0 0) that carries a viewport-sized layer onto the
    raster under the given camera, riding the machine's float, and optionally
    squashed about its centre the way a tube collapses when it switches off.
    Exactly `none` once landed (by then the float has died away). */
export function rasterTransform(
  pose: CameraPose,
  layout: StartupLayout,
  hover: Hover = STILL,
  squash: { x: number; y: number } = { x: 1, y: 1 },
): string {
  const z = rasterZoom(pose, layout);
  const s = Math.exp(pose.logScale);
  const squashed = squash.x !== 1 || squash.y !== 1;
  const floating = Math.abs(hover.rise) > 1e-4 || Math.abs(hover.roll) > 1e-5;
  if (Math.abs(z - 1) < 1e-4 && Math.abs(pose.lift - 1) < 1e-4 && !squashed && !floating) {
    return 'none';
  }
  const { vw, vh } = layout;
  // The glass centre on screen: camera lift, plus the float carried through
  // the camera's zoom. The roll pivots on it.
  const cx = vw / 2;
  const cy =
    layout.glassCenterY + pose.lift * layout.landLift - hover.rise * layout.pxPerUnit * s;
  let t = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
  if (floating) t += ` rotate(${hover.roll.toFixed(4)}deg)`;
  t += ` scale(${z.toFixed(5)})`;
  if (squashed) t += ` scale(${squash.x.toFixed(4)}, ${squash.y.toFixed(4)})`;
  t += ` translate(${(-vw / 2).toFixed(2)}px, ${(-vh / 2).toFixed(2)}px)`;
  return t;
}
