/* ==========================================================================
   build-artifacts.mjs — turn cached Chess.com games into the two JSON artifacts
   the bot ships with:

     src/chess/data/opening-book.json   (Andy's learned repertoire)
     src/chess/data/style-profile.json  (Andy's measured tendencies + ratings)

   This is the REAL pipeline (build-defaults.mjs is the hand-curated fallback).
   It reads tools/chess-data/cache/games.json produced by fetch-games.mjs, so it
   runs fully offline.

   What it measures (all from Andy's own moves only — opponent moves merely
   advance each game):

     Opening book  Every move Andy played in the first OPENING_PLIES half-moves,
                   keyed by the first four FEN fields, with a count and a
                   result-weighted `score` = (wins + 0.5·draws) / games. The
                   engine samples proportional to count·(0.5 + score), so lines
                   that won for Andy are preferred — exactly how he'd lean.

     Style vector  Capture / check / castle / promotion / central-pawn /
                   minor-development / kingside-attack rates, mapped through
                   documented baselines into the 0..1 knobs the style layer uses.

     Ratings       The most recent rating Andy held in each time class.

     Error model   blunder/inaccuracy rates scaled from rating (a strong proxy
                   for error frequency). Centipawn-accurate mistake labelling
                   would require a reference engine pass — see README for that
                   optional extension; the heuristic curve is intentionally
                   conservative and matches the curated defaults at ~1500.

     Think times   Chess.com embeds a [%clk] tag after every move; the per-move
                   think time is the drop in Andy's own clock (plus increment).
                   Blitz games only. Each think is classified into the same
                   context buckets the engine uses (forced / recapture / book /
                   endgame / capture / normal) and fitted as a log-normal
                   (median + sigma of ln). Buckets with too few samples fall
                   back to the curated defaults.

   Usage:  node tools/chess-data/build-artifacts.mjs
   ========================================================================== */

import { Chess } from 'chess.js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(__dirname, 'cache', 'games.json');
const OUT_DIR = resolve(__dirname, '../../src/chess/data');

/* ---- tunables ----------------------------------------------------------- */
const OPENING_PLIES = 24; // record book moves for the first 12 full moves
const MIDDLE_START = 16; // ply where we start counting "kingside attack" moves
const MIDDLE_END = 70;
const MIN_POS_GAMES = 3; // drop book positions seen in fewer games (noise)
const MIN_MOVE_COUNT = 2; // within a kept position, drop one-off move choices
const TIME_CLASSES = new Set(['bullet', 'blitz', 'rapid']);

/* Timing model tunables. Buckets with fewer samples than this fall back to
   the curated defaults (kept in sync with DEFAULT_TIMING in
   src/chess/engine/think.ts). */
const MIN_TIMING_SAMPLES = 30;
const MAX_THINK_MS = 120_000; // discard pathological gaps (disconnects, AFK)
const TIMING_TIME_CLASS = 'blitz'; // the bot presents as ~5|0 blitz

const CURATED_TIMING_BUCKETS = {
  forced: { medianMs: 700, sigma: 0.45 },
  recapture: { medianMs: 650, sigma: 0.4 },
  book: { medianMs: 1100, sigma: 0.55 },
  endgame: { medianMs: 2000, sigma: 0.6 },
  capture: { medianMs: 2600, sigma: 0.65 },
  normal: { medianMs: 3400, sigma: 0.7 },
};

const CENTRAL_SQUARES = new Set(['c4', 'c5', 'd4', 'd5', 'e4', 'e5', 'f4', 'f5']);
const DRAW_RESULTS = new Set([
  'stalemate', 'agreed', 'repetition', 'insufficient',
  '50move', 'timevsinsufficient',
]);

/* ---- small helpers ------------------------------------------------------ */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
/** Linear map [lo,hi] -> [0,1], clamped. */
const mapRate = (v, lo, hi) => clamp01((v - lo) / (hi - lo));
const fileOf = (sq) => sq.charCodeAt(0) - 97; // 'a'->0
const rankOf = (sq) => Number(sq[1]); // 1..8

function fenKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function outcome(andyResult) {
  if (andyResult === 'win') return 'win';
  if (DRAW_RESULTS.has(andyResult)) return 'draw';
  return 'loss'; // checkmated, resigned, timeout, abandoned, lose, ...
}

/* ---- clock / timing helpers --------------------------------------------- */

/** All [%clk H:MM:SS(.t)] values in the PGN, in ply order, as seconds. */
function parseClocks(pgn) {
  const out = [];
  const re = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
  let m;
  while ((m = re.exec(pgn)) !== null) {
    out.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
  }
  return out;
}

