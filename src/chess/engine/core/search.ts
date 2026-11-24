/* search.ts — the core engine's search: iterative deepening negamax with
   principal-variation search, a transposition table, null-move pruning, late-
   move reductions, futility pruning, killer and history move ordering, a check
   extension, and a capture-only quiescence search.

   Two entry points:
     think()        → the engine's own best move (used by the post-game review)
     analyzeRoot()  → every legal move scored three ways, which is what the
                      humanizer chooses from:
                        glance  what's obvious: the move, then the captures
                                that follow (quiescence only)
                        reply   one full reply considered, then captures
                        deep    the engine's real verdict at full depth
                      The gap between what a move looks like at a glance and
                      what it really is is exactly where human mistakes live. */

import {
  BISHOP,
  KING,
  KNIGHT,
  PAWN,
  Position,
  QUEEN,
  ROOK,
  isCaptureMove,
  moveFrom,
  movePromo,
  moveTo,
} from './position';
import { evaluate } from './evaluate';
import { VALUE } from './tables';

export const INF = 32000;
export const MATE = 31000;
/** Scores beyond this are mates */
export const MATE_BOUND = MATE - 1000;
const MAX_PLY = 96;

const TT_BITS = 20;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;

/** Moves are searched in this order: hash move, winning captures and
    promotions, killers, then quiets by history. */
const ORDER_TT = 2_000_000;
const ORDER_CAPTURE = 1_000_000;
const ORDER_KILLER1 = 900_000;
const ORDER_KILLER2 = 800_000;

export type SearchLimits = {
  /** deepest iteration to run */
  depth: number;
  /** total node budget across the whole call */
  nodes: number;
};

export type RootMove = {
  move: number;
  /** quiescence-only: the obvious consequences */
  glance: number;
  /** one full reply, then quiescence */
  reply: number;
  /** the engine's verdict at full depth (moves far below best keep an upper
      bound, which is all the humanizer needs from them) */
  deep: number;
};

export type RootAnalysis = {
  moves: RootMove[];
  depth: number;
  nodes: number;
  bestMove: number;
  bestScore: number;
};

export class Searcher {
  private ttKey = new Int32Array(TT_SIZE);
  private ttMove = new Int32Array(TT_SIZE);
  private ttScore = new Int16Array(TT_SIZE);
  private ttDepth = new Int8Array(TT_SIZE);
  private ttFlag = new Uint8Array(TT_SIZE);

  private killers = new Int32Array(MAX_PLY * 2);
  private history = new Int32Array(16 * 128);
  private moveBuf = Array.from({ length: MAX_PLY + 1 }, () => new Int32Array(256));
  private scoreBuf = Array.from({ length: MAX_PLY + 1 }, () => new Int32Array(256));

  nodes = 0;
  private nodeLimit = Infinity;
  private stopped = false;

  constructor(private pos: Position) {}

  /** Fresh tables for a new game (the TT may be reused across moves). */
  clear(): void {
    this.ttFlag.fill(0);
    this.history.fill(0);
    this.killers.fill(0);
  }

  /* --- transposition table ---------------------------------------------- */
  private ttProbe(): number {
    const i = this.pos.hashLo & TT_MASK;
    return this.ttFlag[i] && this.ttKey[i] === this.pos.hashHi ? i : -1;
  }

  private ttStore(depth: number, score: number, flag: number, move: number, ply: number) {
    const i = this.pos.hashLo & TT_MASK;
    // Depth-preferred, but always replace a stale entry from another position.
    if (this.ttFlag[i] && this.ttKey[i] === this.pos.hashHi && this.ttDepth[i] > depth && flag !== EXACT) {
      return;
    }
    // Mate scores are stored relative to this node, not the root.
    if (score > MATE_BOUND) score += ply;
    else if (score < -MATE_BOUND) score -= ply;
    this.ttKey[i] = this.pos.hashHi;
    this.ttMove[i] = move;
    this.ttScore[i] = score;
    this.ttDepth[i] = depth;
    this.ttFlag[i] = flag;
  }

  private ttScoreAt(i: number, ply: number): number {
    const s = this.ttScore[i];
    if (s > MATE_BOUND) return s - ply;
    if (s < -MATE_BOUND) return s + ply;
    return s;
  }

  /* --- move ordering ----------------------------------------------------- */
  private orderMoves(n: number, ply: number, ttMove: number): void {
    const moves = this.moveBuf[ply];
    const scores = this.scoreBuf[ply];
    const b = this.pos.board;
    const k1 = this.killers[ply * 2];
    const k2 = this.killers[ply * 2 + 1];
    for (let i = 0; i < n; i++) {
      const m = moves[i];
      let s: number;
      if (m === ttMove) s = ORDER_TT;
      else if (isCaptureMove(m) || movePromo(m)) {
        const victim = b[moveTo(m)] & 7 || PAWN; // en passant: a pawn
        const attacker = b[moveFrom(m)] & 7;
        s = ORDER_CAPTURE + VALUE[victim] * 10 - VALUE[attacker] + VALUE[movePromo(m)];
      } else if (m === k1) s = ORDER_KILLER1;
      else if (m === k2) s = ORDER_KILLER2;
      else s = this.history[(b[moveFrom(m)] & 15) * 128 + moveTo(m)];
      scores[i] = s;
    }
  }

