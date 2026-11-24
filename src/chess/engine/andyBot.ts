/* andyBot.ts — the engine entry point. Given a position, returns the move Andy
   would plausibly play:

     1. In a position from his opening book (and unless we roll a deviation),
        one of the moves he actually played there, weighted by how often and
        how well.
     2. Otherwise the core engine scores every legal move three ways (glance,
        one reply, deep; see core/search.ts) and the fitted humanizer picks
        one the way Andy would (see human/model.ts).

   Synchronous; the Web Worker wraps it. The engine (and its hash table) is
   kept between moves, and the game so far is replayed into it so it can see
   repetitions. */

import { Chess, type Move } from 'chess.js';
import type { AndyProfile, EngineResult, LastMoveInfo, OpeningBook, Rng } from './types';
import { pickBookMove } from './book';
import { humanThinkMs, type ThinkContext } from './think';
import {
  Position,
  moveFrom,
  movePromo,
  moveTo,
  parseSq,
  sqName,
} from './core/position';
import { Searcher } from './core/search';
import {
  SEARCH_NODES,
  contextFeatures,
  decide,
  habitFeatures,
  sampleDecision,
  type HumanModel,
} from './human/model';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Loss (engine cp) below which a move counts as one of the best, and above
    which it's a real mistake — only used to label moves for the UI. */
const LABEL_BEST = 30;
const LABEL_BLUNDER = 150;

const PROMO = ' pnbrqk';

/** Full moves played straight from the book (no random deviation) */
const BOOK_FIXED_MOVES = 5;

let engine: { pos: Position; searcher: Searcher } | null = null;

function getEngine() {
  if (!engine) {
    const pos = new Position();
    engine = { pos, searcher: new Searcher(pos) };
  }
  return engine;
}

const fenKey4 = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** Load the position, replaying the game when we have it (for repetitions). */
function loadPosition(pos: Position, fen: string, history?: string[]): void {
  if (history && history.length) {
    pos.setFen(START_FEN);
    let ok = true;
    for (const uci of history) {
      const m = pos.findMove(uci.slice(0, 2), uci.slice(2, 4), uci[4]);
      if (!m || !pos.make(m)) {
        ok = false;
        break;
      }
    }
    if (ok && fenKey4(pos.toFen()) === fenKey4(fen)) return;
  }
  pos.setFen(fen);
}

function isCapture(m: Move): boolean {
  return m.flags.includes('c') || m.flags.includes('e');
}

export type ChooseOptions = {
  /** the opponent's previous move (for instant recaptures) */
  lastMove?: LastMoveInfo;
  /** the game so far as UCI moves from the start position */
  history?: string[];
  /** engine budget override (tests, calibration) */
  nodes?: number;
};

export function chooseMove(
  fen: string,
  profile: AndyProfile,
  book: OpeningBook,
  model: HumanModel,
  rng: Rng = Math.random,
  opts: ChooseOptions = {},
): EngineResult | null {
  const t0 = Date.now();
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return null; // game over

  const moveNumber = Number(fen.split(' ')[5]) || 1;
  const { lastMove } = opts;
  const thinkCtx = (
    source: 'book' | 'search',
    chosen: Move,
    sharp: number,
    endgame: boolean,
  ): ThinkContext => ({
    source,
    forced: legal.length === 1,
    recapture: !!lastMove && lastMove.capture && isCapture(chosen) && chosen.to === lastMove.to,
    capture: isCapture(chosen),
    endgame,
    sharp,
    moveNumber,
  });

  const finish = (
    from: string,
    to: string,
    promotion: string | undefined,
    source: EngineResult['source'],
    evalCp: number,
    delayMs: number,
  ): EngineResult => {
    const applied = chess.move({ from, to, promotion });
    return {
      san: applied.san,
      from: applied.from,
      to: applied.to,
      promotion: applied.promotion,
      fen: chess.fen(),
      source,
      evalCp,
      thinkMs: Date.now() - t0,
      delayMs,
    };
  };

  // --- 1. Opening book ---------------------------------------------------
  // The first few moves always come from the book; after that he sometimes
  // leaves it anyway, which keeps games from all looking alike.
  if (moveNumber < BOOK_FIXED_MOVES || rng() > profile.bookDeviation) {
    const bm = pickBookMove(chess, book, rng);
    if (bm) {
      const delay = humanThinkMs(profile.timing, thinkCtx('book', bm, 0, false), rng);
      return finish(bm.from, bm.to, bm.promotion, 'book', 0, delay);
    }
  }

  // --- 2. Engine + humanizer ---------------------------------------------
  const { pos, searcher } = getEngine();
  loadPosition(pos, fen, opts.history);
  const analysis = searcher.analyzeRoot({ depth: 64, nodes: opts.nodes ?? SEARCH_NODES });

  const ply = (moveNumber - 1) * 2 + (pos.side === 1 ? 1 : 0);
  const ctx = {
    lastCaptureTo: lastMove?.capture ? parseSq(lastMove.to) : -1,
    ply,
    blitz: false, // the bot plays as rapid Andy...
    rating: profile.ratings.rapid, // ...at his current rapid rating
  };
  const habits = analysis.moves.map((rm) => habitFeatures(pos, rm.move, ctx));
  const context = contextFeatures(pos, analysis, ctx);
  const decision = decide(model, analysis, habits, context);
  const { index } = sampleDecision(decision, rng);
  const chosen = analysis.moves[index];

  const loss = analysis.bestScore - chosen.deep;
  const source: EngineResult['source'] =
    legal.length === 1
      ? 'forced'
      : loss <= LABEL_BEST
        ? 'best'
        : loss < LABEL_BLUNDER
          ? 'inaccuracy'
          : 'blunder';

  const from = sqName(moveFrom(chosen.move));
  const to = sqName(moveTo(chosen.move));
  const promotion = movePromo(chosen.move) ? PROMO[movePromo(chosen.move)] : undefined;
  const chosenJs = legal.find((m) => m.from === from && m.to === to) ?? legal[0];
  const sharp = context[2] + context[3] * 0.4;
  const endgame = context[1] > 0.6;
  const delay = humanThinkMs(profile.timing, thinkCtx('search', chosenJs, sharp, endgame), rng);

  return finish(from, to, promotion, source, chosen.deep, delay);
}
