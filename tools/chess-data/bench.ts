/* bench.ts — search sanity: tactics solved and speed at the bot's budget.
   Run: npx jiti tools/chess-data/bench.ts [nodes] */
import { Position, moveToUci } from '../../src/chess/engine/core/position';
import { Searcher } from '../../src/chess/engine/core/search';
import { Chess } from 'chess.js';

const WAC: [string, string][] = [
  ['2rr3k/pp3pp1/1nnqbN1p/3pN3/2pP4/2P3Q1/PPB4P/R4RK1 w - - 0 1', 'Qg6'],
  ['8/7p/5k2/5p2/p1p2P2/Pr1pPK2/1P1R3P/8 b - - 0 1', 'Rxb2'],
  ['5rk1/1ppb3p/p1pb4/6q1/3P1p1r/2P1R2P/PP1BQ1P1/5RKN w - - 0 1', 'Rg3'],
  ['r1bq2rk/pp3pbp/2p1p1pQ/7P/3P4/2PB1N2/PP3PPR/2KR4 w - - 0 1', 'Qxh7+'],
  ['5k2/6pp/p1qN4/1p1p4/3P4/2PKP2Q/PP3r2/3R4 b - - 0 1', 'Qc4+'],
  ['7k/p7/1R5K/6r1/6p1/6P1/8/8 w - - 0 1', 'Rb7'],
  ['rnbqkb1r/pppp1ppp/8/4P3/6n1/7P/PPPNPPP1/R1BQKBNR b KQkq - 0 1', 'Ne3'],
  ['r4q1k/p2bR1rp/2p2Q1N/5p2/5p2/2P5/PP3PPP/R5K1 w - - 0 1', 'Rf7'],
  ['3q1rk1/p4pp1/2pb3p/3p4/6Pr/1PNQ4/P1PB1PP1/4RRK1 b - - 0 1', 'Bh2+'],
  ['2br2k1/2q3rn/p2NppQ1/2p1P3/Pp5R/4P3/1P3PPP/3R2K1 w - - 0 1', 'Rxh7'],
];
const nodes = Number(process.argv[2] ?? 300000);
let solved = 0;
let totalNodes = 0;
let totalMs = 0;
for (const [fen, bm] of WAC) {
  const pos = Position.fromFen(fen);
  const s = new Searcher(pos);
  const t0 = Date.now();
  const r = s.think({ depth: 64, nodes });
  const ms = Date.now() - t0;
  totalNodes += s.nodes;
  totalMs += ms;
  const uci = moveToUci(r.move);
  const c = new Chess(fen);
  const san = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  const ok = san === bm;
  if (ok) solved++;
  console.log(`${ok ? 'ok  ' : 'miss'} ${san.padEnd(6)} (want ${bm.padEnd(6)}) d${r.depth} ${r.score}cp ${ms}ms`);
}
console.log(`solved ${solved}/${WAC.length}, ${Math.round(totalNodes / totalMs)}k nps`);
