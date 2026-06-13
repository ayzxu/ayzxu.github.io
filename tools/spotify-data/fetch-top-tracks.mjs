/* ==========================================================================
   fetch-top-tracks.mjs — refresh Andy's top 10 songs from the Spotify Web API
   and write them to public/data/top-tracks.json, which the MusicWindow loads
   at runtime.

   Spotify's "top tracks" endpoint is user-scoped, so it needs OAuth — there is
   no public, keyless path like Chess.com or the iTunes Search API. The flow:

     1. One time, on your laptop, run get-refresh-token.mjs to authorize the app
        and obtain a long-lived REFRESH token (saved to GitHub Actions secrets).
     2. On every run, this script exchanges that refresh token for a short-lived
        ACCESS token (no browser needed), then calls:
          GET /v1/me/top/tracks?limit=10&time_range=<range>
        and writes a small, shape-stable JSON artifact.

   The client secret never reaches the browser — it lives only in GitHub Actions
   secrets and is used here, server-side, at build time. The committed JSON is
   what ships to production (same model as the chess-data pipeline).

   Required env (set as GitHub Actions secrets, or in .env.local for dev):
     SPOTIFY_CLIENT_ID
     SPOTIFY_CLIENT_SECRET
     SPOTIFY_REFRESH_TOKEN
   Optional env:
     SPOTIFY_TIME_RANGE   short_term | medium_term | long_term  (default short_term)

   If credentials are missing, this script logs a notice and exits 0 WITHOUT
   touching the existing JSON — so a deploy never fails just because secrets
   aren't wired up yet.

   Usage:
     node tools/spotify-data/fetch-top-tracks.mjs
     node tools/spotify-data/fetch-top-tracks.mjs --range medium_term
   ========================================================================== */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../../public/data');
const OUT_FILE = resolve(OUT_DIR, 'top-tracks.json');

/* ---- tiny arg parser ---------------------------------------------------- */
function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const VALID_RANGES = new Set(['short_term', 'medium_term', 'long_term']);
const TIME_RANGE = (() => {
  const r = getArg('--range', process.env.SPOTIFY_TIME_RANGE || 'short_term');
  return VALID_RANGES.has(r) ? r : 'short_term';
})();
const LIMIT = 10;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

/** mm:ss from a millisecond duration. */
function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Exchange the long-lived refresh token for a short-lived access token. */
async function getAccessToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Token refresh failed: HTTP ${res.status} ${body}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Token refresh returned no access_token');
  return data.access_token;
}

/** Fetch the top tracks and normalize them into the shape MusicWindow wants. */
async function getTopTracks(accessToken) {
  const url =
    `https://api.spotify.com/v1/me/top/tracks` +
    `?limit=${LIMIT}&time_range=${TIME_RANGE}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Top tracks request failed: HTTP ${res.status} ${body}`);
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map((t) => ({
    title: t.name ?? '',
    // Join all credited artists, e.g. "John Summit, HAYLA" — matches the
    // hand-written format the window used before.
    artist: (Array.isArray(t.artists) ? t.artists : [])
      .map((a) => a?.name)
      .filter(Boolean)
      .join(', '),
    album: t.album?.name ?? '',
    time: fmtTime(Number(t.duration_ms) || 0),
    url: t.external_urls?.spotify ?? '',
  }));
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.warn(
      '[spotify] Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET / ' +
        'SPOTIFY_REFRESH_TOKEN — skipping refresh and keeping the existing ' +
        'public/data/top-tracks.json.',
    );
    process.exit(0);
  }

  const accessToken = await getAccessToken();
  const tracks = await getTopTracks(accessToken);

  if (tracks.length === 0) {
    // Don't clobber a good file with an empty list (e.g. a transient API
    // hiccup or a brand-new account with no listening history yet).
    console.warn('[spotify] API returned 0 tracks — leaving existing JSON intact.');
    process.exit(0);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    timeRange: TIME_RANGE,
    tracks,
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `[spotify] Wrote ${tracks.length} tracks (${TIME_RANGE}) -> ${OUT_FILE}`,
  );
}

main().catch((err) => {
  // A failed refresh should not break the whole deploy — log loudly and exit 0
  // so the build proceeds with the last-good committed JSON.
  console.error(`[spotify] ${err.message}`);
  console.error('[spotify] Keeping existing JSON; continuing build.');
  process.exit(0);
});
