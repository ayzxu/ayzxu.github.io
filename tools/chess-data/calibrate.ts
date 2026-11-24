/* calibrate.ts — how strong is the bot, and does it err like Andy?

   Plays the real bot (book + engine + fitted humanizer) against Stockfish in
   its rating-limited mode, then grades every bot move with full-strength
   Stockfish, the same way annotate.mjs graded Andy's own games. Reports:
     • score against the limited Stockfish, and the Elo that implies
     • the bot's average centipawn loss, accuracy, and inaccuracies /
       mistakes / blunders per 40 moves, to compare with Andy's real rapid
       numbers

   Needs a native Stockfish (STOCKFISH=/path or `stockfish` on PATH).
   Run: tools/chess-data/run.sh tools/chess-data/calibrate.ts --games 24 --elo 1900 [--deep 0] [--tau 1] */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Chess } from 'chess.js';
import { chooseMove } from '../../src/chess/engine/andyBot';
import type { AndyProfile, OpeningBook } from '../../src/chess/engine/types';
import { calibrated, type Calibration, type HumanModel } from '../../src/chess/engine/human/model';
import bookJson from '../../src/chess/data/opening-book.json';
import profileJson from '../../src/chess/data/style-profile.json';
import humanJson from '../../src/chess/data/human-model.json';

const STOCKFISH = process.env.STOCKFISH || 'stockfish';
const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

/* --- UCI engine ------------------------------------------------------------ */
class Uci {
  private proc = spawn(STOCKFISH, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  private buf = '';
  private lines: string[] = [];
  private waiter: { re: RegExp; res: (l: string[]) => void } | null = null;
  constructor() {
    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        if (this.waiter && this.waiter.re.test(line)) {
          const w = this.waiter;
          this.waiter = null;
          w.res(this.lines);
          this.lines = [];
        }
      }
    });
  }
  send(c: string) {
    this.proc.stdin.write(c + '\n');
  }
  until(re: RegExp): Promise<string[]> {
    return new Promise((res) => (this.waiter = { re, res }));
  }
  async init(opts: Record<string, string | number | boolean>) {
    this.send('uci');
    await this.until(/^uciok/);
    for (const [k, v] of Object.entries(opts)) this.send(`setoption name ${k} value ${v}`);
    this.send('isready');
    await this.until(/^readyok/);
  }
  async bestmove(fen: string, go: string): Promise<string> {
    this.send(`position fen ${fen}`);
    this.send(`go ${go}`);
    const lines = await this.until(/^bestmove/);
    return lines[lines.length - 1].split(' ')[1];
  }
  /** Score (side to move, cp; mates mapped to ±3000) */
  async score(fen: string, go: string): Promise<{ move: string; cp: number }> {
    this.send(`position fen ${fen}`);
    this.send(`go ${go}`);
    const lines = await this.until(/^bestmove/);
    let cp = 0;
    for (const l of lines) {
      const c = / score cp (-?\d+)/.exec(l);
      const m = / score mate (-?\d+)/.exec(l);
      if (c) cp = Number(c[1]);
      else if (m) cp = Number(m[1]) > 0 ? 3000 - Number(m[1]) : -3000 - Number(m[1]);
    }
    return { move: lines[lines.length - 1].split(' ')[1], cp };
  }
  quit() {
    this.send('quit');
  }
}

/* --- one game ---------------------------------------------------------------- */
type GameOut = {
  result: number; // bot's score: 1, 0.5, 0
  pgn: string;
  botPositions: { fen: string; uci: string }[];
};

async function playGame(sf: Uci, botWhite: boolean, model: HumanModel, nodes: number, movetime: number): Promise<GameOut> {
  const chess = new Chess();
  const history: string[] = [];
  const botPositions: { fen: string; uci: string }[] = [];
  while (!chess.isGameOver() && history.length < 300) {
    const botTurn = (chess.turn() === 'w') === botWhite;
    const fen = chess.fen();
    let uci: string;
    if (botTurn) {
      const verbose = chess.history({ verbose: true });
      const last = verbose[verbose.length - 1];
      const res = chooseMove(fen, profileJson as unknown as AndyProfile, bookJson as unknown as OpeningBook, model, Math.random, {
        history,
        nodes,
        lastMove: last ? { to: last.to, capture: last.flags.includes('c') || last.flags.includes('e') } : undefined,
      })!;
      uci = res.from + res.to + (res.promotion ?? '');
      // Graded like Andy's own games: every move from ply 8 on, book or not.
      if (history.length >= 8) botPositions.push({ fen, uci });
    } else {
      uci = await sf.bestmove(fen, `movetime ${movetime}`);
    }
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    history.push(uci);
  }
  let result = 0.5;
  if (chess.isCheckmate()) result = (chess.turn() === 'w') === botWhite ? 0 : 1;
  return { result, pgn: chess.pgn(), botPositions };
}

