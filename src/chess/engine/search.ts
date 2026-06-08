/* ==========================================================================
   search.ts — negamax with alpha-beta pruning and a capture-only quiescence
   search. Operates on a single chess.js instance via move/undo for speed.

   searchRoot() returns a *true* score for every legal root move (full window,
   no cross-root pruning) so the style layer and humanizer can rank and sample
   among them. A node budget bounds worst-case latency.
   ========================================================================== */

import type { Chess, Move } from 'chess.js';
import { evaluate, PIECE_VALUE } from './evaluate';

export const MATE = 100_000;
const INF = 1_000_000;
const DEFAULT_NODE_BUDGET = 200_000;
/** Only the most promising root moves get a full deep search; the rest keep
    their cheap quiescence score. This is the key performance lever given how
    slow chess.js move generation is — and shallow search on the long tail is
    also more human (a 1500 doesn't deeply calculate every candidate). */
const DEFAULT_TOP_K = 8;
/** Hard ceiling on quiescence recursion so tactical positions can't explode.
    This is what gives a *depth-2* search real tactical safety: it resolves all
    pending captures before scoring, so the engine rarely hangs or misses a
    simple trade — the main reason a shallow engine feels weak. */
const MAX_QDEPTH = 5;

type Budget = { nodes: number; limit: number };

function isCapture(m: Move): boolean {
  return m.flags.includes('c') || m.flags.includes('e');
}

/** Most-Valuable-Victim / Least-Valuable-Attacker, plus promotion & check noise
    so the better-looking moves are tried first (more cutoffs). */
function orderScore(m: Move): number {
  let s = 0;
  if (isCapture(m)) {
    const victim = m.captured ? PIECE_VALUE[m.captured] : 100;
    s += 10 * victim - PIECE_VALUE[m.piece];
  }
  if (m.promotion) s += PIECE_VALUE[m.promotion] * 5;
  if (m.san.includes('+')) s += 50;
  return s;
}

function ordered(moves: Move[]): Move[] {
  return [...moves].sort((a, b) => orderScore(b) - orderScore(a));
}

/** Score the side-to-move's position statically (centipawns, mover's POV). */
function staticForMover(chess: Chess): number {
  const cp = evaluate(chess);
  return chess.turn() === 'w' ? cp : -cp;
}

function applyMove(chess: Chess, m: Move): void {
  chess.move({ from: m.from, to: m.to, promotion: m.promotion });
}

/** Quiescence: only resolve captures so the search doesn't stop mid-trade. */
function quiesce(
  chess: Chess,
  alpha: number,
  beta: number,
  budget: Budget,
  qdepth: number,
): number {
  budget.nodes++;
  const standPat = staticForMover(chess);
  if (budget.nodes > budget.limit || qdepth <= 0) return standPat;
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;

  const captures = ordered(
    (chess.moves({ verbose: true }) as Move[]).filter(
      (m) => isCapture(m) || !!m.promotion,
    ),
  );

  for (const m of captures) {
    applyMove(chess, m);
    const score = -quiesce(chess, -beta, -alpha, budget, qdepth - 1);
    chess.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  budget: Budget,
): number {
  budget.nodes++;
  if (budget.nodes > budget.limit) return staticForMover(chess);

  if (chess.isCheckmate()) return -MATE + ply; // prefer slower mates against us
  if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial()) {
    return 0;
  }
  if (depth <= 0) return quiesce(chess, alpha, beta, budget, MAX_QDEPTH);

  const moves = ordered(chess.moves({ verbose: true }) as Move[]);
  let best = -INF;
  for (const m of moves) {
    applyMove(chess, m);
    const score = -negamax(chess, depth - 1, -beta, -alpha, ply + 1, budget);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // beta cutoff
  }
  return best;
}

export type RootScore = { move: Move; searchCp: number };

/** Search the legal root moves and return scores (mover POV).

    Two-phase for speed: a cheap quiescence score orders every move, then only
    the top K get a full deep search to `depth`. The long tail keeps its
    quiescence score — fine, since the humanizer rarely samples from it. */
export function searchRoot(
  chess: Chess,
  depth: number,
  topK: number = DEFAULT_TOP_K,
  nodeLimit: number = DEFAULT_NODE_BUDGET,
): RootScore[] {
  const budget: Budget = { nodes: 0, limit: nodeLimit };
  const rootMoves = ordered(chess.moves({ verbose: true }) as Move[]);

  // Phase 1 — cheap quiescence score for ordering.
  const prelim: RootScore[] = rootMoves.map((m) => {
    applyMove(chess, m);
    const s = -quiesce(chess, -INF, INF, budget, MAX_QDEPTH);
    chess.undo();
    return { move: m, searchCp: s };
  });
  prelim.sort((a, b) => b.searchCp - a.searchCp);

  if (depth <= 1) return prelim;

  // Phase 2 — deep-search the top K with a full window for accurate scores.
  const k = Math.min(topK, prelim.length);
  for (let i = 0; i < k; i++) {
    applyMove(chess, prelim[i].move);
    prelim[i].searchCp = -negamax(chess, depth - 1, -INF, INF, 1, budget);
    chess.undo();
  }
  prelim.sort((a, b) => b.searchCp - a.searchCp);
  return prelim;
}
