/* ==========================================================================
   evaluate.ts — a compact handcrafted evaluation (centipawns, White's POV).

   Material + midgame piece-square tables + bishop pair + a light king-safety
   blend (midgame king table → endgame king table by material phase). Tuned to
   play around 1600-1800 on its own; the humanizer then pulls it down to ~1500,
   which reads far more naturally than corrupting a 3200 engine.

   Tables use the classic "Simplified Evaluation Function" layout (Michniewski),
   written rank-8-first to match chess.js `board()` row order:
     White piece at board()[r][f]  -> table[r*8 + f]
     Black piece at board()[r][f]  -> table[(7-r)*8 + f]   (vertical mirror)
   ========================================================================== */

import type { Chess, PieceSymbol } from 'chess.js';

export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// prettier-ignore
const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

// prettier-ignore
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

// prettier-ignore
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

// prettier-ignore
const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];

// prettier-ignore
const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

// prettier-ignore
const PST_KING_MG = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

// prettier-ignore
const PST_KING_EG = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

const PST: Record<Exclude<PieceSymbol, 'k'>, number[]> = {
  p: PST_PAWN,
  n: PST_KNIGHT,
  b: PST_BISHOP,
  r: PST_ROOK,
  q: PST_QUEEN,
};

const BISHOP_PAIR = 30;
/** Below this much non-pawn, non-king material per side we are "in the endgame"
    and the king should centralize rather than hide. */
const ENDGAME_MATERIAL = 1300; // ~ rook + minor + a bit

/** Total non-pawn material on the board (both sides), used as a phase signal. */
export function nonPawnMaterial(chess: Chess): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.type !== 'p' && sq.type !== 'k') total += PIECE_VALUE[sq.type];
    }
  }
  return total;
}

/** True once the position has simplified into an endgame. */
export function isEndgame(chess: Chess): boolean {
  return nonPawnMaterial(chess) <= ENDGAME_MATERIAL * 2;
}

/** Static evaluation in centipawns from White's perspective. */
export function evaluate(chess: Chess): number {
  let score = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  // Phase: 1.0 = full middlegame, 0.0 = bare endgame. Blends the king table.
  const npm = nonPawnMaterial(chess);
  const phase = Math.max(0, Math.min(1, npm / (ENDGAME_MATERIAL * 2)));

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r][f];
      if (!sq) continue;
      const white = sq.color === 'w';
      const idx = white ? r * 8 + f : (7 - r) * 8 + f;

      let v = PIECE_VALUE[sq.type];
      if (sq.type === 'k') {
        v += Math.round(PST_KING_MG[idx] * phase + PST_KING_EG[idx] * (1 - phase));
      } else {
        v += PST[sq.type][idx];
      }
      score += white ? v : -v;

      if (sq.type === 'b') {
        if (white) whiteBishops++;
        else blackBishops++;
      }
    }
  }

  if (whiteBishops >= 2) score += BISHOP_PAIR;
  if (blackBishops >= 2) score -= BISHOP_PAIR;

  return score;
}
