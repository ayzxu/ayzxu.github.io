/* ==========================================================================
   analyze.ts — post-game review, scored by the engine's own judgement.

   This is deliberately NOT Stockfish. The same shallow negamax + quiescence
   search the bot plays with (search.ts) re-scores every position, so the review
   reflects "what Andy's engine thinks" rather than a 3200 oracle. That keeps the
   feature honest and, conveniently, fast enough to run client-side in the worker.

   For each move we measure centipawns lost versus the engine's best reply,
   bucket it (best → blunder), and convert the win-probability swing into a
   per-move accuracy using Lichess's published model. For the human's moves we
   also look up the position in Andy's opening book, so the panel can show what
   Andy actually plays most in that spot.
   ========================================================================== */

import { Chess, type Move } from 'chess.js';
import { searchRoot } from './search';
import { fenKey } from './book';
import type {
  GameReview,
  MoveQuality,
  MoveReview,
  OpeningBook,
} from './types';

/* Shallow on purpose: this matches the bot's gameplay strength, and quiescence
   already resolves hanging pieces and trades, which is what makes a depth-2
   review trustworthy enough to flag real blunders. The tighter node budget and
   topK keep a whole-game review to roughly a second or two. */
const ANALYSIS_DEPTH = 2;
const ANALYSIS_TOPK = 6;
const ANALYSIS_NODE_BUDGET = 60_000;

/* cp-lost thresholds for the quality buckets. */
const T_BEST = 20;
const T_GOOD = 50;
const T_INACCURACY = 100;
const T_MISTAKE = 250;

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

const samePromotion = (a?: string, b?: string): boolean =>
  (a ?? '') === (b ?? '');

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

  for (let ply = 0; ply < history.length; ply++) {
    const san = history[ply];
    const color = chess.turn(); // side about to move
    const byUser = (color === 'w') === (userColor === 'white');
    const fenBefore = chess.fen();

    const legal = chess.moves({ verbose: true }) as Move[];
    const playedMove = legal.find((m) => m.san === san) ?? null;

    // The engine scores every legal root move (mover's POV), best first. With a
    // single legal move there's nothing to lose — skip the search.
    let bestCp = 0;
    let playedCp = 0;
    let bestSan: string | undefined;
    if (legal.length > 1) {
      const scores = searchRoot(
        chess,
        ANALYSIS_DEPTH,
        ANALYSIS_TOPK,
        ANALYSIS_NODE_BUDGET,
      );
      if (scores.length) {
        bestCp = scores[0].searchCp;
        bestSan = scores[0].move.san;
        const mine = playedMove
          ? scores.find(
              (s) =>
                s.move.from === playedMove.from &&
                s.move.to === playedMove.to &&
                samePromotion(s.move.promotion, playedMove.promotion),
            )
          : scores.find((s) => s.move.san === san);
        playedCp = mine ? mine.searchCp : bestCp;
      }
    }

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
