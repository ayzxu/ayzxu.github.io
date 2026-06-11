/* ==========================================================================
   achievements — a tiny client-side achievement system. Unlocks persist in
   localStorage; subscribers are notified so the desktop can pop a System 1
   style toast and the Achievements window can re-render live.
   ========================================================================== */

export type AchievementId =
  | 'chess-win'
  | 'snake-10'
  | 'minesweeper-win'
  | 'paint-save'
  | 'news-read'
  | 'puzzle-solve'
  | 'write-export'
  | 'music-play'
  | 'all-clear';

export type AchievementDef = {
  id: AchievementId;
  title: string;
  /** How to earn it — always visible, like an arcade scoreboard */
  desc: string;
  /** Tiny pictogram drawn by the Achievements window / toast */
  glyph: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'chess-win',
    title: 'Andy-Slayer',
    desc: 'Checkmate Andy in a game of chess.',
    glyph: '♞',
  },
  {
    id: 'snake-10',
    title: 'Snake Charmer',
    desc: 'Score 10 or more in a single run of Snake.',
    glyph: 'S',
  },
  {
    id: 'minesweeper-win',
    title: 'Bomb Defuser',
    desc: 'Clear a Minesweeper board without exploding.',
    glyph: '✸',
  },
  {
    id: 'paint-save',
    title: 'Gallery Artist',
    desc: 'Save a masterpiece from Paint.',
    glyph: '✦',
  },
  {
    id: 'news-read',
    title: 'Extra! Extra!',
    desc: 'Open a story from The Daily Hacker.',
    glyph: '¶',
  },
  {
    id: 'puzzle-solve',
    title: 'Tile Tactician',
    desc: 'Put the sliding Puzzle back in order.',
    glyph: '15',
  },
  {
    id: 'write-export',
    title: 'Published Author',
    desc: 'Save a document from AndyWrite.',
    glyph: 'A',
  },
  {
    id: 'music-play',
    title: 'Top of the Charts',
    desc: 'Spin a track in AndyMusic.',
    glyph: '♪',
  },
  {
    id: 'all-clear',
    title: '128K Completionist',
    desc: 'Earn every other achievement.',
    glyph: '★',
  },
];

const STORAGE_KEY = 'mac-achievements-v1';

/** id → ISO timestamp of when it was unlocked */
type UnlockMap = Partial<Record<AchievementId, string>>;

function readUnlocks(): UnlockMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as UnlockMap;
  } catch {
    /* storage unavailable or corrupted — treat as empty */
  }
  return {};
}

function writeUnlocks(map: UnlockMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — achievements just won't persist */
  }
}

type ToastListener = (def: AchievementDef) => void;
type ChangeListener = () => void;

const toastListeners = new Set<ToastListener>();
const changeListeners = new Set<ChangeListener>();

export function getUnlocks(): UnlockMap {
  return readUnlocks();
}

export function isUnlocked(id: AchievementId): boolean {
  return readUnlocks()[id] !== undefined;
}

/** Unlock an achievement. No-op if already earned. Fires toast + change
    listeners, and awards the meta-achievement when the rest are done. */
export function unlockAchievement(id: AchievementId) {
  const map = readUnlocks();
  if (map[id]) return;
  map[id] = new Date().toISOString();
  writeUnlocks(map);

  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (def) toastListeners.forEach((fn) => fn(def));
  changeListeners.forEach((fn) => fn());

  // meta: everything except 'all-clear' itself
  if (
    id !== 'all-clear' &&
    ACHIEVEMENTS.every((a) => a.id === 'all-clear' || map[a.id])
  ) {
    // slight delay so the two toasts queue in a satisfying order
    window.setTimeout(() => unlockAchievement('all-clear'), 400);
  }
}

export function resetAchievements() {
  writeUnlocks({});
  changeListeners.forEach((fn) => fn());
}

export function onAchievementToast(fn: ToastListener): () => void {
  toastListeners.add(fn);
  return () => toastListeners.delete(fn);
}

export function onAchievementsChange(fn: ChangeListener): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
