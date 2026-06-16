/* ==========================================================================
   ChessWindow — "Andy Chess Bot". Play a full game against a client-side engine
   tuned to mimic Andy's ~1500 Chess.com style (Italian as White, King's Indian
   vs 1.d4, sharp open games, and lifelike mistakes). Styled to match the 1-bit
   System 1 desktop: dithered dark squares, pixel/VT323 type, mac-button chrome.

   The engine runs in a Web Worker (see useAndyBot); this component owns the game
   state, the board interaction (drag + click-to-move), the move list and result.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { playChessSound, type ChessSound } from '../lib/sounds';
import { Chessboard } from 'react-chessboard';
import type { ChessboardOptions } from 'react-chessboard';
import { useAndyBot } from '../chess/useAndyBot';
import type { GameReview, MoveReview } from '../chess/engine/types';
import { unlockAchievement } from '../lib/achievements';
import {
  buildResultCard,
  downloadCard,
  shareOrDownloadCard,
} from '../lib/chessCard';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* 25%-black dither for dark squares — the classic Macintosh "light gray"
   pattern: mostly white with a sparse grid of black pixels, a subtle 1-bit
   texture that still distinguishes the dark squares from the white ones. */
const DITHER = {
  backgroundColor: '#ffffff',
  backgroundImage: 'repeating-conic-gradient(#000000 0% 25%, #ffffff 0% 100%)',
  backgroundSize: '4px 4px',
} as const;

/** True for the board's dark squares (a1 is dark). */
function isDarkSquare(sq: Square): boolean {
  return (sq.charCodeAt(0) - 97 + (Number(sq[1]) - 1)) % 2 === 0;
}

type UserColor = 'white' | 'black';
type Status =
  | { kind: 'playing' }
  | { kind: 'over'; text: string };

function resultText(game: Chess, userColor: UserColor): string {
  if (game.isCheckmate()) {
    const loser = game.turn() === 'w' ? 'white' : 'black';
    return loser === userColor ? 'Checkmate — Andy wins' : 'Checkmate — you win!';
  }
  if (game.isStalemate()) return 'Stalemate — draw';
  if (game.isInsufficientMaterial()) return 'Draw — insufficient material';
  if (game.isThreefoldRepetition()) return 'Draw — repetition';
  if (game.isDraw()) return 'Draw';
  return 'Game over';
}

/** Pick the clip for a just-played move — one sound per move, Chess.com
    priority order: game end > check > promotion > castle > capture > plain
    move (whose clip differs for the user vs. Andy). `g` must already reflect
    the move. */
function soundForMove(move: Move, g: Chess, byUser: boolean): ChessSound {
  if (g.isGameOver()) return 'game-end';
  if (g.inCheck()) return 'move-check';
  if (move.promotion) return 'promote';
  if (move.flags.includes('k') || move.flags.includes('q')) return 'castle';
  if (move.flags.includes('c') || move.flags.includes('e')) return 'capture';
  return byUser ? 'move-self' : 'move-opponent';
}

/** Pair SAN history into numbered (white, black) rows for the move list. */
function toRows(history: string[]): { n: number; w: string; b?: string }[] {
  const rows: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: history[i], b: history[i + 1] });
  }
  return rows;
}

/** Classic annotation suffix for a move's quality (blank for solid moves). */
function qualityMark(q: MoveReview['quality']): string {
  if (q === 'blunder') return '??';
  if (q === 'mistake') return '?';
  if (q === 'inaccuracy') return '?!';
  return '';
}

/** "12." for a white move, "12…" for a black move. */
function moveLabel(m: MoveReview): string {
  return m.color === 'w' ? `${m.moveNumber}.` : `${m.moveNumber}…`;
}

