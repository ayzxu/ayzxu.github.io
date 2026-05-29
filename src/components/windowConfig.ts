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
  | 'aboutmac'
  | 'trash';

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
  readme: { title: 'Read Me', w: 575, h: 475 },
  projects: { title: 'Projects', w: 980, h: 720 },
  fun: { title: 'Fun', w: 980, h: 740 },
  about: { title: 'About Me', w: 720, h: 620 },
  aboutmac: { title: 'About This Macintosh', w: 475, h: 300 },
  trash: { title: 'Trash', w: 375, h: 188 },
};

/* The three content windows that map to deep-link routes. The Read Me window
   and the system windows (aboutmac, trash) are not routable. */
export const ROUTE_FOR_WINDOW: Partial<Record<WindowId, string>> = {
  projects: '/projects',
  fun: '/fun',
  about: '/about',
};

export const WINDOW_FOR_ROUTE: Record<string, WindowId> = {
  '/projects': 'projects',
  '/fun': 'fun',
  '/about': 'about',
};
