/* ==========================================================================
   windowBounds — viewport-aware sizing and positioning for System 1 windows.
   ========================================================================== */

import type { WindowMeta } from '../components/windowConfig';

export type Viewport = { w: number; h: number };
export type Point = { x: number; y: number };
export type Size = { w: number; h: number };

export const MENU_TOP = 29;

const MARGIN_X = 50;
const MARGIN_Y = 88;

const SMALL_DIALOG_MAX_W = 500;
const LARGE_FOLDER_MIN_W = 900;

/** Small system dialogs (trash, about mac) vs content folders */
function isSmallDialog(meta: WindowMeta): boolean {
  return meta.w <= SMALL_DIALOG_MAX_W;
}

function isLargeFolder(meta: WindowMeta): boolean {
  return meta.w >= LARGE_FOLDER_MIN_W;
}

/** Cap large content folders so they do not dominate the screen */
function capLargeFolder(size: Size, viewport: Viewport): Size {
  return {
    w: Math.min(size.w, Math.round(viewport.w * 0.78)),
    h: Math.min(size.h, Math.round(viewport.h * 0.72)),
  };
}

export function getViewport(): Viewport {
  if (typeof window === 'undefined') return { w: 1024, h: 768 };
  return { w: window.innerWidth, h: window.innerHeight };
}

export function getWindowMargins() {
  return { x: MARGIN_X, y: MARGIN_Y };
}

/** Maximum size a window may occupy on this viewport */
export function getMaxWindowSize(viewport: Viewport): Size {
  return {
    w: Math.max(240, viewport.w - MARGIN_X),
    h: Math.max(160, viewport.h - MARGIN_Y),
  };
}

/** Cap an arbitrary size to the viewport minus chrome margins */
export function clampWindowSize(size: Size, viewport: Viewport): Size {
  const max = getMaxWindowSize(viewport);
  return {
    w: Math.min(max.w, Math.max(240, size.w)),
    h: Math.min(max.h, Math.max(160, size.h)),
  };
}

/** Viewport-relative default before user resize */
export function getDefaultWindowSize(meta: WindowMeta, viewport: Viewport): Size {
  let w: number;
  let h: number;

  if (viewport.w >= 1024) {
    w = meta.w;
    h = meta.h;
    if (isLargeFolder(meta)) {
      ({ w, h } = capLargeFolder({ w, h }, viewport));
    }
  } else if (viewport.w >= 768) {
    w = Math.min(meta.w, Math.round(viewport.w * 0.92));
    h = Math.min(meta.h, Math.round(viewport.h * 0.85));
    if (isLargeFolder(meta)) {
      ({ w, h } = capLargeFolder({ w, h }, viewport));
    }
  } else if (isSmallDialog(meta)) {
    w = Math.round(viewport.w * 0.9);
    h = Math.min(meta.h, Math.round(viewport.h * 0.55));
  } else if (isLargeFolder(meta)) {
    // Large folder windows (projects / fun / about)
    w = Math.round(viewport.w * 0.92);
    h = Math.round(viewport.h * 0.76);
  } else {
    // Read Me and similar
    w = Math.round(viewport.w * 0.94);
    h = Math.round(viewport.h * 0.75);
  }

  return clampWindowSize({ w, h }, viewport);
}

export function clampWindowPosition(
  pos: Point,
  size: Size,
  viewport: Viewport,
): Point {
  const maxX = Math.max(0, viewport.w - size.w);
  const maxY = Math.max(MENU_TOP, viewport.h - size.h);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(MENU_TOP, pos.y), maxY),
  };
}

/** Centre a window of the given size in the viewport */
export function centerWindowPosition(size: Size, viewport: Viewport): Point {
  const x = Math.max(0, Math.round((viewport.w - size.w) / 2));
  const y = Math.max(MENU_TOP, Math.round((viewport.h - size.h) / 2));
  return clampWindowPosition({ x, y }, size, viewport);
}

/** Cascade offset when stacking windows */
export function getCascadeOffset(viewport: Viewport): number {
  return Math.min(35, Math.round(viewport.w * 0.04));
}

/** Compact bottom icon row on narrow or short viewports */
export function isCompactIcons(viewport: Viewport): boolean {
  return viewport.w < 768 || viewport.h < 520;
}

/** @deprecated Use isCompactIcons — kept as alias for call sites */
export function useCompactIcons(viewport: Viewport): boolean {
  return isCompactIcons(viewport);
}
