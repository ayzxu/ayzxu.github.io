/* ==========================================================================
   ChessWindow — "Andy Chess Bot". Play a full game against a client-side engine
   tuned to mimic Andy's ~1500 Chess.com style (Italian as White, King's Indian
   vs 1.d4, sharp open games, and lifelike mistakes). Styled to match the 1-bit
   System 1 desktop: dithered dark squares, pixel/VT323 type, mac-button chrome.

   The engine runs in a Web Worker (see useAndyBot); this component owns the game
   state, the board interaction (drag + click-to-move), the move list and result.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { ChessboardOptions } from 'react-chessboard';
import { useAndyBot } from '../chess/useAndyBot';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* 50%-gray dither for dark squares — pure 1-bit Macintosh texture */
const DITHER = {
  backgroundColor: '#ffffff',
  backgroundImage: 'repeating-conic-gradient(#000000 0% 25%, #ffffff 0% 50%)',
  backgroundSize: '6px 6px',
} as const;

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

/** Pair SAN history into numbered (white, black) rows for the move list. */
function toRows(history: string[]): { n: number; w: string; b?: string }[] {
  const rows: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: history[i], b: history[i + 1] });
  }
  return rows;
}

export default function ChessWindow() {
  const gameRef = useRef(new Chess());
  const gameIdRef = useRef(0); // bumped on New Game to void in-flight bot moves
  const { requestMove, thinking } = useAndyBot();

  const [userColor, setUserColor] = useState<UserColor>('white');
  const [fen, setFen] = useState(START_FEN);
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'playing' });
  const [selected, setSelected] = useState<Square | null>(null);

  const isUserTurn = useCallback(() => {
    const turn = gameRef.current.turn() === 'w' ? 'white' : 'black';
    return turn === userColor;
  }, [userColor]);

  const syncFromGame = useCallback(() => {
    const g = gameRef.current;
    setFen(g.fen());
    setHistory(g.history());
    if (g.isGameOver()) setStatus({ kind: 'over', text: resultText(g, userColor) });
  }, [userColor]);

  /* Ask the engine for Andy's reply, then apply it (guarding against a New Game
     started while the worker was thinking). */
  const askAndy = useCallback(async () => {
    const myGameId = gameIdRef.current;
    const g = gameRef.current;
    if (g.isGameOver()) return;
    try {
      const res = await requestMove(g.fen());
      if (myGameId !== gameIdRef.current) return; // game was reset mid-think
      if (!res) return;
      g.move({ from: res.from, to: res.to, promotion: res.promotion });
      setSelected(null);
      syncFromGame();
    } catch {
      /* worker error — leave it the user's move; they can retry */
    }
  }, [requestMove, syncFromGame]);

  const newGame = useCallback(
    (color: UserColor) => {
      gameIdRef.current += 1;
      gameRef.current = new Chess();
      setUserColor(color);
      setSelected(null);
      setStatus({ kind: 'playing' });
      setFen(gameRef.current.fen());
      setHistory([]);
      // If the user takes Black, Andy (White) opens.
      if (color === 'black') {
        const myGameId = gameIdRef.current;
        requestMove(gameRef.current.fen())
          .then((res) => {
            if (myGameId !== gameIdRef.current || !res) return;
            gameRef.current.move({ from: res.from, to: res.to, promotion: res.promotion });
            setFen(gameRef.current.fen());
            setHistory(gameRef.current.history());
          })
          .catch(() => {});
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
      try {
        g.move({ from, to, promotion: promo });
      } catch {
        return false; // illegal
      }
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

      if (selected) {
        if (sq === selected) {
          setSelected(null);
          return;
        }
        if (tryUserMove(selected, sq)) return; // moved
      }
      // (Re)select if the square holds one of the user's pieces.
      const piece = g.get(sq);
      const mine = piece && (piece.color === 'w') === (userColor === 'white');
      setSelected(mine ? sq : null);
    },
    [selected, status.kind, isUserTurn, thinking, userColor, tryUserMove],
  );

  /* Highlight the selected square and its legal destinations, 1-bit style. */
  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!selected) return {};
    const styles: Record<string, React.CSSProperties> = {
      [selected]: { boxShadow: 'inset 0 0 0 3px #000000' },
    };
    const moves = gameRef.current.moves({ square: selected, verbose: true });
    for (const m of moves) {
      styles[m.to] = {
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

  // Start a fresh game on first mount.
  useEffect(() => {
    newGame('white');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = toRows(history);
  const turnLabel =
    status.kind === 'over'
      ? status.text
      : thinking
        ? 'Andy is thinking…'
        : isUserTurn()
          ? 'Your move'
          : "Andy's move";

  return (
    <div className="chess-app">
      <div className="chess-app-head">
        <div className="win-sub">Andy Chess Bot</div>
        <div className="win-meta">Plays like Andy · ~1500 blitz</div>
      </div>

      <div className="chess-app-body">
        <div className="chess-board-area">
          <div className="chess-game-board">
            <Chessboard options={options} />
          </div>
          <div className={`chess-status${status.kind === 'over' ? ' over' : ''}`}>
            {turnLabel}
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
              onClick={() => newGame(userColor)}
            >
              New Game
            </button>
          </div>

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
    </div>
  );
}
