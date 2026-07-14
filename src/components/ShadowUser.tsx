/* ==========================================================================
   ShadowUser — "AndyAI", a translucent ghost cursor that silently demos the
   desktop on every fresh page load: rubber-band selects the left icon
   column, nudges an icon (and puts it back), then drags, resizes and finally
   closes a phantom demo window with its close box.

   Plays on roomy desktop viewports only. The visitor can keep using the
   desktop while it runs; the only way to end it early is the "Skip
   Tutorial" button floating at the bottom of the screen while the ghost is
   visible. The ghost layer sits below every real window (windows start at
   z-index 10), so open windows cover the ghost — it lives on the desktop,
   not over the UI.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import {
  ICON_H,
  ICON_W,
  iconsInMarquee,
  marqueeFromPoints,
  type DesktopIconId,
  type IconPositions,
  type MarqueeRect,
} from '../lib/iconLayout';
import {
  centerWindowPosition,
  getDefaultWindowSize,
  isCompactIcons,
  type Point,
  type Viewport,
} from '../lib/windowBounds';
import { WINDOW_META } from './windowConfig';

/** Matches .desktop-icons-layer { top: 28px } — converts icon-layer ↔ client Y */
const ICON_LAYER_TOP = 28;
/** Above the icon layer (z 1), below every real window (z 10+) */
const GHOST_Z = 5;
const START_DELAY_MS = 1600;
const PHANTOM_W = 360;
const PHANTOM_H = 240;
/** How much the ghost grows the phantom window from its size box */
const RESIZE_DELTA = { x: 70, y: 55 };
const CURSOR_ALPHA = 0.75;
const PHANTOM_ALPHA = 0.65;

type ShadowUserProps = {
  viewport: Viewport;
  iconPositions: IconPositions;
  onMarquee: (rect: MarqueeRect | null) => void;
  onSelectIcons: (ids: DesktopIconId[]) => void;
  onMoveIcon: (id: DesktopIconId, pos: Point) => void;
};

type GhostView = {
  cursor: { x: number; y: number; opacity: number; pressed: boolean } | null;
  win: {
    x: number;
    y: number;
    w: number;
    h: number;
    opacity: number;
    closeArmed: boolean;
  } | null;
};

/* The tour plays in the strip left of the centred boot Read Me window, so it
   needs enough clearance for the first icon column to stay visible. */