/** Parse the [TimeControl "base+inc"] header -> { base, inc } in seconds. */
function parseTimeControl(pgn) {
  const m = pgn.match(/\[TimeControl\s+"(\d+)(?:\+(\d+))?"\]/);
  if (!m) return null;
  return { base: Number(m[1]), inc: Number(m[2] ?? 0) };
}

/** Mirrors isEndgame() in src/chess/engine/evaluate.ts. */
const NPM_VALUE = { n: 320, b: 330, r: 500, q: 900 };
const ENDGAME_NPM = 2600; // ENDGAME_MATERIAL(1300) * 2
function isEndgame(chess) {
  let total = 0;
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.type !== 'p' && sq.type !== 'k') total += NPM_VALUE[sq.type];
    }
  }
  return total <= ENDGAME_NPM;
}

/* ---- accumulators ------------------------------------------------------- */
const book = {}; // key -> Map(san -> { count, wins, draws, losses })
const ratingByClass = {}; // timeClass -> latest rating seen

const tally = {
  andyMoves: 0,
  openingMoves: 0,
  middleMoves: 0,
  captures: 0,
  checks: 0,
  castles: 0,
  promotions: 0,
  centralPawns: 0,
  developments: 0,
  kingsideAttacks: 0,
};
const games = { used: 0, skipped: 0, wins: 0, draws: 0, losses: 0 };

/** bucket -> array of measured think times (ms), Andy's blitz moves only. */
const timingSamples = {
  forced: [], recapture: [], book: [], endgame: [], capture: [], normal: [],
};
let timingGames = 0;

function recordBook(key, san, result) {
  if (!book[key]) book[key] = new Map();
  const e =
    book[key].get(san) ?? { count: 0, wins: 0, draws: 0, losses: 0 };
  e.count += 1;
  if (result === 'win') e.wins += 1;
  else if (result === 'draw') e.draws += 1;
  else e.losses += 1;
  book[key].set(san, e);
}

function processGame(rec) {
  if (rec.rules !== 'chess' || !TIME_CLASSES.has(rec.timeClass) || !rec.pgn) {
    games.skipped += 1;
    return;
  }

  // Parse PGN -> SAN list (variant/corrupt PGNs are skipped).
  let sans;
  try {
    const parsed = new Chess();
    parsed.loadPgn(rec.pgn);
    sans = parsed.history();
  } catch {
    games.skipped += 1;
    return;
  }
  if (sans.length === 0) {
    games.skipped += 1;
    return;
  }

  games.used += 1;
  const result = outcome(rec.andyResult);
  games[`${result}s`] += 1;
  if (rec.andyRating && rec.timeClass) {
    ratingByClass[rec.timeClass] = rec.andyRating; // games are oldest->newest
  }

  // --- think-time samples (blitz only, needs one [%clk] per ply) ---
  const tc = rec.timeClass === TIMING_TIME_CLASS ? parseTimeControl(rec.pgn) : null;
  const clocks = tc ? parseClocks(rec.pgn) : [];
  const hasClocks = tc !== null && clocks.length === sans.length;
  if (hasClocks) timingGames += 1;
  let lastMv = null; // previous (opponent) move, for recapture detection

  const g = new Chess();
  for (let ply = 0; ply < sans.length; ply++) {
    const side = g.turn();
    const fen = g.fen();

    // Pre-move context for the timing buckets (cheap checks only when needed).
    let preForced = false;
    let preEndgame = false;
    if (hasClocks && side === rec.andyColor) {
      preForced = g.moves().length === 1;
      preEndgame = isEndgame(g);
    }

    let mv;
    try {
      mv = g.move(sans[ply]);
    } catch {
      break; // desync — abandon the rest of this game
    }
    if (side !== rec.andyColor) {
      lastMv = mv;
      continue; // only Andy's moves count
    }

    // --- think time: drop in Andy's own clock since his previous move ---
    if (hasClocks) {
      const prev = ply < 2 ? tc.base : clocks[ply - 2];
      const thinkMs = Math.round((prev - clocks[ply] + tc.inc) * 1000);
      if (thinkMs >= 0 && thinkMs <= MAX_THINK_MS) {
        const moverCapture = mv.flags.includes('c') || mv.flags.includes('e');
        const oppCaptured = !!lastMv && (lastMv.flags.includes('c') || lastMv.flags.includes('e'));
        // Same precedence as pickBucket() in src/chess/engine/think.ts; "book"
        // is proxied by the opening phase the book itself is built from.
        const bucket = preForced
          ? 'forced'
          : oppCaptured && moverCapture && mv.to === lastMv.to
            ? 'recapture'
            : ply < OPENING_PLIES
              ? 'book'
              : preEndgame
                ? 'endgame'
                : moverCapture
                  ? 'capture'
                  : 'normal';
        // Clock granularity is 0.1s, so floor instant moves at 100ms.
        timingSamples[bucket].push(Math.max(100, thinkMs));
      }
    }
    lastMv = mv;

    // --- opening book ---
    if (ply < OPENING_PLIES) recordBook(fenKey(fen), mv.san, result);

    // --- style tallies ---
    tally.andyMoves += 1;
    const opening = ply < OPENING_PLIES;
    if (opening) tally.openingMoves += 1;
    const middle = ply >= MIDDLE_START && ply < MIDDLE_END;
    if (middle) tally.middleMoves += 1;

    const isCapture = mv.flags.includes('c') || mv.flags.includes('e');
    if (isCapture) tally.captures += 1;
    if (mv.san.includes('+') || mv.san.includes('#')) tally.checks += 1;
    if (mv.flags.includes('k') || mv.flags.includes('q')) tally.castles += 1;
    if (mv.promotion) tally.promotions += 1;

    if (opening && mv.piece === 'p' && CENTRAL_SQUARES.has(mv.to)) {
      tally.centralPawns += 1;
    }
    if (opening && (mv.piece === 'n' || mv.piece === 'b')) {
      const fromHome = rec.andyColor === 'w' ? mv.from[1] === '1' : mv.from[1] === '8';
      if (fromHome) tally.developments += 1;
    }
    if (middle) {
      const toFile = fileOf(mv.to); // f,g,h => 5,6,7
      const toRank = rankOf(mv.to);
      const inEnemyHalf = rec.andyColor === 'w' ? toRank >= 5 : toRank <= 4;
      if (toFile >= 5 && inEnemyHalf) tally.kingsideAttacks += 1;
    }
  }
}