/* --- worker ------------------------------------------------------------------- */
async function workerMain() {
  const { games, elo, model, nodes, movetime } = workerData as {
    games: boolean[];
    elo: number;
    model: HumanModel;
    nodes: number;
    movetime: number;
  };
  const opp = new Uci();
  await opp.init({ Threads: 1, Hash: 32, UCI_LimitStrength: true, UCI_Elo: elo });
  const grader = new Uci();
  await grader.init({ Threads: 1, Hash: 64 });
  for (const botWhite of games) {
    const g = await playGame(opp, botWhite, model, nodes, movetime);
    // Grade the bot's own moves with full-strength Stockfish.
    const losses: number[] = [];
    for (const p of g.botPositions) {
      const best = await grader.score(p.fen, 'nodes 300000');
      if (best.move === p.uci) {
        losses.push(0);
        continue;
      }
      const played = await grader.score(p.fen, `nodes 300000 searchmoves ${p.uci}`);
      const B = Math.max(-1000, Math.min(1000, best.cp));
      const P = Math.max(-1000, Math.min(1000, played.cp));
      losses.push(Math.max(0, B - P));
    }
    parentPort!.postMessage({ result: g.result, botWhite, losses, pgn: g.pgn });
  }
  opp.quit();
  grader.quit();
}

/* --- main ----------------------------------------------------------------------- */
async function main() {
  const games = Number(arg('--games', '24'));
  const elo = Number(arg('--elo', '1900'));
  const workers = Number(arg('--workers', '4'));
  const nodes = Number(arg('--nodes', '250000'));
  const movetime = Number(arg('--movetime', '300'));
  // The shipped calibration unless overridden with --tau / --deep.
  const shipped = (humanJson as { calibration?: Calibration }).calibration;
  const model = calibrated(humanJson.model as unknown as HumanModel, {
    tauScale: Number(arg('--tau', String(shipped?.tauScale ?? 1))),
    deepShift: Number(arg('--deep', String(shipped?.deepShift ?? 0))),
  });

  const colors = Array.from({ length: games }, (_, i) => i % 2 === 0);
  const self = fileURLToPath(import.meta.url);
  const results: { result: number; losses: number[]; pgn: string }[] = [];
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: workers }, (_, w) =>
      new Promise<void>((res, rej) => {
        const worker = new Worker(self, {
          workerData: { games: colors.filter((_, i) => i % workers === w), elo, model, nodes, movetime },
        });
        worker.on('message', (m) => {
          results.push(m);
          process.stdout.write(`\r  ${results.length}/${games} games`);
        });
        worker.on('error', rej);
        worker.on('exit', () => res());
      }),
    ),
  );

  const score = results.reduce((s, r) => s + r.result, 0);
  const pct = score / results.length;
  const clampP = Math.min(0.97, Math.max(0.03, pct));
  const eloDiff = 400 * Math.log10(clampP / (1 - clampP));
  const profile = (label: string, xs: number[]) => {
    const n = xs.length;
    const acpl = xs.reduce((s, x) => s + x, 0) / n;
    const per40 = (lo: number, hi: number) => ((xs.filter((x) => x >= lo && x < hi).length / n) * 40).toFixed(1);
    return `${label}: ACPL ${acpl.toFixed(0)} over ${n} moves, per 40: inacc ${per40(50, 100)} mist ${per40(100, 300)} blund ${per40(300, 1e9)}`;
  };
  console.log(
    `\nvs Stockfish ${elo}: ${score}/${results.length} (${(pct * 100).toFixed(0)}%) → ~${Math.round(elo + eloDiff)} ` +
      `| ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
  console.log('  ' + profile('all moves', results.flatMap((r) => r.losses)));
  // Andy's graded rapid games average ~31 graded moves; compare like for like.
  console.log('  ' + profile('first 31 graded moves', results.flatMap((r) => r.losses.slice(0, 31))));
  const dir = resolve(process.cwd(), 'tools/chess-data/cache');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `calibration-${elo}.json`), JSON.stringify(results));
}

if (isMainThread) main();
else workerMain();
