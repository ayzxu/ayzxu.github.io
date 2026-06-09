# Andy Chess Bot — Technical Design Document

A client-side chess bot that plays like Andy Xu (~1500 Chess.com, `mozandyque`), embedded as a Macintosh-style application inside the `andyxu.dev` desktop portfolio.

The goal is **not** strength. The goal is recognizability: a visitor should finish a game thinking *"that felt like playing Andy."* That means replicating Andy's opening repertoire, his preference for sharp open positions, his attacking tendencies, and — critically — his ~1500-level mistakes.

---

## 1. Recommended architecture

**Decision: a fully client-side hybrid engine.** No server, no Stockfish, no WebAssembly threading.

This was chosen deliberately over the "Stockfish + style layer" option in the brief, for three reasons:

1. **Hosting reality.** `andyxu.dev` is a static GitHub Pages deployment (`gh-pages -d dist`, custom-domain `CNAME`). GitHub Pages cannot set the `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers that multi-threaded Stockfish (`SharedArrayBuffer`) requires. The workarounds (single-threaded WASM, or a `coi-serviceworker` hack) add fragility and a multi-megabyte download for an engine whose strength we then have to throw away.
2. **The goal fights the tool.** Stockfish's entire value is finding the best move. Our job is to find a *plausibly human, frequently sub-optimal* move. Starting from a 3200-rated oracle and corrupting it down to 1500 is harder, and looks less human, than starting from a deliberately modest engine and shaping it.
3. **Control & maintainability.** A handwritten evaluation + shallow search gives us direct, legible knobs for aggression, materialism, and blunder rate. Every "feels like Andy" lever is a number in a JSON file, not an opaque NNUE weight.

The bot is therefore three cooperating layers:

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  OPENING BOOK         │  STYLE-SHAPED SEARCH       │  HUMANIZER       │
 │  (statistical, from   │  (handcrafted eval +       │  (error model,   │
 │   Andy's real games)  │   shallow αβ + style bonus)│   softmax sample)│
 └─────────────────────────────────────────────────────────────────────┘
        prefer his                play like his                 miss things
        repertoire                middlegame taste              like a 1500
```

---

## 2. System diagram & data flow

### Offline (build time, runs on Andy's machine)

```
Chess.com Public API ──► fetch-games.mjs ──► raw PGN cache (tools/chess-data/.cache)
                                                   │
                                                   ▼
                                        build-artifacts.mjs
                                                   │
                          ┌────────────────────────┴───────────────────────┐
                          ▼                                                  ▼
              src/chess/data/opening-book.json            src/chess/data/style-profile.json
              (FEN → weighted move stats)                 (aggression, errors, search knobs)
```

The pipeline runs from **Andy's machine** because the sandboxed build environment cannot reach `api.chess.com`, and because pre-baking the artifacts (rather than fetching at page load) keeps the app fast and offline-capable. The artifacts are committed to the repo and bundled by Vite.

A curated **default** book + profile ship in the repo so the bot is fully playable before the pipeline is ever run; running the pipeline simply replaces the defaults with data-driven numbers.

### Online (runtime, in the visitor's browser)

```
 ChessWindow.tsx ──user move──► useAndyBot (hook)
        ▲                              │  postMessage({fen, history})
        │                              ▼
   board + move list           andyBot.worker.ts  (Web Worker, off main thread)
        │                              │
        │                     chooseMove(fen, profile, book)
        │                              │
        │         ┌────────────────────┼─────────────────────┐
        │         ▼                    ▼                     ▼
        │      book.ts             search.ts             humanize.ts
        │   (sample line)      (eval + αβ + style)   (error + softmax)
        │                              │
        └──────reply{san,fen}◄─────────┘
```

Running the engine in a **Web Worker** guarantees the 1-bit desktop UI never janks while the bot "thinks." The pause before each reply is sampled from a measured think-time model (`engine/think.ts`): the data pipeline reads the `[%clk]` tag Chess.com stamps on every move of Andy's blitz games and fits a log-normal per context bucket (forced / recapture / book / endgame / capture / normal), so the bot snaps off recaptures and book moves, tanks in sharp middlegames, and speeds up late in the game like real clock pressure. Curated defaults tuned to ~5|0 blitz ship in the profile until the pipeline is run on real games.

