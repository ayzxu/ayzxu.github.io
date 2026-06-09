/* ==========================================================================
   think.ts — models how long Andy actually spends on a move.

   Real blitz players don't think uniformly: recaptures are instant, book moves
   are blitzed, sharp middlegames get the long tank, and everything speeds up as
   the game (and the clock) runs down. The data pipeline measures Andy's real
   per-move clock usage from the [%clk] tags in his Chess.com PGNs and stores a
   log-normal model per context bucket; this module samples from it so the
   "Andy is thinking…" pause hesitates where Andy hesitates.

   Falls back to curated defaults (tuned to ~5|0 blitz at 1500) when the profile
   has no measured timing block.
   ========================================================================== */

import type { Rng, TimingBucket, TimingProfile } from './types';

/** Curated defaults — overwritten when build-artifacts.mjs measures real games. */
export const DEFAULT_TIMING: TimingProfile = {
  source: 'curated-default',
  clampMs: [400, 8000],
  buckets: {
    forced: { medianMs: 700, sigma: 0.45 },
    recapture: { medianMs: 650, sigma: 0.4 },
    book: { medianMs: 1100, sigma: 0.55 },
    endgame: { medianMs: 2000, sigma: 0.6 },
    capture: { medianMs: 2600, sigma: 0.65 },
    normal: { medianMs: 3400, sigma: 0.7 },
  },
  modifiers: {
    /** total multiplier applied at sharpness=1 (tense positions = longer thinks) */
    sharpMultiplier: 1.6,
    /** think time halves every N full moves — models blitz clock pressure */
    lateGameHalfLifeMoves: 60,
    /** never compress below this fraction of the sampled time */
    minLateFactor: 0.35,
  },
};

export type ThinkContext = {
  source: 'book' | 'search';
  /** only one legal move — played on autopilot */
  forced: boolean;
  /** immediate recapture on the square the opponent just took on */
  recapture: boolean;
  /** the chosen move is a capture */
  capture: boolean;
  endgame: boolean;
  /** 0..1 — how forcing/tactical the position is (0 when in book) */
  sharp: number;
  /** FEN fullmove number — drives the late-game speed-up */
  moveNumber: number;
};

/** Standard normal via Box–Muller, driven by the engine's seedable rng. */
function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickBucket(t: TimingProfile, ctx: ThinkContext): TimingBucket {
  // Precedence: the most "reflexive" context wins.
  if (ctx.forced) return t.buckets.forced;
  if (ctx.recapture) return t.buckets.recapture;
  if (ctx.source === 'book') return t.buckets.book;
  if (ctx.endgame) return t.buckets.endgame;
  if (ctx.capture) return t.buckets.capture;
  return t.buckets.normal;
}

/** Sample a human think time (ms) for this move. */
export function humanThinkMs(
  timing: TimingProfile | undefined,
  ctx: ThinkContext,
  rng: Rng,
): number {
  const t = timing ?? DEFAULT_TIMING;
  const bucket = pickBucket(t, ctx);

  // Log-normal sample around the bucket median.
  let ms = bucket.medianMs * Math.exp(bucket.sigma * gaussian(rng));

  // Sharp positions get the long tank (book/forced moves are exempt — those
  // are played from memory regardless of how scary the board looks).
  if (ctx.source === 'search' && !ctx.forced && !ctx.recapture) {
    ms *= 1 + ctx.sharp * (t.modifiers.sharpMultiplier - 1);
  }

  // Blitz clock pressure: later moves come faster, floored so the bot never
  // becomes a premove machine.
  const decay = Math.pow(0.5, ctx.moveNumber / t.modifiers.lateGameHalfLifeMoves);
  ms *= Math.max(t.modifiers.minLateFactor, decay);

  const [lo, hi] = t.clampMs;
  return Math.round(Math.max(lo, Math.min(hi, ms)));
}
