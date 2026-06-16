/* ==========================================================================
   types.ts — shared contracts for the Andy Chess Bot engine.

   The engine is fully client-side: an opening book learned from Andy's games,
   a handcrafted evaluation + shallow search, a style-weighting layer, and a
   humanizer that injects ~1500-level mistakes. See docs/andy-chess-bot.md.
   ========================================================================== */

import type { Move } from 'chess.js';

/** Andy's playing identity — every "feels like Andy" knob lives here.
    Loaded from src/chess/data/style-profile.json (curated default or
    regenerated from real games by the data pipeline). */
export type AndyProfile = {
  meta: {
    username: string;
    source: string;
    generatedAt: string;
    games: number;
  };
  ratings: { blitz: number; rapid: number; bullet: number };
  style: {
    /** 0..1 — appetite for captures/checks/attacks during search */
    aggression: number;
    /** 0..1 — appetite for forcing/tactical lines */
    tactical: number;
    /** 0..1 — how much material is valued (low = happy to sacrifice) */
    materialism: number;
    /** 0..1 — willingness to enter sharp/unbalanced positions */
    risk: number;
    /** 0..1 — per-feature nudges used by the style layer */
    captureBias: number;
    checkBias: number;
    centerBias: number;
    developmentBias: number;
    kingsideAttackBias: number;
  };
  errors: {
    /** probability of a real error on a given middlegame move */
    blunderRate: number;
    /** probability of a minor inaccuracy */
    inaccuracyRate: number;
    /** [min,max] centipawns worse a "blunder" move may be vs best */
    blunderCpWindow: [number, number];
    /** multiplies error rate as the position gets sharper */
    sharpnessMultiplier: number;
    /** scales error rate down in the endgame */
    endgameErrorMultiplier: number;
  };
  search: {
    baseDepth: number;
    endgameDepth: number;
    /** softmax temperature (cp) for normal move selection */
    baseTemperature: number;
    /** softmax temperature (cp) when playing an inaccuracy */
    inaccuracyTemperature: number;
    /** probability of leaving book even when a book move exists */
    bookDeviation: number;
  };
  /** Measured think-time model (optional — engine falls back to curated
      defaults in think.ts when absent). */
  timing?: TimingProfile;
};

/** Log-normal think-time parameters for one move context. */
export type TimingBucket = {
  /** median think time in ms */
  medianMs: number;
  /** spread in ln-space (≈ 0.4 tight … 0.9 wide) */
  sigma: number;
};

/** Andy's measured clock behaviour, derived from [%clk] tags in his PGNs. */
export type TimingProfile = {
  source: string;
  /** hard bounds on any sampled delay, ms */
  clampMs: [number, number];
  buckets: {
    forced: TimingBucket;
    recapture: TimingBucket;
    book: TimingBucket;
    endgame: TimingBucket;
    capture: TimingBucket;
    normal: TimingBucket;
  };
  modifiers: {
    sharpMultiplier: number;
    lateGameHalfLifeMoves: number;
    minLateFactor: number;
  };
};

/** The opponent's previous move, used to recognize instant recaptures. */
export type LastMoveInfo = {
  /** destination square of the opponent's last move */
  to: string;
  /** whether that move was a capture */
  capture: boolean;
};

export type BookMove = {
  san: string;
  count: number;
  /** (wins + ½draws)/games for this move — a mild result-based prior */
  score: number;
};

export type OpeningBook = {
  meta: Record<string, unknown>;
  positions: Record<string, { moves: BookMove[] }>;
};

/** How the chosen move was decided — useful for the UI and debugging. */
export type MoveSource = 'book' | 'best' | 'inaccuracy' | 'blunder' | 'forced';

export type EngineResult = {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  /** FEN after the move is applied */
  fen: string;
  source: MoveSource;
  /** engine evaluation of the chosen move, centipawns from mover's POV */
  evalCp: number;
  /** wall-clock spent computing (ms) */
  thinkMs: number;
  /** human-modelled think time the UI should present (ms) — sampled from
      Andy's measured clock behaviour (see think.ts) */
  delayMs: number;
};

/* --- Post-game review ----------------------------------------------------- */

/** Quality bucket for a single move, by centipawns lost vs the engine's best. */
export type MoveQuality = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** Per-move review produced by analyze.ts (engine's own judgement, not Stockfish). */
export type MoveReview = {
  /** 0-based half-move index */
  ply: number;
  /** 1-based full-move number */
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  /** True if this was the human player's move (not the bot's). */
  byUser: boolean;
  /** Centipawns lost versus the engine's best move (>= 0). */
  cpLoss: number;
  quality: MoveQuality;
  /** Per-move accuracy 0..100 (Lichess win%-based model). */
  accuracy: number;
  /** The engine's preferred move in this position, if different. */
  bestSan?: string;
  /** What Andy actually plays most here, from the opening book (user moves only). */
  andyBook?: {
    san: string;
    /** Share of Andy's games in this position that chose `san`, 0..100. */
    sharePct: number;
    /** True if the player picked Andy's single most-played move. */
    matchedTop: boolean;
    /** True if the player's move appears anywhere in Andy's repertoire here. */
    inRepertoire: boolean;
  };
};

/** Whole-game review summary for the post-game panel and the share card. */
export type GameReview = {
  userColor: 'white' | 'black';
  /** Aggregate accuracy 0..100 for the player and for Andy's bot. */
  userAccuracy: number;
  andyAccuracy: number;
  /** Player's average centipawn loss. */
  userAcpl: number;
  counts: { blunders: number; mistakes: number; inaccuracies: number };
  /** Player moves that matched a move in Andy's book / had any book data. */
  bookMatches: number;
  bookTotal: number;
  moves: MoveReview[];
};

/** A scored candidate produced during search, before humanization. */
export type ScoredMove = {
  move: Move;
  /** pure search score (cp, mover's POV) */
  searchCp: number;
  /** search score + style bonus (cp) — what selection ranks on */
  adjustedCp: number;
};

/** Random source so play can be seeded in tests and varied in production. */
export type Rng = () => number;
