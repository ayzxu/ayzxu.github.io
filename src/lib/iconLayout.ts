/* ==========================================================================
   iconLayout — default desktop icon positions and drop-target hit tests.
   ========================================================================== */

import { MENU_TOP, type Point, type Viewport } from './windowBounds';

/* Order determines on-screen position: the rightmost column fills top-to-
   bottom first. With 13 icons the grid balances to three columns of five,
   so 'trash' in slot 5 lands at the classic bottom-right. */
export const DESKTOP_ICON_IDS = [
  'readme',
  'projects',
  'fun',
  'achievements',
  'trash',
  'resume',
  'chess',
  'news',
  'paint',
  'andywrite',
  'games',
  'calc',
  'about',
] as const;

export type DesktopIconId = (typeof DESKTOP_ICON_IDS)[number];

/** Drop onto these icons shows the "not implemented" dialog */
export const ICON_DROP_TARGETS: DesktopIconId[] = [
  'trash',
  'projects',
  'fun',
  'about',
  'games',
];

export const ICON_W = 108;
export const ICON_H = 88;

export type IconPositions = Record<DesktopIconId, Point>;

export type MarqueeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Positions are relative to the icon layer (below the 28px menu bar). */
export function getDefaultIconPositions(
  viewport: Viewport,
  compact: boolean,
): IconPositions {
  if (compact) return compactIconPositions(viewport);
  return columnIconPositions(viewport);
}

/** Max icons stacked in a single vertical column before wrapping to the next. */
const MAX_PER_COLUMN = 5;
/** Horizontal spacing between stacked columns. */
const COLUMN_GAP = 12;

function columnIconPositions(viewport: Viewport): IconPositions {
  const containerH = viewport.h - MENU_TOP;
  const count = DESKTOP_ICON_IDS.length;

  // Split into as many columns as needed so no column holds more than
  // MAX_PER_COLUMN icons, then balance the icons evenly across those columns.
  const cols = Math.ceil(count / MAX_PER_COLUMN);
  const perColumn = Math.ceil(count / cols);

  // Rightmost column sits at the classic right margin; extra columns stack to
  // its left.
  const rightX = Math.max(8, viewport.w - ICON_W - 28);
  const gap = (containerH - perColumn * ICON_H) / (perColumn + 1);

  const positions = {} as IconPositions;
  DESKTOP_ICON_IDS.forEach((id, i) => {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    positions[id] = {
      x: Math.max(8, rightX - col * (ICON_W + COLUMN_GAP)),
      y: Math.round(gap + row * (ICON_H + gap)),
    };
  });
  return positions;
}

/* Compact (phone) layout — an iOS-home-screen style grid: icons anchored to
   the top of the screen, centred horizontally, with roomier row spacing so
   the rounded app tiles read clearly and stay easy to tap. */
const COMPACT_GAP_X = 8;
const COMPACT_GAP_Y = 22;
const COMPACT_TOP = 16;
/** iPhone home screens cap at 4 columns; we do the same. */
const COMPACT_MAX_COLS = 4;

function compactIconPositions(viewport: Viewport): IconPositions {
  const containerH = viewport.h - MENU_TOP;
  const count = DESKTOP_ICON_IDS.length;

  // How many icons fit across the viewport without overlapping, capped at the
  // familiar 4-across home-screen grid.
  const cols = Math.max(
    1,
    Math.min(
      COMPACT_MAX_COLS,
      count,
      Math.floor((viewport.w - COMPACT_GAP_X) / (ICON_W + COMPACT_GAP_X)),
    ),
  );
  const rows = Math.ceil(count / cols);

  const gridW = cols * ICON_W + (cols - 1) * COMPACT_GAP_X;
  const gridH = rows * ICON_H + (rows - 1) * COMPACT_GAP_Y;
  const startX = Math.max(4, Math.round((viewport.w - gridW) / 2));
  // Anchor below the menu bar like a home screen; if the grid is taller than
  // the screen (tiny landscape phones) fall back to the top edge.
  const startY = Math.max(4, Math.min(COMPACT_TOP, containerH - gridH));

  const positions = {} as IconPositions;
  DESKTOP_ICON_IDS.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[id] = {
      x: startX + col * (ICON_W + COMPACT_GAP_X),
      y: startY + row * (ICON_H + COMPACT_GAP_Y),
    };
  });
  return positions;
}

export function clampIconPosition(
  pos: Point,
  viewport: Viewport,
): Point {
  const containerH = viewport.h - MENU_TOP;
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, viewport.w - ICON_W)),
    y: Math.min(Math.max(0, pos.y), Math.max(0, containerH - ICON_H)),
  };
}

/** Build a marquee rect from drag start/end in icon-layer coordinates */
export function marqueeFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): MarqueeRect {
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  return {
    left,
    top,
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

/** Classic Mac: icon is selected if its bounding box intersects the marquee */
export function iconIntersectsMarquee(
  iconPos: Point,
  marquee: MarqueeRect,
): boolean {
  if (marquee.width < 2 && marquee.height < 2) return false;

  const iconRight = iconPos.x + ICON_W;
  const iconBottom = iconPos.y + ICON_H;
  const marqueeRight = marquee.left + marquee.width;
  const marqueeBottom = marquee.top + marquee.height;

  return (
    iconPos.x < marqueeRight &&
    iconRight > marquee.left &&
    iconPos.y < marqueeBottom &&
    iconBottom > marquee.top
  );
}

export function iconsInMarquee(
  marquee: MarqueeRect,
  positions: IconPositions,
): DesktopIconId[] {
  return DESKTOP_ICON_IDS.filter((id) =>
    iconIntersectsMarquee(positions[id], marquee),
  );
}

/** Icon centre in viewport (client) coordinates */
export function iconCenterInViewport(
  pos: Point,
): { cx: number; cy: number } {
  return {
    cx: pos.x + ICON_W / 2,
    cy: MENU_TOP + pos.y + ICON_H / 2,
  };
}

/** If a dragged icon was released over a folder/trash target, return that id */
export function findIconDropTarget(
  draggedId: DesktopIconId,
  releasePos: Point,
  positions: IconPositions,
): DesktopIconId | null {
  const { cx, cy } = iconCenterInViewport(releasePos);

  for (const id of ICON_DROP_TARGETS) {
    if (id === draggedId) continue;
    const p = positions[id];
    const left = p.x;
    const top = MENU_TOP + p.y;
    if (
      cx >= left &&
      cx <= left + ICON_W &&
      cy >= top &&
      cy <= top + ICON_H
    ) {
      return id;
    }
  }
  return null;
}
