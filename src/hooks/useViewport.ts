/* ==========================================================================
   useViewport — subscribes to window and visualViewport resize events.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { getViewport, type Viewport } from '../lib/windowBounds';

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(getViewport);

  useEffect(() => {
    const update = () => setViewport(getViewport());

    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return viewport;
}