---

## 3. Component breakdown

| Component | Path | Responsibility |
|---|---|---|
| Data pipeline | `tools/chess-data/` | Fetch games, parse PGNs, emit JSON artifacts |
| Default artifacts | `tools/chess-data/build-default-*.mjs` | Hand-curated repertoire + style so the bot works out of the box |
| Engine types | `src/chess/engine/types.ts` | Shared TypeScript contracts |
| Evaluation | `src/chess/engine/evaluate.ts` | Material + piece-square tables + mobility + king safety |
| Search | `src/chess/engine/search.ts` | Negamax + alpha-beta + quiescence |
| Book | `src/chess/engine/book.ts` | FEN-keyed weighted move sampling |
| Style | `src/chess/engine/style.ts` | Per-move bonuses from Andy's style vector |
| Humanizer | `src/chess/engine/humanize.ts` | Blunder/inaccuracy injection, softmax move sampling |
| Orchestrator | `src/chess/engine/andyBot.ts` | The `chooseMove` entry point tying the layers together |
| Worker | `src/chess/andyBot.worker.ts` | Runs the engine off the main thread |
| Hook | `src/chess/useAndyBot.ts` | React interface to the worker |
| Window | `src/windows/ChessWindow.tsx` | Board, move list, controls, result, Mac styling |

---

## 4. Style modeling

Andy's playing identity is captured in `style-profile.json`, a small vector of `0..1` scores plus an error model and search settings. Each metric is estimable from his game history:

