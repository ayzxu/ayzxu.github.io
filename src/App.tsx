/* App — the journey from the startup hardware to the interactive desktop.

     flight   → the camera swoops in on the machine and straight on into its
                screen, which wakes to the Happy Mac on the way
     booting  → powered back on by hand: Happy Mac, then a dive into the screen
     settling → the Happy Mac fills the view and crossfades into the desktop
     desktop  → the live, interactive desktop (windows, menus, icons)
     shutdown → the screen blacks out and the camera pulls back
     exterior → the machine sits powered off until it's clicked back on

   A first visit plays flight → settling on its own; any click or key on the
   way skips straight to the desktop. Deep links start on the desktop. */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import Macintosh from './components/Macintosh';
import Iphone from './components/Iphone';
import Desktop from './components/Desktop';
import { windowForRoute, type WindowId } from './components/windowConfig';
import { getViewport, isCompactIcons, isPinchZoomed } from './lib/windowBounds';
import { playStartupChime } from './lib/sounds';
import {
  IPHONE_GEOMETRY,
  MAC_GEOMETRY,
  FLIGHT_MS,
  computeStartupLayout,
  flightPose,
} from './lib/startupGeometry';

type Phase = 'flight' | 'booting' | 'settling' | 'desktop' | 'shutdown' | 'exterior';

const DESKTOP_PATHS = ['/projects', '/fun', '/about', '/resume', '/chess', '/writings', '/desktop'];

const BOOT_HOLD_MS = 250;
const BOOT_DIVE_MS = 1200;
const CROSSFADE_MS = 800;
const PULL_BACK_MS = 1150;

/* GitHub Pages serves the pre-rendered deep links as directories, so the
   browser lands on e.g. /projects/ — drop the trailing slash before matching. */
