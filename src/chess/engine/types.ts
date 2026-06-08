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
  /** wall-clock spent thinking (ms) */
  thinkMs: number;
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
