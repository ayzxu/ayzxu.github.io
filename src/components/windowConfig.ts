/* ==========================================================================
   Window registry — IDs, default sizes and titles for every System 1 window
   that the desktop can open. Centralised so MenuBar, Desktop and the route
   sync logic all agree on the same set of windows.

   Two kinds of windows exist:
   - static windows (fixed apps/folders), listed in WINDOW_META; and
   - dynamic document windows (`project-<slug>`, `writing-<slug>`) whose
     titles come from the content data. Use getWindowMeta / routeForWindow /
     windowForRoute, which understand both kinds.
   ========================================================================== */

import { getProject, projects } from '../data/projects';
import { getWriting, writings } from '../data/writings';

export type StaticWindowId =
  | 'readme'
  | 'projects'
  | 'fun'
  | 'about'
  | 'resume'
  | 'chess'
  | 'news'
  | 'paint'
  | 'andywrite'
  | 'writings'
  | 'music'
  | 'apps'
  | 'achievements'
  | 'calc'
  | 'puzzle'
  | 'games'
  | 'minesweeper'
  | 'snake'
  | 'asteroids'
  | 'terminal'
  | 'aboutmac'
  | 'trash'
  | 'dropguard';

export type WindowId =
  | StaticWindowId
  | `project-${string}`
  | `writing-${string}`;

export type WindowMeta = {
  title: string;
  /** Default content width in pixels */
  w: number;
  /** Default content height in pixels */
  h: number;
};

/* Default content sizes. The folder windows open noticeably larger than
   Read Me so they have room to display thumbnails / document icons. */
export const WINDOW_META: Record<StaticWindowId, WindowMeta> = {
  readme: { title: 'Read Me', w: 760, h: 700 },
  projects: { title: 'Projects', w: 640, h: 420 },
  fun: { title: 'Fun', w: 980, h: 740 },
  about: { title: 'About Me', w: 720, h: 620 },
  resume: { title: 'Résumé', w: 800, h: 720 },
  chess: { title: 'Andy Chess Bot', w: 720, h: 640 },
  news: { title: 'News', w: 780, h: 700 },
  paint: { title: 'Paint', w: 700, h: 560 },
  andywrite: { title: 'AndyWrite', w: 760, h: 640 },
  writings: { title: 'Writings', w: 640, h: 420 },
  music: { title: 'AndyMusic', w: 780, h: 620 },
  apps: { title: 'Apps', w: 560, h: 320 },
  achievements: { title: 'Achievements', w: 560, h: 600 },
  puzzle: { title: 'Puzzle', w: 320, h: 430 },
  calc: { title: 'Calculator', w: 252, h: 356 },
  games: { title: 'Games', w: 470, h: 320 },
  minesweeper: { title: 'Minesweeper', w: 400, h: 510 },
  snake: { title: 'Snake', w: 440, h: 560 },
  asteroids: { title: 'Asteroids', w: 720, h: 700 },
  terminal: { title: 'MacTerminal', w: 680, h: 520 },
  aboutmac: { title: 'About This Macintosh', w: 475, h: 300 },
  trash: { title: 'Trash', w: 560, h: 420 },
  dropguard: { title: 'System Notice', w: 440, h: 200 },
};

/* Default sizes for the dynamic document windows */
const PROJECT_WINDOW_SIZE = { w: 760, h: 680 };
const WRITING_WINDOW_SIZE = { w: 760, h: 680 };

/* --- dynamic document windows --------------------------------------------- */

export function projectWindowId(slug: string): WindowId {
  return `project-${slug}`;
}

export function writingWindowId(slug: string): WindowId {
  return `writing-${slug}`;
}

/** The project slug if `id` is a project case-study window, else null */
export function projectSlugFromWindowId(id: WindowId): string | null {
  return id.startsWith('project-') ? id.slice('project-'.length) : null;
}

/** The writing slug if `id` is a writing reader window, else null */
export function writingSlugFromWindowId(id: WindowId): string | null {
  return id.startsWith('writing-') ? id.slice('writing-'.length) : null;
}

/** Title + default size for any window id, static or dynamic. */
export function getWindowMeta(id: WindowId): WindowMeta {
  const projectSlug = projectSlugFromWindowId(id);
  if (projectSlug !== null) {
    const project = getProject(projectSlug);
    return { title: project?.title ?? 'Project', ...PROJECT_WINDOW_SIZE };
  }
  const writingSlug = writingSlugFromWindowId(id);
  if (writingSlug !== null) {
    const writing = getWriting(writingSlug);
    return { title: writing?.title ?? 'Document', ...WRITING_WINDOW_SIZE };
  }
  return WINDOW_META[id as StaticWindowId];
}

/* --- routes ---------------------------------------------------------------- */

/* The content windows that map to deep-link routes. The Read Me window and
   the system windows (aboutmac, trash, dropguard) are not routable. */
const ROUTE_FOR_STATIC_WINDOW: Partial<Record<StaticWindowId, string>> = {
  projects: '/projects',
  fun: '/fun',
  about: '/about',
  resume: '/resume',
  chess: '/chess',
  news: '/news',
  paint: '/paint',
  andywrite: '/write',
  writings: '/writings',
  music: '/music',
  apps: '/apps',
  achievements: '/achievements',
  calc: '/calc',
  puzzle: '/puzzle',
  games: '/games',
  minesweeper: '/minesweeper',
  snake: '/snake',
  asteroids: '/asteroids',
  terminal: '/terminal',
};

/** Deep-link route for a window, if it has one. */
export function routeForWindow(id: WindowId): string | undefined {
  const projectSlug = projectSlugFromWindowId(id);
  if (projectSlug !== null) {
    return getProject(projectSlug) ? `/projects/${projectSlug}` : undefined;
  }
  const writingSlug = writingSlugFromWindowId(id);
  if (writingSlug !== null) {
    return getWriting(writingSlug) ? `/writings/${writingSlug}` : undefined;
  }
  return ROUTE_FOR_STATIC_WINDOW[id as StaticWindowId];
}

const WINDOW_FOR_STATIC_ROUTE: Record<string, WindowId> = Object.fromEntries(
  Object.entries(ROUTE_FOR_STATIC_WINDOW).map(([id, route]) => [route, id]),
) as Record<string, WindowId>;

/** Window for a deep-link route (e.g. '/projects/chess-ai'), if any. */
export function windowForRoute(path: string): WindowId | undefined {
  const direct = WINDOW_FOR_STATIC_ROUTE[path];
  if (direct) return direct;

  const projectMatch = /^\/projects\/([\w-]+)$/.exec(path);
  if (projectMatch && getProject(projectMatch[1])) {
    return projectWindowId(projectMatch[1]);
  }
  const writingMatch = /^\/writings\/([\w-]+)$/.exec(path);
  if (writingMatch && getWriting(writingMatch[1])) {
    return writingWindowId(writingMatch[1]);
  }
  return undefined;
}

/* Re-export the content lists for callers that build window menus/icons */
export { projects, writings };
