/* ==========================================================================
   sounds — tiny fire-and-forget audio helpers for System 1 sound effects.
   All playback is best-effort: if the browser blocks or fails to play a clip
   (autoplay policy, unsupported codec), the UI carries on silently.
   ========================================================================== */

import bassoUrl from '../assets/audio/basso.wav';
import startupDesktopUrl from '../assets/audio/startup-desktop.mp3';
import startupIphoneUrl from '../assets/audio/startup-iphone.wav';

// Chess clips — filenames denominate the game event they accompany
import chessCaptureUrl from '../assets/audio/chess/capture.mp3';
import chessCastleUrl from '../assets/audio/chess/castle.mp3';
import chessGameEndUrl from '../assets/audio/chess/game-end.mp3';
import chessGameStartUrl from '../assets/audio/chess/game-start.mp3';
import chessIllegalUrl from '../assets/audio/chess/illegal.mp3';
import chessMoveCheckUrl from '../assets/audio/chess/move-check.mp3';
import chessMoveOpponentUrl from '../assets/audio/chess/move-opponent.mp3';
import chessMoveSelfUrl from '../assets/audio/chess/move-self.mp3';
import chessPromoteUrl from '../assets/audio/chess/promote.mp3';

// Minesweeper + Snake clips
import mineExplosionUrl from '../assets/audio/minesweeper/explosion.ogg';
import mineFlagUrl from '../assets/audio/minesweeper/flag_sound.ogg';
import mineResetUrl from '../assets/audio/minesweeper/reset.ogg';
import snakeFoodUrl from '../assets/audio/snake/food.mp3';
import snakeMoveUrl from '../assets/audio/snake/move.mp3';

/* --- Mute & volume (SFX controls in the menu bar) ------------------------- */

const MUTE_STORAGE_KEY = 'sfx-muted';
const VOLUME_STORAGE_KEY = 'sfx-volume';

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode, etc.)
  }
}

function readStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null) return 0.7;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
  } catch {
    return 0.7;
  }
}

let muted = readStoredMute();
let masterVolume = readStoredVolume();

/** Master SFX volume, 0–1. Scales every clip's own mix level. */
export function getSfxVolume(): number {
  return masterVolume;
}

/** Set master SFX volume (clamped to 0–1); persists across reloads. */
export function setSfxVolume(value: number): void {
  masterVolume = Math.min(1, Math.max(0, value));
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, String(masterVolume));
  } catch {
    /* storage unavailable — volume still applies for this session */
  }
}

/** Whether all sound effects are currently muted. */
export function isSfxMuted(): boolean {
  return muted;
}

/** Mute/unmute every sound effect; the choice persists across reloads. */
export function setSfxMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* storage unavailable — mute still applies for this session */
  }
}

/* --- Preloading ------------------------------------------------------------
   `new Audio(url)` only starts downloading when it's created, so a clip
   played for the first time lags behind the UI by its fetch+decode time.
   For sounds that must land on a precise beat (the startup chime against the
   boot animation), we buffer them ahead of time and play the warm element. */
const preloaded = new Map<string, HTMLAudioElement>();

function preload(url: string): void {
  if (preloaded.has(url)) return;
  try {
    const audio = new Audio(url);
    audio.preload = 'auto';
    preloaded.set(url, audio);
  } catch {
    /* no audio support — play() will fall back to a cold element */
  }
}

// Warm both startup chimes as soon as the app loads, long before power-on.
preload(startupDesktopUrl);
preload(startupIphoneUrl);

function play(url: string, volume = 1): void {
  if (muted || masterVolume <= 0) return;
  try {
    const audio = preloaded.get(url) ?? new Audio(url);
    audio.currentTime = 0;
    audio.volume = Math.min(1, Math.max(0, volume * masterVolume));
    void audio.play().catch(() => {});
  } catch {
    /* no audio support — stay silent */
  }
}

/** Classic "Basso" error beep — e.g. dropping a folder on the Trash. */
export function playBasso(): void {
  play(bassoUrl, 0.7);
}

/** Startup chime on power-on: Mac chime on desktop, iPhone chime on the
    phone-sized layout (which renders home-screen style app tiles). */
export function playStartupChime(compact: boolean): void {
  play(compact ? startupIphoneUrl : startupDesktopUrl, 0.3);
}

/* --- Chess (Andy Chess Bot) ---------------------------------------------- */

const CHESS_SOUNDS = {
  'capture': chessCaptureUrl,
  'castle': chessCastleUrl,
  'game-end': chessGameEndUrl,
  'game-start': chessGameStartUrl,
  'illegal': chessIllegalUrl,
  'move-check': chessMoveCheckUrl,
  'move-opponent': chessMoveOpponentUrl,
  'move-self': chessMoveSelfUrl,
  'promote': chessPromoteUrl,
} as const;

export type ChessSound = keyof typeof CHESS_SOUNDS;

/** One clip per chess event — keys mirror the filenames in assets/audio/chess. */
export function playChessSound(name: ChessSound): void {
  play(CHESS_SOUNDS[name], 0.8);
}

/* --- Minesweeper ----------------------------------------------------------- */

const MINESWEEPER_SOUNDS = {
  explosion: { url: mineExplosionUrl, volume: 0.8 },
  flag: { url: mineFlagUrl, volume: 0.5 },
  reset: { url: mineResetUrl, volume: 0.6 },
} as const;

export type MinesweeperSound = keyof typeof MINESWEEPER_SOUNDS;

export function playMinesweeperSound(name: MinesweeperSound): void {
  const s = MINESWEEPER_SOUNDS[name];
  play(s.url, s.volume);
}

/* --- Snake ------------------------------------------------------------------ */

const SNAKE_SOUNDS = {
  food: { url: snakeFoodUrl, volume: 0.6 },
  move: { url: snakeMoveUrl, volume: 0.35 },
} as const;

export type SnakeSound = keyof typeof SNAKE_SOUNDS;

export function playSnakeSound(name: SnakeSound): void {
  const s = SNAKE_SOUNDS[name];
  play(s.url, s.volume);
}
