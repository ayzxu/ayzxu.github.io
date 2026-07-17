/* ==========================================================================
   ShadowOrb — "AndyAI" on the phone: the mobile twin of ShadowUser, playing
   on a visitor's first load (and again via "Replay Tour" in the Apple
   menu). Touch has no cursor to ghost, so the guide is a small glowing orb
   that floats around the screen narrating a short tour of iPhone mode: HOME
   leaves a fullscreen app, tapping a tile opens one, and the Read Me hides
   a checklist. Its taps are real — the orb sends the boot Read Me home,
   opens the Apps folder, tidies it away, then restores the Read Me.

   Unlike the desktop ghost (which lives *below* the window layer), the orb
   rides above the fullscreen apps like a fingertip would. It is pointer-
   transparent, so the visitor can keep using the phone while it plays; the
   "Skip Tutorial" button is the only way to end it early. On deep-linked
   visits (the phone booted straight into shared content) the orb goes
   passive: it points and narrates but presses nothing, so the tour never
   navigates the visitor away from the page they came for.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import {
  ICON_W,
  type DesktopIconId,
  type IconPositions,
} from '../lib/iconLayout';
import { playTourClick } from '../lib/sounds';
import { hasSeenTour, markTourSeen } from '../lib/tourMemory';
import {
  isCompactIcons,
  MENU_TOP,
  type Point,
  type Viewport,
} from '../lib/windowBounds';
import { WINDOW_META, type WindowId } from './windowConfig';

/** Same unhurried pace as the desktop tour (see ShadowUser TEMPO) */
const TEMPO = 1.8;
/** Above fullscreen apps (z 10+), below the menu bar (1000) and HUD (999) —
    a fingertip is always on top of the screen it touches. */
const ORB_Z = 500;
const START_DELAY_MS = 1600;
const ORB_ALPHA = 0.92;
/** Caption typing pace — kept at real typing speed, not TEMPO-scaled */
const CAPTION_CHAR_MS = 28;
/** Icon-art centre within a 108×88 tile (the rounded plate, not the label) */
const TILE_ART_CY = 33;

type ShadowOrbProps = {
  viewport: Viewport;
  iconPositions: IconPositions;
  /** True when the visitor asked to replay the tour — bypasses the
      played-once memory */
  replay: boolean;
  /** Deep-linked boot: narrate only — never press HOME or open apps */
  passive: boolean;
  onSelectIcons: (ids: DesktopIconId[]) => void;
  onOpenWindow: (id: WindowId) => void;
  onCloseWindow: (id: WindowId) => void;
};

type OrbView = {
  orb: { x: number; y: number; opacity: number; pressed: boolean } | null;
  /** Monotonic tap counter — each increment replays the tap-ripple ring */
  taps: number;
  /** Caption narrating the current act, shown in a bubble by the orb —
      revealed a character at a time, like live typing */
  caption: string;
  /** The caption's full text — stable per act, so it keys the bubble's
      fade-in and sizes the clamp box while the text is still typing out */
  captionKey: string;
  /** Where the caption bubble anchors — the orb, even while it's hidden */
  anchor: Point;
};

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const linear = (t: number) => t;

type Seg = {
  ms: number;
  ease?: (t: number) => number;
  frame?: (t: number) => void;
  end?: () => void;
};

