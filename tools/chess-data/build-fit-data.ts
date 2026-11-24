/* build-fit-data.ts — the humanizer's training set.

   For every position Andy faced in the Stockfish-annotated games, run the
   bot's own engine at the bot's own budget and record, for each legal move,
   its glance / reply / deep scores and habit features, plus the context
   features and which move Andy actually played. fit-human.ts fits the choice
   model to this.

   Run (bundled, multi-threaded): tools/chess-data/run.sh tools/chess-data/build-fit-data.ts */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { Position, isCaptureMove, moveToUci, parseSq } from '../../src/chess/engine/core/position';
import { Searcher } from '../../src/chess/engine/core/search';
import {
  SEARCH_NODES,
  contextFeatures,
  habitFeatures,
} from '../../src/chess/engine/human/model';

const CACHE = resolve(process.cwd(), 'tools/chess-data/cache');

type Job = {
  url: string;
  timeClass: string;
  rating: number;
  ply: number;
  moves: string[]; // the game so far, as UCI
  played: string;
  sf: { top: { uci: string; cp: number | null; mate: number | null }[]; played: { cp: number | null; mate: number | null } | null };
  clock: number | null;
  base: number | null;
};

function sfCp(s: { cp: number | null; mate: number | null } | null): number | null {
  if (!s) return null;
  if (s.mate !== null) return s.mate > 0 ? 3000 - s.mate : -3000 - s.mate;
  return s.cp;
}

function run(job: Job, searcher: Searcher, pos: Position) {
  pos.setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  let lastCaptureTo = -1;
  for (const u of job.moves) {
    const m = pos.findMove(u.slice(0, 2), u.slice(2, 4), u[4]);
    const capture = isCaptureMove(m);
    pos.make(m);
    lastCaptureTo = capture ? parseSq(u.slice(2, 4)) : -1;
  }
  searcher.clear();
  const analysis = searcher.analyzeRoot({ depth: 64, nodes: SEARCH_NODES });
  const ctx = { lastCaptureTo, ply: job.ply, blitz: job.timeClass === 'blitz', rating: job.rating };
  const context = Array.from(contextFeatures(pos, analysis, ctx));
  const moves = analysis.moves.map((rm) => ({
    uci: moveToUci(rm.move),
    g: rm.glance,
    r: rm.reply,
    d: rm.deep,
    h: Array.from(habitFeatures(pos, rm.move, ctx)),
  }));
  const andy = moves.findIndex((m) => m.uci === job.played);
  return {
    url: job.url,
    timeClass: job.timeClass,
    rating: job.rating,
    ply: job.ply,
    depth: analysis.depth,
    context,
    moves,
    andy,
    sfBest: sfCp(job.sf.top[0] ?? null),
    sfPlayed: sfCp(job.sf.played),
    sfTop: job.sf.top.map((t) => ({ uci: t.uci, cp: sfCp(t) })),
    clock: job.clock,
    base: job.base,
  };
}

if (isMainThread) {
  const games = new Map<string, string>();
  for (const g of JSON.parse(readFileSync(resolve(CACHE, 'games.json'), 'utf8')).games) {
    if (g.url && g.pgn) games.set(g.url, g.pgn);
  }
  const jobs: Job[] = [];
  for (const line of readFileSync(resolve(CACHE, 'annotations.jsonl'), 'utf8').split('\n')) {
    if (!line) continue;
    const a = JSON.parse(line);
    const pgn = games.get(a.url);
    if (!pgn) continue;
    const chess = new Chess();
    chess.loadPgn(pgn);
    const uci = chess.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    for (const p of a.positions) {
      jobs.push({
        url: a.url,
        timeClass: a.timeClass,
        rating: a.andyRating,
        ply: p.ply,
        moves: uci.slice(0, p.ply),
        played: p.uci,
        sf: { top: p.top, played: p.played },
        clock: p.clock,
        base: p.base,
      });
    }
  }
  // Incremental: keep positions already analysed (same game + ply).
  const outPath = resolve(CACHE, 'fit-data.json');
  const out: { url: string; ply: number }[] = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, 'utf8'))
    : [];
  const have = new Set(out.map((r) => `${r.url}#${r.ply}`));
  const todo = jobs.filter((j) => !have.has(`${j.url}#${j.ply}`));
  jobs.length = 0;
  jobs.push(...todo);
  const n = Math.max(1, Number(process.argv[2] ?? cpus().length));
  console.log(`${jobs.length} new positions (${have.size} cached), ${n} workers, ${SEARCH_NODES} nodes each`);
  let done = 0;
  const t0 = Date.now();
  const self = fileURLToPath(import.meta.url);
  await Promise.all(
    Array.from({ length: n }, (_, w) =>
      new Promise<void>((res, rej) => {
        const worker = new Worker(self, { workerData: jobs.filter((_, i) => i % n === w) });
        worker.on('message', (r) => {
          out.push(r);
          if (++done % 100 === 0) {
            process.stdout.write(`\r  ${done}/${jobs.length} (${(done / ((Date.now() - t0) / 1000)).toFixed(1)}/s)   `);
          }
        });
        worker.on('error', rej);
        worker.on('exit', () => res());
      }),
    ),
  );
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`\nWrote ${out.length} positions to cache/fit-data.json`);
} else {
  const pos = new Position();
  const searcher = new Searcher(pos);
  for (const job of workerData as Job[]) parentPort!.postMessage(run(job, searcher, pos));
}
