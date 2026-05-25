/* ==========================================================================
   App — orchestrates the journey from the pixel-art Macintosh to the
   interactive System 1 desktop.

     exterior → the Mac 128K sits in a dark room, waiting to be powered on
     booting  → Happy Mac welcome, then the camera zooms into the screen
     desktop  → the live, interactive desktop (windows, menus, icons)
     shutdown → the screen blacks out and the camera pulls back to exterior

   The initial route is read ONCE here; from then on the Desktop owns URL
   sync, so this component never reacts to router changes (avoids loops).
   ========================================================================== */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import Macintosh from './components/Macintosh';
import Desktop from './components/Desktop';
import { WINDOW_FOR_ROUTE, type WindowId } from './components/windowConfig';

type Phase = 'exterior' | 'booting' | 'desktop' | 'shutdown';

const DESKTOP_PATHS = ['/projects', '/fun', '/about', '/desktop'];

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

  const powerOn = () => {
    if (phase === 'exterior') setPhase('booting');
  };
  const shutDown = () => setPhase('shutdown');

  // Boot sequence: hold on the Happy Mac, zoom into the screen, then hand off
  useEffect(() => {
    if (phase !== 'booting') return;
    const toZoom = window.setTimeout(() => setZoom(true), 900);
    const toDesktop = window.setTimeout(() => setPhase('desktop'), 2100);
    return () => {
      window.clearTimeout(toZoom);
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

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#000000',
        overflow: 'hidden',
      }}
    >
      {phase === 'desktop' ? (
        <div className="crt-screen" style={{ height: '100%', width: '100%' }}>
          <Desktop initialWindow={initialWindow} onShutDown={shutDown} />
        </div>
      ) : (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Wrapper carries the zoom; origin "50% 27%" is the screen centre */}
          <div
            style={{
              transform: zoom ? 'scale(13)' : 'scale(1)',
              transformOrigin: '50% 27%',
              transition: 'transform 1150ms ease-in-out',
            }}
          >
            <Macintosh
              screen={phase === 'booting' ? 'boot' : 'off'}
              showPrompt={phase === 'exterior'}
              onPowerClick={phase === 'exterior' ? powerOn : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
