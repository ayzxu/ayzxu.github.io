/* ==========================================================================
   useViewport — subscribes to window and visualViewport resize events.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { getViewport, isPinchZoomed, type Viewport } from '../lib/windowBounds';

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(getViewport);

  useEffect(() => {
    const update = () => {
      // Pinch-zoom on iOS fires visualViewport resizes with a shrunken
      // visual viewport — don't re-layout the desktop mid-zoom.
      if (isPinchZoomed()) return;
      setViewport(getViewport());
    };

    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return viewport;
}
