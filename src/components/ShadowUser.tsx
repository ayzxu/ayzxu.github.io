/* ==========================================================================
   ShadowUser — "AndyAI", a translucent ghost cursor that demos the desktop
   on a visitor's first load (and again via "Replay Tour" in the Apple
   menu): rubber-band selects the left icon column, nudges an icon (and puts
   it back), then drags, resizes and finally closes a phantom demo window
   with its close box.

   Plays on roomy desktop viewports only — compact (phone) viewports get
   ShadowOrb, its mobile twin. The visitor can keep using the
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
import { playTourClick } from '../lib/sounds';
import { hasSeenTour, markTourSeen } from '../lib/tourMemory';
import {
  centerWindowPosition,
  getDefaultWindowSize,
  isCompactIcons,
  type Point,
  type Viewport,
} from '../lib/windowBounds';
import { WINDOW_META, type WindowId } from './windowConfig';

/** Matches .desktop-icons-layer { top: 28px } — converts icon-layer ↔ client Y */
const ICON_LAYER_TOP = 28;
/** Global pace multiplier — an unhurried tour keeps visitors on the site
    longer. Applies to every beat except the double-click, which must stay
    at real click speed to read as one. */
const TEMPO = 2.0;
/** Above the icon layer (z 1), below every real window (z 10+) */
const GHOST_Z = 5;
const START_DELAY_MS = 1600;
const PHANTOM_W = 360;
const PHANTOM_H = 240;
/** How much the ghost grows the phantom window from its size box */
const RESIZE_DELTA = { x: 70, y: 55 };
const CURSOR_ALPHA = 0.75;
const PHANTOM_ALPHA = 0.65;
/** Caption typing pace — kept at real typing speed, not TEMPO-scaled */
const CAPTION_CHAR_MS = 28;
/** Caption bubble width estimate — VT323 runs ~10px/char at this size */
const captionWidth = (text: string) => Math.round(text.length * 10.2) + 32;
const FAREWELL_CAPTION = 'BTW- the Read Me has a checklist of things to try!';

