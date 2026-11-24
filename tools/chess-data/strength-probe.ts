/* strength-probe.ts — how strong would the humanizer play, judged by
   Stockfish, at different strength settings? On Andy's positions from his
   recent rapid games (where Stockfish graded the top moves), compare:
     Andy  — how often his move was within 50 / 100 cp of Stockfish's best
     model — how much probability the model puts on such moves
   Moves Stockfish didn't grade count as worse than 100 cp (conservative).
   Settings are applied to the raw fit (the shipped calibration is ignored).
   Run: tools/chess-data/run.sh tools/chess-data/strength-probe.ts [since] [tauScales] [deepShifts]
        e.g. ... strength-probe.ts 2026-07 0.5,0.35,0.25 2,3,4 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decide, skillFeatures, type HumanModel } from '../../src/chess/engine/human/model';
import human from '../../src/chess/data/human-model.json';

type Raw = {
  url: string; timeClass: string; rating: number; ply: number; context: number[];
  moves: { uci: string; g: number; r: number; d: number; h: number[] }[];
  andy: number; sfTop: { uci: string; cp: number | null }[]; sfBest: number | null; sfPlayed: number | null;
};
const all: Raw[] = JSON.parse(readFileSync(resolve('tools/chess-data/cache/fit-data.json'), 'utf8'));
const since = process.argv[2] ?? '2026-07';
const games = new Map<string, number>();
for (const g of JSON.parse(readFileSync(resolve('tools/chess-data/cache/games.json'), 'utf8')).games) games.set(g.url, g.endTime);
const month = (u: string) => new Date((games.get(u) ?? 0) * 1000).toISOString().slice(0, 7);
const data = all.filter((r) => r.timeClass === 'rapid' && month(r.url) >= since && r.andy >= 0 && r.sfBest !== null && r.moves.length > 1);

const base = human.model as unknown as HumanModel;
function probe(model: HumanModel, rating: number) {
  let andy50 = 0, andy100 = 0, m50 = 0, m100 = 0;
  for (const r of data) {
    const loss = new Map<string, number>();
    for (const t of r.sfTop) if (t.cp !== null && r.sfBest !== null) loss.set(t.uci, Math.max(0, r.sfBest - t.cp));
    const aL = r.sfBest! - (r.sfPlayed ?? -1e9);
    if (aL < 50) andy50++;
    if (aL < 100) andy100++;
    const context = Float64Array.from([...r.context.slice(0, 8), ...skillFeatures(rating, false)]);
    context[7] = 0; // as rapid
    const analysis = { moves: r.moves.map((m) => ({ move: 0, glance: m.g, reply: m.r, deep: m.d })), depth: 0, nodes: 0, bestMove: 0, bestScore: Math.max(...r.moves.map((m) => m.d)) };
    const d = decide(model, analysis, r.moves.map((m) => Float64Array.from(m.h)), context);
    r.moves.forEach((m, i) => {
      const L = loss.get(m.uci);
      if (L !== undefined && L < 50) m50 += d.probs[i];
      if (L !== undefined && L < 100) m100 += d.probs[i];
    });
  }
  return { n: data.length, andy50: andy50 / data.length, andy100: andy100 / data.length, m50: m50 / data.length, m100: m100 / data.length };
}
const pct = (x: number) => (100 * x).toFixed(1) + '%';
{
  // Same yardstick for everyone: a move only counts if Stockfish graded it.
  let andyTop = 0;
  const argmax = { glance: 0, reply: 0, deep: 0 };
  for (const r of data) {
    const loss = new Map<string, number>();
    for (const t of r.sfTop) if (t.cp !== null && r.sfBest !== null) loss.set(t.uci, Math.max(0, r.sfBest - t.cp));
    const good = (uci: string) => (loss.get(uci) ?? 1e9) < 50;
    if (good(r.moves[r.andy].uci)) andyTop++;
    for (const k of ['glance', 'reply', 'deep'] as const) {
      const key = k[0] as 'g' | 'r' | 'd';
      let b = 0;
      for (let i = 1; i < r.moves.length; i++) if (r.moves[i][key] > r.moves[b][key]) b = i;
      if (good(r.moves[b].uci)) argmax[k]++;
    }
  }
  const n = data.length;
  console.log(`graded-moves-only: Andy ${pct(andyTop / n)} | engine top pick at glance ${pct(argmax.glance / n)}, reply ${pct(argmax.reply / n)}, deep ${pct(argmax.deep / n)}`);
}
const first = probe(base, 1900);
console.log(`${first.n} of Andy's rapid positions since ${since}: Andy within 50cp ${pct(first.andy50)}, within 100cp ${pct(first.andy100)}`);
for (const tau of (process.argv[3] ?? '1,0.5,0.35,0.25').split(',').map(Number)) {
  for (const deep of (process.argv[4] ?? '0,1,2').split(',').map(Number)) {
    const m: HumanModel = { ...base, tau: base.tau.map((t) => t * tau) as [number, number, number], deepLogit: base.deepLogit.map((w, i) => (i === 0 ? w + deep : w)) };
    const r = probe(m, 1900);
    console.log(`tau×${tau} deep+${deep}: model within 50cp ${pct(r.m50)}, within 100cp ${pct(r.m100)}`);
  }
}
