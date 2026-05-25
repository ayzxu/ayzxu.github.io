/* ==========================================================================
   Lightbox — full-screen 1-bit image viewer. Photographs are shown through the
   bw-img filter so they read like they would on a real Macintosh display.
   Clicking anywhere (or the close box) dismisses it.
   ========================================================================== */

import { useEffect } from 'react';

type LightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

export default function Lightbox({ src, alt, onClose }: LightboxProps) {
  // Allow Esc to close, matching the close box
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
      }}
    >
      <div
        className="mac-window"
        style={{ position: 'static', maxWidth: '80%', maxHeight: '80%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="title-bar active">
          <div
            className="close-box"
            onClick={onClose}
            role="button"
            aria-label="Close image"
          />
          <div className="title-bar-text">
            <span>{alt}</span>
          </div>
          <div style={{ width: 12, flexShrink: 0 }} />
        </div>
        <div
          className="window-body"
          style={{ display: 'flex', padding: 10, overflow: 'hidden' }}
        >
          <img
            src={src}
            alt={alt}
            className="bw-img pixelated"
            style={{
              maxWidth: '70vw',
              maxHeight: '64vh',
              objectFit: 'contain',
            }}
          />
        </div>
      </div>
    </div>
  );
}