/* ---- style derivation --------------------------------------------------- */
function deriveStyle() {
  const m = Math.max(1, tally.andyMoves);
  const om = Math.max(1, tally.openingMoves);
  const mm = Math.max(1, tally.middleMoves);

  const captureRate = tally.captures / m;
  const checkRate = tally.checks / m;
  const centerRate = tally.centralPawns / om;
  const developRate = tally.developments / om;
  const ksRate = tally.kingsideAttacks / mm;

  // Map raw rates through baselines tuned to typical club play.
  const captureBias = mapRate(captureRate, 0.16, 0.34);
  const checkBias = mapRate(checkRate, 0.02, 0.10);
  const centerBias = mapRate(centerRate, 0.25, 0.60);
  const developmentBias = mapRate(developRate, 0.30, 0.75);
  const kingsideAttackBias = mapRate(ksRate, 0.08, 0.30);

  // Composites. Aggression & tactical lean on captures/checks/attacks; risk on
  // aggression + attacking flank play; materialism is the (inverse) of how
  // freely Andy gives material, proxied from aggression.
  const aggression = clamp01(
    0.45 * captureBias + 0.30 * checkBias + 0.25 * kingsideAttackBias,
  );
  const tactical = clamp01(0.55 * captureBias + 0.45 * checkBias);
  const risk = clamp01(0.65 * aggression + 0.35 * kingsideAttackBias);
  const materialism = clamp01(0.5 - (aggression - 0.5) * 0.5);

  return {
    raw: { captureRate, checkRate, centerRate, developRate, ksRate },
    style: {
      aggression: round2(aggression),
      tactical: round2(tactical),
      materialism: round2(materialism),
      risk: round2(risk),
      captureBias: round2(captureBias),
      checkBias: round2(checkBias),
      centerBias: round2(centerBias),
      developmentBias: round2(developmentBias),
      kingsideAttackBias: round2(kingsideAttackBias),
    },
  };
}

const round2 = (x) => Math.round(x * 100) / 100;

/* Rating is a strong proxy for error frequency; lower rating -> more mistakes.
   Anchored so ~1500 reproduces the curated defaults. */
