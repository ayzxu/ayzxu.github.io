/* model.ts — the humanizer: how Andy picks a move, as a fitted choice model.

   The engine scores every legal move three ways (see core/search.ts):
     glance  the move and the captures that follow: what's obvious
     reply   one full reply considered, then captures
     deep    the engine's real verdict

   A human doesn't calculate every move to the same depth. On each move Andy
   effectively works at one of those three levels: a quick glance, checking
   the reply, or a proper calculation. Which one depends on the position (an
   only-move crisis, a quiet endgame, a position that's already won). At that
   level he chooses among the moves by how good they look, with some noise
   (a softmax with temperature τ), plus his habits: the kinds of moves he
   likes (captures, checks, knight moves, retreats...).

     P(move) = Σ_level π_level(context) · softmax_moves((value_level + habit) / τ_level)

   Mistakes fall out of this naturally, and the right ones: moves that look
   fine at a glance but lose to a quiet reply, tactics that only a deeper look
   finds. Every weight is fitted by maximum likelihood to the moves Andy
   actually played (tools/chess-data/fit-human.ts), so the bot misses what
   Andy misses, as often as he misses it. */

import {
  BISHOP,
  BLACK_BIT,
  KING,
  KNIGHT,
  PAWN,
  Position,
  QUEEN,
  ROOK,
  F_CASTLE,
  F_DOUBLE,
  isCaptureMove,
  moveFlags,
  moveFrom,
  movePromo,
  moveTo,
} from '../core/position';
import { VALUE, PHASE_MAX } from '../core/tables';
import type { RootAnalysis } from '../core/search';

/** Habits: what kind of move this is, from the mover's point of view */
export const HABITS = [
  'capture', // any capture
  'gain', // value of what's captured, in pawns
  'check', // gives check
  'castle',
  'knight', // piece moved (pawn is the baseline)
  'bishop',
  'rook',
  'queen',
  'king', // non-castling king move
  'retreat', // a piece moving back toward its own side
  'escape', // moving a piece that's currently attacked
  'recapture', // taking back on the square just captured on
  'pawnDouble',
  'develop', // a minor piece's first step off the back rank
  'advance', // a piece landing in the enemy half
] as const;

/** Context: what kind of position it is (for which level he works at) */
export const CONTEXT = [
  'bias',
  'endgame', // 1 with no pieces left, 0 with all of them
  'forcing', // share of legal moves that capture or check
  'inCheck',
  'onlyMove', // how far the best move is ahead of the second (deep)
  'decided', // how lopsided the position already is
  'late', // how far into the game
  'blitz', // fitted on blitz and rapid games; the bot plays as rapid (0)
  'rapidSkill', // Andy's rapid rating then, (r - 1500) / 400 (rapid games only)
  'blitzSkill', // his blitz rating then, (r - 1300) / 300 (blitz games only)
] as const;

/** Rating → skill feature, by time class (blitz ratings run lower) */
export function skillFeatures(rating: number, blitz: boolean): [number, number] {
  return blitz ? [0, (rating - 1300) / 300] : [(rating - 1500) / 400, 0];
}

export type HumanModel = {
  /** What the choice weighs: 'win' = winning chances in %, the way a person
      weighs a position (a pawn matters when it's level, not when you're a
      rook up); 'cp' = raw centipawns */
  scale?: 'win' | 'cp';
  /** softmax temperature for glance, reply, deep (in the scale's units) */
  tau: [number, number, number];
  /** logits for working at the reply / deep level (glance = 0), per context */
  replyLogit: number[];
  deepLogit: number[];
  /** habit weights, in the scale's units */
  habit: number[];
};

/** Strength calibration on top of the fitted model. Sampling from a model
    fitted to predict Andy's moves plays below Andy (it spreads probability
    over moves he wouldn't actually play), so the shipped bot sharpens the
    choice and calculates more often, keeping every learned habit and
    context effect. Chosen so its Stockfish-graded move quality matches
    Andy's recent rapid games (tools/chess-data/strength-probe.ts,
    calibrate.ts). */
export type Calibration = { tauScale: number; deepShift: number };

export function calibrated(model: HumanModel, c?: Calibration): HumanModel {
  if (!c) return model;
  return {
    ...model,
    tau: model.tau.map((t) => t * c.tauScale) as [number, number, number],
    deepLogit: model.deepLogit.map((w, i) => (i === 0 ? w + c.deepShift : w)),
  };
}

/** Engine budget per move. The fit runs at this same budget, so the bot sees
    positions exactly as well as the model it was fitted with did. */
export const SEARCH_NODES = 250_000;

/** Values beyond this are clamped, so a mate counts as "decisive" without
    swamping the softmax */
const CLAMP = 1500;
const clampCp = (v: number) => Math.max(-CLAMP, Math.min(CLAMP, v));
/** Winning chances (0–100) from centipawns: Lichess's logistic model */
const winPct = (cp: number) => 100 / (1 + Math.exp(-0.00368208 * clampCp(cp)));

export type MoveContext = {
  /** square (0x88) the opponent's last move landed on, if it was a capture */
  lastCaptureTo: number;
  /** half-moves played so far */
  ply: number;
  blitz: boolean;
  /** Andy's rating in that time class: the bot plays at his current one */
  rating: number;
};

