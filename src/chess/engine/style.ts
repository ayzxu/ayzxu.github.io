/* ==========================================================================
   style.ts — converts Andy's style vector into a small per-move bonus (cp).

   The bonus is intentionally bounded (≈ ±45 cp): big enough to break ties toward
   the sharp, Andy-flavoured move, far too small to justify hanging a piece. Real
   mistakes are the humanizer's job, not the style layer's.
   ========================================================================== */

import type { Chess, Move } from 'chess.js';
import type { AndyProfile } from './types';

const CAP = 45;

function fullmoveNumber(chess: Chess): number {
  const n = Number(chess.fen().split(' ')[5]);
  return Number.isFinite(n) ? n : 1;
}

/** Bonus (centipawns) added to a candidate move based on how "Andy" it is. */
export function styleBonus(chess: Chess, m: Move, profile: AndyProfile): number {
  const s = profile.style;
  const opening = fullmoveNumber(chess) <= 12;
  const mover = chess.turn(); // side making the move
  let bonus = 0;

  // Captures — aggression × capture appetite.
  if (m.flags.includes('c') || m.flags.includes('e')) {
    bonus += 20 * s.captureBias * (0.6 + 0.8 * s.aggression);
  }

  // Checks — sharp, forcing. Detect by applying the move briefly.
  let givesCheck = false;
  chess.move({ from: m.from, to: m.to, promotion: m.promotion });
  givesCheck = chess.isCheck();
  chess.undo();
  if (givesCheck) bonus += 24 * s.checkBias * (0.6 + 0.8 * s.tactical);

  // Castling — king safety then attack; very Andy.
  if (m.flags.includes('k') || m.flags.includes('q')) {
    bonus += 28 * (0.5 + s.developmentBias);
  }

  // Central pawn pushes (d/e files to the 4th-5th rank).
  if (m.piece === 'p') {
    const toFile = m.to[0];
    const toRank = Number(m.to[1]);
    const central = toFile === 'd' || toFile === 'e';
    const advanced = mover === 'w' ? toRank >= 4 : toRank <= 5;
    if (central && advanced) bonus += 16 * s.centerBias;
  }

  // Development of minor pieces off the back rank, in the opening.
  if (opening && (m.piece === 'n' || m.piece === 'b')) {
    const backRank = mover === 'w' ? '1' : '8';
    if (m.from[1] === backRank) bonus += 14 * s.developmentBias;
  }

  // Kingside attack: pushing the f/g/h pawns or piling pieces onto that flank
  // in the middlegame — the hallmark of Andy's attacking games.
  if (!opening) {
    const toFile = m.to[0];
    const onKingside = toFile === 'f' || toFile === 'g' || toFile === 'h';
    if (onKingside && (m.piece === 'p' || m.piece === 'q' || m.piece === 'n')) {
      bonus += 12 * s.kingsideAttackBias * (0.5 + 0.7 * s.aggression);
    }
  }

  return Math.max(-CAP, Math.min(CAP, Math.round(bonus)));
}
