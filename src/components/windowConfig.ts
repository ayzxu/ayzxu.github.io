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

export const WINDOW_META: Record<WindowId, WindowMeta> = {
  readme: { title: 'Read Me', w: 460, h: 380 },
  projects: { title: 'Projects', w: 600, h: 460 },
  fun: { title: 'Fun', w: 600, h: 480 },
  about: { title: 'About Me', w: 600, h: 500 },
  aboutmac: { title: 'About This Macintosh', w: 380, h: 240 },
  trash: { title: 'Trash', w: 300, h: 150 },
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