/** A short, shareable headline from the result text and length. */
function shareHeadline(statusText: string, fullMoves: number): string {
  const moves = `${fullMoves} move${fullMoves === 1 ? '' : 's'}`;
  if (/you win/i.test(statusText)) return `I beat Andy's bot in ${moves}`;
  if (/andy wins/i.test(statusText)) return `Andy's bot got me in ${moves}`;
  if (/draw|stalemate|repetition|insufficient/i.test(statusText)) {
    return `I drew Andy's bot in ${moves}`;
  }
  return `I played Andy's chess bot`;
}

export default function ChessWindow() {
  const gameRef = useRef(new Chess());
  const gameIdRef = useRef(0); // bumped on New Game to void in-flight bot moves
  const { requestMove, requestAnalysis, thinking, analyzing } = useAndyBot();

  const [userColor, setUserColor] = useState<UserColor>('white');
  const [fen, setFen] = useState(START_FEN);
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'playing' });
  const [selected, setSelected] = useState<Square | null>(null);
  /* True when the engine failed to produce a move (worker error or no result)
     — surfaces a Retry button instead of soft-locking on "Andy's move". */
  const [engineError, setEngineError] = useState(false);
  /* Post-game review, computed once per finished game by the engine worker. */
  const [review, setReview] = useState<GameReview | null>(null);
  const reviewedGameId = useRef(-1);
  /* Share-card generation in flight (disables the buttons + shows feedback). */
  const [cardBusy, setCardBusy] = useState(false);

  const isUserTurn = useCallback(() => {
    const turn = gameRef.current.turn() === 'w' ? 'white' : 'black';
    return turn === userColor;
  }, [userColor]);

  const syncFromGame = useCallback(() => {
    const g = gameRef.current;
    setFen(g.fen());
    setHistory(g.history());
    if (g.isGameOver()) {
      setStatus({ kind: 'over', text: resultText(g, userColor) });
      // checkmate where the side to move (the loser) is Andy → the user won
      const loser = g.turn() === 'w' ? 'white' : 'black';
      if (g.isCheckmate() && loser !== userColor) {
        unlockAchievement('chess-win');
      }
    }
  }, [userColor]);

  /* Ask the engine for Andy's reply, then apply it (guarding against a New Game
     started while the worker was thinking). */
  const askAndy = useCallback(async () => {
    const myGameId = gameIdRef.current;
    const g = gameRef.current;
    if (g.isGameOver()) return;
    // Tell the engine what the user just played so it can recognize recaptures
    // (Andy snaps those back instantly) when sampling its think time.
    const verbose = g.history({ verbose: true });
    const last = verbose[verbose.length - 1];
    const lastMove = last
      ? { to: last.to, capture: last.flags.includes('c') || last.flags.includes('e') }
      : undefined;
    try {
      const res = await requestMove(g.fen(), lastMove);
      if (myGameId !== gameIdRef.current) return; // game was reset mid-think
      if (!res) {
        setEngineError(true);
        return;
      }
      const mv = g.move({ from: res.from, to: res.to, promotion: res.promotion });
      playChessSound(soundForMove(mv, g, false));
      setSelected(null);
      setEngineError(false);
      syncFromGame();
    } catch {
      // Worker error — show a Retry control rather than hanging on "Andy's move"
      if (myGameId === gameIdRef.current) setEngineError(true);
    }
  }, [requestMove, syncFromGame]);

  const newGame = useCallback(
    (color: UserColor) => {
      gameIdRef.current += 1;
      gameRef.current = new Chess();
      setUserColor(color);
      setSelected(null);
      setEngineError(false);
      setStatus({ kind: 'playing' });
      setFen(gameRef.current.fen());
      setHistory([]);
      playChessSound('game-start');
      // If the user takes Black, Andy (White) opens.
      if (color === 'black') {
        const myGameId = gameIdRef.current;
        requestMove(gameRef.current.fen())
          .then((res) => {
            if (myGameId !== gameIdRef.current) return;
            if (!res) {
              setEngineError(true);
              return;
            }
            const mv = gameRef.current.move({
              from: res.from,
              to: res.to,
              promotion: res.promotion,
            });
            playChessSound(soundForMove(mv, gameRef.current, false));
            setFen(gameRef.current.fen());
            setHistory(gameRef.current.history());
          })
          .catch(() => {
            if (myGameId === gameIdRef.current) setEngineError(true);
          });
      }
    },
    [requestMove],
  );

  /* Attempt a user move from -> to (auto-queen on promotion). Returns success. */
  const tryUserMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (status.kind === 'over' || !isUserTurn() || thinking) return false;
      const g = gameRef.current;
      const piece = g.get(from);
      const promo =
        piece && piece.type === 'p' && (to[1] === '8' || to[1] === '1')
          ? 'q'
          : undefined;
      let mv: Move;
      try {
        mv = g.move({ from, to, promotion: promo });
      } catch {
        playChessSound('illegal');
        return false;
      }
      playChessSound(soundForMove(mv, g, true));
      setSelected(null);
      syncFromGame();
      if (!g.isGameOver()) void askAndy();
      return true;
    },
    [status.kind, isUserTurn, thinking, syncFromGame, askAndy],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare) return false;
      return tryUserMove(sourceSquare as Square, targetSquare as Square);
    },
    [tryUserMove],
  );

  const onSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (status.kind === 'over' || !isUserTurn() || thinking) return;
      const sq = square as Square;
      const g = gameRef.current;

      const piece = g.get(sq);
      const mine = piece && (piece.color === 'w') === (userColor === 'white');

      if (selected) {
        if (sq === selected) {
          setSelected(null);
          return;
        }
        // Clicking another of your own pieces just switches the selection —
        // don't run it through tryUserMove, which would treat the (always
        // illegal) self-capture as a bad move and play the error sound.
        if (!mine && tryUserMove(selected, sq)) return; // moved
      }
      // (Re)select if the square holds one of the user's pieces.
      setSelected(mine ? sq : null);
    },
    [selected, status.kind, isUserTurn, thinking, userColor, tryUserMove],
  );

  /* Highlight the selected square and its legal destinations, 1-bit style.
     On dark squares the dot is layered over the dither so the texture is
     preserved underneath. */
  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!selected) return {};
    const styles: Record<string, React.CSSProperties> = {
      [selected]: { boxShadow: 'inset 0 0 0 3px #000000' },
    };
    const moves = gameRef.current.moves({ square: selected, verbose: true });
    for (const m of moves) {
      styles[m.to] = isDarkSquare(m.to)
        ? {
            backgroundImage: `radial-gradient(circle, #000000 22%, rgba(0,0,0,0) 24%), ${DITHER.backgroundImage}`,
            backgroundSize: `auto, ${DITHER.backgroundSize}`,
          }
        : {
            backgroundImage:
              'radial-gradient(circle, #000000 22%, rgba(0,0,0,0) 24%)',
          };
    }
    return styles;
    // `fen` isn't read directly but must stay: it forces the legal-move dots to
    // recompute whenever the position changes (gameRef.current isn't reactive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, fen]);

  const options: ChessboardOptions = useMemo(
    () => ({
      position: fen,
      boardOrientation: userColor,
      allowDragging: status.kind === 'playing' && isUserTurn() && !thinking,
      allowDrawingArrows: false,
      showNotation: true,
      animationDurationInMs: 150,
      darkSquareStyle: DITHER,
      lightSquareStyle: { backgroundColor: '#ffffff' },
      squareStyles,
      onPieceDrop,
      onSquareClick,
    }),
    [fen, userColor, status.kind, isUserTurn, thinking, squareStyles, onPieceDrop, onSquareClick],
  );

  // Start a fresh game on first mount — coin-flip for color, like a real pairing.
  useEffect(() => {
    newGame(Math.random() < 0.5 ? 'white' : 'black');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Re-ask the engine after a worker failure. */
  const retryAndy = useCallback(() => {
    setEngineError(false);
    void askAndy();
  }, [askAndy]);

  /* When a game ends, ask the worker to review it — once per game. Resetting
     to a new game (status back to 'playing') clears the previous review. */
  useEffect(() => {
    if (status.kind !== 'over') {
      setReview(null);
      return;
    }
    const gid = gameIdRef.current;
    if (reviewedGameId.current === gid) return;
    reviewedGameId.current = gid;
    const hist = gameRef.current.history();
    if (hist.length === 0) return;
    requestAnalysis(hist, userColor)
      .then((r) => {
        if (gid === gameIdRef.current) setReview(r);
      })
      .catch(() => {
        /* leave review null — the panel falls back to the plain result */
      });
  }, [status.kind, userColor, requestAnalysis]);

  /* Build and share/download the result card. */
  const handleShare = useCallback(
    async (mode: 'share' | 'download') => {
      if (status.kind !== 'over') return;
      setCardBusy(true);
      try {
        const fullMoves = Math.ceil(gameRef.current.history().length / 2);
        const headline = shareHeadline(status.text, fullMoves);
        const sublines = review
          ? [
              `Your accuracy ${review.userAccuracy}%   ·   Andy ${review.andyAccuracy}%`,
              `${review.counts.blunders} blunders · ${review.counts.mistakes} mistakes · ${review.counts.inaccuracies} inaccuracies`,
            ]
          : [status.text];
        const blob = await buildResultCard({
          fen: gameRef.current.fen(),
          orientation: userColor,
          headline,
          sublines,
          footer: 'andyxu.dev · the bot trained on my real games',
        });
        if (mode === 'download') downloadCard(blob);
        else await shareOrDownloadCard(blob, headline);
      } catch {
        /* swallow — nothing to share if the canvas failed */
      } finally {
        setCardBusy(false);
      }
    },
    [status, review, userColor],
  );

  /* The player's biggest errors, worst first, for the review panel. */
  const biggestMistakes = useMemo<MoveReview[]>(() => {
    if (!review) return [];
    return review.moves
      .filter((m) => m.byUser && (m.quality === 'blunder' || m.quality === 'mistake'))
      .sort((a, b) => b.cpLoss - a.cpLoss)
      .slice(0, 3);
  }, [review]);

  /* Opening positions where the player chose something other than Andy's
     most-played move — the "this is what Andy plays here" overlay. */
  const bookDivergences = useMemo<MoveReview[]>(() => {
    if (!review) return [];
    return review.moves
      .filter((m) => m.byUser && m.andyBook && !m.andyBook.matchedTop)
      .slice(0, 3);
  }, [review]);

  const rows = toRows(history);
  const turnLabel =
    status.kind === 'over'
      ? status.text
      : engineError
        ? 'Andy froze up — '
        : thinking
          ? 'Andy is thinking…'
          : isUserTurn()
            ? 'Your move'
            : "Andy's move";

  return (
    <div className="chess-app">
      <div className="chess-app-head">
        <div className="win-sub">Andy Chess Bot</div>
        <div className="win-meta">Plays like Andy · ~1500 chess.com</div>
      </div>

      <div className="chess-app-body">
        <div className="chess-board-area">
          <div className="chess-game-board">
            <Chessboard options={options} />
          </div>
          <div className={`chess-status${status.kind === 'over' ? ' over' : ''}`}>
            {turnLabel}
            {status.kind === 'playing' && engineError && (
              <button type="button" className="mac-button" onClick={retryAndy}>
                Retry
              </button>
            )}
          </div>
        </div>

        <div className="chess-side">
          <div className="chess-controls">
            <button
              type="button"
              className={`mac-button${userColor === 'white' ? ' default' : ''}`}
              onClick={() => newGame('white')}
            >
              Play White
            </button>
            <button
              type="button"
              className={`mac-button${userColor === 'black' ? ' default' : ''}`}
              onClick={() => newGame('black')}
            >
              Play Black
            </button>
            <button
              type="button"
              className="mac-button"
              onClick={() => newGame(Math.random() < 0.5 ? 'white' : 'black')}
            >
              New Game
            </button>
          </div>

          {status.kind === 'over' && (
            <div className="chess-review">
              {analyzing && !review && (
                <div className="chess-review-pending win-meta">
                  Reviewing the game…
                </div>
              )}
              {review && (
                <>
                  <div className="win-sub chess-review-title">Game Review</div>
                  <div className="chess-review-acc">
                    <span>
                      You <b>{review.userAccuracy}%</b>
                    </span>
                    <span>
                      Andy <b>{review.andyAccuracy}%</b>
                    </span>
                  </div>
                  <div className="chess-review-line">
                    {review.counts.blunders} blunders · {review.counts.mistakes}{' '}
                    mistakes · {review.counts.inaccuracies} inaccuracies
                  </div>
                  {review.bookTotal > 0 && (
                    <div className="chess-review-line">
                      You followed my book on {review.bookMatches}/
                      {review.bookTotal} opening moves
                    </div>
                  )}

                  {bookDivergences.length > 0 && (
                    <div className="chess-review-block">
                      <div className="win-meta chess-review-subhead">
                        Where Andy differs
                      </div>
                      {bookDivergences.map((m) => {
                        const ab = m.andyBook;
                        if (!ab) return null;
                        return (
                          <div key={m.ply} className="chess-review-note">
                            {moveLabel(m)} you played {m.san} — Andy plays{' '}
                            {ab.san} ({ab.sharePct}%)
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {biggestMistakes.length > 0 && (
                    <div className="chess-review-block">
                      <div className="win-meta chess-review-subhead">
                        Biggest slips
                      </div>
                      {biggestMistakes.map((m) => (
                        <div key={m.ply} className="chess-review-note">
                          {moveLabel(m)} {m.san}
                          {qualityMark(m.quality)}
                          {m.bestSan ? ` — engine liked ${m.bestSan}` : ''}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="chess-review-actions">
                    <button
                      type="button"
                      className="mac-button default"
                      disabled={cardBusy}
                      onClick={() => void handleShare('share')}
                    >
                      {cardBusy ? 'Rendering…' : 'Share result'}
                    </button>
                    <button
                      type="button"
                      className="mac-button"
                      disabled={cardBusy}
                      onClick={() => void handleShare('download')}
                    >
                      Save PNG
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="win-meta chess-movelist-title">Moves</div>
          <div className="chess-movelist mac-scroll">
            {rows.length === 0 ? (
              <div className="chess-move-empty">No moves yet.</div>
            ) : (
              rows.map((r) => (
                <div key={r.n} className="chess-move-row">
                  <span className="chess-move-num">{r.n}.</span>
                  <span className="chess-move-san">{r.w}</span>
                  <span className="chess-move-san">{r.b ?? ''}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <hr className="mac-rule" />

      <div className="chess-howto">
        <div className="win-sub">How it works</div>
        <p>
          This isn&apos;t Stockfish with the difficulty turned down. It&apos;s a
          hand-written engine trained on my actual Chess.com games. A data pipeline
          builds two things from my full game history: an opening book of every
          position I&apos;ve reached, weighted by how often I played each move and
          how it scored, and a style profile capturing my tendencies like how often
          I grab captures, give checks, develop pieces, or attack the kingside.
        </p>
        <p>
          In the opening, the bot plays my repertoire. Out of book, a negamax search
          with alpha-beta pruning scores every legal move, then a style layer nudges
          the ranking toward moves that look like me. A humanizer then decides what
          actually gets played: usually something good, sometimes an inaccuracy,
          occasionally a natural-looking blunder. Error rates climb in sharp positions
          and drop in the endgame, which is what lands it at around 1500.
        </p>
        <p>
          Even the pauses are modeled on me. The pipeline reads the clock tags
          Chess.com stamps on every move and learns how long I actually spend in
          different positions. The bot snaps off recaptures and book moves, tanks
          in sharp middlegames, and speeds up as the clock runs low, just like I do.
        </p>
        <p className="win-meta">
          Everything runs in your browser in a Web Worker with no server. The book
          and profile rebuild from my latest games, so as I improve, so does the bot.
        </p>
      </div>
    </div>
  );
}
