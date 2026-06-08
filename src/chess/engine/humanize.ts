/* ==========================================================================
   humanize.ts — turns a ranked candidate list into a human-like choice.

   This is where ~1500 comes from. Three branches, rolled per move:
     • blunder    — pick a natural-looking but clearly inferior move (a tempting
                    capture/check/attack) that is worse by blunderCpWindow cp,
                    modelling missed tactics & miscalculation.
     • inaccuracy — softmax-sample the top few with a wide temperature.
     • normal     — softmax-sample the very top with a tight temperature, so even
                    good play has lifelike variety instead of robotic repetition.
   Error rates scale UP in sharp positions (blitz time-pressure) and DOWN in the
   endgame (cleaner, more "engine-driven" play, as requested).
   ========================================================================== */

import type { AndyProfile, MoveSource, Rng, ScoredMove } from './types';

/** 0..1 measure of how forcing/tactical the position is. */
export function sharpness(moves: ScoredMove[], inCheck: boolean): number {
  if (moves.length === 0) return 0;
  let forcing = 0;
  for (const sm of moves) {
    const m = sm.move;
    if (m.flags.includes('c') || m.flags.includes('e') || m.san.includes('+')) {
      forcing++;
    }
  }
  const ratio = forcing / moves.length;
  return Math.max(0, Math.min(1, ratio + (inCheck ? 0.4 : 0)));
}

function softmaxSample(
  pool: ScoredMove[],
  temperature: number,
  rng: Rng,
): ScoredMove {
  if (pool.length === 1) return pool[0];
  const top = pool[0].adjustedCp;
  const T = Math.max(1, temperature);
  const weights = pool.map((m) => Math.exp((m.adjustedCp - top) / T));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** How "tempting" a move looks to a human (used to weight blunder selection). */
function naturalness(sm: ScoredMove): number {
  const m = sm.move;
  let w = 1;
  if (m.flags.includes('c') || m.flags.includes('e')) w += 2;
  if (m.san.includes('+')) w += 2;
  if (m.promotion) w += 1;
  return w;
}

export type HumanChoice = { choice: ScoredMove; source: MoveSource };

/** Pick the move Andy would plausibly play from a ranked candidate list. */
export function humanizeChoice(
  ranked: ScoredMove[], // sorted by adjustedCp desc
  profile: AndyProfile,
  ctx: { endgame: boolean; sharp: number },
  rng: Rng,
): HumanChoice {
  if (ranked.length === 1) return { choice: ranked[0], source: 'forced' };

  const e = profile.errors;
  const sharpScale = 1 + ctx.sharp * (e.sharpnessMultiplier - 1);
  const egScale = ctx.endgame ? e.endgameErrorMultiplier : 1;
  const blunder = e.blunderRate * sharpScale * egScale;
  const inaccuracy = e.inaccuracyRate * egScale;

  const roll = rng();

  // --- Blunder branch: a believable mistake, bounded in severity ---------
  if (roll < blunder) {
    const best = ranked[0].adjustedCp;
    const [lo, hi] = e.blunderCpWindow;
    const pool = ranked.filter((m) => {
      const loss = best - m.adjustedCp;
      return loss >= lo && loss <= hi;
    });
    if (pool.length > 0) {
      const weights = pool.map(naturalness);
      const total = weights.reduce((s, w) => s + w, 0);
      let r = rng() * total;
      for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return { choice: pool[i], source: 'blunder' };
      }
      return { choice: pool[pool.length - 1], source: 'blunder' };
    }
    // No move in the believable-mistake window → fall through to inaccuracy.
  }

  // --- Inaccuracy branch: a slightly sub-optimal but reasonable move ------
  if (roll < blunder + inaccuracy) {
    const pool = ranked.slice(0, Math.min(6, ranked.length));
    const T = ctx.endgame
      ? profile.search.inaccuracyTemperature * 0.5
      : profile.search.inaccuracyTemperature;
    return { choice: softmaxSample(pool, T, rng), source: 'inaccuracy' };
  }

  // --- Normal branch: a good move, with a little human variety -----------
  const pool = ranked.slice(0, Math.min(ctx.endgame ? 2 : 4, ranked.length));
  const T = ctx.endgame
    ? profile.search.baseTemperature * 0.5
    : profile.search.baseTemperature;
  return { choice: softmaxSample(pool, T, rng), source: 'best' };
}
