/* build-artifacts.mjs — turn cached Chess.com games into the two JSON artifacts
   the bot ships with:

     src/chess/data/opening-book.json   (Andy's learned repertoire)
     src/chess/data/style-profile.json  (ratings + think-time model)

   It reads tools/chess-data/cache/games.json produced by fetch-games.mjs, so it
   runs fully offline. The humanizer is fitted separately (README.md, "The
   humanizer").

   What it measures (all from Andy's own moves only — opponent moves merely
   advance each game):

     Opening book  Every move Andy played in the first OPENING_PLIES half-moves,
                   keyed by the first four FEN fields, with a weighted count and
                   a result-weighted `score` = (wins + 0.5·draws) / games. Games
                   are weighted by recency (half-life BOOK_HALF_LIFE_MONTHS) and
                   time control (rapid > blitz > bullet), so the book is his
                   current, considered repertoire rather than 2020 bullet. The
                   engine samples proportional to count·(0.5 + score).

     Ratings       The most recent rating Andy held in each time class.

     Think times   Chess.com embeds a [%clk] tag after every move; the per-move
                   think time is the drop in Andy's own clock (plus increment).
                   Blitz games only. Each think is classified into the same
                   context buckets the engine uses (forced / recapture / book /
                   endgame / capture / normal) and fitted as a log-normal
                   (median + sigma of ln). Buckets with too few samples fall
                   back to the curated defaults.

   How Andy picks moves (and how often he goes wrong) is fitted separately,
   from Stockfish-graded games: annotate.mjs → build-fit-data.ts →
   fit-human.ts, which writes src/chess/data/human-model.json.

   Usage:  node tools/chess-data/build-artifacts.mjs */

import { Chess } from 'chess.js';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(__dirname, 'cache', 'games.json');
const OUT_DIR = resolve(__dirname, '../../src/chess/data');

/* ---- tunables ----------------------------------------------------------- */
const OPENING_PLIES = 20; // record book moves for the first 10 full moves
/** Book weight per game: considered games count more than bullet... */
const CLASS_WEIGHT = { rapid: 3, blitz: 1, bullet: 0.4 };
/** ...and recent games more than old ones (weight halves every N months). */
const BOOK_HALF_LIFE_MONTHS = 18;
const MIN_POS_WEIGHT = 2.5; // drop book positions with less (noise)
const MIN_MOVE_WEIGHT = 0.8; // within a kept position, drop near one-offs
const MIN_MOVE_SHARE = 0.04; // ...and moves he almost never picks there
const BOOK_DEVIATION = 0.04; // chance to leave book anyway (stays fresh)
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

const DRAW_RESULTS = new Set([
  'stalemate', 'agreed', 'repetition', 'insufficient',
  '50move', 'timevsinsufficient',
]);

/* ---- small helpers ------------------------------------------------------ */

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

const games = { used: 0, skipped: 0, wins: 0, draws: 0, losses: 0 };

/** bucket -> array of measured think times (ms), Andy's blitz moves only. */
const timingSamples = {
  forced: [], recapture: [], book: [], endgame: [], capture: [], normal: [],
};
let timingGames = 0;

function recordBook(key, san, result, weight) {
  if (!book[key]) book[key] = new Map();
  const e =
    book[key].get(san) ?? { count: 0, wins: 0, draws: 0, losses: 0 };
  e.count += weight;
  if (result === 'win') e.wins += weight;
  else if (result === 'draw') e.draws += weight;
  else e.losses += weight;
  book[key].set(san, e);
}

const NOW = Date.now() / 1000;
function bookWeight(rec) {
  const ageMonths = Math.max(0, (NOW - (rec.endTime ?? NOW)) / (30.44 * 86400));
  return (CLASS_WEIGHT[rec.timeClass] ?? 0) * 0.5 ** (ageMonths / BOOK_HALF_LIFE_MONTHS);
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
  if (result === 'win') games.wins += 1;
  else if (result === 'draw') games.draws += 1;
  else games.losses += 1;
  if (rec.andyRating && rec.timeClass) {
    ratingByClass[rec.timeClass] = rec.andyRating; // games are oldest->newest
  }

  // --- think-time samples (blitz only, needs one [%clk] per ply) ---
  const tc = rec.timeClass === TIMING_TIME_CLASS ? parseTimeControl(rec.pgn) : null;
  const clocks = tc ? parseClocks(rec.pgn) : [];
  const hasClocks = tc !== null && clocks.length === sans.length;
  if (hasClocks) timingGames += 1;
  let lastMv = null; // previous (opponent) move, for recapture detection
  const weight = bookWeight(rec);

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
    if (ply < OPENING_PLIES) recordBook(fenKey(fen), mv.san, result, weight);
  }
}

const round2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

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
    if (total < MIN_POS_WEIGHT) continue;
    const arr = [...moves.entries()]
      .filter(([, e]) => e.count >= MIN_MOVE_WEIGHT && e.count / total >= MIN_MOVE_SHARE)
      .map(([san, e]) => ({
        san,
        count: round2(e.count),
        score: round2((e.wins + 0.5 * e.draws) / e.count),
      }))
      .sort((a, b) => b.count - a.count);
    if (arr.length === 0) continue;
    outPositions[key] = { moves: arr };
    positions += 1;
    moveCount += arr.length;
  }

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
      weighting: { classWeight: CLASS_WEIGHT, halfLifeMonths: BOOK_HALF_LIFE_MONTHS },
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
    },
    ratings,
    bookDeviation: BOOK_DEVIATION,
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
  console.log(
    `  timing: ${timing.source} — ${timingGames} blitz games with clocks, ` +
      `samples ${JSON.stringify(sampleCounts)} (${measured}/6 buckets measured)`,
  );
}

main();
