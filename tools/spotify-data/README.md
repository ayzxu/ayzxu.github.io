# spotify-data

Keeps the MusicWindow's "top 10 songs" in sync with my actual Spotify listening,
refreshed on a schedule by GitHub Actions.

## How it works

Spotify's top-tracks endpoint is user-scoped, so it needs OAuth — there is no
keyless public path like Chess.com or the iTunes Search API. So:

- The **client secret** lives only in GitHub Actions secrets and is used
  server-side at build time. It never reaches the browser.
- `fetch-top-tracks.mjs` runs in CI, exchanges a long-lived refresh token for a
  short-lived access token, fetches the top 10, and writes
  `public/data/top-tracks.json`.
- `MusicWindow.tsx` loads that JSON at runtime. If it's missing or malformed,
  the window falls back to a hard-coded list, so the site never breaks.

"Live" here means refreshed on the deploy cron (see `.github/workflows/deploy.yml`),
not real-time per visitor.

## One-time setup

1. **Create a Spotify app** at https://developer.spotify.com/dashboard.
   - In the app's **Settings**, add this Redirect URI exactly:
     `http://127.0.0.1:8888/callback`
   - Copy the **Client ID** and **Client Secret**.

2. **Get a refresh token** (once, on your laptop):

   ```bash
   SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy \
     node tools/spotify-data/get-refresh-token.mjs
   ```

   A browser opens, you approve, and the terminal prints
   `SPOTIFY_REFRESH_TOKEN=...`. Copy it.

3. **Add three GitHub Actions secrets**
   (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REFRESH_TOKEN`

That's it. The next scheduled (or manual) deploy will refresh the list.

## Run it locally

```bash
# put the three SPOTIFY_* vars in .env.local, then:
export $(grep -v '^#' .env.local | xargs)
node tools/spotify-data/fetch-top-tracks.mjs            # short_term (last ~4 weeks)
node tools/spotify-data/fetch-top-tracks.mjs --range medium_term
```

If the `SPOTIFY_*` vars are missing, the script logs a notice and exits without
touching the committed JSON — so it's always safe to run.

## Tuning

- **Time window:** `SPOTIFY_TIME_RANGE` = `short_term` (default, ~4 weeks),
  `medium_term` (~6 months), or `long_term` (~years).
- **Cadence:** edit the `schedule:` cron in `.github/workflows/deploy.yml`.
