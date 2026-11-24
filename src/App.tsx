/* App — the journey from the startup hardware to the interactive desktop.

     intro    → a film on one clock (see lib/introTimeline): on a first visit
                the title card, the machine rising out of the dark, the tube
                switching on, the welcome typing itself, and one camera move
                that dives into the screen; when powered on by hand, the same
                film from the moment the tube comes on
     desktop  → the live, interactive desktop (windows, menus, icons)
     shutdown → the camera pulls back out of the desktop to the machine, and
                the tube collapses to a dot
     exterior → the machine floats powered off until it's clicked back on

   The picture on the tube *is* the desktop. It's mounted as the film starts,
   viewport-sized, and carried onto the glass by the same camera that moves
   the machine, so the dive ends with it at exactly 1:1 and the hand-off is
   nothing more than the camera letting go: no crossfade, no remount, no jump.
   Every frame is written straight to the DOM from the clock; React only
   re-renders at the phase boundaries, when nothing on screen changes.

   The machine floats throughout, on a second clock that never stops or
   speeds up, and the float dies away exactly as the camera lands.

   Any click, key or scroll during the intro fast-forwards the clock (it never
   jumps), and a hidden tab pauses it. Deep links and reduced-motion visitors
   start on the desktop. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import './App.css';
import Macintosh from './components/Macintosh';
import Iphone from './components/Iphone';
import Desktop from './components/Desktop';
import BootScreen from './components/BootScreen';
import { windowForRoute, type WindowId } from './components/windowConfig';
import { getViewport, isCompactIcons, isPinchZoomed, type Viewport } from './lib/windowBounds';
import { playStartupChime } from './lib/sounds';
import {
  IPHONE_GEOMETRY,
  MAC_GEOMETRY,
  computeStartupLayout,
  hoverPoint,
  hoverTransform,
  rasterTransform,
  stageTransform,
  type StartupLayout,
} from './lib/startupGeometry';
import {
  POWER_AT,
  WARM_START,
  WELCOME_TEXT,
  introFrame,
  type IntroFrame,
  type IntroMode,
} from './lib/introTimeline';
import { tetherPath } from './lib/tether';

type Phase = 'intro' | 'desktop' | 'shutdown' | 'exterior';

const DESKTOP_PATHS = ['/projects', '/fun', '/about', '/resume', '/chess', '/writings', '/desktop'];

/** How much faster the film runs once the visitor asks to skip */
const FAST_FORWARD = 3.2;
/** Time constant (ms) of the ease into fast-forward, so the speed-up is felt
    as an acceleration rather than a lurch */
const FAST_FORWARD_EASE_MS = 90;
/** Longest frame step the clock will take, so a stalled or hidden tab
    resumes where it left off instead of skipping ahead */
const MAX_STEP_MS = 48;
/** The title card holds on black until its typeface is in, up to this long;
    after that it uses the fallback face for the whole shot (never a swap) */
const TITLE_FONT = '450 64px "Geist Variable"';
const TITLE_FONT_WAIT_MS = 900;
/** Length of the pulse of light on the cable, as a share of the cable */
const PULSE_SHARE = 0.09;

/* GitHub Pages serves the pre-rendered deep links as directories, so the
   browser lands on e.g. /projects/ — drop the trailing slash before matching. */
