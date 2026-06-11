/* ==========================================================================
   Shared content types used across the data modules (projects, experience,
   fun, writings). Kept separate so the modules stay import-light.
   ========================================================================== */

export type MediaItem = {
  src: string;
  alt: string;
  type: 'image' | 'video';
  /** Videos: H.264 MP4 fallback for browsers without WebM/VP9 support */
  mp4?: string;
  /** Videos: still frame shown before playback starts (preload="none") */
  poster?: string;
};

export type LinkItem = { name: string; url: string };

export type ImageItem = { src: string; alt: string };