type ShadowUserProps = {
  viewport: Viewport;
  iconPositions: IconPositions;
  /** True when the visitor asked to replay the tour — bypasses the
      played-once memory */
  replay: boolean;
  onMarquee: (rect: MarqueeRect | null) => void;
  onSelectIcons: (ids: DesktopIconId[]) => void;
  onMoveIcon: (id: DesktopIconId, pos: Point) => void;
  onOpenWindow: (id: WindowId) => void;
  onCloseWindow: (id: WindowId) => void;
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
  /** Caption narrating the current act, shown in a bubble by the cursor —
      revealed a character at a time, like live typing */
  caption: string;
  /** The caption's full text — stable per act, so it keys the bubble's
      fade-in and sizes the clamp box while the text is still typing out */
  captionKey: string;
  /** Where the caption bubble anchors — the cursor, even while it's hidden */
  anchor: Point;
  /** While clicking a real (topmost) window, the cursor renders above it */
  elevated: boolean;
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
  replay,
  onMarquee,
  onSelectIcons,
  onMoveIcon,
  onOpenWindow,
  onCloseWindow,
}: ShadowUserProps) {
  const [view, setView] = useState<GhostView | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);
  /* Eligibility is decided once, at mount: a roomy viewport, and either a
     first-time visitor or an explicit "Replay Tour" request */
  const [play] = useState(
    () => tourEligible(viewport) && (replay || !hasSeenTour()),
  );

  /* Latest props for the rAF loop without restarting the effect */
  const propsRef = useRef({
    iconPositions,
    onMarquee,
    onSelectIcons,
    onMoveIcon,
    onOpenWindow,
    onCloseWindow,
  });
  propsRef.current = {
    iconPositions,
    onMarquee,
    onSelectIcons,
    onMoveIcon,
    onOpenWindow,
    onCloseWindow,
  };
  /* Lets the Skip Tutorial button end the tour from render land */
  const cancelRef = useRef<(() => void) | null>(null);
  /* Rendered caption position — trails its target so cursor wiggles and
     clamp flips glide instead of jumping (renders happen once per rAF) */
  const capPosRef = useRef<Point | null>(null);

  useEffect(() => {
    if (!play) return;
    markTourSeen();

    const vp = viewport;
    const icons = propsRef.current.iconPositions;

    /* --- choreography waypoints (icon layer coords unless noted) --------- */
    const a = icons.chess; // top of the left icon column
    const bottomIcon = icons.terminal; // bottom of that column — big sweep
    const mStart = { x: Math.max(4, a.x - 12), y: Math.max(4, a.y - 10) };
    const mEnd = { x: bottomIcon.x + ICON_W + 8, y: bottomIcon.y + ICON_H + 2 };
    const chessCenter = { x: a.x + ICON_W / 2, y: a.y + ICON_H / 2 };
    const toClient = (p: Point): Point => ({ x: p.x, y: p.y + ICON_LAYER_TOP });

    /* Phantom window: in the strip left of the Read Me, with the whole act
       (spawn, drag up, resize down) centred on the viewport's vertical
       middle — parked near the bottom edge, the caption bubble kept having
       to dodge the screen edge and jumped around. Everything about it is
       deterministic, so later grab points (size box, close box) can be
       precomputed from spawn + drag delta. */
    const readmeSize = getDefaultWindowSize(WINDOW_META.readme, vp);
    const readmePos = centerWindowPosition(readmeSize, vp);
    const winDrag = { x: 118, y: -34 };
    const winSpawn: Point = {
      // Clear of the Read Me even after the rightward drag + resize
      x: Math.max(20, readmePos.x - PHANTOM_W - winDrag.x - RESIZE_DELTA.x - 12),
      y: Math.max(
        ICON_LAYER_TOP + 8 - winDrag.y,
        Math.round(vp.h / 2 - (PHANTOM_H + RESIZE_DELTA.y) / 2 - winDrag.y),
      ),
    };
    const winGrabPoint = { x: winSpawn.x + PHANTOM_W * 0.5, y: winSpawn.y + 13 };
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
    /* Captions type themselves out (see publish); caption() re-arms the
       typewriter with the next act's line. */
    let capFull = '';
    let capStart = 0; // rAF timestamp of the first typed frame; 0 = not started
    const caption = (text: string) => {
      capFull = text;
      capStart = 0;
    };
    let elevated = false;
    /** When set, the caption bubble anchors here instead of the cursor —
        the farewell parks beside the Read Me checklist while the cursor
        exits. */
    let capAnchor: Point | null = null;
    /** Real window the ghost opened (so skipping mid-act can close it) */
    let openedWindow: WindowId | null = null;

    /* Locate a real (non-phantom) window by title — the opened window's spot
       depends on runtime state, so its close box is found from the DOM. */
    const realCloseBox = (title: string) => (): Point => {
      const els = Array.from(
        document.querySelectorAll('.mac-window:not(.shadow-window)'),
      );
      for (const el of els) {
        if (el.querySelector('.title-bar-text')?.textContent === title) {
          const r = el.getBoundingClientRect();
          return { x: r.left + 20, y: r.top + 14 };
        }
      }
      return { x: cur.x, y: cur.y }; // window vanished — stay put
    };

    /* Where the farewell caption parks: centred over the top of the Read
       Me's "Things to check out" checklist, instead of chasing the exiting
       cursor into the corner. Measured from the DOM when the act starts
       (the visitor may have moved the window); falls back to the
       boot-centred Read Me geometry. The renderer draws the bubble at
       anchor + (20, 48), so those offsets are backed out here. */
    const farewellAnchor = (): Point => {
      const pane = document
        .querySelector('.readme-tour-pane')
        ?.getBoundingClientRect();
      const cx = pane
        ? pane.left + pane.width / 2
        : readmePos.x + readmeSize.w * 0.72;
      const top = pane ? pane.top : readmePos.y + readmeSize.h * 0.3;
      return { x: cx - captionWidth(FAREWELL_CAPTION) / 2 - 20, y: top };
    };

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
    const wait = (ms: number, end?: () => void) =>
      segs.push({ ms: Math.round(ms * TEMPO), end });
    /** Unscaled beat — for gestures whose timing must stay realistic */
    const waitExact = (ms: number, end?: () => void) => segs.push({ ms, end });

    /* Glide along a light quadratic arc — reads as a hand, not a robot.
       Function targets resolve when the move starts (for runtime-positioned
       targets like a freshly opened window's close box). */
    const moveTo = (
      target: Point | (() => Point),
      ms: number,
      arc = 0.12,
      onFrame?: (t: number) => void,
    ) => {
      let from: Point | null = null;
      let ctrl: Point | null = null;
      let to: Point | null = null;
      segs.push({
        ms: Math.round(ms * TEMPO),
        ease: easeInOut,
        frame: (t) => {
          if (!from || !ctrl || !to) {
            from = { x: cur.x, y: cur.y };
            to = typeof target === 'function' ? target() : target;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            ctrl = {
              x: (from.x + to.x) / 2 - dy * arc,
              y: (from.y + to.y) / 2 + dx * arc,
            };
          }
          const u = 1 - t;
          cur.x = u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x;
          cur.y = u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y;
          onFrame?.(t);
        },
      });
    };

    /* --- the script -------------------------------------------------------- */
    wait(START_DELAY_MS, () => caption("hi! it's AndyAI — here's a quick tour"));
    moveTo(toClient(mStart), 900, 0.12, (t) => {
      cur.opacity = CURSOR_ALPHA * Math.min(1, t * 1.8);
    });

    // 1. Rubber-band the whole left icon column, then let go.
    wait(180, () => {
      caption('drag on the desktop to select icons');
      cur.pressed = true;
      marqueeAnchor = { x: cur.x, y: cur.y - ICON_LAYER_TOP };
    });
    moveTo(toClient(mEnd), 950, 0.03, () => updateMarquee());
    wait(240);
    wait(140, () => {
      cur.pressed = false;
      marqueeAnchor = null;
      propsRef.current.onMarquee(null);
    });
    wait(300);

    // Click empty desktop above the column to deselect.
    moveTo(toClient({ x: chessCenter.x - 10, y: mStart.y - 46 }), 400, 0.1);
    wait(130, () => {
      cur.pressed = true;
    });
    wait(150, () => {
      cur.pressed = false;
      setSelection([]);
    });
    wait(180);

    // 2. Nudge an icon and put it right back.
    wait(0, () => caption('icons can be moved around'));
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

    // 3. Double-click a real folder open, then close it with its close box.
    //    The cursor pops above the window stack while it works the close box
    //    (a real pointer would be above the topmost window too).
    wait(0, () => caption('double-click icons to open them'));
    moveTo(toClient({ x: icons.apps.x + ICON_W / 2, y: icons.apps.y + ICON_H / 2 }), 600, 0.1);
    waitExact(110, () => {
      cur.pressed = true;
      setSelection(['apps']);
    });
    waitExact(100, () => {
      cur.pressed = false;
    });
    waitExact(90, () => {
      cur.pressed = true;
    });
    waitExact(100, () => {
      cur.pressed = false;
      elevated = true;
      openedWindow = 'apps';
      propsRef.current.onOpenWindow('apps');
    });
    wait(750); // hourglass beat while the window "loads"
    // Tidy the folder away again — uncaptioned; the ✕ lesson itself comes
    // later, on the phantom window, so the teaching order stays sequential.
    moveTo(realCloseBox(WINDOW_META.apps.title), 650, 0.08);
    wait(200, () => {
      cur.pressed = true;
    });
    wait(150, () => {
      cur.pressed = false;
      openedWindow = null;
      propsRef.current.onCloseWindow('apps');
    });
    wait(260, () => {
      elevated = false;
      setSelection([]);
    });

    // 4. Drag the phantom window by its title bar.
    wait(80, () => {
      caption('drag windows by their title bar');
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

    // 5. Grow it from the bottom-right size box.
    wait(0, () => caption('resize from the corner size box'));
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

    // 6. Close the phantom with its close box — the ✕ lesson, last so the
    //    captions teach in order: select → move → open → drag → resize → close.
    wait(0, () => caption('the ✕ box closes a window'));
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

    // Ghost drifts off-screen and fades — tutorial over. The farewell
    // caption parks itself over the Read Me checklist it's pointing the
    // visitor at, and hangs on for a beat after the cursor is gone.
    wait(0, () => {
      caption(FAREWELL_CAPTION);
      capAnchor = farewellAnchor();
    });
    moveTo({ x: -40, y: vp.h + 40 }, 700, 0.15, (t) => {
      // Fully faded well before the edge — dissolves mid-exit
      cur.opacity = CURSOR_ALPHA * Math.max(0, 1 - t * 1.6);
    });
    // Long farewell hold — the checklist tip deserves an unhurried read.
    wait(1600);

    // Very last beat: park a caption under the Apple menu so visitors know
    // where to find the tour again ("Replay Tour" lives up there).
    wait(0, () => {
      caption('replay me anytime from the apple menu up here');
      // Renderer draws the bubble at anchor + (20, 48) — this lands it at
      // (12, 36), tucked just below the menu bar's apple.
      capAnchor = { x: -8, y: -12 };
    });
    wait(1500, () => caption(''));

    /* --- runner -------------------------------------------------------------- */
    let raf = 0;
    let segIdx = 0;
    let segStart = 0;
    let stopped = false;
    let leaveTimer: number | null = null;
    let lastTick = 0;
    let lastPressed = false;

    const publish = (now: number) => {
      /* Reveal the caption a character at a time; a trailing _ plays the
         part of the terminal cursor until the line is complete. */
      if (capFull !== '' && capStart === 0) capStart = now;
      const typed =
        capFull === ''
          ? ''
          : capFull.slice(
              0,
              Math.max(1, Math.ceil((now - capStart) / CAPTION_CHAR_MS)),
            );
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
        caption: typed + (typed.length < capFull.length ? '_' : ''),
        captionKey: capFull,
        anchor: capAnchor ?? { x: cur.x, y: cur.y },
        elevated,
      });
    };

    const tick = (now: number) => {
      if (stopped) return;
      /* rAF stops while the tab is hidden — shift the clocks past the gap
         so the tour resumes where it left off instead of lurching ahead. */
      if (lastTick > 0 && now - lastTick > 200) {
        segStart += now - lastTick;
        if (capStart > 0) capStart += now - lastTick;
      }
      lastTick = now;
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
      /* The ghost's presses are audible — a soft tick per edge, like a real
         mouse button (silent until the browser unlocks audio). */
      if (cur.pressed !== lastPressed) {
        lastPressed = cur.pressed;
        playTourClick(cur.pressed);
      }
      publish(now);
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
      if (openedWindow) propsRef.current.onCloseWindow(openedWindow);
      setLeaving(true);
      leaveTimer = window.setTimeout(() => setDone(true), 380);
    };
    cancelRef.current = cancel;

    return () => {
      if (!stopped) {
        /* Unmounted mid-play (Replay Tour remounts the component) — put
           back anything the ghost was still holding. */
        propsRef.current.onMarquee(null);
        if (iconGrab) propsRef.current.onMoveIcon(iconGrab.id, iconGrab.orig);
        if (selectionKey) propsRef.current.onSelectIcons([]);
        if (openedWindow) propsRef.current.onCloseWindow(openedWindow);
      }
      stopped = true;
      cancelAnimationFrame(raf);
      cancelRef.current = null;
      if (leaveTimer !== null) window.clearTimeout(leaveTimer);
    };
    // The tour is a one-shot: everything is captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  if (!play || done || !view) return null;

  const ghostVisible =
    view.cursor !== null || view.win !== null || view.captionKey !== '';

  /* Caption bubble rides just below the cursor's name tag, clamped to the
     viewport. Clamp by the full text's width so the bubble doesn't slide
     around while it's still typing out. */
  const capW = captionWidth(view.captionKey);
  const capLeft = Math.max(8, Math.min(view.anchor.x + 20, viewport.w - capW - 8));
  let capTop = view.anchor.y + 48;
  /* Flip above the cursor near the bottom, and keep the lowest ~100px clear
     so the bubble never sits on the Skip Tutorial button. */
  if (capTop > viewport.h - 104) {
    capTop = Math.min(view.anchor.y - 52, viewport.h - 104);
  }
  capTop = Math.max(36, capTop);

  /* Ease the rendered position toward the target: the bubble trails the
     cursor smoothly rather than mirroring every wiggle, and clamp flips
     become short glides instead of ~100px jumps. */
  if (view.captionKey === '') {
    capPosRef.current = null;
  } else if (!capPosRef.current) {
    capPosRef.current = { x: capLeft, y: capTop };
  } else {
    capPosRef.current = {
      x: capPosRef.current.x + (capLeft - capPosRef.current.x) * 0.16,
      y: capPosRef.current.y + (capTop - capPosRef.current.y) * 0.16,
    };
  }
  const capPos = capPosRef.current;

  return (
    <>
      <div
        className={`shadow-layer${leaving ? ' shadow-layer--out' : ''}`}
        style={{
          position: 'absolute',
          inset: 0,
          // While clicking the real (topmost) window the cursor rides above
          // the window stack, like a real pointer would; 500 stays below the
          // menu bar (1000) and the tour HUD (999).
          zIndex: view.elevated ? 500 : GHOST_Z,
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
      {view.captionKey !== '' && capPos && !leaving && (
        <div className="shadow-caption-layer" aria-hidden>
          {/* keyed by the full text so the fade-in plays once per caption,
              not once per typed character */}
          <div
            className="shadow-caption"
            key={view.captionKey}
            style={{
              transform: `translate(${Math.round(capPos.x)}px, ${Math.round(capPos.y)}px)`,
            }}
          >
            {view.caption}
          </div>
        </div>
      )}
      {ghostVisible && !leaving && (
        <div className="shadow-hud">
          <button
            type="button"
            className="mac-button shadow-skip"
            onClick={() => cancelRef.current?.()}
          >
            Skip Tutorial
          </button>
        </div>
      )}
    </>
  );
}