export default function ShadowOrb({
  viewport,
  iconPositions,
  replay,
  passive,
  onSelectIcons,
  onOpenWindow,
  onCloseWindow,
}: ShadowOrbProps) {
  const [view, setView] = useState<OrbView | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);
  /* Only mounted on compact viewports, but re-check like the desktop twin;
     plays for first-time visitors or on an explicit "Replay Tour" request */
  const [play] = useState(
    () => isCompactIcons(viewport) && (replay || !hasSeenTour()),
  );

  /* Latest props for the rAF loop without restarting the effect */
  const propsRef = useRef({
    iconPositions,
    onSelectIcons,
    onOpenWindow,
    onCloseWindow,
  });
  propsRef.current = { iconPositions, onSelectIcons, onOpenWindow, onCloseWindow };
  /* Lets the Skip Tutorial button end the tour from render land */
  const cancelRef = useRef<(() => void) | null>(null);
  /* Rendered caption position — trails its target so clamp flips glide */
  const capPosRef = useRef<Point | null>(null);

  useEffect(() => {
    if (!play) return;
    markTourSeen();

    const vp = viewport;

    /* --- mutable animation state ----------------------------------------- */
    const cur = {
      x: vp.w * 0.5,
      y: vp.h + 40,
      opacity: 0,
      pressed: false,
    };
    let taps = 0;
    /* Captions type themselves out (see publish); caption() re-arms the
       typewriter with the next act's line. */
    let capFull = '';
    let capStart = 0; // rAF timestamp of the first typed frame; 0 = not started
    const caption = (text: string) => {
      capFull = text;
      capStart = 0;
    };
    let selectedNow = false;
    /** Real window the orb opened (so skipping mid-act can close it) */
    let openedWindow: WindowId | null = null;
    /* The orb sends the boot Read Me home for the tile lesson and restores
       it at the end; skipping in between restores it early. */
    let readmeDismissed = false;
    let readmeRestored = false;

    /* HOME box of the fullscreen app with the given title — its spot depends
       on runtime chrome, so it's found from the DOM when the move starts. */
    const homeBoxOf = (title: string) => (): Point => {
      const els = Array.from(document.querySelectorAll('.mac-window--full'));
      for (const el of els) {
        if (el.querySelector('.title-bar-text')?.textContent === title) {
          const r = el.querySelector('.home-box')?.getBoundingClientRect();
          if (r) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      }
      return { x: cur.x, y: cur.y }; // window vanished — stay put
    };

    /** HOME box of whichever fullscreen app is on top (passive pointing) */
    const topHomeBox = (): Point => {
      const els = document.querySelectorAll('.mac-window--full .home-box');
      const el = els[els.length - 1];
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return { x: vp.w - 40, y: MENU_TOP + 14 };
    };

    /** Centre of a home-screen tile's art plate, in client coords */
    const tileCenter = (id: DesktopIconId) => (): Point => {
      const p = propsRef.current.iconPositions[id];
      return { x: p.x + ICON_W / 2, y: MENU_TOP + p.y + TILE_ART_CY };
    };

    const select = (ids: DesktopIconId[]) => {
      selectedNow = ids.length > 0;
      propsRef.current.onSelectIcons(ids);
    };

    /* --- tiny segment engine (same shape as ShadowUser's) ------------------ */
    const segs: Seg[] = [];
    const wait = (ms: number, end?: () => void) =>
      segs.push({ ms: Math.round(ms * TEMPO), end });

    /* Glide along a light quadratic arc — reads as a drifting mote, not a
       robot. Function targets resolve when the move starts (for runtime-
       positioned targets like a fullscreen app's HOME box). */
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

    /** Press pulse + ripple ring, then the tap's real effect */
    const tap = (act: () => void) => {
      wait(140, () => {
        cur.pressed = true;
        taps += 1;
      });
      wait(170, () => {
        cur.pressed = false;
        act();
      });
    };

    /* --- the script -------------------------------------------------------- */
    wait(START_DELAY_MS, () => caption("hi! it's AndyAI — here's a quick tour"));
    // Rise up from below the screen, fading in.
    moveTo({ x: vp.w * 0.5, y: vp.h * 0.55 }, 900, 0.12, (t) => {
      cur.opacity = ORB_ALPHA * Math.min(1, t * 1.8);
    });
    wait(350);

    if (!passive) {
      // 1. HOME sends the boot Read Me away, revealing the home screen.
      wait(0, () => caption('apps fill the screen — HOME goes back'));
      moveTo(homeBoxOf(WINDOW_META.readme.title), 850, 0.1);
      tap(() => {
        readmeDismissed = true;
        propsRef.current.onCloseWindow('readme');
      });
      wait(550);

      // 2. A single tap on a tile opens the app.
      wait(0, () => caption('tap any tile to open it'));
      moveTo(tileCenter('apps'), 750, 0.1);
      wait(140, () => {
        cur.pressed = true;
        taps += 1;
        select(['apps']);
      });
      wait(170, () => {
        cur.pressed = false;
        openedWindow = 'apps';
        propsRef.current.onOpenWindow('apps');
      });
      wait(260, () => select([]));
      wait(700); // admire the folder
      // Tidy it away again — uncaptioned; HOME was already the lesson.
      moveTo(homeBoxOf(WINDOW_META.apps.title), 750, 0.08);
      tap(() => {
        openedWindow = null;
        propsRef.current.onCloseWindow('apps');
      });
      wait(350);

      // 3. Farewell: restore the Read Me and point at its checklist.
      wait(0, () =>
        caption('BTW- the Read Me has a checklist of things to try!'),
      );
      moveTo(tileCenter('readme'), 750, 0.1);
      wait(140, () => {
        cur.pressed = true;
        taps += 1;
        select(['readme']);
      });
      wait(170, () => {
        cur.pressed = false;
        readmeRestored = true;
        propsRef.current.onOpenWindow('readme');
      });
      wait(260, () => select([]));
      wait(500);
    } else {
      // Deep-linked boot: point and narrate, but press nothing — the tour
      // must never navigate the visitor away from the page they came for.
      wait(0, () => caption('HOME up there goes to the home screen'));
      moveTo(
        () => {
          const p = topHomeBox();
          return { x: p.x - 8, y: p.y + 36 };
        },
        850,
        0.1,
      );
      wait(1400);
      wait(0, () => caption('home-screen tiles open more apps'));
      moveTo({ x: vp.w * 0.5, y: vp.h * 0.45 }, 700, 0.1);
      wait(1200);
      wait(0, () =>
        caption('BTW- the Read Me has a checklist of things to try!'),
      );
      wait(1400);
    }

    // Orb drifts off-screen and fades — tutorial over. The farewell caption
    // hangs on for a beat after the orb is gone.
    moveTo({ x: vp.w * 0.5, y: vp.h + 50 }, 700, 0.15, (t) => {
      cur.opacity = ORB_ALPHA * (1 - t);
    });
    wait(1600, () => caption(''));

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
        orb:
          cur.opacity > 0.02
            ? { x: cur.x, y: cur.y, opacity: cur.opacity, pressed: cur.pressed }
            : null,
        taps,
        caption: typed + (typed.length < capFull.length ? '_' : ''),
        captionKey: capFull,
        anchor: { x: cur.x, y: cur.y },
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
      /* The orb's taps are audible — one soft tick per press, fingertip
         style (silent until the browser unlocks audio). */
      if (cur.pressed !== lastPressed) {
        lastPressed = cur.pressed;
        if (cur.pressed) playTourClick(true);
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

    /* Ends the demo (Skip Tutorial button only): undo whatever the orb was
       mid-way through, then fade the whole layer out. */
    const cancel = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      if (selectedNow) propsRef.current.onSelectIcons([]);
      if (openedWindow) propsRef.current.onCloseWindow(openedWindow);
      if (readmeDismissed && !readmeRestored)
        propsRef.current.onOpenWindow('readme');
      setLeaving(true);
      leaveTimer = window.setTimeout(() => setDone(true), 380);
    };
    cancelRef.current = cancel;

    return () => {
      if (!stopped) {
        /* Unmounted mid-play (Replay Tour remounts the component) — put
           back anything the orb was still holding. */
        if (selectedNow) propsRef.current.onSelectIcons([]);
        if (openedWindow) propsRef.current.onCloseWindow(openedWindow);
        if (readmeDismissed && !readmeRestored)
          propsRef.current.onOpenWindow('readme');
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

  const ghostVisible = view.orb !== null || view.captionKey !== '';

  /* Caption bubble rides below the orb's name tag, centred and clamped to
     the viewport. Phone captions wrap (see .shadow-caption--wrap), so the
     width estimate caps at the bubble's CSS max-width; clamp by the full
     text's width so the bubble doesn't slide around while it's typing. */
  const capMaxW = Math.min(Math.round(viewport.w * 0.78), 340);
  const capW = Math.min(Math.round(view.captionKey.length * 9) + 30, capMaxW);
  const capLeft = Math.max(
    8,
    Math.min(view.anchor.x - capW / 2, viewport.w - capW - 8),
  );
  let capTop = view.anchor.y + 54;
  /* Flip above the orb near the bottom, keeping the lowest ~190px clear so
     a two-line bubble never sits on the Skip Tutorial button. */
  if (capTop > viewport.h - 190) {
    capTop = Math.min(view.anchor.y - 96, viewport.h - 190);
  }
  capTop = Math.max(36, capTop);

  /* Ease the rendered position toward the target: the bubble trails the orb
     smoothly, and clamp flips become short glides instead of jumps. */
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
          zIndex: ORB_Z,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {view.orb && (
          <div
            className={`shadow-orb${view.orb.pressed ? ' shadow-orb--pressed' : ''}`}
            style={{
              transform: `translate(${view.orb.x - 15}px, ${view.orb.y - 15}px)`,
              opacity: view.orb.opacity,
            }}
          >
            {/* keyed so each new tap replays the ripple ring */}
            {view.taps > 0 && <span className="shadow-orb-ring" key={view.taps} />}
            <span className="shadow-orb-bob">
              <span className="shadow-orb-core" />
            </span>
            <span className="shadow-orb-tag">AndyAI</span>
          </div>
        )}
      </div>
      {view.captionKey !== '' && capPos && !leaving && (
        <div className="shadow-caption-layer" aria-hidden>
          {/* keyed by the full text so the fade-in plays once per caption,
              not once per typed character */}
          <div
            className="shadow-caption shadow-caption--wrap"
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
