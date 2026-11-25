/* Lightbox — full-screen 1-bit image viewer. Photographs are shown through the
   bw-img filter so they read like they would on a real Macintosh display.
   Clicking anywhere (or the close box) dismisses it.

   The window is sized from the image, not the other way round: the photo is
   scaled to fit about 90% of the screen at its own aspect ratio, and the
   window wraps it exactly, so a tall portrait gets a tall window instead of a
   wide one with empty space beside it. The caption stays on one line. */

import { useCallback, useEffect, useState } from 'react';

type LightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

/** Share of the screen the window may take, and what surrounds the image
    inside it (title bar, body padding, borders) */
const MAX_W = 0.92;
const MAX_H = 0.9;
const CHROME_W = 2 * 10 + 2 * 2;
const CHROME_H = 27 + 2 * 10 + 2 * 2;
/** Small images may be blown up, but not past this (pixel art stays crisp) */
const MAX_UPSCALE = 2;

type Size = { w: number; h: number };

function fitImage(natural: Size): Size {
  const maxW = Math.max(120, window.innerWidth * MAX_W - CHROME_W);
  const maxH = Math.max(120, window.innerHeight * MAX_H - CHROME_H);
  const scale = Math.min(maxW / natural.w, maxH / natural.h, MAX_UPSCALE);
  return { w: Math.round(natural.w * scale), h: Math.round(natural.h * scale) };
}

export default function Lightbox({ src, alt, onClose }: LightboxProps) {
  const [natural, setNatural] = useState<Size | null>(null);
  const [, setViewportTick] = useState(0);

  // Allow Esc to close, matching the close box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Refit when the window is resized or the phone rotates
  useEffect(() => {
    const onResize = () => setViewportTick((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The image is usually already cached from its thumbnail, in which case it
  // can be measured before the first paint.
  const measure = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  const size = natural ? fitImage(natural) : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 'var(--z-lightbox)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
      }}
    >
      <div
        className="mac-window lightbox-window"
        style={{
          position: 'static',
          // Exactly the image plus its frame; the caption truncates to fit.
          width: size ? size.w + CHROME_W : undefined,
          // Hidden until measured, so it never flashes at the wrong size
          visibility: size ? 'visible' : 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="title-bar active">
          <button
            type="button"
            className="close-box"
            onClick={onClose}
            aria-label="Close image"
          >
            <span className="close-box-glyph" />
          </button>
          <div className="title-bar-text lightbox-title">
            <span>{alt}</span>
          </div>
          <div style={{ width: 12, flexShrink: 0 }} />
        </div>
        <div
          className="window-body"
          style={{ display: 'flex', padding: 10, overflow: 'hidden' }}
        >
          <img
            ref={measure}
            src={src}
            alt={alt}
            decoding="async"
            className="bw-img pixelated lightbox-image"
            style={size ? { width: size.w, height: size.h } : undefined}
            onLoad={(e) =>
              setNatural({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
