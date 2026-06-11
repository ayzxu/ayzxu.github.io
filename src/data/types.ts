/* ==========================================================================
   Shared content types used across the data modules (projects, experience,
   fun, writings). Kept separate so the modules stay import-light.
   ========================================================================== */

export type MediaItem = { src: string; alt: string; type: 'image' | 'video' };

export type LinkItem = { name: string; url: string };

export type ImageItem = { src: string; alt: string };