- **Aggression** — share of his moves that are captures, checks, or pawn storms toward the enemy king; frequency of early piece sallies. High aggression boosts sharp candidate moves during search.
- **Tactical** — proxied by capture density in the middlegame and how often games are decided before move 40. Raises the search's appetite for forcing lines.
- **Materialism** — how readily he trades when ahead and how quickly he recaptures. *Low* materialism = more willing to sacrifice; it discounts the penalty for giving up material in the style layer.
- **Risk** — variance of outcomes and willingness to enter unbalanced positions; raises the sampling temperature so he picks the second-best sharp move more often.
- **Opening preferences** — learned directly as move frequencies in the book (Italian as White, King's Indian vs `1.d4`, open `1...e5` games vs `1.e4`).
- **Blunder tendencies** — at ~1500, roughly one in twelve to twenty middlegame moves is a real error. We model this as a per-move probability that the engine *deliberately* selects a worse-but-natural-looking move (a tempting capture, a check, an over-eager attack), scaled up in sharp/tactical positions to mimic blitz time-pressure, and scaled down in the endgame.

> **Honest limitation.** Exact centipawn-loss calibration of the blunder rate would require running every historical position through a real engine offline. The pipeline ships with rating-derived defaults and a documented hook to refine them later; this is the single biggest lever for future fidelity work.

---

## 5. Engine layer

**Evaluation** (`evaluate.ts`) returns centipawns from White's perspective: material values, midgame piece-square tables, mobility, a bishop-pair bonus, and a light king-safety term (pawn shield + attackers near the king). On its own this plays around 1600–1800 — intentionally modest, because the humanizer pulls it *down* to ~1500, which looks more natural than corrupting a 3200 engine.

**Search** (`search.ts`) is negamax with alpha-beta pruning and a quiescence search over captures to avoid absurd one-move horizon blunders. Default depth is 3 in the middlegame and 5 in the endgame (few pieces → cleaner, more "engine-driven" play, as requested). A node cap bounds worst-case latency.

**Style weighting** (`style.ts`) adds a bounded bonus (≈ ±40 cp) to each candidate based on Andy's vector — captures, checks, central pawn pushes, development, castling, and kingside attacks. It is intentionally too small to justify hanging a piece, but large enough to break ties toward the sharp, Andy-flavored move.

**Humanization** (`humanize.ts`) is where ~1500 comes from. After scoring, the orchestrator rolls against the error model:
- a *blunder* roll picks a natural-looking but clearly inferior move (missed tactic / miscalculation);
- an *inaccuracy* roll softmax-samples from the top ~6 with raised temperature;
- otherwise it softmax-samples from the top ~3, so even "good" play has lifelike variety rather than robotic repetition.

The result is a bot that **plays noticeably differently from vanilla Stockfish**: it opens with Andy's lines, attacks, occasionally overpresses, and sometimes drops a tactic — then tidies up in the endgame.

---

## 6. Data schemas

`src/chess/data/opening-book.json`:

```jsonc
{
  "meta": { "source": "curated-default", "generatedAt": "ISO", "games": 0 },
  "positions": {
    // key = first 4 FEN fields (placement, side, castling, en-passant)
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -": {
      "moves": [
        { "san": "e4", "count": 312, "score": 0.54 },  // score = (wins+½draws)/games
        { "san": "Nf3", "count": 18,  "score": 0.50 }
      ]
    }
  }
}
```

`src/chess/data/style-profile.json`:

```jsonc
{
  "meta": { "username": "mozandyque", "source": "curated-default", "games": 0 },
  "ratings": { "blitz": 1500, "rapid": 1450, "bullet": 1450 },
  "style": { "aggression": 0.66, "tactical": 0.62, "materialism": 0.42,
             "risk": 0.6, "captureBias": 0.5, "checkBias": 0.5,
             "centerBias": 0.6, "developmentBias": 0.6, "kingsideAttackBias": 0.62 },
  "errors": { "blunderRate": 0.025, "inaccuracyRate": 0.08, "blunderCpWindow": [80, 260],
              "sharpnessMultiplier": 1.35, "endgameErrorMultiplier": 0.25 },
  "search": { "baseDepth": 2, "endgameDepth": 4, "baseTemperature": 24,
              "inaccuracyTemperature": 75, "bookDeviation": 0.1 }
}
```

---

## 7. Frontend integration

The bot becomes a first-class desktop app, identical in pattern to the existing Projects/Fun/About windows:

- a new `chess` window id in `windowConfig.ts` with a deep-link route `/chess`;
- a hand-drawn 1-bit **knight icon** on the desktop (`PixelIcons.tsx`), wired through `iconLayout.ts` and `Desktop.tsx`;
- `ChessWindow.tsx` renders an interactive `react-chessboard` (dithered dark squares to match the Fun panel), a two-column SAN move list, a "New Game" control with color choice, a "thinking…" indicator, and a result banner;
- the engine talks through `useAndyBot`, so the UI thread stays smooth.

---

## 8. Deployment

**Selected model: fully client-side, shipped with the existing static build.** No new infrastructure.

| Model | Cost | Reliability | Maintenance | Verdict |
|---|---|---|---|---|
| Fully client-side | $0 | No backend to fail | Rebuild = redeploy | ✅ Chosen |
| Serverless engine | low but non-zero | cold starts, quotas | another deploy target | ✗ Unjustified |
| Small backend | ongoing | a server to babysit | highest | ✗ Overkill |

The data pipeline runs locally and commits JSON; `npm run build && npm run deploy` ships everything. Refreshing Andy's style after new games is a single command.

---

## 9. Risks & mitigations

- **Engine too strong / too weak.** Every knob is data in `style-profile.json`; tune `baseDepth`, `blunderRate`, and temperature without touching code. A self-play sanity harness ships with the engine.
- **UI jank during "thinking."** Mitigated by the Web Worker; the main thread only renders.
- **Book gaps (opponent plays offbeat lines).** Graceful fallback to style-shaped search; the bot is never stuck.
- **Blunder calibration is approximate.** Documented; rating-derived defaults now, optional offline engine-analysis pass later.
- **`react-chessboard` v5 API churn.** Pinned in `package.json`; integration isolated to `ChessWindow.tsx`.
- **Bundle size.** Pure-JS engine + JSON book is tens of KB, not the multi-MB of Stockfish WASM.

---

## 10. Roadmap

1. ✅ Data pipeline + curated defaults
2. ✅ Engine core (eval, search, book, style, humanizer)
3. ✅ Worker + hook
4. ✅ Mac-style chess window + desktop wiring
5. ✅ Typecheck / build / self-play verification
6. ▶ Andy runs the pipeline on his real games to replace the defaults
7. ◻ Optional: offline engine-analysis pass to calibrate blunder severity to true centipawn loss
