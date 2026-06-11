/* ==========================================================================
   chiptune — a tiny WebAudio chiptune generator for AndyMusic previews.

   Every track gets an ORIGINAL little melody, procedurally generated from a
   per-track seed (these are deliberately not the real songs — just a 1-bit
   Macintosh impression of each one's vibe via bpm, key and style). Four
   voices: square lead, triangle bass, sine kick, filtered-noise hats/snare.
   The whole preview is scheduled up front; stop() silences and cancels.
   ========================================================================== */

export type ChiptuneStyle = 'house' | 'rave' | 'trap' | 'pop' | 'ballad';

export type ChiptuneSpec = {
  seed: number;
  bpm: number;
  /** MIDI note of the bass root, e.g. 45 = A2 */
  root: number;
  minor: boolean;
  style: ChiptuneStyle;
};

/* --- seeded rng ------------------------------------------------------------ */

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/* pentatonic scales for the lead — hard to sound bad */
const MINOR_PENT = [0, 3, 5, 7, 10];
const MAJOR_PENT = [0, 2, 4, 7, 9];
/* chord-root cycles (semitones above the root), one chord per bar */
const MINOR_PROG = [0, 8, 3, 10]; // i  VI  III  VII
const MAJOR_PROG = [0, 7, 9, 5]; // I  V  vi  IV

/** Preview length ≈ 24s, snapped to whole 8-beat blocks. */
export function previewSeconds(spec: ChiptuneSpec): number {
  return totalBeats(spec) * (60 / spec.bpm);
}

function totalBeats(spec: ChiptuneSpec): number {
  return Math.max(32, Math.round((spec.bpm * 24) / 60 / 8) * 8);
}

/* --- engine state ------------------------------------------------------------ */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null; // per-play bus, disconnected on stop
let endTimer: number | null = null;
let volume = 0.6;

function ensureCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume * 0.22;
    master.connect(ctx.destination);
  }
  return ctx;
}

export function setChiptuneVolume(v: number) {
  volume = v;
  if (master && ctx) {
    master.gain.setTargetAtTime(v * 0.22, ctx.currentTime, 0.02);
  }
}

export function getChiptuneVolume(): number {
  return volume;
}

export function stopChiptune() {
  if (endTimer !== null) {
    window.clearTimeout(endTimer);
    endTimer = null;
  }
  if (bus) {
    bus.disconnect();
    bus = null;
  }
}

/* --- generation -------------------------------------------------------------- */

type Motif = (number | null)[]; // pentatonic degree (octave-extended) or rest

/** 16 eighth-note steps of melody: a random walk on the pentatonic with
    rests and repeats, so it phrases like a hook instead of noise. */
function makeMotif(rng: () => number, busy: number): Motif {
  const motif: Motif = [];
  let deg = Math.floor(rng() * 5) + 5; // start mid-register
  for (let i = 0; i < 16; i++) {
    const r = rng();
    if (r > busy) {
      motif.push(null); // rest / let ring
    } else {
      const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)];
      deg = Math.max(2, Math.min(11, deg + step));
      motif.push(deg);
    }
  }
  // land phrase-ends on the root side so it resolves
  motif[14] = 5;
  motif[15] = null;
  return motif;
}

function pentNote(root: number, minor: boolean, deg: number): number {
  const scale = minor ? MINOR_PENT : MAJOR_PENT;
  const oct = Math.floor(deg / scale.length);
  return root + 24 + oct * 12 + scale[deg % scale.length];
}

