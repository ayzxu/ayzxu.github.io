/* ==========================================================================
   book.ts — opening-book lookup and weighted sampling.

   The book is keyed by the first four FEN fields (placement, side, castling,
   en-passant) and stores only moves Andy actually played, so sampling from it
   reproduces his repertoire (Italian as White, King's Indian vs 1.d4, open
   1...e5 games vs 1.e4).
   ========================================================================== */

import type { Chess, Move } from 'chess.js';
import type { OpeningBook, Rng } from './types';

/** Normalize a FEN to the book key: placement, side, castling, en-passant.
    Matches chess.js, which emits '-' for en-passant when no capture is legal. */
export function fenKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** Pick a book move for the current position, or null if out of book.
    Sampling weight = count × (0.5 + score), biasing toward Andy's frequent and
    historically successful choices while preserving variety. Any book move that
    is not currently legal (corrupt/stale data) is skipped defensively. */
export function pickBookMove(
  chess: Chess,
  book: OpeningBook,
  rng: Rng,
): Move | null {
  const entry = book.positions[fenKey(chess.fen())];
  if (!entry || entry.moves.length === 0) return null;

  const legal = chess.moves({ verbose: true }) as Move[];
  const bySan = new Map(legal.map((m) => [m.san, m]));

  const candidates: { move: Move; weight: number }[] = [];
  for (const bm of entry.moves) {
    const mv = bySan.get(bm.san);
    if (!mv) continue; // not legal here — ignore stale entry
    const weight = Math.max(1, bm.count) * (0.5 + (bm.score ?? 0.5));
    candidates.push({ move: mv, weight });
  }
  if (candidates.length === 0) return null;

  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c.move;
  }
  return candidates[candidates.length - 1].move;
}