function normalizedPath(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function initialPhase(): Phase {
  return DESKTOP_PATHS.includes(normalizedPath()) ? 'desktop' : 'flight';
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
  const [zoom, setZoom] = useState(false);
  // Whether the screen has come on during the opening flight
  const [lit, setLit] = useState(false);
  const [crossfaded, setCrossfaded] = useState(false);
  const [layout, setLayout] = useState(() =>
    computeStartupLayout(geometry, getViewport()),
  );
  const stageRef = useRef<HTMLDivElement>(null);

  /* GitHub Pages serves 404.html for unknown paths, so the SPA boots with the
     bogus URL still in the address bar — send it back to '/'. */
  useEffect(() => {
    const path = normalizedPath();
    if (path !== '/' && !DESKTOP_PATHS.includes(path) && !windowForRoute(path)) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const onResize = () => {
      // Pinch-zooming on iOS resizes the visual viewport, not the layout.
      if (isPinchZoomed()) return;
      setLayout(computeStartupLayout(geometry, getViewport()));
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [geometry]);

  // Flight: posed frame by frame, starting before first paint so the machine
  // is never seen at rest. The chime is best-effort — browsers mute it until
  // the first user gesture.
  useLayoutEffect(() => {
    if (phase !== 'flight') return;
    const stage = stageRef.current;
    if (!stage) return;
    const viewport = getViewport();
    const startupLayout = computeStartupLayout(geometry, viewport);
    const pose = (t: number) => {
      const { transform, opacity, lit } = flightPose(t, viewport, startupLayout);
      stage.style.transform = transform;
      stage.style.opacity = String(opacity);
      return lit;
    };
    const land = () => {
      setZoom(true);
      setPhase('settling');
    };

    let frame = 0;
    let startedAt = 0;
    let litUp = false;
    const tick = (now: number) => {
      startedAt ||= now;
      const t = Math.min(1, (now - startedAt) / FLIGHT_MS);
      if (pose(t) && !litUp) {
        litUp = true;
        setLit(true);
        playStartupChime(compact);
      }
      if (t < 1) frame = requestAnimationFrame(tick);
      else land();
    };
    pose(0);
    frame = requestAnimationFrame(tick);
    // Frames stop in a background tab — don't strand the visitor on a black
    // screen; land regardless.
    const fallback = window.setTimeout(land, FLIGHT_MS + 1500);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      // The transform is left alone: by now React has set the landed one.
      stage.style.opacity = '';
    };
  }, [phase, geometry, compact]);

  // Booting: chime, hold on the Happy Mac, dive into the screen, hand off.
  useEffect(() => {
    if (phase !== 'booting') return;
    playStartupChime(compact);
    const toDive = window.setTimeout(() => setZoom(true), BOOT_HOLD_MS);
    const toSettling = window.setTimeout(
      () => setPhase('settling'),
      BOOT_HOLD_MS + BOOT_DIVE_MS + 50,
    );
    return () => {
      window.clearTimeout(toDive);
      window.clearTimeout(toSettling);
    };
  }, [phase, compact]);

  // Settling: start the crossfade on the next tick, then hand off.
  useEffect(() => {
    if (phase !== 'settling') {
      setCrossfaded(false);
      return;
    }
    const toFade = window.setTimeout(() => setCrossfaded(true), 30);
    const toDesktop = window.setTimeout(() => setPhase('desktop'), CROSSFADE_MS + 50);
    return () => {
      window.clearTimeout(toFade);
      window.clearTimeout(toDesktop);
    };
  }, [phase]);

  // Shutdown: the blank screen already fills the viewport — pull back out.
  useEffect(() => {
    if (phase !== 'shutdown') return;
    const toPullBack = window.setTimeout(() => setZoom(false), 60);
    const toExterior = window.setTimeout(() => {
      setPhase('exterior');
      navigate('/', { replace: true });
    }, PULL_BACK_MS + 150);
    return () => {
      window.clearTimeout(toPullBack);
      window.clearTimeout(toExterior);
    };
  }, [phase, navigate]);

  // Any click or key during the intro skips ahead to the desktop.
  const introPlaying = phase === 'flight' || phase === 'booting';
  useEffect(() => {
    if (!introPlaying) return;
    const skip = () => {
      // The gesture unlocks audio, so the chime can still land.
      if (phase === 'flight' && !lit) playStartupChime(compact);
      setZoom(true);
      setPhase('settling');
    };
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [introPlaying, phase, lit, compact]);

  const settling = phase === 'settling';
  const screenOff =
    (phase === 'flight' && !lit) || phase === 'shutdown' || phase === 'exterior';

  return (
    <div
      style={{
        position: 'relative',
        height: '100vh',
        width: '100vw',
        background: '#000000',
        overflow: 'hidden',
      }}
    >
      {(phase === 'desktop' || settling) && (
        <div
          className="crt-screen"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: phase === 'desktop' || crossfaded ? 1 : 0,
            transition: settling ? `opacity ${CROSSFADE_MS}ms ease-in` : 'none',
            zIndex: 1,
          }}
        >
          <Desktop initialWindow={initialWindow} onShutDown={() => setPhase('shutdown')} />
        </div>
      )}

      {phase !== 'desktop' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: settling && crossfaded ? 0 : 1,
            transition: settling ? `opacity ${CROSSFADE_MS}ms ease-out` : 'none',
            // The desktop underneath is already interactive while this fades.
            pointerEvents: settling ? 'none' : 'auto',
            zIndex: 2,
          }}
        >
          {/* The stage carries every camera move. It pivots on the glass
              centre and, zoomed, shifts that centre to the viewport's, so the
              glass lands exactly filling the screen. The opening flight is
              a keyframe animation on top of this; only the hand-started boot
              dive and the shutdown pull-back are transitions. */}
          <div
            ref={stageRef}
            style={{
              transform: zoom
                ? `translate(0, ${layout.zoomTranslateY}vh) scale(${layout.fitScale})`
                : 'none',
              transformOrigin: `50% ${layout.originYPct}%`,
              transition:
                phase === 'booting'
                  ? `transform ${BOOT_DIVE_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`
                  : phase === 'shutdown'
                    ? `transform ${PULL_BACK_MS}ms ease-in-out`
                    : 'none',
              willChange: 'transform',
            }}
          >
            <Device
              screen={screenOff ? 'off' : 'boot'}
              showPrompt={phase === 'exterior'}
              onPowerClick={phase === 'exterior' ? () => setPhase('booting') : undefined}
              svgVh={layout.svgVh}
            />
          </div>
        </div>
      )}
    </div>
  );
}
