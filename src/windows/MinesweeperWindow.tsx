/* ==========================================================================
   MinesweeperWindow — classic 9×9 / 10-mine Minesweeper in 1-bit dress.
   Left-click (tap) reveals; right-click flags; a Flag toggle covers touch
   devices. First click is always safe — mines are placed after it.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { playMinesweeperSound } from '../lib/sounds';

const ROWS = 9;
const COLS = 9;
const MINES = 10;

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

type Phase = 'fresh' | 'playing' | 'won' | 'lost';

function emptyBoard(): Cell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  );
}

/** Place mines anywhere except the first-clicked cell and its neighbours */
function plantMines(board: Cell[][], safeR: number, safeC: number): void {
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (board[r][c].mine) continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    board[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc].mine)
            n++;
        }
      }
      board[r][c].adjacent = n;
    }
  }
}

function revealFrom(board: Cell[][], r: number, c: number): void {
  const stack = [[r, c]];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!;
    const cell = board[cr][cc];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0 && !cell.mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = cr + dr;
          const ccc = cc + dc;
          if (rr >= 0 && rr < ROWS && ccc >= 0 && ccc < COLS) {
            stack.push([rr, ccc]);
          }
        }
      }
    }
  }
}

export default function MinesweeperWindow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<Cell[][]>(emptyBoard);
  const [phase, setPhase] = useState<Phase>('fresh');
  const [flagMode, setFlagMode] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  /* grab keyboard focus on open */
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  /* timer runs only while playing */
  useEffect(() => {
    if (phase === 'playing') {
      timerRef.current = window.setInterval(
        () => setSeconds((s) => Math.min(999, s + 1)),
        1000,
      );
      return () => {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
      };
    }
  }, [phase]);

  const flagsUsed = board.flat().filter((c) => c.flagged).length;

  const reset = () => {
    playMinesweeperSound('reset');
    setBoard(emptyBoard());
    setPhase('fresh');
    setSeconds(0);
    setFlagMode(false);
  };

  const checkWin = (b: Cell[][]): boolean =>
    b.flat().every((c) => c.mine || c.revealed);

  const reveal = (r: number, c: number) => {
    if (phase === 'won' || phase === 'lost') return;
    // Sound is decided here, outside the state updater. The first click can
    // never be a mine (mines are planted around it), so checking the current
    // board is accurate.
    if (
      phase === 'playing' &&
      board[r][c].mine &&
      !board[r][c].flagged &&
      !board[r][c].revealed
    ) {
      playMinesweeperSound('explosion');
    }
    setBoard((prev) => {
      const b = prev.map((row) => row.map((cell) => ({ ...cell })));
      if (phase === 'fresh') {
        plantMines(b, r, c);
        setPhase('playing');
      }
      const cell = b[r][c];
      if (cell.flagged || cell.revealed) return b;
      if (cell.mine) {
        // boom — show everything
        b.forEach((row) => row.forEach((x) => (x.revealed = true)));
        setPhase('lost');
        return b;
      }
      revealFrom(b, r, c);
      if (checkWin(b)) setPhase('won');
      return b;
    });
  };

  const toggleFlag = (r: number, c: number) => {
    if (phase === 'won' || phase === 'lost' || phase === 'fresh') return;
    if (!board[r][c].revealed) playMinesweeperSound('flag');
    setBoard((prev) => {
      const b = prev.map((row) => row.map((cell) => ({ ...cell })));
      const cell = b[r][c];
      if (!cell.revealed) cell.flagged = !cell.flagged;
      return b;
    });
  };

  const onCellClick = (r: number, c: number) => {
    if (flagMode) toggleFlag(r, c);
    else reveal(r, c);
  };

  const face = phase === 'lost' ? 'X(' : phase === 'won' ? 'B)' : ':)';

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'f') {
      e.preventDefault();
      setFlagMode((f) => !f);
    } else if (k === 'r') {
      e.preventDefault();
      reset();
    }
  };

  return (
    <div
      ref={rootRef}
      className="mine-content"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={() => rootRef.current?.focus({ preventScroll: true })}
    >
      <div className="mine-status">
        <span className="mine-counter">
          {String(Math.max(0, MINES - flagsUsed)).padStart(3, '0')}
        </span>
        <button
          type="button"
          className="mac-button mine-face"
          onClick={reset}
          aria-label="New game"
        >
          {face}
        </button>
        <span className="mine-counter">{String(seconds).padStart(3, '0')}</span>
      </div>

      <div
        className="mine-grid"
        role="grid"
        aria-label="Minesweeper board"
        onContextMenu={(e) => e.preventDefault()}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            let glyph = '';
            if (cell.revealed) {
              glyph = cell.mine ? '✹' : cell.adjacent > 0 ? String(cell.adjacent) : '';
            } else if (cell.flagged) {
              glyph = '⚑';
            }
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                className={`mine-cell${cell.revealed ? ' revealed' : ''}${
                  cell.revealed && cell.mine ? ' boom' : ''
                }`}
                onClick={() => onCellClick(r, c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleFlag(r, c);
                }}
                aria-label={`Row ${r + 1} column ${c + 1}`}
              >
                {glyph}
              </button>
            );
          }),
        )}
      </div>

      <div className="mine-footer">
        <button
          type="button"
          className={`mac-button${flagMode ? ' mine-flag-on' : ''}`}
          onClick={() => setFlagMode((f) => !f)}
        >
          ⚑ Flag {flagMode ? 'On' : 'Off'}
        </button>
        <span className="win-meta">
          {phase === 'won'
            ? 'You win!'
            : phase === 'lost'
              ? 'Boom. Click the face (or press R).'
              : 'Right-click or F for flags. R restarts.'}
        </span>
      </div>
    </div>
  );
}
