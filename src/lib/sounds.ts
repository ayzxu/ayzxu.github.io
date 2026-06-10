/* ==========================================================================
   sounds — tiny fire-and-forget audio helpers for System 1 sound effects.
   All playback is best-effort: if the browser blocks or fails to play a clip
   (autoplay policy, unsupported codec), the UI carries on silently.
   ========================================================================== */

import bassoUrl from '../assets/audio/basso.wav';
import startupDesktopUrl from '../assets/audio/startup-desktop.mp3';
import startupIphoneUrl from '../assets/audio/startup-iphone.wav';

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
