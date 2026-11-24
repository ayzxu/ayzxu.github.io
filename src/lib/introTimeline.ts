/* introTimeline — the startup film as pure functions of one clock.

   Nothing here is stateful: every frame is computed from the elapsed time
   alone, so the picture can never jump between states — speeding the clock up
   (a skip), pausing it (a background tab) or resizing mid-shot all stay
   continuous. Beats overlap on smoothstep windows, so one thing is always
   fading out as the next fades in.

   cold     → first visit: title card, the machine rises out of the dark, the
              tube switches on, the welcome types itself, and the camera dives
              into the screen until the desktop is the whole viewport
   warm     → powered on by hand from the exterior: the same film from the
              moment the tube switches on
   shutdown → the camera pulls back out of the desktop to the machine on the
              desk, then the tube collapses to a line and a dot */

import {
  landedLogScale,
  rasterZoom,
  type CameraPose,
  type StartupLayout,
} from './startupGeometry';

export type IntroMode = 'cold' | 'warm' | 'shutdown';

export const WELCOME_TEXT = 'Welcome to AndyOS';

/* --- Beats (ms on the film clock) ---------------------------------------- */
const TITLE_IN = [100, 700] as const;
const TITLE_OUT = [1350, 1950] as const;
const EMERGE = [1500, 2500] as const;
/** The tube switches on (and the chime plays) */
export const POWER_AT = 2350;
const TYPE = [2780, 3380] as const;
const DIVE = [3250, 5050] as const;
/** The boot screen gives way to the desktop, halfway through the dive */
const DESK = [4150, 4370] as const;
/** The desktop starts painting (still covered) a beat before it's revealed */
const DESK_PAINT = DESK[0] - 400;
/** Where a hand-started boot picks the film up */
export const WARM_START = POWER_AT - 160;

const PULL_BACK = [0, 1150] as const;
const COLLAPSE_Y = [1150, 1320] as const;
const COLLAPSE_X = [1320, 1470] as const;
const DOT_FADE = [1470, 1640] as const;
const SHUTDOWN_END = 1700;

/** Camera at the start of the film, and as the dive begins (natural logs) */
const PUSH_FROM = Math.log(0.86);
const PUSH_TO = Math.log(1.04);

/* --- Easing ---------------------------------------------------------------- */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Smoothstep of t through the window [a, b] */
const ramp = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeInCubic = (x: number) => x * x * x;

/** Quintic from 0 to 1 that leaves with slope `v0` and arrives with zero
    speed and zero acceleration, so the landing has no settle or bump. */
function glide(x: number, v0: number): number {
  const x3 = x * x * x;
  const x4 = x3 * x;
  const x5 = x4 * x;
  const h1 = x - 6 * x3 + 8 * x4 - 3 * x5;
  const h5 = 10 * x3 - 15 * x4 + 6 * x5;
  return v0 * h1 + h5;
}

/* --- Camera ---------------------------------------------------------------- */

/** The slow push-in that runs under everything before the dive: constant
    speed in log scale, so the approach reads as one steady glide. */
function pushAt(t: number): number {
  return PUSH_FROM + ((PUSH_TO - PUSH_FROM) * t) / DIVE[0];
}

/** Where the machine sits while it's switched off */
export const REST_POSE: CameraPose = { logScale: pushAt(WARM_START), lift: 0 };

function filmCamera(t: number, layout: StartupLayout): CameraPose {
  if (t <= DIVE[0]) return { logScale: pushAt(t), lift: 0 };
  const land = landedLogScale(layout);
  const span = land - PUSH_TO;
  const duration = DIVE[1] - DIVE[0];
  // Leave the push at the speed it was already moving.
  const v0 = ((PUSH_TO - PUSH_FROM) / DIVE[0]) * (duration / span);
  const f = glide(clamp01((t - DIVE[0]) / duration), v0);
  return { logScale: PUSH_TO + span * f, lift: f };
}

function shutdownCamera(t: number, layout: StartupLayout): CameraPose {
  const land = landedLogScale(layout);
  const f = 1 - glide(clamp01((t - PULL_BACK[0]) / (PULL_BACK[1] - PULL_BACK[0])), 0);
  return { logScale: REST_POSE.logScale + (land - REST_POSE.logScale) * f, lift: f };
}

