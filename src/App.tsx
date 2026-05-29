/* ==========================================================================
   App — orchestrates the journey from the pixel-art Macintosh to the
   interactive System 1 desktop.

     exterior → the Mac 128K sits in a dark room, waiting to be powered on
     booting  → Happy Mac welcome, then the camera zooms into the screen
     settling → zoom complete; the Happy Mac crossfades into the live desktop
     desktop  → the live, interactive desktop (windows, menus, icons)
     shutdown → the screen blacks out and the camera pulls back to exterior

   The zoom scale is computed dynamically so that the Mac's screen-glass lands
   exactly fitted to the viewport — never so big the Happy Mac logo is cropped.
   ========================================================================== */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import Macintosh from './components/Macintosh';
import Desktop from './components/Desktop';
import { WINDOW_FOR_ROUTE, type WindowId } from './components/windowConfig';

type Phase = 'exterior' | 'booting' | 'settling' | 'desktop' | 'shutdown';

const DESKTOP_PATHS = ['/projects', '/fun', '/about', '/desktop'];

/* Macintosh.tsx renders the SVG at height: 90vh, viewBox 470×520.
   The widened "screen glass" occupies SVG-coords (84..386, 56..224) → 302×168
   → centre at (235, 140), aspect ≈ 16:9. These constants let us compute the
   precise zoom transform that perfectly snaps the glass to the viewport. */
const SVG_VIEW_W = 470;
const SVG_VIEW_H = 520;
const GLASS_W = 302;
const GLASS_H = 168;
const GLASS_CX = 235; // SVG x of glass centre
const GLASS_CY = 140; // SVG y of glass centre

/* Glass-centre as a percentage of the wrapper (which is sized to the SVG) —
   used directly as the transform-origin so scaling pivots on the glass centre. */
const GLASS_ORIGIN_X_PCT = (GLASS_CX / SVG_VIEW_W) * 100;            // 50%
const GLASS_ORIGIN_Y_PCT = (GLASS_CY / SVG_VIEW_H) * 100;            // ≈26.92%

function getSvgVh(): number {
  if (typeof window === 'undefined') return 0.9;
  return window.innerWidth < 480 ? 0.85 : 0.9;
}

function getZoomTranslateYVh(svgVh: number): number {
  const wrapperTop = (100 - svgVh * 100) / 2;
  const glassCenter = wrapperTop + svgVh * GLASS_ORIGIN_Y_PCT;
  return 50 - glassCenter;
}

function computeFitScale(svgVh: number): number {
  const svgHpx = svgVh * window.innerHeight;
  const svgWpx = svgHpx * (SVG_VIEW_W / SVG_VIEW_H);
  const glassWpx = svgWpx * (GLASS_W / SVG_VIEW_W);
  const glassHpx = svgHpx * (GLASS_H / SVG_VIEW_H);
  // Fit the screen-glass *just inside* the viewport — pick the smaller axis
  // so neither dimension overshoots (which would crop the Happy Mac logo).
  return Math.min(
    window.innerWidth / glassWpx,
    window.innerHeight / glassHpx,
  );
}

