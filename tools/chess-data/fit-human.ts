/* fit-human.ts — fit the humanizer (src/chess/engine/human/model.ts) to the
   moves Andy actually played, by maximum likelihood.

   Input: cache/fit-data.json from build-fit-data.ts. Games are split 80/20 by
   URL; the model is fitted on the 80 and judged on the held-out 20:
     • move-match: how often the model's most likely move is Andy's move,
       against "the engine's best move" as a baseline
     • log-likelihood per move
     • the size of the mistakes it makes vs the ones Andy made

   Output: src/chess/data/human-model.json

   Run: tools/chess-data/run.sh tools/chess-data/fit-human.ts */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTEXT, HABITS, skillFeatures, type HumanModel } from '../../src/chess/engine/human/model';

const CACHE = resolve(process.cwd(), 'tools/chess-data/cache');
const OUT = resolve(process.cwd(), 'src/chess/data/human-model.json');

type Raw = {
  url: string;
  timeClass: string;
  rating: number;
  ply: number;
  context: number[];
  moves: { uci: string; g: number; r: number; d: number; h: number[] }[];
  andy: number;
  sfBest: number | null;
  sfPlayed: number | null;
};

const CLAMP = 1500;
const clampCp = (v: number) => Math.max(-CLAMP, Math.min(CLAMP, v));
/** Value scale the choice is made on: 'win' = winning chances in % (how a
    person weighs a position), 'cp' = raw centipawns */
const SCALE = process.argv.includes('--cp') ? 'cp' : 'win';
const toScale = (cp: number) =>
  SCALE === 'win' ? 100 / (1 + Math.exp(-0.00368208 * clampCp(cp))) : clampCp(cp);

/* Flatten for speed: per position, typed arrays of values and habits */
type Pos = {
  n: number;
  vals: [Float64Array, Float64Array, Float64Array];
  habits: Float64Array; // n × H
  /** deep score in cp, for measuring mistakes */
  deepCp: Float64Array;
  context: Float64Array;
  andy: number;
  bestDeep: number;
  blitz: boolean;
  /** likelihood weight: rapid counts double, blitz mostly teaches the shape
      of the mistakes (there are far more blitz games, and more blunders) */
  weight: number;
  url: string;
  sfLoss: number | null;
};

const RAPID_WEIGHT = 2;

const H = HABITS.length;
const C = CONTEXT.length;

function prep(r: Raw): Pos {
  const n = r.moves.length;
  const vals: [Float64Array, Float64Array, Float64Array] = [
    new Float64Array(n),
    new Float64Array(n),
    new Float64Array(n),
  ];
  const habits = new Float64Array(n * H);
  const deepCp = new Float64Array(n);
  r.moves.forEach((m, i) => {
    vals[0][i] = toScale(m.g);
    vals[1][i] = toScale(m.r);
    vals[2][i] = toScale(m.d);
    deepCp[i] = clampCp(m.d);
    for (let k = 0; k < H; k++) habits[i * H + k] = m.h[k];
  });
  return {
    n,
    vals,
    habits,
    // The first eight context features come from the engine pass; the skill
    // features are rebuilt from the game's rating so they can change freely.
    context: Float64Array.from([
      ...r.context.slice(0, 8),
      ...skillFeatures(r.rating, r.timeClass === 'blitz'),
    ]),
    andy: r.andy,
    deepCp,
    bestDeep: Math.max(...deepCp),
    blitz: r.timeClass === 'blitz',
    weight: r.timeClass === 'blitz' ? 1 : RAPID_WEIGHT,
    url: r.url,
    sfLoss:
      r.sfBest !== null && r.sfPlayed !== null
        ? Math.max(0, Math.min(1000, r.sfBest) - Math.max(-1000, r.sfPlayed))
        : null,
  };
}

/* --- parameters <-> vector --------------------------------------------------- */
const NP = 3 + C + C + H;
/** habit weights are optimised in these units (keeps the step sizes even) */
const HABIT_UNIT = SCALE === 'win' ? 1 : 10;
function unpack(theta: Float64Array): HumanModel {
  return {
    tau: [Math.exp(theta[0]), Math.exp(theta[1]), Math.exp(theta[2])],
    replyLogit: Array.from(theta.subarray(3, 3 + C)),
    deepLogit: Array.from(theta.subarray(3 + C, 3 + 2 * C)),
    habit: Array.from(theta.subarray(3 + 2 * C)).map((w) => w * HABIT_UNIT),
  };
}