function normalizedPath(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function initialPhase(): Phase {
  if (DESKTOP_PATHS.includes(normalizedPath())) return 'desktop';
  return prefersReducedMotion() ? 'desktop' : 'intro';
}

export default function App() {
  const navigate = useNavigate();

  // Phones get the iPhone, everything else the Macintosh — chosen once.
  const [compact] = useState(() => isCompactIcons(getViewport()));
  const Device = compact ? Iphone : Macintosh;
  const geometry = compact ? IPHONE_GEOMETRY : MAC_GEOMETRY;

  // The route is read once at mount — deep links open their window.
  const [initialWindow] = useState<WindowId | undefined>(() =>
    windowForRoute(normalizedPath()),
  );
  const [phase, setPhase] = useState<Phase>(initialPhase);
  /** Which film the intro phase plays */
  const [film, setFilm] = useState<'cold' | 'warm'>('cold');
  /** A cold start mounts the desktop once the title is up, so its wallpapers
      don't compete with the title's typeface for the network */
  const [desktopMounted, setDesktopMounted] = useState(phase === 'desktop');

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const restRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const cableRef = useRef<SVGSVGElement>(null);
  const [rig] = useState(() => ({ machine: machineRef, shadow: shadowRef, cable: cableRef }));
  /** The float's clock: runs at 1× through every phase, never fast-forwards,
      so the bob carries on unbroken from film to exterior and back */
  const ambient = useRef(0);

  /* The camera maths runs on the root's own box, which is exactly what the
     screen layer fills, so 1:1 is 1:1 however the browser sizes `vh`. */
  const measure = (): Viewport => {
    const root = rootRef.current;
    return root && root.clientWidth
      ? { w: root.clientWidth, h: root.clientHeight }
      : getViewport();
  };
  const [layout, setLayout] = useState(() => computeStartupLayout(geometry, getViewport()));
  const layoutRef = useRef<StartupLayout>(layout);

  /* GitHub Pages serves 404.html for unknown paths, so the SPA boots with the
     bogus URL still in the address bar — send it back to '/'. */
  useEffect(() => {
    const path = normalizedPath();
    if (path !== '/' && !DESKTOP_PATHS.includes(path) && !windowForRoute(path)) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useLayoutEffect(() => {
    const update = () => {
      // Pinch-zooming on iOS resizes the visual viewport, not the layout.
      if (isPinchZoomed()) return;
      const next = computeStartupLayout(geometry, measure());
      layoutRef.current = next;
      setLayout(next);
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [geometry]);

  const typedShown = useRef(-1);

  /* The film. Posed before first paint, so nothing is ever seen out of place,
     then frame by frame off the clock until the shot ends. */
  useLayoutEffect(() => {
    if (phase === 'desktop') return;
    const mode: IntroMode =
      phase === 'shutdown' ? 'shutdown' : phase === 'exterior' ? 'exterior' : film;

    /** Write one frame of the film to the DOM. Elements that aren't mounted
        (yet, or any more) are simply skipped. */
    const paint = (f: IntroFrame, lay: StartupLayout) => {
      const stage = stageRef.current;
      if (stage) {
        stage.style.transform = stageTransform(f.camera, lay);
        stage.style.opacity = String(f.stageOpacity);
        stage.style.setProperty('--screen-light', f.light.toFixed(3));
      }
      if (machineRef.current) machineRef.current.style.transform = hoverTransform(f.hover, lay);
      if (shadowRef.current) {
        const { scaleX, scaleY, opacity } = f.shadow;
        shadowRef.current.style.transform = `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
        shadowRef.current.style.opacity = opacity.toFixed(3);
      }
      const cable = cableRef.current;
      if (cable) {
        const plug = hoverPoint(geometry.tether.port, f.hover, geometry);
        const { d, length } = tetherPath(geometry.tether, plug, f.sway);
        const dash = length * PULSE_SHARE;
        const pulseOn = f.pulse.strength > 0.001;
        cable.querySelectorAll<SVGPathElement>('path[data-cable]').forEach((path) => {
          const role = path.dataset.cable;
          if (role === 'edge' || role === 'body') {
            path.setAttribute('d', d);
          } else if (role === 'glow') {
            path.setAttribute('opacity', (0.32 * f.pulse.glow).toFixed(3));
            if (f.pulse.glow > 0.001) path.setAttribute('d', d);
          } else {
            path.setAttribute('opacity', (role === 'halo' ? 0.4 : 1) * f.pulse.strength + '');
            if (!pulseOn) return;
            path.setAttribute('d', d);
            // One dash the length of the pulse, centred `at` of the way down
            path.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${(length + dash).toFixed(1)}`);
            path.setAttribute('stroke-dashoffset', (dash / 2 - f.pulse.at * length).toFixed(1));
          }
        });
      }
      const title = titleRef.current;
      if (title) {
        title.style.opacity = String(f.title.opacity);
        title.style.transform = `scale(${f.title.scale.toFixed(4)})`;
      }
      const screen = screenRef.current;
      if (screen) {
        screen.style.transform = rasterTransform(f.camera, lay, f.hover, {
          x: f.raster.squashX,
          y: f.raster.squashY,
        });
        screen.style.visibility = f.raster.shown ? 'visible' : 'hidden';
        screen.style.opacity = String(f.raster.opacity);
        screen.style.setProperty('--fine-detail', f.fineDetail.toFixed(3));
      }
      if (desktopRef.current) {
        desktopRef.current.style.visibility = f.desktopPainted ? '' : 'hidden';
      }
      if (glassRef.current) glassRef.current.style.opacity = String(f.glass);
      if (flashRef.current) flashRef.current.style.opacity = String(f.raster.flash);
      const cover = coverRef.current;
      if (cover) {
        cover.style.opacity = String(f.cover);
        cover.style.visibility = f.cover > 0 ? '' : 'hidden';
      }
      if (caretRef.current) caretRef.current.style.visibility = f.caret ? '' : 'hidden';
      if (typedRef.current && restRef.current && f.typed !== typedShown.current) {
        typedShown.current = f.typed;
        typedRef.current.textContent = WELCOME_TEXT.slice(0, f.typed);
        restRef.current.textContent = WELCOME_TEXT.slice(f.typed);
      }
    };

    let t = mode === 'warm' ? WARM_START : 0;
    let rate = 1;
    let targetRate = 1;
    let last: number | null = null;
    let running = mode !== 'cold';
    let chimed = !(mode === 'cold' || mode === 'warm');
    let frame = 0;
    let finished = false;
    typedShown.current = -1;

    const draw = () => {
      const f = introFrame(mode, t, ambient.current, layoutRef.current, geometry.crt);
      paint(f, layoutRef.current);
      return f;
    };

    /* Committed synchronously, inside this frame: the next paint must already
       be the new phase, never a half-updated mix of the two. */
    const finish = () => {
      finished = true;
      if (mode === 'shutdown') {
        flushSync(() => {
          setPhase('exterior');
          setDesktopMounted(false);
        });
        navigate('/', { replace: true });
      } else {
        // The last frame already shows the desktop at exactly 1:1; this only
        // hands it the controls and clears away the props around it.
        const screen = screenRef.current;
        if (screen) {
          screen.style.transform = 'none';
          screen.style.opacity = '';
          screen.style.removeProperty('--fine-detail');
        }
        flushSync(() => setPhase('desktop'));
      }
    };

    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(now - last, MAX_STEP_MS);
      ambient.current += dt;
      if (running) {
        rate += (targetRate - rate) * (1 - Math.exp(-dt / FAST_FORWARD_EASE_MS));
        t += dt * rate;
      }
      last = now;
      const f = draw();
      if (!chimed && t >= POWER_AT) {
        chimed = true;
        playStartupChime(compact);
      }
      if (f.done) finish();
      else frame = requestAnimationFrame(tick);
    };

    const start = (titleFontLoaded: boolean) => {
      if (running || finished) return;
      titleRef.current?.classList.toggle('intro-title--fallback', !titleFontLoaded);
      running = true;
      setDesktopMounted(true);
    };

    let fontTimer = 0;
    if (mode === 'cold') {
      const fonts = document.fonts;
      const loaded = () => fonts?.check(TITLE_FONT) ?? false;
      if (loaded()) start(true);
      else {
        fonts?.load(TITLE_FONT).then(() => start(loaded()), () => start(false));
        fontTimer = window.setTimeout(() => start(loaded()), TITLE_FONT_WAIT_MS);
      }
    }

    // Asking to skip speeds the film up; it never cuts. The gesture also
    // unlocks audio, so the chime still lands if the tube isn't on yet.
    const skippable = mode === 'cold' || mode === 'warm';
    const skip = () => {
      start(document.fonts?.check(TITLE_FONT) ?? false);
      targetRate = FAST_FORWARD;
    };
    if (skippable) {
      window.addEventListener('pointerdown', skip);
      window.addEventListener('keydown', skip);
      window.addEventListener('wheel', skip, { passive: true });
    }

    draw();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fontTimer);
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
      finished = true;
    };
  }, [phase, film, geometry, compact, navigate]);

  const powerOn = () => {
    setFilm('warm');
    setDesktopMounted(true);
    setPhase('intro');
  };

  const live = phase === 'desktop';

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        height: '100vh',
        width: '100vw',
        background: '#000000',
        overflow: 'hidden',
      }}
    >
      {phase !== 'desktop' && (
        <div
          className="startup-stage-wrap"
          style={{ pointerEvents: phase === 'exterior' ? 'auto' : 'none' }}
        >
          {/* The stage carries the camera. It pivots on the glass centre, so
              a push-in closes on the screen, and lifts that centre to the
              viewport's as the dive lands. */}
          <div
            ref={stageRef}
            className={`startup-stage${phase === 'shutdown' ? '' : ' startup-stage--composited'}`}
            style={{ transformOrigin: `50% ${layout.originYPct}%` }}
          >
            <Device
              screen={phase === 'exterior' ? 'off' : 'on'}
              showPrompt={phase === 'exterior'}
              onPowerClick={phase === 'exterior' ? powerOn : undefined}
              height={layout.svgVh * layout.vh}
              rig={rig}
            />
          </div>
        </div>
      )}

      {/* The raster: the desktop itself, carried onto the glass by the same
          camera. Hands-off (inert) until the camera has landed. */}
      {desktopMounted && (
        <div
          ref={screenRef}
          className={`crt-screen screen-layer${live ? '' : ' screen-layer--film'}`}
          inert={!live}
        >
          <div ref={desktopRef} className="screen-desktop">
            <Desktop
              initialWindow={initialWindow}
              live={live}
              onShutDown={() => setPhase('shutdown')}
            />
          </div>
          {phase === 'intro' && (
            <BootScreen
              coverRef={coverRef}
              typedRef={typedRef}
              restRef={restRef}
              caretRef={caretRef}
            />
          )}
          {!live && <div ref={glassRef} className="screen-glass" aria-hidden="true" />}
          {!live && <div ref={flashRef} className="screen-flash" aria-hidden="true" />}
        </div>
      )}

      {phase === 'intro' && film === 'cold' && (
        <div ref={titleRef} className="intro-title" aria-hidden="true">
          <p>
            <span>Andy Xu’s</span>
            <span>Personal Computer</span>
          </p>
        </div>
      )}
    </div>
  );
}
