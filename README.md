# andyxu.dev

My personal website, rebuilt as a 1984 Macintosh. Draggable windows, desktop icons, a menu bar, and a Trash can with some of my worst files in it.

Live at **[andyxu.dev](https://andyxu.dev)**

## What's on the desktop

Double-click around. There's a Read Me with the basics, folders for my projects, experience, and hobbies (art, volleyball, lifting — the usual), my résumé in a window, and the thing I'm most proud of: **Andy Chess Bot**.

## The chess bot

It's a chess engine that plays like me, built from my real Chess.com games. Not Stockfish with the difficulty slider turned down — the whole engine is hand-written and runs in your browser in a Web Worker.

The pipeline in `tools/chess-data/` downloads my game history and builds two artifacts: an opening book (every position I've reached, weighted by how often I played each move and how it scored) and a style profile (how often I capture, check, develop, attack the kingside). The engine itself is a negamax search with alpha-beta pruning and a capture-only quiescence search, plus a style layer that nudges it toward moves I'd actually play, plus a "humanizer" that makes believable ~1500 mistakes — more of them in sharp positions, fewer in endgames. Details in [`tools/chess-data/README.md`](tools/chess-data/README.md) and `src/chess/`.

Whenever I rerun the pipeline it retrains on my latest games, so the bot improves when I do. Hopefully.

## Tech

React 19 + TypeScript + Vite, Tailwind for utility styles with a lot of hand-rolled 1-bit CSS on top, chess.js + react-chessboard for the board. Deployed to GitHub Pages.

## Running it locally

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm run deploy   # build + push to GitHub Pages
```

To refresh the chess bot's data, see `tools/chess-data/README.md` (runs locally, not at build time).
