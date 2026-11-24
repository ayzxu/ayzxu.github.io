/* analyze.ts — post-game review, scored by the bot's own engine.

   Not Stockfish: the core engine (core/search.ts) re-scores every position of
   the game at a modest budget, which is fast enough to run in the worker and
   strong enough to call real mistakes. Each position is evaluated once; a
   move's loss is the score before it minus the score after it (from the
   mover's side), the way Lichess computes it. Losses become quality buckets
   (best → blunder) and a per-move accuracy from Lichess's win% model. For the
   human's moves we also look up Andy's opening book, so the panel can show
   what Andy actually plays in that spot. */

import { Chess } from 'chess.js';
import { fenKey } from './book';
import { Position, moveFrom, movePromo, moveTo, sqName } from './core/position';
import { MATE_BOUND, Searcher } from './core/search';
import type { GameReview, MoveQuality, MoveReview, OpeningBook } from './types';

/** Engine budget per position: ~depth 7–8, a few seconds for a whole game */
const REVIEW_NODES = 20_000;
/** Scores are clamped here so a mate doesn't dwarf everything else */
const CLAMP = 1500;

/* cp-lost thresholds for the quality buckets. */
const T_BEST = 20;
const T_GOOD = 50;
const T_INACCURACY = 100;
const T_MISTAKE = 250;

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Win probability (0..100) for the side to move, from a centipawn score in
    that side's POV — Lichess's logistic model. */
function winPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Per-move accuracy (0..100) from the win% the player gave up — Lichess model. */
function moveAccuracy(winBefore: number, winAfter: number): number {
  const acc = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

function classify(cpLoss: number): MoveQuality {
  if (cpLoss <= T_BEST) return 'best';
  if (cpLoss <= T_GOOD) return 'good';
  if (cpLoss <= T_INACCURACY) return 'inaccuracy';
  if (cpLoss <= T_MISTAKE) return 'mistake';
  return 'blunder';
}

/** Replay a SAN history and produce a full game review. */
export function analyzeGame(
  history: string[],
  userColor: 'white' | 'black',
  book: OpeningBook,
): GameReview {
  const chess = new Chess();
  const moves: MoveReview[] = [];

  let userAccSum = 0;
  let userAccN = 0;
  let andyAccSum = 0;
  let andyAccN = 0;
  let userLossSum = 0;
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;
  let bookMatches = 0;
  let bookTotal = 0;

  // Score every position once (side to move's view), with the engine's pick.
  const pos = new Position();
  pos.setFen(START_FEN);
  const searcher = new Searcher(pos);
  const scores: number[] = [];
  const bestUci: (string | null)[] = [];
  const replay = new Chess();
  for (let ply = 0; ply <= history.length; ply++) {
    const legal = pos.legalMoves();
    if (legal.length === 0) {
      scores.push(pos.inCheck() ? -CLAMP : 0);
      bestUci.push(null);
    } else {
      const r = searcher.think({ depth: 64, nodes: REVIEW_NODES });
      const score = Math.abs(r.score) > MATE_BOUND ? Math.sign(r.score) * CLAMP : r.score;
      scores.push(Math.max(-CLAMP, Math.min(CLAMP, score)));
      const m = r.move || legal[0];
      bestUci.push(
        sqName(moveFrom(m)) + sqName(moveTo(m)) + (movePromo(m) ? ' pnbrqk'[movePromo(m)] : ''),
      );
    }
    if (ply === history.length) break;
    const played = replay.move(history[ply]);
    const mv = pos.findMove(played.from, played.to, played.promotion);
    if (!mv || !pos.make(mv)) break;
  }

  for (let ply = 0; ply < history.length; ply++) {
    const san = history[ply];
    const color = chess.turn(); // side about to move
    const byUser = (color === 'w') === (userColor === 'white');
    const fenBefore = chess.fen();

    const legal = chess.moves({ verbose: true });
    const before = scores[ply] ?? 0;
    const after = -(scores[ply + 1] ?? 0);
    let bestSan: string | undefined;
    const b = bestUci[ply];
    if (b) {
      const bm = legal.find(
        (m) => m.from === b.slice(0, 2) && m.to === b.slice(2, 4) && (m.promotion ?? '') === (b[4] ?? ''),
      );
      bestSan = bm?.san;
    }
    const bestCp = legal.length > 1 ? before : 0;
    const playedCp = legal.length > 1 ? Math.min(before, after) : 0;

    // What does Andy actually do here? (Only meaningful for the human's moves —
    // the bot's own moves came from this very book.)
    let andyBook: MoveReview['andyBook'];
    let inAndyBook = false;
    if (byUser) {
      const entry = book.positions[fenKey(fenBefore)];
      if (entry && entry.moves.length) {
        bookTotal++;
        const totalCount =
          entry.moves.reduce((s, mv) => s + mv.count, 0) || 1;
        const top = [...entry.moves].sort((a, b) => b.count - a.count)[0];
        inAndyBook = entry.moves.some((mv) => mv.san === san);
        if (inAndyBook) bookMatches++;
        andyBook = {
          san: top.san,
          sharePct: Math.round((100 * top.count) / totalCount),
          matchedTop: top.san === san,
          inRepertoire: inAndyBook,
        };
      }
    }

    // A move that's genuinely in Andy's repertoire is, by definition, "like
    // Andy" — don't let the shallow review engine flag a normal book move as an
    // error just because it would have picked something else.
    let cpLoss = Math.max(0, bestCp - playedCp);
    if (byUser && inAndyBook) cpLoss = Math.min(cpLoss, T_GOOD);
    const quality = classify(cpLoss);
    const accuracy = moveAccuracy(winPercent(bestCp), winPercent(bestCp - cpLoss));

    if (byUser) {
      userAccSum += accuracy;
      userAccN++;
      userLossSum += cpLoss;
      if (quality === 'blunder') blunders++;
      else if (quality === 'mistake') mistakes++;
      else if (quality === 'inaccuracy') inaccuracies++;
    } else {
      andyAccSum += accuracy;
      andyAccN++;
    }

    moves.push({
      ply,
      moveNumber: Math.floor(ply / 2) + 1,
      color,
      san,
      byUser,
      cpLoss,
      quality,
      accuracy,
      bestSan: bestSan && bestSan !== san ? bestSan : undefined,
      andyBook,
    });

    chess.move(san);
  }

  return {
    userColor,
    userAccuracy: userAccN ? Math.round(userAccSum / userAccN) : 0,
    andyAccuracy: andyAccN ? Math.round(andyAccSum / andyAccN) : 0,
    userAcpl: userAccN ? Math.round(userLossSum / userAccN) : 0,
    counts: { blunders, mistakes, inaccuracies },
    bookMatches,
    bookTotal,
    moves,
  };
}
