# Andy Chess Bot — Technical Design Document

A client-side chess bot that plays like Andy Xu (`mozandyque`, ~1900 Chess.com
rapid), embedded as a Macintosh-style application inside the `andyxu.dev`
desktop portfolio.

The goal is recognizability, at the right strength: a visitor should finish a
game thinking *"that felt like playing Andy"*: his opening repertoire, the moves
he likes, and his mistakes, at the rate and of the kind he really makes them.

---

## 1. Architecture

**A fully client-side engine in a Web Worker.** No server, no Stockfish at
runtime. (GitHub Pages can't set the cross-origin isolation headers
multi-threaded Stockfish needs, and its strength would only be thrown away.)

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  OPENING BOOK          │  CORE ENGINE               │  HUMANIZER          │
 │  (Andy's real games,   │  (0x88 board, αβ + TT,     │  (choice model      │
 │   recent rapid first)  │   PeSTO eval)              │   fitted to Andy)   │
 └──────────────────────────────────────────────────────────────────────────┘
        his repertoire       every move scored three         picks the move
                             ways: glance / reply / deep     Andy would play
```

Version 1 (2026-06) searched two plies through chess.js and injected mistakes
with hand-set rates tuned to ~1500. Version 2 replaces it with a real engine,
and replaces the hand-set error rates with a model fitted to Andy's own moves,
graded by Stockfish.

---

## 2. Data flow

### Offline (runs on Andy's machine; artifacts are committed)

```
Chess.com API ──► fetch-games.mjs ──► cache/games.json
                                          │
             ┌────────────────────────────┼─────────────────────────────┐
             ▼                            ▼                             ▼
   build-artifacts.mjs             annotate.mjs (Stockfish)       calibrate.ts
   opening-book.json               cache/annotations.jsonl        bot vs rating-
   style-profile.json                     │                       limited Stockfish
   (ratings, think times)                 ▼
                                   build-fit-data.ts (bot's engine on every position)
                                          │
                                          ▼
                                   fit-human.ts ──► human-model.json
```

See `tools/chess-data/README.md` for commands.

### Online (in the visitor's browser)

```
 ChessWindow ──user move──► useAndyBot ──postMessage({fen, lastMove, history})──►
 andyBot.worker ──► chooseMove()
                      ├─ book.ts          in book? sample Andy's move
                      ├─ core/search.ts   analyzeRoot(): glance / reply / deep per move
                      └─ human/model.ts   decide() + sampleDecision()
                 ◄── reply {san, fen, source, evalCp, delayMs}
```

The reply is held back for a think time sampled from Andy's real clock usage
(`engine/think.ts`): instant recaptures, quick book moves, long thinks in sharp
middlegames.

---

## 3. Components

| Component | Path | Responsibility |
|---|---|---|
| Board | `src/chess/engine/core/position.ts` | 0x88 board, move generation, make/unmake, Zobrist hashing |
| Tables | `src/chess/engine/core/tables.ts` | PeSTO material + piece-square tables |
| Evaluation | `src/chess/engine/core/evaluate.ts` | Tapered eval: pawn structure, passed pawns, mobility, king safety |
| Search | `src/chess/engine/core/search.ts` | Iterative deepening PVS, TT, null move, LMR, quiescence; `analyzeRoot` |
| Humanizer | `src/chess/engine/human/model.ts` | Habit + context features, the fitted choice model |
| Book | `src/chess/engine/book.ts` | FEN-keyed weighted move sampling |
| Think time | `src/chess/engine/think.ts` | Log-normal think-time model |
| Orchestrator | `src/chess/engine/andyBot.ts` | `chooseMove`: book → engine → humanizer |
| Review | `src/chess/engine/analyze.ts` | Post-game review on the core engine |
| Worker / hook / window | `src/chess/andyBot.worker.ts`, `useAndyBot.ts`, `src/windows/ChessWindow.tsx` | Off-thread engine, React glue, UI |

---

## 4. The engine

A 0x88 mailbox board with pseudo-legal generation and in-place make/unmake,
verified against the standard perft suite (`tools/chess-data/perft.ts`). Search
is iterative-deepening negamax with principal-variation search, a 2^20-entry
transposition table, null-move pruning, late-move reductions, reverse futility
and futility pruning, killer and history ordering, a check extension, and a
capture quiescence search with delta pruning. Evaluation is PeSTO's tapered
tables plus doubled / isolated / passed pawns, the bishop pair, rooks on open
files, mobility, a pawn shield and king-zone attack pressure.

At the bot's budget (250k nodes, about half a second in a browser) it reaches
8–12 plies and solves most classic tactics: far stronger than Andy, which is
the point. The humanizer, not a weakened search, decides how well it plays.

`analyzeRoot()` scores every legal move three ways:

- **glance**: the move, then the captures that follow (what's obvious);
- **reply**: one full reply considered, then captures;
- **deep**: the real verdict (best move at full depth, the most promising
  alternatives two plies shallower; the rest keep their one-reply score).

---

## 5. The humanizer

```
P(move) = Σ_level π_level(context) · softmax((value_level(move) + habit(move)) / τ_level)
```

- **Levels.** On each move Andy works at one level: a glance, checking the
  reply, or real calculation. `π` comes from the position: endgame, how forcing
  it is, in check, how far the best move is ahead of the second (an only-move
  crisis), how decided the game already is, how late it is, and the time control.
- **Choice.** At that level he picks among moves by how good they look, with
  noise `τ`.
- **Habits.** A learned bonus per kind of move: captures and their size, checks,
  castling, which piece moves, retreats, escapes, recaptures, double pawn
  pushes, development, moves into the enemy half.

Mistakes come from the gap between levels: a move that looks fine at a glance
but loses to a quiet reply; a tactic only a deeper look finds.

**Fitting.** Every move Andy played after the opening in his rated rapid games
since 2025 and his most recent blitz games was graded by Stockfish
(`annotate.mjs`) and re-analysed by the bot's own engine at the bot's own budget
(`build-fit-data.ts`). `fit-human.ts` fits all weights by maximum likelihood on
those moves, with a fifth of the games held out. Rapid positions count double:
there are few of them (Andy's rapid rating only reached 1900 in July 2026), so
the larger blitz sample mostly teaches the *shape* of his mistakes, with a blitz
flag absorbing the difference in level. The bot always plays as rapid Andy.

**Calibration.** Sampling from a model fitted to *predict* Andy plays below him:
it spreads probability over moves he wouldn't actually play (the raw fit picks a
Stockfish-approved move 51% of the time on his positions; Andy, 67%). The shipped
bot therefore sharpens the choice (`tauScale` 0.35) and calculates more often
(`deepShift` +3), which keeps every learned habit and context effect and only
moves the level. A rating input (his rating at the time of each game) lets the
fit learn how his play changes as he improves; the bot plays at his current
rapid rating.

### Results (November 2026 data)

| | Andy | Bot |
|---|---|---|
| Predicting Andy's move on held-out games | — | 44.6% (engine's best move: 39.8%) |
| Stockfish-approved moves on his Jul–Aug 2026 rapid positions | 67.1% | 66.2% |
| Avg. centipawn loss (first 31 graded moves of a game) | 38 | 40 |
| Inaccuracies / mistakes / blunders per 40 moves | 4.4 / 3.4 / 0.8 | 6.6 / 4.1 / 0.5 |
| vs Stockfish `UCI_Elo` 1900 / 1700 | — | 9.5/24, 9.5/32 (≈1700 on Stockfish's scale) |

Andy's column is his rated rapid games from July–August 2026, when he reached
1900. The bot's error profile comes from its games against rating-limited
Stockfish, graded by full-strength Stockfish exactly as Andy's were.

---

## 6. Artifacts

- `opening-book.json` — `positions[fenKey].moves = [{ san, count, score }]`,
  counts weighted by time control (rapid 3, blitz 1, bullet 0.4) and recency
  (half-life 18 months).
- `style-profile.json` — `ratings`, `bookDeviation`, `timing` (think-time model).
- `human-model.json` — `model.{scale, tau, replyLogit, deepLogit, habit}`, the
  `calibration` applied on top, the feature names, and held-out fit statistics.

---

## 7. Risks & mitigations

- **Too strong / too weak.** `calibrate.ts` measures it against rating-limited
  Stockfish and compares the bot's error profile with Andy's; the model can be
  shifted toward more or less calculation without refitting.
- **UI jank.** The engine runs in a Web Worker; the main thread only renders.
- **Book gaps.** Out of book the engine takes over; it's never stuck.
- **Thin rapid data.** Blitz games supply the shape of the mistakes; rerun the
  pipeline as more rapid games are played.
- **Bundle size.** The engine is a few thousand lines of TypeScript plus JSON:
  tens of KB, not the megabytes of Stockfish WASM.
