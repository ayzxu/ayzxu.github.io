/* ==========================================================================
   iconLayout — default desktop icon positions and drop-target hit tests.
   ========================================================================== */

import { MENU_TOP, type Point, type Viewport } from './windowBounds';

export const DESKTOP_ICON_IDS = [
  'readme',
  'projects',
  'fun',
  'about',
  'trash',
] as const;

export type DesktopIconId = (typeof DESKTOP_ICON_IDS)[number];

/** Drop onto these icons shows the "not implemented" dialog */
export const ICON_DROP_TARGETS: DesktopIconId[] = [
  'trash',
  'projects',
  'fun',
  'about',
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

function columnIconPositions(viewport: Viewport): IconPositions {
  const containerH = viewport.h - MENU_TOP;
  const x = Math.max(8, viewport.w - ICON_W - 28);
  const gap = (containerH - DESKTOP_ICON_IDS.length * ICON_H) /
    (DESKTOP_ICON_IDS.length + 1);

  const positions = {} as IconPositions;
  DESKTOP_ICON_IDS.forEach((id, i) => {
    positions[id] = {
      x,
      y: Math.round(gap + i * (ICON_H + gap)),
    };
  });
  return positions;
}

function compactIconPositions(viewport: Viewport): IconPositions {
  const containerH = viewport.h - MENU_TOP;
  const gap = 10;
  const count = DESKTOP_ICON_IDS.length;

  // How many icons fit across the viewport without overlapping. On phones this
  // wraps the row into a grid so icons never collide; on wider compact screens
  // it still resolves to a single bottom row.
  const cols = Math.max(
    1,
    Math.min(count, Math.floor((viewport.w - gap) / (ICON_W + gap))),
  );
  const rows = Math.ceil(count / cols);

  const gridW = cols * ICON_W + (cols - 1) * gap;
  const gridH = rows * ICON_H + (rows - 1) * gap;
  const startX = Math.max(8, Math.round((viewport.w - gridW) / 2));
  const startY = Math.max(8, containerH - gridH - gap);

  const positions = {} as IconPositions;
  DESKTOP_ICON_IDS.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[id] = {
      x: startX + col * (ICON_W + gap),
      y: startY + row * (ICON_H + gap),
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
