# Andy Chess Bot — data pipeline

These scripts turn Andy's real Chess.com games into the two JSON artifacts the
bot ships with:

- `src/chess/data/opening-book.json` — Andy's learned repertoire (per-position
  move choices, weighted by how often he plays them and how they scored).
- `src/chess/data/style-profile.json` — Andy's measured tendencies (capture /
  check / development / attacking rates mapped to style knobs), his ratings,
  the error model, and a think-time model measured from his real clock usage.

The pipeline runs **on your machine, not at build/deploy time.** Production ships
the committed JSON. Regenerate whenever you want the bot to reflect newer games.

## Requirements

- Node 18+ (uses global `fetch`).
- Outbound network access to `api.chess.com` (the sandbox/CI may block it; run
  locally).
- `chess.js` (already a project dependency).

## Usage

```bash
# 1) Download games into tools/chess-data/cache/ (monthly archives, cached).
node tools/chess-data/fetch-games.mjs --user mozandyque

#    Optionally limit how far back to go:
node tools/chess-data/fetch-games.mjs --user mozandyque --max-months 24

# 2) Build the artifacts from the cache (fully offline).
node tools/chess-data/build-artifacts.mjs

# 3) Sanity-check the result before committing.
npx jiti tools/chess-data/selfplay.ts
```

Re-running `fetch-games.mjs` reuses already-downloaded months from
`cache/raw/`, so it's cheap to refresh — only new months hit the network.

## Fallback: curated defaults

`build-defaults.mjs` regenerates hand-curated artifacts from Andy's stated
repertoire (Italian as White, King's Indian vs 1.d4, sharp open games as Black).
These ship by default so the bot is fully playable before the real pipeline is
ever run, and are a safe thing to fall back to:

```bash
node tools/chess-data/build-defaults.mjs
```

## How the artifacts are derived

**Opening book.** Every move Andy played in the first 24 half-moves is recorded,
keyed by the first four FEN fields (placement, side, castling, en passant). Each
entry stores a `count` and a result-weighted `score = (wins + 0.5·draws) /
games`. The engine samples proportional to `count · (0.5 + score)`, so lines
that won for Andy are preferred. Positions seen in fewer than 3 games, and
one-off move choices, are pruned as noise.

**Style vector.** Raw rates over Andy's own moves — captures, checks, castles,
promotions, central pawn pushes, minor-piece development, and kingside-attack
moves — are mapped through documented baselines (see `build-artifacts.mjs`) into
the 0..1 knobs the style layer reads. `aggression`, `tactical`, `risk`, and
`materialism` are composites of those measured rates.

**Ratings.** The most recent rating Andy held in each time class.

**Error model.** `blunderRate` / `inaccuracyRate` are scaled from rating, which
is a strong proxy for error frequency, anchored so ~1500 reproduces the curated
defaults. Centipawn-accurate mistake labelling would require annotating every
position with a reference engine (e.g. a local Stockfish) and measuring Andy's
average centipawn loss; that's a worthwhile future extension but is intentionally
out of scope here, since the bot ships no engine binary and the rating-based
curve is already a good match for a ~1500 player's mistake cadence.

**Think times.** Chess.com embeds a `[%clk]` tag after every move in the PGN, so
Andy's per-move think time is the drop in his own clock since his previous move
(plus the increment). Blitz games only, since that's the persona the bot
presents. Each measured think is classified into the same context buckets the
engine uses — `forced`, `recapture`, `book` (proxied by the opening phase),
`endgame`, `capture`, `normal` — and fitted as a log-normal: the bucket's median
think time plus the spread of its log-times (clamped to 0.3–0.9 so the result
reads neither robotic nor erratic). Buckets with fewer than 30 samples fall back
to the curated defaults in `src/chess/engine/think.ts`. At play time the engine
samples from this model (`humanThinkMs`), stretches thinks in sharp positions,
and speeds up late in the game to mimic blitz clock pressure.

## Files

| File | Purpose |
| --- | --- |
| `fetch-games.mjs` | Download + cache games from the Chess.com public API. |
| `build-artifacts.mjs` | Real pipeline: cache → opening-book + style-profile. |
| `build-defaults.mjs` | Curated fallback artifacts from Andy's repertoire. |
| `selfplay.ts` | Self-play / repertoire sanity harness (run via `jiti`). |
| `cache/` | Downloaded games (git-ignored; safe to delete). |
