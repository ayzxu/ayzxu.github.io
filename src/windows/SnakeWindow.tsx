/* ==========================================================================
   SnakeWindow — grid Snake on a 1-bit canvas. Arrow keys / WASD steer; the
   on-screen D-pad covers touch. Speeds up as you eat; high score persists
   in localStorage.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { playSnakeSound } from '../lib/sounds';
import { unlockAchievement } from '../lib/achievements';

const GRID = 20; // 20×20 cells
const CELL = 16; // px per cell
const SIZE = GRID * CELL;
const START_MS = 160;
const MIN_MS = 60;
const HIGH_SCORE_KEY = 'snake-high-score';

type Dir = 'up' | 'down' | 'left' | 'right';
type Pt = { x: number; y: number };
type Phase = 'idle' | 'running' | 'over';

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DELTA: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function readHighScore(): number {
  try {
    const n = Number(localStorage.getItem(HIGH_SCORE_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export default function SnakeWindow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(readHighScore);

  /* Game state lives in refs — the rAF/interval loop mutates it directly */
  const snake = useRef<Pt[]>([]);
  const dir = useRef<Dir>('right');
  const nextDir = useRef<Dir>('right');
  const food = useRef<Pt>({ x: 10, y: 10 });
  const loopId = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // food — small diamond
    ctx.fillStyle = '#000000';
    const f = food.current;
    ctx.beginPath();
    ctx.moveTo(f.x * CELL + CELL / 2, f.y * CELL + 2);
    ctx.lineTo(f.x * CELL + CELL - 2, f.y * CELL + CELL / 2);
    ctx.lineTo(f.x * CELL + CELL / 2, f.y * CELL + CELL - 2);
    ctx.lineTo(f.x * CELL + 2, f.y * CELL + CELL / 2);
    ctx.fill();

    // snake — solid blocks with a 1px gap so segments read individually
    for (const s of snake.current) {
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    }
  };

  const placeFood = () => {
    const occupied = new Set(snake.current.map((s) => `${s.x},${s.y}`));
    let p: Pt;
    do {
      p = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
    } while (occupied.has(`${p.x},${p.y}`));
    food.current = p;
  };

  const stopLoop = () => {
    if (loopId.current !== null) {
      window.clearTimeout(loopId.current);
      loopId.current = null;
    }
  };

  const gameOver = () => {
    stopLoop();
    setPhase('over');
    setScore((s) => {
      if (s > readHighScore()) {
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(s));
        } catch {
          /* storage unavailable */
        }
        setHighScore(s);
      }
      return s;
    });
  };

  const tick = (delay: number) => {
    loopId.current = window.setTimeout(() => {
      dir.current = nextDir.current;
      const head = snake.current[0];
      const d = DELTA[dir.current];
      const nx = head.x + d.x;
      const ny = head.y + d.y;

      // wall or self collision ends the run
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= GRID ||
        ny >= GRID ||
        snake.current.some((s) => s.x === nx && s.y === ny)
      ) {
        gameOver();
        return;
      }

      snake.current.unshift({ x: nx, y: ny });
      let nextDelay = delay;
      if (nx === food.current.x && ny === food.current.y) {
        playSnakeSound('food');
        setScore((s) => {
          const next = s + 1;
          if (next >= 10) unlockAchievement('snake-10');
          return next;
        });
        placeFood();
        nextDelay = Math.max(MIN_MS, delay - 4);
      } else {
        snake.current.pop();
      }
      draw();
      tick(nextDelay);
    }, delay);
  };

  const start = () => {
    stopLoop();
    snake.current = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
    dir.current = 'right';
    nextDir.current = 'right';
    setScore(0);
    placeFood();
    setPhase('running');
    draw();
    tick(START_MS);
  };

  const steer = (d: Dir) => {
    if (phaseRef.current !== 'running') return;
    if (d === OPPOSITE[dir.current]) return; // can't reverse into yourself
    // click only on an actual change of direction — every tick would be noise
    if (d !== nextDir.current) playSnakeSound('move');
    nextDir.current = d;
  };

  /* initial board + keyboard focus + cleanup */
  useEffect(() => {
    draw();
    rootRef.current?.focus({ preventScroll: true });
    return stopLoop;
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const map: Record<string, Dir> = {
      arrowup: 'up',
      w: 'up',
      arrowdown: 'down',
      s: 'down',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
    };
    if (map[k]) {
      e.preventDefault();
      steer(map[k]);
    } else if (k === ' ' || k === 'enter') {
      e.preventDefault();
      if (phaseRef.current !== 'running') start();
    }
  };

  return (
    <div
      ref={rootRef}
      className="snake-content"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={() => rootRef.current?.focus({ preventScroll: true })}
    >
      <div className="snake-status">
        <span>Score: {score}</span>
        <span>Best: {highScore}</span>
      </div>

      <div className="snake-board-wrap">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="snake-board"
        />
        {phase !== 'running' && (
          <div className="snake-overlay">
            <div className="win-sub">
              {phase === 'over' ? 'GAME OVER' : 'SNAKE'}
            </div>
            <button
              type="button"
              className="mac-button default"
              // keep keyboard focus on the wrapper so steering works right away
              onMouseDown={(e) => e.preventDefault()}
              onClick={start}
            >
              {phase === 'over' ? 'Play Again' : 'Start'}
            </button>
            <p className="win-meta" style={{ margin: 0 }}>
              Arrows / WASD to steer
            </p>
          </div>
        )}
      </div>

      {/* touch D-pad */}
      <div className="snake-dpad" aria-hidden onMouseDown={(e) => e.preventDefault()}>
        <button type="button" className="mac-button" onClick={() => steer('up')}>
          ▲
        </button>
        <div className="snake-dpad-row">
          <button type="button" className="mac-button" onClick={() => steer('left')}>
            ◀
          </button>
          <button type="button" className="mac-button" onClick={() => steer('down')}>
            ▼
          </button>
          <button type="button" className="mac-button" onClick={() => steer('right')}>
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