function tourEligible(viewport: Viewport): boolean {
  if (isCompactIcons(viewport)) return false;
  const readme = centerWindowPosition(
    getDefaultWindowSize(WINDOW_META.readme, viewport),
    viewport,
  );
  return readme.x >= 150;
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const linear = (t: number) => t;

type Seg = {
  ms: number;
  ease?: (t: number) => number;
  frame?: (t: number) => void;
  end?: () => void;
};

export default function ShadowUser({
  viewport,
  iconPositions,
  onMarquee,
  onSelectIcons,
  onMoveIcon,
}: ShadowUserProps) {
  const [view, setView] = useState<GhostView | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);
  /* Eligibility is decided once, at mount */
  const [play] = useState(() => tourEligible(viewport));

  /* Latest props for the rAF loop without restarting the effect */
  const propsRef = useRef({ iconPositions, onMarquee, onSelectIcons, onMoveIcon });
  propsRef.current = { iconPositions, onMarquee, onSelectIcons, onMoveIcon };
  /* Lets the Skip Tutorial button end the tour from render land */
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!play) return;

    const vp = viewport;
    const icons = propsRef.current.iconPositions;

    /* --- choreography waypoints (icon layer coords unless noted) --------- */
    const a = icons.chess; // top of the left icon column
    const bottomIcon = icons.terminal; // bottom of that column — big sweep
    const mStart = { x: Math.max(4, a.x - 12), y: Math.max(4, a.y - 10) };
    const mEnd = { x: bottomIcon.x + ICON_W + 8, y: bottomIcon.y + ICON_H + 2 };
    const chessCenter = { x: a.x + ICON_W / 2, y: a.y + ICON_H / 2 };
    const toClient = (p: Point): Point => ({ x: p.x, y: p.y + ICON_LAYER_TOP });

    /* Phantom window: below the Read Me if there's room, else bottom-left.
       Everything about it is deterministic, so later grab points (size box,
       close box) can be precomputed from spawn + drag delta. */
    const readmeSize = getDefaultWindowSize(WINDOW_META.readme, vp);
    const readmePos = centerWindowPosition(readmeSize, vp);
    const readmeBottom = readmePos.y + readmeSize.h;
    const winSpawn: Point =
      vp.h - readmeBottom >= PHANTOM_H + 40
        ? { x: Math.max(16, readmePos.x - 40), y: readmeBottom + 12 }
        : { x: 20, y: Math.max(ICON_LAYER_TOP + 8, vp.h - PHANTOM_H - 28) };
    const winGrabPoint = { x: winSpawn.x + PHANTOM_W * 0.5, y: winSpawn.y + 13 };
    const winDrag = { x: 118, y: -34 };
    const winMoved = { x: winSpawn.x + winDrag.x, y: winSpawn.y + winDrag.y };
    const sizeBoxPoint = {
      x: winMoved.x + PHANTOM_W - 9,
      y: winMoved.y + PHANTOM_H - 9,
    };
    const closeBoxPoint = { x: winMoved.x + 19, y: winMoved.y + 12 };

    /* --- mutable animation state ----------------------------------------- */
    const cur = {
      x: -40,
      y: toClient(mStart).y + 130,
      opacity: 0,
      pressed: false,
    };
    const win = {
      x: winSpawn.x,
      y: winSpawn.y,
      w: PHANTOM_W,
      h: PHANTOM_H,
      opacity: 0,
      shown: false,
      closeArmed: false,
    };
    let marqueeAnchor: Point | null = null;
    let selectionKey = '';
    let iconGrab: { id: DesktopIconId; orig: Point; at: Point } | null = null;
    let winGrab: { orig: Point; at: Point } | null = null;
    let winResize: { orig: { w: number; h: number }; at: Point } | null = null;

    const setSelection = (ids: DesktopIconId[]) => {
      const key = ids.join(',');
      if (key === selectionKey) return;
      selectionKey = key;
      propsRef.current.onSelectIcons(ids);
    };

    const updateMarquee = () => {
      if (!marqueeAnchor) return;
      const rect = marqueeFromPoints(
        marqueeAnchor.x,
        marqueeAnchor.y,
        cur.x,
        cur.y - ICON_LAYER_TOP,
      );
      propsRef.current.onMarquee(rect);
      setSelection(iconsInMarquee(rect, propsRef.current.iconPositions));
    };

    const updateIconDrag = () => {
      if (!iconGrab) return;
      propsRef.current.onMoveIcon(iconGrab.id, {
        x: iconGrab.orig.x + (cur.x - iconGrab.at.x),
        y: iconGrab.orig.y + (cur.y - iconGrab.at.y),
      });
    };

    const updateWinDrag = () => {
      if (!winGrab) return;
      win.x = winGrab.orig.x + (cur.x - winGrab.at.x);
      win.y = winGrab.orig.y + (cur.y - winGrab.at.y);
    };

    const updateWinResize = () => {
      if (!winResize) return;
      win.w = winResize.orig.w + (cur.x - winResize.at.x);
      win.h = winResize.orig.h + (cur.y - winResize.at.y);
    };

    /* --- tiny segment engine ---------------------------------------------- */
    const segs: Seg[] = [];
    const wait = (ms: number, end?: () => void) => segs.push({ ms, end });

    /* Glide along a light quadratic arc — reads as a hand, not a robot */
    const moveTo = (
      target: Point,
      ms: number,
      arc = 0.12,
      onFrame?: (t: number) => void,
    ) => {
      let from: Point | null = null;
      let ctrl: Point | null = null;
      segs.push({
        ms,
        ease: easeInOut,
        frame: (t) => {
          if (!from || !ctrl) {
            from = { x: cur.x, y: cur.y };
            const dx = target.x - from.x;
            const dy = target.y - from.y;
            ctrl = {
              x: (from.x + target.x) / 2 - dy * arc,
              y: (from.y + target.y) / 2 + dx * arc,
            };
          }
          const u = 1 - t;
          cur.x = u * u * from.x + 2 * u * t * ctrl.x + t * t * target.x;
          cur.y = u * u * from.y + 2 * u * t * ctrl.y + t * t * target.y;
          onFrame?.(t);
        },
      });
    };

    /* --- the script -------------------------------------------------------- */
    wait(START_DELAY_MS);
    moveTo(toClient(mStart), 900, 0.12, (t) => {
      cur.opacity = CURSOR_ALPHA * Math.min(1, t * 1.8);
    });

    // 1. Rubber-band the whole left icon column, then let go.
    wait(180, () => {
      cur.pressed = true;
      marqueeAnchor = { x: cur.x, y: cur.y - ICON_LAYER_TOP };
    });
    moveTo(toClient(mEnd), 1400, 0.03, () => updateMarquee());
    wait(340);
    wait(140, () => {
      cur.pressed = false;
      marqueeAnchor = null;
      propsRef.current.onMarquee(null);
    });
    wait(420);

    // Click empty desktop above the column to deselect.
    moveTo(toClient({ x: chessCenter.x - 10, y: mStart.y - 46 }), 480, 0.1);
    wait(130, () => {
      cur.pressed = true;
    });
    wait(150, () => {
      cur.pressed = false;
      setSelection([]);
    });
    wait(260);

    // 2. Nudge an icon and put it right back.
    moveTo(toClient(chessCenter), 520, 0.1);
    wait(160, () => {
      cur.pressed = true;
      iconGrab = {
        id: 'chess',
        orig: { ...propsRef.current.iconPositions.chess },
        at: { x: cur.x, y: cur.y },
      };
      setSelection(['chess']);
    });
    moveTo(
      toClient({ x: chessCenter.x + 58, y: chessCenter.y + 40 }),
      680,
      0.08,
      () => updateIconDrag(),
    );
    wait(300);
    moveTo(toClient(chessCenter), 680, 0.08, () => updateIconDrag());
    wait(150, () => {
      if (iconGrab) propsRef.current.onMoveIcon(iconGrab.id, iconGrab.orig);
      iconGrab = null;
      cur.pressed = false;
    });
    wait(300, () => setSelection([]));

    // 3. Drag the phantom window by its title bar.
    wait(80, () => {
      win.shown = true;
    });
    moveTo(winGrabPoint, 780, 0.12, (t) => {
      win.opacity = PHANTOM_ALPHA * t;
    });
    wait(180, () => {
      cur.pressed = true;
      winGrab = { orig: { x: win.x, y: win.y }, at: { x: cur.x, y: cur.y } };
    });
    moveTo({ x: winGrabPoint.x + winDrag.x, y: winGrabPoint.y + winDrag.y }, 1250, 0.1, () =>
      updateWinDrag(),
    );
    wait(240, () => {
      winGrab = null;
      cur.pressed = false;
    });

    // 4. Grow it from the bottom-right size box.
    moveTo(sizeBoxPoint, 520, 0.08);
    wait(160, () => {
      cur.pressed = true;
      winResize = { orig: { w: win.w, h: win.h }, at: { x: cur.x, y: cur.y } };
    });
    moveTo(
      { x: sizeBoxPoint.x + RESIZE_DELTA.x, y: sizeBoxPoint.y + RESIZE_DELTA.y },
      900,
      0.05,
      () => updateWinResize(),
    );
    wait(280, () => {
      winResize = null;
      cur.pressed = false;
    });
    wait(200);

    // 5. Close it properly, with the close box.
    moveTo(closeBoxPoint, 560, 0.1);
    wait(150, () => {
      cur.pressed = true;
      win.closeArmed = true;
    });
    wait(130, () => {
      cur.pressed = false;
      win.shown = false;
    });
    wait(220);

    // Ghost drifts off-screen and fades — tutorial over.
    moveTo({ x: Math.max(-40, winSpawn.x - 70), y: vp.h + 40 }, 700, 0.15, (t) => {
      cur.opacity = CURSOR_ALPHA * (1 - t);
    });

    /* --- runner -------------------------------------------------------------- */
    let raf = 0;
    let segIdx = 0;
    let segStart = 0;
    let stopped = false;
    let leaveTimer: number | null = null;

    const publish = () =>
      setView({
        cursor:
          cur.opacity > 0.02
            ? { x: cur.x, y: cur.y, opacity: cur.opacity, pressed: cur.pressed }
            : null,
        win: win.shown
          ? {
              x: win.x,
              y: win.y,
              w: win.w,
              h: win.h,
              opacity: win.opacity,
              closeArmed: win.closeArmed,
            }
          : null,
      });

    const tick = (now: number) => {
      if (stopped) return;
      if (segIdx < segs.length) {
        const s = segs[segIdx];
        const t = s.ms <= 0 ? 1 : (now - segStart) / s.ms;
        if (t >= 1) {
          s.frame?.(1);
          s.end?.();
          segIdx += 1;
          // Re-anchor to now (not += s.ms): every section's end state gets
          // its own rendered frame, stretching each beat slightly.
          segStart = now;
        } else {
          s.frame?.((s.ease ?? linear)(Math.max(0, t)));
        }
      }
      publish();
      if (segIdx >= segs.length) {
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame((now) => {
      segStart = now;
      tick(now);
    });

    /* Ends the demo (Skip Tutorial button only — regular clicks around the
       desktop leave the tour running): undo everything the ghost was
       holding, then fade the whole layer out. */
    const cancel = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      propsRef.current.onMarquee(null);
      if (iconGrab) propsRef.current.onMoveIcon(iconGrab.id, iconGrab.orig);
      if (selectionKey) propsRef.current.onSelectIcons([]);
      setLeaving(true);
      leaveTimer = window.setTimeout(() => setDone(true), 380);
    };
    cancelRef.current = cancel;

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      cancelRef.current = null;
      if (leaveTimer !== null) window.clearTimeout(leaveTimer);
    };
    // The tour is a one-shot: everything is captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  if (!play || done || !view) return null;

  const ghostVisible = view.cursor !== null || view.win !== null;

  return (
    <>
      <div
        className={`shadow-layer${leaving ? ' shadow-layer--out' : ''}`}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: GHOST_Z,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {view.win && (
          <div
            className="mac-window shadow-window"
            style={{
              left: view.win.x,
              top: view.win.y,
              width: view.win.w,
              height: view.win.h,
              opacity: view.win.opacity,
            }}
          >
            <div className="title-bar active">
              <div
                className={`close-box${view.win.closeArmed ? ' shadow-close-armed' : ''}`}
              >
                <span className="close-box-glyph" />
              </div>
              <div className="title-bar-text">
                <span>AndyAI</span>
              </div>
              <div style={{ width: 15, flexShrink: 0 }} />
            </div>
            <div className="window-body">
              <p style={{ margin: 0 }}>you can drag these!</p>
              <p style={{ margin: 0 }}>(resize and close them, too)</p>
            </div>
            <div className="resize-handle" />
          </div>
        )}
        {view.cursor && (
          <div
            className={`shadow-cursor${view.cursor.pressed ? ' shadow-cursor--pressed' : ''}`}
            style={{
              transform: `translate(${view.cursor.x - 2}px, ${view.cursor.y - 1}px)`,
              opacity: view.cursor.opacity,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" shapeRendering="crispEdges">
              <path
                d="M2 1 L2 16 L6 12 L9 19 L12 18 L9 11 L15 11 Z"
                fill="#000000"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinejoin="miter"
              />
            </svg>
            <span className="shadow-cursor-tag">AndyAI</span>
          </div>
        )}
      </div>
      {ghostVisible && !leaving && (
        <button
          type="button"
          className="mac-button shadow-skip"
          onClick={() => cancelRef.current?.()}
        >
          Skip Tutorial
        </button>
      )}
    </>
  );
}