/* --- likelihood ----------------------------------------------------------- */
const scratch = new Float64Array(512);
const habitScratch = new Float64Array(512);

/** Per-move choice probabilities under the model (into `out`). */
function probs(m: HumanModel, p: Pos, out: Float64Array): void {
  const { n } = p;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < H; k++) s += m.habit[k] * p.habits[i * H + k];
    habitScratch[i] = s;
  }
  let rl = 0;
  let dl = 0;
  for (let k = 0; k < C; k++) {
    rl += m.replyLogit[k] * p.context[k];
    dl += m.deepLogit[k] * p.context[k];
  }
  const er = Math.exp(Math.max(-30, Math.min(30, rl)));
  const ed = Math.exp(Math.max(-30, Math.min(30, dl)));
  const z = 1 + er + ed;
  const w = [1 / z, er / z, ed / z];
  for (let i = 0; i < n; i++) out[i] = 0;
  for (let l = 0; l < 3; l++) {
    const v = p.vals[l];
    const tau = Math.max(1, m.tau[l]);
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      scratch[i] = v[i] + habitScratch[i];
      if (scratch[i] > max) max = scratch[i];
    }
    let s = 0;
    for (let i = 0; i < n; i++) {
      scratch[i] = Math.exp((scratch[i] - max) / tau);
      s += scratch[i];
    }
    for (let i = 0; i < n; i++) out[i] += (w[l] * scratch[i]) / s;
  }
}

const outBuf = new Float64Array(512);
function nll(theta: Float64Array, data: Pos[]): number {
  const m = unpack(theta);
  let s = 0;
  let w = 0;
  for (const p of data) {
    probs(m, p, outBuf);
    s -= p.weight * Math.log(Math.max(1e-12, outBuf[p.andy]));
    w += p.weight;
  }
  // Light ridge on the habits and level logits keeps rare features sane.
  let reg = 0;
  for (let i = 3; i < NP; i++) reg += theta[i] * theta[i];
  return s / w + 0.0005 * reg;
}

/* --- optimizer: Adam on central-difference gradients ------------------------ */
function fit(data: Pos[], theta: Float64Array, steps: number): Float64Array {
  const mom = new Float64Array(NP);
  const vel = new Float64Array(NP);
  const g = new Float64Array(NP);
  const lr = 0.03;
  const eps = 1e-3;
  for (let t = 1; t <= steps; t++) {
    // Stochastic: a fresh minibatch each step.
    const batch: Pos[] = [];
    for (let i = 0; i < 600; i++) batch.push(data[Math.floor(Math.random() * data.length)]);
    for (let k = 0; k < NP; k++) {
      const x = theta[k];
      theta[k] = x + eps;
      const up = nll(theta, batch);
      theta[k] = x - eps;
      const dn = nll(theta, batch);
      theta[k] = x;
      g[k] = (up - dn) / (2 * eps);
    }
    for (let k = 0; k < NP; k++) {
      mom[k] = 0.9 * mom[k] + 0.1 * g[k];
      vel[k] = 0.999 * vel[k] + 0.001 * g[k] * g[k];
      const mh = mom[k] / (1 - 0.9 ** t);
      const vh = vel[k] / (1 - 0.999 ** t);
      theta[k] -= (lr * mh) / (Math.sqrt(vh) + 1e-8);
    }
    if (t % 50 === 0) console.log(`  step ${t}: train nll ${nll(theta, data).toFixed(4)}`);
  }
  return theta;
}