function ratingToErrors(blitz) {
  const r = blitz || 1500;
  return {
    blunderRate: round3(clamp(0.025 + (1500 - r) * 0.00006, 0.01, 0.1)),
    inaccuracyRate: round3(clamp(0.08 + (1500 - r) * 0.00012, 0.04, 0.2)),
    blunderCpWindow: [80, 260],
    sharpnessMultiplier: 1.35,
    endgameErrorMultiplier: 0.25,
  };
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round3 = (x) => Math.round(x * 1000) / 1000;

/* ---- timing derivation --------------------------------------------------- */
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Fit a log-normal (median + sigma of ln) per bucket; thin buckets fall back
    to the curated defaults so the bot never thinks in unnatural rhythms. */
function deriveTiming() {
  const buckets = {};
  const sampleCounts = {};
  let measured = 0;
  for (const [name, samples] of Object.entries(timingSamples)) {
    sampleCounts[name] = samples.length;
    if (samples.length < MIN_TIMING_SAMPLES) {
      buckets[name] = { ...CURATED_TIMING_BUCKETS[name] };
      continue;
    }
    measured += 1;
    const logs = samples.map((ms) => Math.log(ms));
    const mean = logs.reduce((s, x) => s + x, 0) / logs.length;
    const variance = logs.reduce((s, x) => s + (x - mean) ** 2, 0) / logs.length;
    buckets[name] = {
      medianMs: Math.round(median(samples)),
      // Clamp the spread: too tight reads robotic, too wide reads erratic.
      sigma: round2(clamp(Math.sqrt(variance), 0.3, 0.9)),
    };
  }
  return {
    timing: {
      source: measured > 0 ? 'chesscom-clk' : 'curated-default',
      clampMs: [400, 8000],
      buckets,
      modifiers: {
        sharpMultiplier: 1.6,
        lateGameHalfLifeMoves: 60,
        minLateFactor: 0.35,
      },
    },
    sampleCounts,
    measured,
  };
}

/* ---- main --------------------------------------------------------------- */
function main() {
  if (!existsSync(CACHE)) {
    console.error(
      `Missing ${CACHE}.\nRun: node tools/chess-data/fetch-games.mjs first.`,
    );
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(CACHE, 'utf8'));
  const username = data.meta?.username ?? 'mozandyque';
  console.log(`Building from ${data.games.length} cached games for "${username}"…`);

  for (const rec of data.games) processGame(rec);

  // --- serialize opening book (with pruning) ---
  const outPositions = {};
  let positions = 0;
  let moveCount = 0;
  for (const [key, moves] of Object.entries(book)) {
    const total = [...moves.values()].reduce((s, e) => s + e.count, 0);
    if (total < MIN_POS_GAMES) continue;
    const arr = [...moves.entries()]
      .filter(([, e]) => e.count >= MIN_MOVE_COUNT)
      .map(([san, e]) => ({
        san,
        count: e.count,
        score: round2((e.wins + 0.5 * e.draws) / e.count),
      }))
      .sort((a, b) => b.count - a.count);
    if (arr.length === 0) continue;
    outPositions[key] = { moves: arr };
    positions += 1;
    moveCount += arr.length;
  }

  const { raw, style } = deriveStyle();
  const { timing, sampleCounts, measured } = deriveTiming();
  const ratings = {
    blitz: ratingByClass.blitz ?? 1500,
    rapid: ratingByClass.rapid ?? 1450,
    bullet: ratingByClass.bullet ?? 1450,
  };

  const bookOut = {
    meta: {
      source: 'chesscom-pipeline',
      username,
      generatedAt: new Date().toISOString(),
      games: games.used,
      positions,
      openingPlies: OPENING_PLIES,
      note: 'Learned from real games. Regenerate with fetch-games + build-artifacts.',
    },
    positions: outPositions,
  };

  const profileOut = {
    meta: {
      username,
      source: 'chesscom-pipeline',
      generatedAt: new Date().toISOString(),
      games: games.used,
      record: { wins: games.wins, draws: games.draws, losses: games.losses },
      rawRates: {
        captureRate: round3(raw.captureRate),
        checkRate: round3(raw.checkRate),
        centerRate: round3(raw.centerRate),
        developRate: round3(raw.developRate),
        kingsideAttackRate: round3(raw.ksRate),
      },
    },
    ratings,
    style,
    errors: ratingToErrors(ratings.blitz),
    search: {
      baseDepth: 2,
      endgameDepth: 4,
      baseTemperature: 24,
      inaccuracyTemperature: 75,
      bookDeviation: 0.1,
    },
    timing,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    resolve(OUT_DIR, 'opening-book.json'),
    JSON.stringify(bookOut, null, 2) + '\n',
  );
  writeFileSync(
    resolve(OUT_DIR, 'style-profile.json'),
    JSON.stringify(profileOut, null, 2) + '\n',
  );

  console.log(
    `\nGames used: ${games.used} (skipped ${games.skipped}) — ` +
      `record ${games.wins}/${games.draws}/${games.losses} (W/D/L)`,
  );
  console.log(`opening-book.json   ${positions} positions, ${moveCount} moves`);
  console.log(
    `style-profile.json  ratings b/r/bu ${ratings.blitz}/${ratings.rapid}/${ratings.bullet}`,
  );
  console.log(`  style: ${JSON.stringify(style)}`);
  console.log(
    `  timing: ${timing.source} — ${timingGames} blitz games with clocks, ` +
      `samples ${JSON.stringify(sampleCounts)} (${measured}/6 buckets measured)`,
  );
}

main();