/* --- Frames ---------------------------------------------------------------- */

export type IntroFrame = {
  camera: CameraPose;
  /** Opacity of the whole scene (it rises out of the dark on a cold start) */
  stageOpacity: number;
  title: { opacity: number; scale: number };
  /** The lit picture: squash (tube on/off), opacity (backlight), and a white
      bloom while the tube is switching */
  raster: { shown: boolean; squashX: number; squashY: number; opacity: number; flash: number };
  /** Screen light spilling onto the case and desk, 0–1 */
  light: number;
  /** Characters of the welcome typed so far, and whether the caret shows */
  typed: number;
  caret: boolean;
  /** Opacity of the boot screen over the desktop (0 = desktop showing) */
  cover: number;
  /** Whether the desktop beneath needs painting yet */
  desktopPainted: boolean;
  /** Glass reflections, strongest from afar and gone at 1:1 */
  glass: number;
  /** The desktop's own scanlines and grain, faded while it's tiny so the fine
      patterns don't shimmer */
  fineDetail: number;
  done: boolean;
};

export function introFrame(
  mode: IntroMode,
  t: number,
  layout: StartupLayout,
  crt: boolean,
): IntroFrame {
  const camera = mode === 'shutdown' ? shutdownCamera(t, layout) : filmCamera(t, layout);
  const z = rasterZoom(camera, layout);
  const glass = 1 - ramp(z, 0.5, 0.985);
  const fineDetail = ramp(z, 0.8, 0.985);

  if (mode === 'shutdown') {
    const y = ramp(t, COLLAPSE_Y[0], COLLAPSE_Y[1]);
    const x = ramp(t, COLLAPSE_X[0], COLLAPSE_X[1]);
    const fade = ramp(t, DOT_FADE[0], DOT_FADE[1]);
    const off = clamp01((t - COLLAPSE_Y[0]) / 450);
    return {
      camera,
      stageOpacity: 1,
      title: { opacity: 0, scale: 1 },
      raster: crt
        ? {
            shown: fade < 1,
            squashX: 1 - 0.985 * x,
            squashY: 1 - 0.994 * easeInCubic(y),
            opacity: 1 - fade,
            flash: 0.9 * y,
          }
        : { shown: off < 1, squashX: 1, squashY: 1, opacity: 1 - smooth(off), flash: 0 },
      light: (1 - smooth(off)) ** 2,
      typed: WELCOME_TEXT.length,
      caret: false,
      cover: 0,
      desktopPainted: true,
      glass,
      fineDetail,
      done: t >= SHUTDOWN_END,
    };
  }

  const on = t - POWER_AT;
  const raster = !crt
    ? { shown: on >= 0, squashX: 1, squashY: 1, opacity: ramp(on, 0, 320), flash: 0 }
    : {
        shown: on >= 0,
        squashX: 1,
        squashY: 0.012 + 0.988 * easeOutCubic(clamp01(on / 240)),
        opacity: 1,
        flash: 0.85 * ramp(on, 0, 60) * (1 - ramp(on, 140, 700)),
      };
  const typing = clamp01((t - TYPE[0]) / (TYPE[1] - TYPE[0]));
  const titleOut = ramp(t, TITLE_OUT[0], TITLE_OUT[1]);

  return {
    camera,
    stageOpacity: mode === 'cold' ? ramp(t, EMERGE[0], EMERGE[1]) : 1,
    title:
      mode === 'cold'
        ? { opacity: ramp(t, TITLE_IN[0], TITLE_IN[1]) * (1 - titleOut), scale: 1 - 0.065 * titleOut }
        : { opacity: 0, scale: 1 },
    raster,
    light: ramp(on, 40, 700) ** 2,
    typed: Math.floor(WELCOME_TEXT.length * typing),
    caret: t >= TYPE[0] - 260 && t < DESK[0],
    cover: 1 - ramp(t, DESK[0], DESK[1]),
    desktopPainted: t >= DESK_PAINT,
    glass,
    fineDetail,
    done: t >= DIVE[1],
  };
}