/* --- evaluation ------------------------------------------------------------- */
function report(label: string, m: HumanModel, data: Pos[]) {
  let match = 0;
  let engineMatch = 0;
  let nllSum = 0;
  let andyLoss = 0;
  let modelLoss = 0;
  const bins = { andy: [0, 0, 0, 0], model: [0, 0, 0, 0] }; // <50, 50-100, 100-300, 300+
  const bin = (x: number) => (x < 50 ? 0 : x < 100 ? 1 : x < 300 ? 2 : 3);
  for (const p of data) {
    probs(m, p, outBuf);
    let arg = 0;
    for (let i = 1; i < p.n; i++) if (outBuf[i] > outBuf[arg]) arg = i;
    if (arg === p.andy) match++;
    let best = 0;
    for (let i = 1; i < p.n; i++) if (p.deepCp[i] > p.deepCp[best]) best = i;
    if (best === p.andy) engineMatch++;
    nllSum -= Math.log(Math.max(1e-12, outBuf[p.andy]));
    const aL = Math.min(1000, p.bestDeep - p.deepCp[p.andy]);
    andyLoss += aL;
    bins.andy[bin(aL)]++;
    for (let i = 0; i < p.n; i++) {
      const L = Math.min(1000, p.bestDeep - p.deepCp[i]);
      modelLoss += outBuf[i] * L;
      bins.model[bin(L)] += outBuf[i];
    }
  }
  const N = data.length;
  const pct = (x: number) => ((100 * x) / N).toFixed(1) + '%';
  console.log(
    `${label}: ${N} moves | model predicts Andy's move ${pct(match)} (engine's best: ${pct(engineMatch)}) | nll ${(nllSum / N).toFixed(3)}`,
  );
  console.log(
    `   avg loss (engine cp): Andy ${(andyLoss / N).toFixed(0)} vs model ${(modelLoss / N).toFixed(0)}` +
      ` | <50/50-100/100-300/300+: Andy ${bins.andy.map(pct).join(' ')} · model ${bins.model.map(pct).join(' ')}`,
  );
  return { moves: N, matchPct: (100 * match) / N, engineMatchPct: (100 * engineMatch) / N, nll: nllSum / N };
}

/* --- main ----------------------------------------------------------------- */
const raw: Raw[] = JSON.parse(readFileSync(resolve(CACHE, 'fit-data.json'), 'utf8'));
const all = raw.filter((r) => r.andy >= 0 && r.moves.length > 1).map(prep);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const test = all.filter((p) => Math.abs(hash(p.url)) % 5 === 0);
const train = all.filter((p) => Math.abs(hash(p.url)) % 5 !== 0);
console.log(`${all.length} positions: ${train.length} train, ${test.length} test`);

const sf = all.filter((p) => p.sfLoss !== null);
for (const tc of ['rapid', 'blitz']) {
  const xs = sf.filter((p) => (tc === 'blitz') === p.blitz).map((p) => p.sfLoss as number);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const share = (lo: number, hi: number) =>
    ((100 * xs.filter((x) => x >= lo && x < hi).length) / xs.length).toFixed(1);
  console.log(
    `Stockfish on Andy's ${tc} moves (${xs.length}): avg loss ${mean.toFixed(0)}cp, ` +
      `inaccuracies ${share(50, 100)}%, mistakes ${share(100, 300)}%, blunders ${share(300, 1e9)}%`,
  );
}

const theta = new Float64Array(NP);
const tau0 = SCALE === 'win' ? 8 : 80;
theta[0] = Math.log(tau0);
theta[1] = Math.log(tau0);
theta[2] = Math.log(tau0);
fit(train, theta, Number(process.argv[2] ?? 400)); // optimises theta in place
const model = unpack(theta);

const r = {
  train: report('train', model, train),
  test: report('test ', model, test),
  testRapid: report('test rapid', model, test.filter((p) => !p.blitz)),
  testBlitz: report('test blitz', model, test.filter((p) => p.blitz)),
};

const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
console.log('\nlevels: τ glance/reply/deep =', model.tau.map((x) => round(x, 1)));
console.log('reply logit:', Object.fromEntries(CONTEXT.map((c, i) => [c, round(model.replyLogit[i], 2)])));
console.log('deep logit: ', Object.fromEntries(CONTEXT.map((c, i) => [c, round(model.deepLogit[i], 2)])));
console.log('habits (cp):', Object.fromEntries(HABITS.map((h, i) => [h, round(model.habit[i], 1)])));

// A refit keeps the strength calibration (set separately; see model.ts).
const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
writeFileSync(
  OUT,
  JSON.stringify(
    {
      calibration: previous.calibration ?? { tauScale: 1, deepShift: 0 },
      meta: {
        source: 'fit-human.ts',
        generatedAt: new Date().toISOString(),
        positions: all.length,
        heldOut: r.test,
        heldOutRapid: r.testRapid,
      },
      scale: SCALE,
      context: CONTEXT,
      habits: HABITS,
      model: {
        scale: SCALE,
        tau: model.tau.map((x) => round(x, 2)),
        replyLogit: model.replyLogit.map((x) => round(x)),
        deepLogit: model.deepLogit.map((x) => round(x)),
        habit: model.habit.map((x) => round(x, 2)),
      },
    },
    null,
    2,
  ) + '\n',
);
console.log(`\nWrote ${OUT}`);
