/* ==========================================================================
   Screensaver — after 4 minutes without input, the screen goes black and a
   1-bit happy Mac drifts and bounces DVD-logo style. Any input wakes it.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';

const IDLE_MS = 4 * 60 * 1000;
const SPEED = 80; // px per second

const WAKE_EVENTS: (keyof WindowEventMap)[] = [
  'pointermove',
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
];

export default function Screensaver() {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  activeRef.current = active;

  const idleTimer = useRef<number | null>(null);

  /* --- idle detection ------------------------------------------------------ */
  useEffect(() => {
    const arm = () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setActive(true), IDLE_MS);
    };

    const onInput = () => {
      if (activeRef.current) setActive(false);
      arm();
    };

    arm();
    for (const ev of WAKE_EVENTS) {
      window.addEventListener(ev, onInput, { passive: true });
    }
    // don't fire the saver while the tab is hidden
    const onVisibility = () => {
      if (!document.hidden) onInput();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      for (const ev of WAKE_EVENTS) window.removeEventListener(ev, onInput);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!active) return null;
  return <BouncingMac />;
}

/* The drifting artwork — its own component so the rAF loop only exists while
   the saver is showing. Position lives in refs; the DOM node is moved
   directly, so no re-renders happen per frame. */
function BouncingMac() {
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const logo = logoRef.current;
    if (!logo) return;

    let x = Math.random() * Math.max(1, window.innerWidth - 160);
    let y = Math.random() * Math.max(1, window.innerHeight - 200);
    let vx = SPEED * (Math.random() < 0.5 ? 1 : -1);
    let vy = SPEED * (Math.random() < 0.5 ? 1 : -1);
    let last = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = logo.offsetWidth;
      const h = logo.offsetHeight;
      const maxX = window.innerWidth - w;
      const maxY = window.innerHeight - h;

      x += vx * dt;
      y += vy * dt;
      if (x <= 0 || x >= maxX) {
        vx = -vx;
        x = Math.min(Math.max(0, x), maxX);
      }
      if (y <= 0 || y >= maxY) {
        vy = -vy;
        y = Math.min(Math.max(0, y), maxY);
      }
      logo.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="screensaver" aria-hidden>
      <div ref={logoRef} className="screensaver-logo">
        {/* Happy Mac, in white-on-black */}
        <svg
          viewBox="0 0 32 40"
          width="96"
          height="120"
          shapeRendering="crispEdges"
        >
          {/* case */}
          <rect
            x="3"
            y="2"
            width="26"
            height="30"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* screen */}
          <rect
            x="7"
            y="6"
            width="18"
            height="14"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* face */}
          <rect x="11" y="9" width="2" height="4" fill="#ffffff" />
          <rect x="19" y="9" width="2" height="4" fill="#ffffff" />
          <path
            d="M12 16 Q16 19 20 16"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          {/* floppy slot + chin */}
          <rect x="11" y="24" width="10" height="2" fill="#ffffff" />
          <rect x="6" y="34" width="20" height="3" fill="#ffffff" />
        </svg>
        <div className="screensaver-text">andyxu.dev</div>
      </div>
    </div>
  );
}
