/* ==========================================================================
   nowPlaying — a tiny shared store for the "now playing" track shown in the
   menu bar. On load it seeds itself with a song from Andy's top 10 (so the
   bar always shows something "currently playing"); once the visitor actually
   plays a track in AndyMusic, it switches to whatever they're listening to.
   Same fire-and-forget, dependency-free style as sounds.ts — a module-level
   value plus a set of subscribers.
   ========================================================================== */

import { loadTopTracks } from './topTracks';

export type NowPlaying = {
  title: string;
  artist: string;
};

/* Shown until the live top-10 loads (or if it can't be reached). */
const DEFAULT_TRACK: NowPlaying = {
  title: "DON'T BELIEVE IT",
  artist: 'John Summit',
};

let current: NowPlaying = DEFAULT_TRACK;
/* Once the visitor presses play, their choice wins — the async seed below
   must not overwrite it if it happens to resolve later. */
let userDriven = false;

const listeners = new Set<(np: NowPlaying) => void>();

function emit(): void {
  for (const listener of listeners) listener(current);
}

/** The current now-playing track. */
export function getNowPlaying(): NowPlaying {
  return current;
}

/** Subscribe to now-playing changes; returns an unsubscribe function. */
export function subscribe(listener: (np: NowPlaying) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** AndyMusic calls this when the visitor plays a real track — from here on the
    menu bar mirrors what they're actually listening to. */
export function setNowPlaying(np: NowPlaying): void {
  userDriven = true;
  // Keep only the artist's primary name tidy for the narrow menu-bar slot.
  current = { title: np.title, artist: np.artist.split(',')[0].trim() };
  emit();
}

/* Seed the default "currently playing" pick from the live top-10, once, unless
   the visitor has already taken over playback. A random pick keeps the bar
   feeling alive across visits. Any failure leaves the built-in default. */
void loadTopTracks().then((tracks) => {
  if (userDriven || !tracks || tracks.length === 0) return;
  const pick = tracks[Math.floor(Math.random() * tracks.length)];
  current = { title: pick.title, artist: pick.artist.split(',')[0].trim() };
  emit();
});
