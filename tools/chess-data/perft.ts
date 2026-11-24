/* perft.ts — move-generator correctness check against the standard perft
   counts (Chess Programming Wiki). Run: npx jiti tools/chess-data/perft.ts */
import { Position } from '../../src/chess/engine/core/position';

function perft(pos: Position, depth: number, buf: Int32Array[], ply = 0): number {
  if (depth === 0) return 1;
  const moves = buf[ply];
  const n = pos.generate(moves, 0);
  let nodes = 0;
  for (let i = 0; i < n; i++) {
    if (!pos.make(moves[i])) continue;
    nodes += depth === 1 ? 1 : perft(pos, depth - 1, buf, ply + 1);
    pos.unmake();
  }
  return nodes;
}

const CASES: [string, string, number, number][] = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 5, 4865609],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 4, 4085603],
  ['pos3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 5, 674624],
  ['pos4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 4, 422333],
  ['pos5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 4, 2103487],
  ['pos6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', 4, 3894594],
];

const buf = Array.from({ length: 16 }, () => new Int32Array(256));
let ok = true;
for (const [name, fen, depth, expected] of CASES) {
  const pos = Position.fromFen(fen);
  const t0 = Date.now();
  const n = perft(pos, depth, buf);
  const ms = Date.now() - t0;
  const pass = n === expected && pos.toFen() === fen;
  ok &&= pass;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name} d${depth}: ${n} (want ${expected}) ${ms}ms, ${Math.round(n / ms)}k nps`);
}
process.exit(ok ? 0 : 1);
