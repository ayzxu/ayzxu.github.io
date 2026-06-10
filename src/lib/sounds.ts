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

function play(url: string, volume = 1): void {
  try {
    const audio = new Audio(url);
    audio.volume = volume;
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
  play(compact ? startupIphoneUrl : startupDesktopUrl, 0.6);
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