  /** Selection sort step: bring the best remaining move to index i. */
  private pick(i: number, n: number, ply: number): number {
    const moves = this.moveBuf[ply];
    const scores = this.scoreBuf[ply];
    let best = i;
    for (let j = i + 1; j < n; j++) if (scores[j] > scores[best]) best = j;
    if (best !== i) {
      const m = moves[i];
      moves[i] = moves[best];
      moves[best] = m;
      const s = scores[i];
      scores[i] = scores[best];
      scores[best] = s;
    }
    return moves[i];
  }

  private hasNonPawnMaterial(side: number): boolean {
    const b = this.pos.board;
    const bit = side ? 8 : 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (p && (p & 8) === bit) {
        const t = p & 7;
        if (t === KNIGHT || t === BISHOP || t === ROOK || t === QUEEN) return true;
      }
    }
    return false;
  }

  private checkLimit(): void {
    if (this.nodes >= this.nodeLimit) this.stopped = true;
  }

  /* --- quiescence ---------------------------------------------------------- */
  quiesce(alpha: number, beta: number, ply: number): number {
    this.nodes++;
    if ((this.nodes & 1023) === 0) this.checkLimit();
    const pos = this.pos;
    if (ply >= MAX_PLY) return evaluate(pos);

    const inCheck = pos.inCheck();
    let best = -INF;
    if (!inCheck) {
      const standPat = evaluate(pos);
      if (standPat >= beta) return standPat;
      if (standPat > alpha) alpha = standPat;
      best = standPat;
    }

    const moves = this.moveBuf[ply];
    // In check every evasion counts, not just captures.
    const n = pos.generate(moves, 0, !inCheck);
    this.orderMoves(n, ply, 0);
    const b = pos.board;
    const them = pos.side ^ 1;
    let legal = 0;
    for (let i = 0; i < n; i++) {
      const m = this.pick(i, n, ply);
      if (!inCheck) {
        const victim = b[moveTo(m)] & 7 || PAWN;
        const attacker = b[moveFrom(m)] & 7;
        // Delta pruning: even winning this piece can't lift us to alpha.
        if (!movePromo(m) && best + VALUE[victim] + 200 < alpha) continue;
        // Losing capture into a defended square: skip (a cheap stand-in for SEE).
        if (
          VALUE[attacker] > VALUE[victim] &&
          attacker !== KING &&
          !movePromo(m) &&
          pos.attacked(moveTo(m), them)
        ) {
          continue;
        }
      }
      if (!pos.make(m)) continue;
      legal++;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) {
        best = score;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) return score;
        }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return best;
  }

  /* --- main search --------------------------------------------------------- */
  negamax(depth: number, alpha: number, beta: number, ply: number, nullOk: boolean): number {
    const pos = this.pos;
    if (ply > 0 && (pos.halfmove >= 100 || pos.isRepetition())) return 0;
    if (ply >= MAX_PLY) return evaluate(pos);

    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);

    this.nodes++;
    if ((this.nodes & 1023) === 0) this.checkLimit();
    if (this.stopped) return 0;

    const pvNode = beta - alpha > 1;
    let ttMove = 0;
    const ti = this.ttProbe();
    if (ti >= 0) {
      ttMove = this.ttMove[ti];
      if (ply > 0 && this.ttDepth[ti] >= depth && !pvNode) {
        const s = this.ttScoreAt(ti, ply);
        const f = this.ttFlag[ti];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }

    const staticEval = inCheck ? -INF : evaluate(pos);

    if (!pvNode && !inCheck && ply > 0) {
      // Reverse futility: comfortably above beta even after a margin.
      if (depth <= 3 && staticEval - 110 * depth >= beta) return staticEval;
      // Null move: if passing still beats beta, a real move surely does.
      if (nullOk && depth >= 3 && staticEval >= beta && this.hasNonPawnMaterial(pos.side)) {
        const r = depth >= 6 ? 3 : 2;
        pos.makeNull();
        const s = -this.negamax(depth - 1 - r, -beta, -beta + 1, ply + 1, false);
        pos.unmakeNull();
        if (this.stopped) return 0;
        if (s >= beta && s < MATE_BOUND) return s;
      }
    }

    const moves = this.moveBuf[ply];
    const n = pos.generate(moves, 0);
    this.orderMoves(n, ply, ttMove);

    const alpha0 = alpha;
    let best = -INF;
    let bestMove = 0;
    let legal = 0;
    for (let i = 0; i < n; i++) {
      const m = this.pick(i, n, ply);
      const quiet = !isCaptureMove(m) && !movePromo(m);
      if (!pos.make(m)) continue;
      legal++;
      const givesCheck = pos.inCheck();

      // Futility: a quiet move this close to the horizon can't rescue alpha.
      if (
        quiet && !pvNode && !inCheck && !givesCheck && legal > 1 && depth <= 2 &&
        staticEval + 90 + 110 * depth <= alpha
      ) {
        pos.unmake();
        continue;
      }

      let score: number;
      if (legal === 1) {
        score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        // Late quiet moves are searched shallower first.
        let r = 0;
        if (depth >= 3 && legal > 3 && quiet && !inCheck && !givesCheck) {
          r = Math.floor(0.75 + (Math.log(depth) * Math.log(legal)) / 2.25);
          if (pvNode) r--;
          r = Math.max(0, Math.min(depth - 2, r));
        }
        score = -this.negamax(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && r > 0) {
          score = -this.negamax(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        }
        if (score > alpha && score < beta) {
          score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
        }
      }
      pos.unmake();
      if (this.stopped) return 0;

      if (score > best) {
        best = score;
        bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) {
            if (quiet) {
              if (this.killers[ply * 2] !== m) {
                this.killers[ply * 2 + 1] = this.killers[ply * 2];
                this.killers[ply * 2] = m;
              }
              const h = (pos.board[moveFrom(m)] & 15) * 128 + moveTo(m);
              this.history[h] = Math.min(400_000, this.history[h] + depth * depth);
            }
            break;
          }
        }
      }
    }

    if (legal === 0) return inCheck ? -MATE + ply : 0;

    this.ttStore(depth, best, best >= beta ? LOWER : best > alpha0 ? EXACT : UPPER, bestMove, ply);
    return best;
  }

  /** Iterative deepening from the current position. */
  think(limits: SearchLimits): { move: number; score: number; depth: number } {
    this.nodes = 0;
    this.nodeLimit = limits.nodes;
    this.stopped = false;
    let bestMove = 0;
    let bestScore = 0;
    let reached = 0;
    let prev = 0;
    for (let d = 1; d <= limits.depth; d++) {
      // Aspiration window around the last score, widened on failure.
      let delta = d >= 4 ? 40 : INF;
      let alpha = Math.max(-INF, prev - delta);
      let beta = Math.min(INF, prev + delta);
      let score: number;
      for (;;) {
        score = this.negamax(d, alpha, beta, 0, false);
        if (this.stopped) break;
        if (score <= alpha) alpha = Math.max(-INF, alpha - (delta *= 3));
        else if (score >= beta) beta = Math.min(INF, beta + (delta *= 3));
        else break;
      }
      if (this.stopped && d > 1) break;
      const ti = this.ttProbe();
      if (ti >= 0 && this.ttMove[ti]) bestMove = this.ttMove[ti];
      bestScore = score;
      prev = score;
      reached = d;
      if (Math.abs(score) > MATE_BOUND) break; // found a forced mate
    }
    return { move: bestMove, score: bestScore, depth: reached };
  }

  /** Score every legal root move: glance, one-reply and deep (see header).

      Budget: the glance and one-reply scores always complete (they're cheap).
      The main search then gets about half of `limits.nodes`, and the rest goes
      to checking the alternatives two plies shallower, most promising first;
      any the budget doesn't reach keep their one-reply score as "deep". */
  analyzeRoot(limits: SearchLimits, window = 350): RootAnalysis {
    const pos = this.pos;
    const legal = pos.legalMoves();
    this.nodes = 0;
    this.nodeLimit = Infinity;
    this.stopped = false;

    const out: RootMove[] = [];
    for (const m of legal) {
      pos.make(m);
      const glance = -this.quiesce(-INF, INF, 1);
      const reply = -this.negamax(1, -INF, INF, 1, false);
      pos.unmake();
      out.push({ move: m, glance, reply, deep: reply });
    }
    const quick = this.nodes;

    // Main search: the best line, and a warm TT for everything after it.
    const main = this.think({
      depth: limits.depth,
      nodes: Math.max(20_000, Math.round((limits.nodes - quick) * 0.55)),
    });
    const depth = Math.max(1, main.depth);
    const best = main.score;
    const altDepth = Math.max(1, depth - 2);

    this.nodes += quick;
    this.nodeLimit = limits.nodes;
    this.stopped = false;
    out.sort((a, b) => b.reply - a.reply);
    for (const rm of out) {
      if (rm.move === main.move) {
        rm.deep = best;
        continue;
      }
      if (this.stopped || this.nodes >= this.nodeLimit) continue;
      pos.make(rm.move);
      // Exact within `window` of the best move; an upper bound below that.
      let deep = -this.negamax(altDepth - 1, -(best + 1), -(best - window), 1, true);
      if (!this.stopped && deep > best) {
        deep = -this.negamax(altDepth - 1, -INF, -best, 1, true);
      }
      pos.unmake();
      if (!this.stopped) rm.deep = deep;
    }

    out.sort((a, b) => b.deep - a.deep);
    const top = out[0];
    return {
      moves: out,
      depth,
      nodes: this.nodes,
      bestMove: top ? top.move : 0,
      bestScore: top ? top.deep : 0,
    };
  }
}

