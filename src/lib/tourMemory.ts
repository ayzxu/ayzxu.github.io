/* ==========================================================================
   tourMemory — remembers that the AndyAI tutorial has already played, so it
   greets each visitor once instead of on every reload. "Replay Tour" in the
   Apple menu bypasses the flag on demand.
   ========================================================================== */

const STORAGE_KEY = 'mac-tour-seen-v1';

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode) — tour plays each visit
  }
}

/** Called the moment a tour actually starts playing — not when eligibility
    fails — so a visitor on an undersized window still gets their first tour
    once they enlarge it. */
export function markTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* storage unavailable — the tour will simply play again next visit */
  }
}
