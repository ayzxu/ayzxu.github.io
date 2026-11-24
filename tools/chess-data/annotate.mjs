/* annotate.mjs — grade Andy's own moves with Stockfish.

   For every position where Andy was to move in the selected games, Stockfish
   (MultiPV) records its top candidates with scores, and the score of the move
   Andy actually played. That's ground truth for how often, and how badly, Andy
   really goes wrong — by phase, by how sharp the position was, by how much
   clock he had — which is what the humanizer is fitted to.

   Needs a native Stockfish on the PATH (or STOCKFISH=/path/to/binary), e.g.
   `apt-get install stockfish` or `brew install stockfish`. Runs one engine per
   core and caches results in cache/annotations.jsonl, keyed by game URL, so
   re-runs only grade new games.

   Usage:
     node tools/chess-data/annotate.mjs                     # defaults below
     node tools/chess-data/annotate.mjs --rapid-since 2025-01 --blitz 150 */

import { Chess } from 'chess.js';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(__dirname, 'cache');
const GAMES = resolve(CACHE, 'games.json');
const OUT = resolve(CACHE, 'annotations.jsonl');

function getArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const STOCKFISH = process.env.STOCKFISH || 'stockfish';
const RAPID_SINCE = getArg('--rapid-since', '2025-01'); // every rapid game since
const BLITZ_RECENT = Number(getArg('--blitz', '150')); // most recent N blitz
const NODES = Number(getArg('--nodes', '600000')); // per position
const MULTIPV = 4;
const WORKERS = Math.max(1, Number(getArg('--workers', String(cpus().length))));
/** Skip the first few moves: those are book, and graded elsewhere. */
const FROM_PLY = 8;

/* ---- one UCI engine process --------------------------------------------- */
class Engine {
  constructor() {
    this.proc = spawn(STOCKFISH, [], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.buf = '';
    this.waiters = [];
    this.lines = [];
    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        const w = this.waiters[0];
        if (w && w.test(line)) {
          this.waiters.shift();
          w.resolve(this.lines);
          this.lines = [];
        }
      }
    });
  }
  send(cmd) {
    this.proc.stdin.write(cmd + '\n');
  }
  until(re) {
    return new Promise((res) => this.waiters.push({ test: (l) => re.test(l), resolve: res }));
  }
  async init() {
    this.send('uci');
    await this.until(/^uciok/);
    this.send('setoption name Threads value 1');
    this.send('setoption name Hash value 64');
    this.send('isready');
    await this.until(/^readyok/);
  }
  /** Search a FEN; returns the final info line per multipv index. */
  async go(fen, { multipv = 1, searchmoves } = {}) {
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    this.send(`go nodes ${NODES}${searchmoves ? ` searchmoves ${searchmoves}` : ''}`);
    const lines = await this.until(/^bestmove/);
    const best = new Map();
    for (const l of lines) {
      if (!l.startsWith('info') || !l.includes(' pv ')) continue;
      const mpv = Number(/ multipv (\d+)/.exec(l)?.[1] ?? 1);
      const cp = / score cp (-?\d+)/.exec(l);
      const mate = / score mate (-?\d+)/.exec(l);
      const depth = Number(/ depth (\d+)/.exec(l)?.[1] ?? 0);
      const pv = / pv (.+)$/.exec(l)[1].split(' ');
      best.set(mpv, {
        uci: pv[0],
        cp: cp ? Number(cp[1]) : null,
        mate: mate ? Number(mate[1]) : null,
        depth,
      });
    }
    return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }
  quit() {
    this.send('quit');
  }
}

/* ---- which games -------------------------------------------------------- */
const monthOf = (g) => new Date((g.endTime ?? 0) * 1000).toISOString().slice(0, 7);

function selectGames(all) {
  const std = all.filter((g) => g.rules === 'chess' && g.rated && g.pgn);
  const rapid = std.filter((g) => g.timeClass === 'rapid' && monthOf(g) >= RAPID_SINCE);
  const blitz = std.filter((g) => g.timeClass === 'blitz').slice(-BLITZ_RECENT);
  return [...rapid, ...blitz];
}

function parseClocks(pgn) {
  const out = [];
  const re = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g;
  let m;
  while ((m = re.exec(pgn)) !== null) out.push(+m[1] * 3600 + +m[2] * 60 + +m[3]);
  return out;
}

/** Every position Andy faced in a game, with what he played. */
function andyPositions(game) {
  const chess = new Chess();
  try {
    chess.loadPgn(game.pgn);
  } catch {
    return [];
  }
  const moves = chess.history({ verbose: true });
  const clocks = parseClocks(game.pgn);
  const tc = /\[TimeControl\s+"(\d+)(?:\+(\d+))?"\]/.exec(game.pgn);
  const out = [];
  moves.forEach((m, ply) => {
    if (m.color !== game.andyColor || ply < FROM_PLY) return;
    out.push({
      ply,
      fen: m.before,
      uci: m.from + m.to + (m.promotion ?? ''),
      san: m.san,
      // Clock left *before* this move: Andy's previous clock reading.
      clock: ply >= 2 ? clocks[ply - 2] ?? null : null,
      base: tc ? Number(tc[1]) : null,
      inc: tc ? Number(tc[2] ?? 0) : 0,
    });
  });
  return out;
}

/* ---- main --------------------------------------------------------------- */
async function main() {
  const { games } = JSON.parse(readFileSync(GAMES, 'utf8'));
  const done = new Set();
  if (existsSync(OUT)) {
    for (const line of readFileSync(OUT, 'utf8').split('\n')) {
      if (line) done.add(JSON.parse(line).url);
    }
  }
  const todo = selectGames(games).filter((g) => !done.has(g.url));
  const totalPositions = todo.reduce((s, g) => s + andyPositions(g).length, 0);
  console.log(
    `${todo.length} games to grade (${done.size} cached), ~${totalPositions} positions, ` +
      `${WORKERS} engines × ${NODES} nodes each.`,
  );

  let next = 0;
  let graded = 0;
  const t0 = Date.now();

  async function worker() {
    const sf = new Engine();
    await sf.init();
    while (next < todo.length) {
      const game = todo[next++];
      const positions = [];
      for (const p of andyPositions(game)) {
        const top = await sf.go(p.fen, { multipv: MULTIPV });
        let played = top.find((c) => c.uci === p.uci);
        if (!played) {
          // Not one of Stockfish's top picks: score it on its own.
          [played] = await sf.go(p.fen, { searchmoves: p.uci });
        }
        positions.push({ ...p, top, played: played ?? null });
        graded++;
      }
      appendFileSync(
        OUT,
        JSON.stringify({
          url: game.url,
          timeClass: game.timeClass,
          endTime: game.endTime,
          andyColor: game.andyColor,
          andyRating: game.andyRating,
          oppRating: game.oppRating,
          result: game.andyResult,
          positions,
        }) + '\n',
      );
      const rate = graded / ((Date.now() - t0) / 1000);
      process.stdout.write(
        `\r  ${graded}/${totalPositions} positions (${rate.toFixed(1)}/s)        `,
      );
    }
    sf.quit();
  }

  await Promise.all(Array.from({ length: WORKERS }, worker));
  console.log(`\nWrote ${OUT}`);
}

main().catch((err) => {
  console.error('annotate failed:', err);
  process.exit(1);
});
