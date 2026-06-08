/* ==========================================================================
   fetch-games.mjs — download Andy's games from the public Chess.com API and
   cache them locally so build-artifacts.mjs can run offline and repeatably.

   Chess.com exposes monthly PGN archives with no auth required:
     GET /pub/player/{user}/games/archives        -> { archives: [url, ...] }
     GET /pub/player/{user}/games/{YYYY}/{MM}      -> { games: [ {...}, ... ] }

   The API asks clients to send a descriptive User-Agent; we do, and we fetch
   archives sequentially with a small delay to stay polite. Every raw monthly
   payload is cached under cache/raw/, and a normalized, flattened games.json is
   written for the build step.

   This script must be run on a machine with outbound network access (e.g. Andy's
   laptop). It is intentionally NOT run at build time — the committed JSON
   artifacts in src/chess/data are what ship to production.

   Usage:
     node tools/chess-data/fetch-games.mjs                 # default user, all months
     node tools/chess-data/fetch-games.mjs --user mozandyque --max-months 24
   ========================================================================== */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, 'cache');
const RAW_DIR = resolve(CACHE_DIR, 'raw');

/* ---- tiny arg parser ---------------------------------------------------- */
function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const USERNAME = getArg('--user', 'mozandyque').toLowerCase();
const MAX_MONTHS = Number(getArg('--max-months', '0')) || 0; // 0 = all
const REQUEST_DELAY_MS = 250;

const UA =
  'andyxu.dev-chess-bot/1.0 (data pipeline; contact: andyxuburner@gmail.com)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

/* Normalize a Chess.com game object into the minimal record the build needs. */
function normalize(game) {
  const white = game.white ?? {};
  const black = game.black ?? {};
  const isWhite = (white.username ?? '').toLowerCase() === USERNAME;
  const isBlack = (black.username ?? '').toLowerCase() === USERNAME;
  if (!isWhite && !isBlack) return null; // not Andy's game (shouldn't happen)

  const andyColor = isWhite ? 'w' : 'b';
  const me = isWhite ? white : black;
  const opp = isWhite ? black : white;

  return {
    url: game.url ?? null,
    endTime: game.end_time ?? null,
    timeClass: game.time_class ?? null, // bullet | blitz | rapid | daily
    rules: game.rules ?? 'chess', // chess | chess960 | bughouse | ...
    rated: game.rated ?? false,
    andyColor,
    andyRating: me.rating ?? null,
    oppRating: opp.rating ?? null,
    // result strings: 'win' | 'checkmated' | 'resigned' | 'timeout' |
    // 'stalemate' | 'agreed' | 'repetition' | 'insufficient' | 'abandoned' ...
    andyResult: me.result ?? null,
    pgn: game.pgn ?? null,
  };
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });

  console.log(`Fetching archive list for "${USERNAME}"…`);
  const list = await getJson(
    `https://api.chess.com/pub/player/${USERNAME}/games/archives`,
  );
  if (!list || !Array.isArray(list.archives) || list.archives.length === 0) {
    throw new Error(
      `No archives found for "${USERNAME}". Check the username and network access.`,
    );
  }

  // Most recent months first; optionally cap how far back we go.
  let archives = [...list.archives].reverse();
  if (MAX_MONTHS > 0) archives = archives.slice(0, MAX_MONTHS);
  console.log(`Found ${list.archives.length} months; fetching ${archives.length}.`);

  const all = [];
  for (const url of archives) {
    const stamp = url.split('/').slice(-2).join('-'); // YYYY-MM
    const rawPath = resolve(RAW_DIR, `${stamp}.json`);

    let payload;
    if (existsSync(rawPath)) {
      payload = JSON.parse(readFileSync(rawPath, 'utf8'));
      console.log(`  ${stamp}: cached (${payload.games?.length ?? 0} games)`);
    } else {
      payload = await getJson(url);
      if (!payload) {
        console.log(`  ${stamp}: 404 (skipped)`);
        continue;
      }
      writeFileSync(rawPath, JSON.stringify(payload));
      console.log(`  ${stamp}: ${payload.games?.length ?? 0} games`);
      await sleep(REQUEST_DELAY_MS);
    }

    for (const g of payload.games ?? []) {
      const rec = normalize(g);
      if (rec) all.push(rec);
    }
  }

  // Stable order: oldest -> newest, so "latest rating" logic reads naturally.
  all.sort((a, b) => (a.endTime ?? 0) - (b.endTime ?? 0));

  const out = {
    meta: {
      username: USERNAME,
      fetchedAt: new Date().toISOString(),
      months: archives.length,
      games: all.length,
    },
    games: all,
  };
  writeFileSync(resolve(CACHE_DIR, 'games.json'), JSON.stringify(out));
  console.log(
    `\nWrote cache/games.json — ${all.length} games across ${archives.length} months.`,
  );
  console.log('Next: node tools/chess-data/build-artifacts.mjs');
}

main().catch((err) => {
  console.error('\nfetch-games failed:', err.message);
  process.exit(1);
});
