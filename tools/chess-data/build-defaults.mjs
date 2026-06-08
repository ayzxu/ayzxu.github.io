/* ==========================================================================
   build-defaults.mjs — generates the *curated* default artifacts that ship in
   the repo so the Andy Chess Bot is fully playable before the data pipeline is
   ever run against real games.

   It encodes Andy's known repertoire as SAN lines with relative weights, replays
   each line through chess.js (guaranteeing every FEN is legal), and accumulates
   per-position move statistics in the exact same schema produced by
   build-artifacts.mjs. Running the real pipeline later overwrites these files.

   Usage:  node tools/chess-data/build-defaults.mjs
   Output: src/chess/data/opening-book.json
           src/chess/data/style-profile.json
   ========================================================================== */

import { Chess } from 'chess.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../../src/chess/data');

/* Each entry: [andyColor, weight, [...SAN moves]].
   andyColor is the side Andy plays in that line; we record ONLY his moves so the
   opponent's replies (needed to advance the line) never pollute the book. This
   mirrors the real pipeline, which records only the moves of the side whose
   username is `mozandyque`. Weight ~ how often Andy plays the line; shared
   prefixes accumulate so his frequent choices dominate naturally. */
const LINES = [
  /* ---- White: Italian Game (Giuoco Piano), Andy's main weapon ---------- */
  ['w', 12, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6', 'a4', 'Ba7']],
  ['w', 10, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'a6', 'a4', 'O-O', 'Nbd2']],
  ['w', 6,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6', 'd3', 'd6', 'c3', 'O-O']],
  ['w', 4,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4']], // Evans-flavoured
  /* ---- White: Two Knights / Fried Liver ------------------------------- */
  ['w', 9,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Be2', 'h6', 'Nf3', 'e4', 'Ne5', 'Bd6']],
  ['w', 4,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5', 'Nxf7', 'Kxf7', 'Qf3+', 'Ke6', 'Nc3']], // true Fried Liver
  ['w', 3,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'c3', 'd6', 'O-O', 'O-O']],
  /* ---- White: vs Sicilian / French / Caro (Italian-minded) ------------ */
  ['w', 4,  ['e4', 'c5', 'Nf3', 'Nc6', 'Bc4', 'e6', 'O-O', 'a6', 'c3', 'd5']],
  ['w', 3,  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']],
  ['w', 3,  ['e4', 'e6', 'd4', 'd5', 'e5', 'c5', 'c3', 'Nc6', 'Nf3', 'Qb6']], // French advance
  ['w', 3,  ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5']], // Caro advance
  /* ---- White: rare King's Indian Attack ------------------------------- */
  ['w', 2,  ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'e6', 'O-O', 'Be7', 'd3', 'O-O', 'Nbd2', 'c5', 'e4']],
  ['w', 2,  ['e4', 'e6', 'd3', 'd5', 'Nd2', 'Nf6', 'Ngf3', 'c5', 'g3', 'Nc6', 'Bg2', 'Be7', 'O-O', 'O-O']], // KIA vs French

  /* ---- Black vs 1.e4: open games, Italian / Two Knights -------------- */
  ['b', 11, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Bc5', 'c3', 'd6', 'O-O', 'O-O', 'Re1', 'a5']],
  ['b', 8,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5', 'Bb5+', 'c6', 'dxc6', 'bxc6', 'Be2', 'h6']], // declines Fried Liver
  ['b', 4,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5']], // takes the bait (sharp)
  ['b', 6,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+', 'Nc3', 'Nxe4']],
  ['b', 4,  ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Bb4', 'Nxc6', 'bxc6', 'Bd3', 'd5']], // Scotch as black
  ['b', 3,  ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Bb5', 'Bb4', 'O-O', 'O-O', 'd3', 'd6']], // Four Knights
  ['b', 3,  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O']], // Ruy as black

  /* ---- Black vs 1.d4: King's Indian Defense -------------------------- */
  ['b', 12, ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'Ne1', 'Nd7']],
  ['b', 8,  ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'd5', 'a5', 'Bg5', 'h6']],
  ['b', 5,  ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'Nf3', 'O-O', 'g3', 'd6', 'Bg2', 'Nc6', 'O-O', 'e5']], // fianchetto KID
  ['b', 4,  ['d4', 'Nf6', 'Nf3', 'g6', 'c4', 'Bg7', 'Nc3', 'O-O', 'e4', 'd6', 'Be2', 'e5']],
  ['b', 3,  ['d4', 'Nf6', 'c4', 'g6', 'g3', 'Bg7', 'Bg2', 'O-O', 'Nc3', 'd6', 'Nf3', 'Nc6']],
  /* ---- Black vs 1.c4 / 1.Nf3: KID structures ------------------------- */
  ['b', 3,  ['c4', 'Nf6', 'Nc3', 'g6', 'g3', 'Bg7', 'Bg2', 'O-O', 'Nf3', 'd6', 'O-O', 'e5']],
  ['b', 3,  ['Nf3', 'Nf6', 'd4', 'g6', 'c4', 'Bg7', 'Nc3', 'O-O', 'e4', 'd6']],
];

/* key = first 4 fields of FEN (placement, side, castling, en-passant). */
function fenKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

const positions = {}; // key -> Map(san -> count)

for (const [andyColor, weight, sans] of LINES) {
  const game = new Chess();
  for (const san of sans) {
    const sideToMove = game.turn(); // 'w' | 'b' before the move
    const key = fenKey(game.fen());
    let mv;
    try {
      mv = game.move(san);
    } catch (e) {
      console.error(`Illegal move "${san}" in line ${JSON.stringify(sans)}: ${e.message}`);
      break;
    }
    // Record only Andy's own moves; opponent replies merely advance the line.
    if (sideToMove === andyColor) {
      if (!positions[key]) positions[key] = new Map();
      positions[key].set(mv.san, (positions[key].get(mv.san) ?? 0) + weight);
    }
  }
}

/* Serialize to the artifact schema. score is a mild winning prior for curated
   moves (real pipeline computes it from actual results). */
const outPositions = {};
let moveCount = 0;
for (const [key, moves] of Object.entries(positions)) {
  const arr = [...moves.entries()]
    .map(([san, count]) => ({ san, count, score: 0.55 }))
    .sort((a, b) => b.count - a.count);
  outPositions[key] = { moves: arr };
  moveCount += arr.length;
}

const book = {
  meta: {
    source: 'curated-default',
    generatedAt: new Date().toISOString(),
    games: 0,
    positions: Object.keys(outPositions).length,
    note: 'Hand-curated from Andy\'s stated repertoire. Replace by running build-artifacts.mjs on real games.',
  },
  positions: outPositions,
};

const profile = {
  meta: {
    username: 'mozandyque',
    source: 'curated-default',
    generatedAt: new Date().toISOString(),
    games: 0,
  },
  ratings: { blitz: 1500, rapid: 1450, bullet: 1450 },
  style: {
    aggression: 0.66,
    tactical: 0.62,
    materialism: 0.42,
    risk: 0.6,
    captureBias: 0.5,
    checkBias: 0.5,
    centerBias: 0.6,
    developmentBias: 0.6,
    kingsideAttackBias: 0.62,
  },
  errors: {
    blunderRate: 0.025,
    inaccuracyRate: 0.08,
    blunderCpWindow: [80, 260],
    sharpnessMultiplier: 1.35,
    endgameErrorMultiplier: 0.25,
  },
  search: {
    baseDepth: 2,
    endgameDepth: 4,
    baseTemperature: 24,
    inaccuracyTemperature: 75,
    bookDeviation: 0.1,
  },
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'opening-book.json'), JSON.stringify(book, null, 2) + '\n');
writeFileSync(resolve(OUT_DIR, 'style-profile.json'), JSON.stringify(profile, null, 2) + '\n');

console.log(`Wrote opening-book.json  (${book.meta.positions} positions, ${moveCount} moves)`);
console.log(`Wrote style-profile.json (curated default, rating ~${profile.ratings.blitz})`);
