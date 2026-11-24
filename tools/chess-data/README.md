# Andy Chess Bot — data pipeline

These scripts turn Andy's real Chess.com games into the three JSON artifacts
the bot ships with:

- `src/chess/data/opening-book.json` — Andy's repertoire: per-position move
  choices, weighted by how often he plays them (recent and slower games count
  more) and how they scored.
- `src/chess/data/style-profile.json` — his ratings and a think-time model
  measured from his real clock usage.
- `src/chess/data/human-model.json` — how he picks moves out of book, fitted
  to the moves he actually played, including how often and how badly he goes
  wrong (see "The humanizer" below).

The pipeline runs **on your machine, not at build/deploy time.** Production ships
the committed JSON. Regenerate whenever you want the bot to reflect newer games.

## Requirements

- Node 22+.
- Outbound network access to `api.chess.com` (step 1 only).
- A native Stockfish for grading (steps 2 and 5): `brew install stockfish` /
  `apt-get install stockfish`, or point `STOCKFISH=/path/to/binary` at one.
  Stockfish is only used offline to *grade* moves; the bot itself never uses it.

## Usage

```bash
# 1) Download games into tools/chess-data/cache/ (monthly archives, cached;
#    the current month is always re-fetched).
node tools/chess-data/fetch-games.mjs --user mozandyque

# 2) Opening book, ratings and think times (offline).
node tools/chess-data/build-artifacts.mjs

# 3) Grade Andy's own moves with Stockfish: every rapid game since a month,
#    plus the most recent blitz games. Cached per game in cache/annotations.jsonl.
node tools/chess-data/annotate.mjs --rapid-since 2025-01 --blitz 150

# 4) Fit the humanizer to those moves.
tools/chess-data/run.sh tools/chess-data/build-fit-data.ts   # engine pass, all cores
tools/chess-data/run.sh tools/chess-data/fit-human.ts        # writes human-model.json

# 5) Check strength and error profile. The probe is quick and uses Andy's own
#    positions; calibrate plays real games against rating-limited Stockfish.
tools/chess-data/run.sh tools/chess-data/strength-probe.ts 2026-07 0.35 3
tools/chess-data/run.sh tools/chess-data/calibrate.ts --games 32 --elo 1900
```

`run.sh` bundles a TypeScript tool with rolldown (the toolchain Vite uses) and
runs it with Node, so the engine runs exactly as it ships. Other checks:

```bash
npx jiti tools/chess-data/perft.ts               # move generator vs known perft counts
tools/chess-data/run.sh tools/chess-data/bench.ts  # tactics solved + nodes/second
tools/chess-data/run.sh tools/chess-data/selfplay.ts
```

## How the artifacts are derived

**Opening book.** Every move Andy played in the first 20 half-moves is recorded,
keyed by the first four FEN fields (placement, side, castling, en passant). Each
game counts with a weight: rapid 3, blitz 1, bullet 0.4, halving every 18 months
of age, so the book is his current, considered repertoire. Each move stores its
weighted `count` and a result-weighted `score = (wins + 0.5·draws) / games`; the
engine samples proportional to `count · (0.5 + score)`. Thin positions and moves
he almost never plays there are pruned.

**Ratings.** The most recent rating Andy held in each time class.

**Think times.** Chess.com embeds a `[%clk]` tag after every move in the PGN, so
Andy's per-move think time is the drop in his own clock since his previous move
(plus the increment). Blitz games, so the bot moves at a lively pace. Each think
is classified into the context buckets the engine uses — `forced`, `recapture`,
`book`, `endgame`, `capture`, `normal` — and fitted as a log-normal.

## The humanizer

The engine (`src/chess/engine/core/`) is a real alpha-beta engine: far stronger
than Andy. The humanizer (`src/chess/engine/human/model.ts`) decides which move
he'd actually play. For every legal move the engine reports three scores:

- **glance**: the move, then the captures that follow (what's obvious);
- **reply**: one full reply considered, then captures;
- **deep**: the engine's real verdict.

On each move Andy works at one of those levels, with probabilities that depend
on the position (in check, an only-move crisis, a won position, an endgame...),
picks among the moves by how good they look at that level with some noise, and
leans toward his habits (captures, checks, which piece, retreats, recaptures...):

```
P(move) = Σ_level π_level(context) · softmax((value_level + habits) / τ_level)
```

Mistakes come out of this the way they do for a person: a move that looks fine at
a glance but loses to a quiet reply, a tactic that only a deeper look finds.

**Fitting.** `annotate.mjs` grades every move Andy made (after the opening) with
Stockfish. `build-fit-data.ts` runs the bot's own engine on each of those
positions at the bot's own budget. `fit-human.ts` then fits every weight by
maximum likelihood on the moves he really played, holding out a fifth of the
games to report how often the model predicts his actual move (against "the
engine's best move" as a baseline) and whether its mistakes are the size of his.

**Calibration.** Sampling from a model fitted to *predict* Andy plays below
Andy: it spreads probability over moves he wouldn't actually play. So the
shipped bot applies a calibration on top of the fit (`calibration` in
`human-model.json`): a sharper choice (`tauScale`) and more calculation
(`deepShift`), which keeps every learned habit and context effect and only moves
the level. `strength-probe.ts` measures, on Andy's recent rapid positions, how
often the model picks a Stockfish-approved move compared with how often Andy did;
`calibrate.ts` plays the bot against Stockfish's rating-limited mode and grades
the bot's moves the same way Andy's were graded. The shipped setting matches
Andy's July–August 2026 rapid games (when he reached 1900): 66% vs 67%
Stockfish-approved moves, and an average centipawn loss of 40 vs his 38.

## Files

| File | Purpose |
| --- | --- |
| `fetch-games.mjs` | Download + cache games from the Chess.com public API. |
| `build-artifacts.mjs` | Cache → opening book + style profile (ratings, timing). |
| `annotate.mjs` | Grade Andy's moves with Stockfish. |
| `build-fit-data.ts` | Run the bot's engine on every graded position. |
| `fit-human.ts` | Fit the humanizer; writes `human-model.json`. |
| `strength-probe.ts` | Model vs Andy on Stockfish-approved moves, per strength setting. |
| `calibrate.ts` | Bot vs rating-limited Stockfish, with the bot's moves graded. |
| `perft.ts`, `bench.ts`, `selfplay.ts` | Engine correctness, speed and sanity. |
| `run.sh` | Bundle + run a TypeScript tool. |
| `cache/` | Downloaded games and analysis (git-ignored; safe to delete). |
