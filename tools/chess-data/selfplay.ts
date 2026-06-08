/* Self-play / sanity harness for the Andy Chess Bot engine.
   Run: node_modules/.bin/jiti tools/chess-data/selfplay.ts            */
import { Chess } from 'chess.js';
import { chooseMove } from '../../src/chess/engine/andyBot';
import type { AndyProfile, OpeningBook } from '../../src/chess/engine/types';
import book from '../../src/chess/data/opening-book.json';
import profile from '../../src/chess/data/style-profile.json';

const PROFILE = profile as AndyProfile;
const BOOK = book as OpeningBook;

function playGame(maxPlies = 120) {
  const g = new Chess();
  const line: string[] = [];
  const sources: Record<string, number> = {};
  let plies = 0;
  while (!g.isGameOver() && plies < maxPlies) {
    const t0 = Date.now();
    const res = chooseMove(g.fen(), PROFILE, BOOK);
    const dt = Date.now() - t0;
    if (!res) break;
    g.move({ from: res.from, to: res.to, promotion: res.promotion });
    line.push(res.san);
    sources[res.source] = (sources[res.source] ?? 0) + 1;
    if (dt > 600) console.log(`  (slow move ${res.san}: ${dt}ms)`);
    plies++;
  }
  return { line, sources, result: gameResult(g), plies };
}

function gameResult(g: Chess): string {
  if (g.isCheckmate()) return `checkmate (${g.turn() === 'w' ? 'black' : 'white'} wins)`;
  if (g.isStalemate()) return 'stalemate';
  if (g.isInsufficientMaterial()) return 'draw (insufficient material)';
  if (g.isDraw()) return 'draw (50-move/repetition)';
  return 'unfinished';
}

console.log('=== Repertoire checks ===');
const checks: [string, string][] = [
  ['startpos (bot=White)', new Chess().fen()],
  ['after 1.d4 (bot=Black, expect Nf6 KID)', (() => { const c = new Chess(); c.move('d4'); return c.fen(); })()],
  ['after 1.e4 (bot=Black, expect e5)', (() => { const c = new Chess(); c.move('e4'); return c.fen(); })()],
];
for (const [label, fen] of checks) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 40; i++) {
    const r = chooseMove(fen, PROFILE, BOOK);
    if (r) counts[r.san] = (counts[r.san] ?? 0) + 1;
  }
  console.log(`${label}: ${JSON.stringify(counts)}`);
}

console.log('\n=== Self-play games ===');
let maxMoveMs = 0;
for (let i = 0; i < 3; i++) {
  const t0 = Date.now();
  const { line, sources, result, plies } = playGame();
  const avg = Math.round((Date.now() - t0) / Math.max(1, plies));
  maxMoveMs = Math.max(maxMoveMs, avg);
  console.log(`Game ${i + 1}: ${plies} plies, ${result}, ~${avg}ms/move, sources=${JSON.stringify(sources)}`);
  console.log('  ' + line.slice(0, 24).join(' ') + (line.length > 24 ? ' ...' : ''));
}
console.log(`\nAvg move time across games stayed around ${maxMoveMs}ms.`);
