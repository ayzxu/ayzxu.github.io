/* ==========================================================================
   MacImg — an <img> that shows a classic 50%-dither "loading" fill until the
   bitmap arrives. Lazy-loaded photos otherwise render as empty bordered boxes
   for a beat, which reads as broken; a dithered gray pane reads as a 1984 Mac
   politely thinking. The fill is removed on load (not just painted over) so
   images with transparency stay clean.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';

type MacImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

export default function MacImg({ className, onLoad, ...rest }: MacImgProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  /* Cached images can be complete before React attaches onLoad — check once
     on mount so they never flash the placeholder. */
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <img
      ref={ref}
      {...rest}
      className={[className, !loaded && 'img-loading']
        .filter(Boolean)
        .join(' ')}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
    />
  );
}