/** Habit features for one move, before it's played. */
export function habitFeatures(pos: Position, m: number, ctx: MoveContext): Float64Array {
  const f = new Float64Array(HABITS.length);
  const b = pos.board;
  const from = moveFrom(m);
  const to = moveTo(m);
  const piece = b[from];
  const type = piece & 7;
  const white = !(piece & BLACK_BIT);
  const capture = isCaptureMove(m);
  const flags = moveFlags(m);

  if (capture) {
    f[0] = 1;
    f[1] = (VALUE[b[to] & 7 || PAWN] + (movePromo(m) ? VALUE[movePromo(m)] - 100 : 0)) / 100;
  }
  if (flags & F_CASTLE) f[3] = 1;
  else if (type === KNIGHT) f[4] = 1;
  else if (type === BISHOP) f[5] = 1;
  else if (type === ROOK) f[6] = 1;
  else if (type === QUEEN) f[7] = 1;
  else if (type === KING) f[8] = 1;

  const fromRank = from >> 4;
  const toRank = to >> 4;
  const forward = white ? toRank - fromRank : fromRank - toRank;
  if (type !== PAWN && type !== KING && forward < 0) f[9] = 1;
  if (type !== KING && pos.attacked(from, pos.side ^ 1)) f[10] = 1;
  if (capture && to === ctx.lastCaptureTo) f[11] = 1;
  if (flags & F_DOUBLE) f[12] = 1;
  const backRank = white ? 0 : 7;
  if ((type === KNIGHT || type === BISHOP) && fromRank === backRank) f[13] = 1;
  if (type !== PAWN && type !== KING && (white ? toRank >= 4 : toRank <= 3)) f[14] = 1;

  // Check: play it and look.
  if (pos.make(m)) {
    if (pos.inCheck()) f[2] = 1;
    pos.unmake();
  }
  return f;
}

/** Context features for the position as a whole. */
export function contextFeatures(
  pos: Position,
  analysis: RootAnalysis,
  ctx: MoveContext,
): Float64Array {
  const c = new Float64Array(CONTEXT.length);
  const moves = analysis.moves;
  c[0] = 1;
  c[1] = 1 - Math.min(PHASE_MAX, pos.phase) / PHASE_MAX;
  let forcing = 0;
  for (const rm of moves) if (isCaptureMove(rm.move)) forcing++;
  c[2] = moves.length ? forcing / moves.length : 0;
  c[3] = pos.inCheck() ? 1 : 0;
  if (moves.length > 1) {
    c[4] = Math.min(1, Math.max(0, clampCp(moves[0].deep) - clampCp(moves[1].deep)) / 300);
  }
  c[5] = Math.min(1, Math.abs(clampCp(analysis.bestScore)) / 600);
  c[6] = Math.min(1, ctx.ply / 100);
  c[7] = ctx.blitz ? 1 : 0;
  [c[8], c[9]] = skillFeatures(ctx.rating, ctx.blitz);
  return c;
}

const dot = (w: number[], x: Float64Array) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (w[i] ?? 0) * x[i];
  return s;
};

/** Probability of working at each level: [glance, reply, deep]. */
export function levelWeights(model: HumanModel, context: Float64Array): [number, number, number] {
  const r = Math.exp(Math.max(-30, Math.min(30, dot(model.replyLogit, context))));
  const d = Math.exp(Math.max(-30, Math.min(30, dot(model.deepLogit, context))));
  const z = 1 + r + d;
  return [1 / z, r / z, d / z];
}

/** Softmax over the moves at one level, written into `out`. */
function softmaxInto(values: Float64Array, tau: number, out: Float64Array): void {
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
  let z = 0;
  for (let i = 0; i < values.length; i++) {
    out[i] = Math.exp((values[i] - max) / tau);
    z += out[i];
  }
  for (let i = 0; i < values.length; i++) out[i] /= z;
}

export type Decision = {
  /** per-move probability of being chosen (mixed over levels) */
  probs: Float64Array;
  /** per level, per move probability */
  perLevel: [Float64Array, Float64Array, Float64Array];
  levels: [number, number, number];
};

/** The full choice distribution for a position. `habits[i]` must line up
    with `analysis.moves[i]`. */
export function decide(
  model: HumanModel,
  analysis: RootAnalysis,
  habits: Float64Array[],
  context: Float64Array,
): Decision {
  const n = analysis.moves.length;
  const habit = new Float64Array(n);
  for (let i = 0; i < n; i++) habit[i] = dot(model.habit, habits[i]);
  const vals = new Float64Array(n);
  const perLevel: [Float64Array, Float64Array, Float64Array] = [
    new Float64Array(n),
    new Float64Array(n),
    new Float64Array(n),
  ];
  const keys = ['glance', 'reply', 'deep'] as const;
  const toScale = model.scale === 'win' ? winPct : clampCp;
  for (let l = 0; l < 3; l++) {
    for (let i = 0; i < n; i++) vals[i] = toScale(analysis.moves[i][keys[l]]) + habit[i];
    softmaxInto(vals, Math.max(1, model.tau[l]), perLevel[l]);
  }
  const levels = levelWeights(model, context);
  const probs = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    probs[i] = levels[0] * perLevel[0][i] + levels[1] * perLevel[1][i] + levels[2] * perLevel[2][i];
  }
  return { probs, perLevel, levels };
}

/** Sample a move index (and the level it was chosen at). */
export function sampleDecision(d: Decision, rng: () => number): { index: number; level: number } {
  let r = rng();
  let level = 2;
  for (let l = 0; l < 3; l++) {
    if (r < d.levels[l]) {
      level = l;
      break;
    }
    r -= d.levels[l];
  }
  const p = d.perLevel[level];
  let u = rng();
  for (let i = 0; i < p.length; i++) {
    u -= p[i];
    if (u <= 0) return { index: i, level };
  }
  return { index: p.length - 1, level };
}