export default function App() {
  const navigate = useNavigate();

  // Route is read once at mount — deep links jump straight to the desktop
  const [initialWindow] = useState<WindowId | undefined>(
    () => WINDOW_FOR_ROUTE[window.location.pathname],
  );
  const [phase, setPhase] = useState<Phase>(() =>
    DESKTOP_PATHS.includes(window.location.pathname) ? 'desktop' : 'exterior',
  );
  const [zoom, setZoom] = useState(false);

  // Dynamic zoom scale and exterior Mac height — recomputed on resize
  const [exteriorLayout, setExteriorLayout] = useState(() => {
    const svgVh = typeof window === 'undefined' ? 0.9 : getSvgVh();
    return {
      svgVh,
      fitScale: typeof window === 'undefined' ? 6 : computeFitScale(svgVh),
      zoomTranslateY: getZoomTranslateYVh(svgVh),
    };
  });
  useEffect(() => {
    const onResize = () => {
      const svgVh = getSvgVh();
      setExteriorLayout({
        svgVh,
        fitScale: computeFitScale(svgVh),
        zoomTranslateY: getZoomTranslateYVh(svgVh),
      });
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  // Crossfade flag — flips true a tick after entering 'settling'
  const [crossfaded, setCrossfaded] = useState(false);

  const powerOn = () => {
    if (phase === 'exterior') setPhase('booting');
  };
  const shutDown = () => setPhase('shutdown');

  // Boot sequence: hold on Happy Mac, zoom into the screen, then crossfade
  useEffect(() => {
    if (phase !== 'booting') return;
    const toZoom = window.setTimeout(() => setZoom(true), 700);
    const toSettling = window.setTimeout(() => setPhase('settling'), 1900);
    return () => {
      window.clearTimeout(toZoom);
      window.clearTimeout(toSettling);
    };
  }, [phase]);

  // Settling: kick off the opacity crossfade on the next tick, then hand off
  useEffect(() => {
    if (phase !== 'settling') {
      setCrossfaded(false);
      return;
    }
    const toFade = window.setTimeout(() => setCrossfaded(true), 30);
    const toDesktop = window.setTimeout(() => setPhase('desktop'), 850);
    return () => {
      window.clearTimeout(toFade);
      window.clearTimeout(toDesktop);
    };
  }, [phase]);

  // Shut-down sequence: blank screen is already filling the viewport (zoomed
  // in from the desktop) — pull the camera back out, then return to exterior
  useEffect(() => {
    if (phase !== 'shutdown') return;
    const toZoomOut = window.setTimeout(() => setZoom(false), 60);
    const toExterior = window.setTimeout(() => {
      setPhase('exterior');
      navigate('/', { replace: true });
    }, 1300);
    return () => {
      window.clearTimeout(toZoomOut);
      window.clearTimeout(toExterior);
    };
  }, [phase, navigate]);

  // The Mac SVG layer is mounted for every phase except plain 'desktop'
  const macMounted = phase !== 'desktop';
  // The Desktop layer is mounted during the crossfade and afterwards
  const desktopMounted = phase === 'desktop' || phase === 'settling';
  // During settling we need to fade Mac out / Desktop in
  const settling = phase === 'settling';

  const macWrapperStyle = useMemo<React.CSSProperties>(
    () => ({
      position: settling ? 'absolute' : 'relative',
      inset: settling ? 0 : undefined,
      height: settling ? '100%' : '100%',
      width: settling ? '100%' : '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // While settling the Mac fades out so the Desktop shows through
      opacity: settling && crossfaded ? 0 : 1,
      transition: settling ? 'opacity 800ms ease-out' : 'none',
      // Don't intercept clicks while fading — Desktop is interactive underneath
      pointerEvents: settling ? 'none' : 'auto',
      zIndex: 2,
    }),
    [settling, crossfaded],
  );

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
      {/* Desktop layer — present during the crossfade and after */}
      {desktopMounted && (
        <div
          className="crt-screen"
          style={{
            position: 'absolute',
            inset: 0,
            // Fade in on settle; once we hit 'desktop' it's already fully shown
            opacity: phase === 'desktop' ? 1 : crossfaded ? 1 : 0,
            transition: settling ? 'opacity 800ms ease-in' : 'none',
            zIndex: 1,
          }}
        >
          <Desktop initialWindow={initialWindow} onShutDown={shutDown} />
        </div>
      )}

      {/* Mac layer — exterior / booting / settling */}
      {macMounted && (
        <div style={macWrapperStyle}>
          {/* Wrapper carries the zoom. The transform pivots on the glass centre
              AND translates that centre to viewport-centre, so the glass snaps
              perfectly into the screen rather than landing high and cropped. */}
          <div
            style={{
              transform: zoom
                ? `translate(0, ${exteriorLayout.zoomTranslateY}vh) scale(${exteriorLayout.fitScale})`
                : 'translate(0, 0) scale(1)',
              transformOrigin: `${GLASS_ORIGIN_X_PCT}% ${GLASS_ORIGIN_Y_PCT}%`,
              transition: 'transform 1150ms ease-in-out',
              willChange: 'transform',
            }}
          >
            <Macintosh
              screen={phase === 'exterior' ? 'off' : 'boot'}
              showPrompt={phase === 'exterior'}
              onPowerClick={phase === 'exterior' ? powerOn : undefined}
              svgVh={exteriorLayout.svgVh}
            />
          </div>
        </div>
      )}
    </div>
  );
}
