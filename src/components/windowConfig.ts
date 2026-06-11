/* ==========================================================================
   Window registry — IDs, default sizes and titles for every System 1 window
   that the desktop can open. Centralised so MenuBar, Desktop and the route
   sync logic all agree on the same set of windows.
   ========================================================================== */

export type WindowId =
  | 'readme'
  | 'projects'
  | 'fun'
  | 'about'
  | 'resume'
  | 'chess'
  | 'news'
  | 'paint'
  | 'andywrite'
  | 'music'
  | 'achievements'
  | 'calc'
  | 'puzzle'
  | 'games'
  | 'minesweeper'
  | 'snake'
  | 'aboutmac'
  | 'trash'
  | 'dropguard';

export type WindowMeta = {
  title: string;
  /** Default content width in pixels */
  w: number;
  /** Default content height in pixels */
  h: number;
};

/* Default content sizes. The three folder windows (projects/fun/about) open
   noticeably larger than Read Me so they have room to display thumbnails. */
export const WINDOW_META: Record<WindowId, WindowMeta> = {
  readme: { title: 'Read Me', w: 760, h: 700 },
  projects: { title: 'Projects', w: 980, h: 720 },
  fun: { title: 'Fun', w: 980, h: 740 },
  about: { title: 'About Me', w: 720, h: 620 },
  resume: { title: 'Résumé', w: 800, h: 720 },
  chess: { title: 'Andy Chess Bot', w: 720, h: 640 },
  news: { title: 'News', w: 780, h: 700 },
  paint: { title: 'Paint', w: 700, h: 560 },
  andywrite: { title: 'AndyWrite', w: 760, h: 640 },
  music: { title: 'AndyMusic', w: 780, h: 620 },
  achievements: { title: 'Achievements', w: 560, h: 600 },
  puzzle: { title: 'Puzzle', w: 320, h: 430 },
  calc: { title: 'Calculator', w: 252, h: 356 },
  games: { title: 'Games', w: 470, h: 320 },
  minesweeper: { title: 'Minesweeper', w: 400, h: 510 },
  snake: { title: 'Snake', w: 440, h: 560 },
  aboutmac: { title: 'About This Macintosh', w: 475, h: 300 },
  trash: { title: 'Trash', w: 560, h: 420 },
  dropguard: { title: 'System Notice', w: 440, h: 200 },
};

/* The three content windows that map to deep-link routes. The Read Me window
   and the system windows (aboutmac, trash) are not routable. */
export const ROUTE_FOR_WINDOW: Partial<Record<WindowId, string>> = {
  projects: '/projects',
  fun: '/fun',
  about: '/about',
  resume: '/resume',
  chess: '/chess',
  news: '/news',
  paint: '/paint',
  andywrite: '/write',
  music: '/music',
  achievements: '/achievements',
  calc: '/calc',
  puzzle: '/puzzle',
  games: '/games',
  minesweeper: '/minesweeper',
  snake: '/snake',
};

export const WINDOW_FOR_ROUTE: Record<string, WindowId> = {
  '/projects': 'projects',
  '/fun': 'fun',
  '/about': 'about',
  '/resume': 'resume',
  '/chess': 'chess',
  '/news': 'news',
  '/paint': 'paint',
  '/write': 'andywrite',
  '/music': 'music',
  '/achievements': 'achievements',
  '/calc': 'calc',
  '/puzzle': 'puzzle',
  '/games': 'games',
  '/minesweeper': 'minesweeper',
  '/snake': 'snake',
};