/** Schedule the whole preview. Returns its duration in seconds. */
export function startChiptune(spec: ChiptuneSpec, onEnded?: () => void): number {
  stopChiptune();
  const ac = ensureCtx();
  void ac.resume();

  bus = ac.createGain();
  bus.gain.value = 1;
  bus.connect(master!);
  const out = bus;

  const rng = mulberry32(spec.seed);
  const beats = totalBeats(spec);
  const steps = beats * 2; // eighth notes
  const stepDur = 60 / spec.bpm / 2;
  const t0 = ac.currentTime + 0.08;
  const prog = spec.minor ? MINOR_PROG : MAJOR_PROG;
  const busy = spec.style === 'ballad' ? 0.55 : spec.style === 'trap' ? 0.6 : 0.72;

  /* motif arrangement: A A B A C A B A … */
  const A = makeMotif(rng, busy);
  const B = makeMotif(rng, busy);
  const C = makeMotif(rng, busy * 0.85);
  const blocks = Math.ceil(steps / 16);
  const order: Motif[] = [];
  for (let i = 0; i < blocks; i++) {
    order.push([A, A, B, A, C, A, B, A][i % 8]);
  }

  /* --- lead: square wave ---------------------------------------------- */
  const lead = ac.createOscillator();
  lead.type = 'square';
  const leadGain = ac.createGain();
  leadGain.gain.value = 0;
  lead.connect(leadGain).connect(out);
  const leadLevel = spec.style === 'ballad' ? 0.14 : 0.18;

  for (let s = 0; s < steps; s++) {
    const deg = order[Math.floor(s / 16)][s % 16];
    const t = t0 + s * stepDur;
    if (deg === null) {
      leadGain.gain.setTargetAtTime(0, t, stepDur * 0.18);
      continue;
    }
    // lead stays in the root pentatonic — consonant over the whole progression
    const note = pentNote(spec.root, spec.minor, deg);
    lead.frequency.setValueAtTime(midiHz(note), t);
    leadGain.gain.setValueAtTime(leadLevel, t);
    leadGain.gain.setTargetAtTime(leadLevel * 0.55, t + stepDur * 0.5, stepDur * 0.3);
  }

  /* --- bass: triangle, follows the chord roots ------------------------- */
  const bass = ac.createOscillator();
  bass.type = 'triangle';
  const bassGain = ac.createGain();
  bassGain.gain.value = 0;
  bass.connect(bassGain).connect(out);
  const pump = spec.style === 'house' || spec.style === 'rave';

  for (let s = 0; s < steps; s++) {
    const t = t0 + s * stepDur;
    const bar = Math.floor(s / 8) % prog.length;
    const chordRoot = spec.root + prog[bar];
    if (spec.style === 'ballad' || spec.style === 'pop') {
      if (s % 4 === 0) {
        const note = s % 8 === 4 ? chordRoot + 7 : chordRoot;
        bass.frequency.setValueAtTime(midiHz(note), t);
        bassGain.gain.setValueAtTime(0.3, t);
        bassGain.gain.setTargetAtTime(0.06, t + stepDur * 2, stepDur);
      }
    } else {
      // octave-bouncing 8ths (house pump) or low 8ths (trap)
      const note = pump && s % 2 === 1 ? chordRoot + 12 : chordRoot;
      bass.frequency.setValueAtTime(midiHz(note), t);
      bassGain.gain.setValueAtTime(0.32, t);
      bassGain.gain.setTargetAtTime(0.02, t + stepDur * 0.55, stepDur * 0.25);
    }
  }

  /* --- kick: pitched-down sine thump ----------------------------------- */
  if (spec.style !== 'ballad') {
    const kick = ac.createOscillator();
    kick.type = 'sine';
    const kickGain = ac.createGain();
    kickGain.gain.value = 0;
    kick.connect(kickGain).connect(out);
    for (let beat = 0; beat < beats; beat++) {
      const onBeat =
        spec.style === 'pop' || spec.style === 'trap' ? beat % 2 === 0 : true;
      if (!onBeat) continue;
      const t = t0 + beat * stepDur * 2;
      kick.frequency.setValueAtTime(160, t);
      kick.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      kickGain.gain.setValueAtTime(0.85, t);
      kickGain.gain.setTargetAtTime(0, t + 0.02, 0.04);
    }
    kick.start(t0);
    kick.stop(t0 + steps * stepDur + 0.3);
  }

  /* --- hats + snare: one looping noise source, gain-gated --------------- */
  const noiseLen = 2;
  const buffer = ac.createBuffer(1, ac.sampleRate * noiseLen, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const noiseGain = ac.createGain();
  noiseGain.gain.value = 0;
  noise.connect(hp).connect(noiseGain).connect(out);

  for (let s = 0; s < steps; s++) {
    const t = t0 + s * stepDur;
    const isOff = s % 2 === 1;
    let level = 0;
    if (spec.style === 'house' || spec.style === 'rave') {
      level = isOff ? 0.16 : 0.05;
    } else if (spec.style === 'trap') {
      level = 0.09; // straight 8ths
    } else if (spec.style === 'pop') {
      level = isOff ? 0 : 0.05;
    } else {
      level = s % 4 === 2 ? 0.04 : 0;
    }
    if (level > 0) {
      noiseGain.gain.setValueAtTime(level, t);
      noiseGain.gain.setTargetAtTime(0, t + 0.012, 0.018);
    }
    // snare on beats 2 & 4 (steps 4 and 12 of each bar)
    if (spec.style !== 'ballad' && (s % 16 === 4 || s % 16 === 12)) {
      noiseGain.gain.setValueAtTime(0.3, t);
      noiseGain.gain.setTargetAtTime(0, t + 0.02, 0.045);
    }
  }

  const endAt = t0 + steps * stepDur;
  lead.start(t0);
  lead.stop(endAt + 0.3);
  bass.start(t0);
  bass.stop(endAt + 0.3);
  noise.start(t0);
  noise.stop(endAt + 0.3);

  const durationMs = (endAt - ac.currentTime) * 1000;
  endTimer = window.setTimeout(() => {
    endTimer = null;
    stopChiptune();
    onEnded?.();
  }, durationMs + 150);

  return steps * stepDur;
}
