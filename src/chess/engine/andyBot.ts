/* ==========================================================================
   andyBot.ts — the engine entry point. Given a position, returns the move Andy
   would plausibly play, in this order:

     1. If the position is in his opening book (and we don't roll a deviation),
        sample one of his historical moves.
     2. Otherwise search every legal move, add the style bonus, and let the
        humanizer choose — usually a good move, sometimes an inaccuracy or a
        believable ~1500 blunder.

   Pure and synchronous; the Web Worker wraps it for off-main-thread execution.
   ========================================================================== */

import { Chess } from 'chess.js';
import type { AndyProfile, EngineResult, OpeningBook, Rng, ScoredMove } from './types';
import { isEndgame } from './evaluate';
import { searchRoot } from './search';
import { pickBookMove } from './book';
import { styleBonus } from './style';
import { humanizeChoice, sharpness } from './humanize';

export function chooseMove(
  fen: string,
  profile: AndyProfile,
  book: OpeningBook,
  rng: Rng = Math.random,
): EngineResult | null {
  const t0 = Date.now();
  const chess = new Chess(fen);

  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return null; // game over — nothing to play

  // --- 1. Opening book ---------------------------------------------------
  if (rng() > profile.search.bookDeviation) {
    const bm = pickBookMove(chess, book, rng);
    if (bm) {
      const applied = chess.move({ from: bm.from, to: bm.to, promotion: bm.promotion });
      return {
        san: applied.san,
        from: applied.from,
        to: applied.to,
        promotion: applied.promotion,
        fen: chess.fen(),
        source: 'book',
        evalCp: 0,
        thinkMs: Date.now() - t0,
      };
    }
  }

  // --- 2. Style-shaped search + humanization -----------------------------
  const endgame = isEndgame(chess);
  const depth = endgame ? profile.search.endgameDepth : profile.search.baseDepth;
  const roots = searchRoot(chess, depth);

  const ranked: ScoredMove[] = roots
    .map((r) => ({
      move: r.move,
      searchCp: r.searchCp,
      adjustedCp: r.searchCp + styleBonus(chess, r.move, profile),
    }))
    .sort((a, b) => b.adjustedCp - a.adjustedCp);

  const ctx = { endgame, sharp: sharpness(ranked, chess.isCheck()) };
  const { choice, source } = humanizeChoice(ranked, profile, ctx, rng);

  const applied = chess.move({
    from: choice.move.from,
    to: choice.move.to,
    promotion: choice.move.promotion,
  });

  return {
    san: applied.san,
    from: applied.from,
    to: applied.to,
    promotion: applied.promotion,
    fen: chess.fen(),
    source,
    evalCp: choice.searchCp,
    thinkMs: Date.now() - t0,
  };
}
