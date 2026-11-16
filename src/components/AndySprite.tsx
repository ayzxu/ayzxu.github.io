/* AndySprite — a 24×24 1-bit pixel portrait of Andy for the chess window.

   The art is authored as character grids (X = black, o = white, . = clear):
   one base bust plus small patches for eyes, mouth and props, composed into
   frames and flattened to crisp-edged SVG paths once at module load. Each mood
   is a short loop of those frames. Frames advance on a JS timer rather than a
   CSS animation, so the sprite keeps moving for visitors whose OS asks for
   reduced motion — it is a blink-sized frame swap, not movement across the
   screen. */

import { useEffect, useState } from 'react';
import type { AndyMood } from '../chess/andyMood';

const SIZE = 24;

const BASE = [
  '........................',
  '.........XXXXXX.........',
  '......XXXXXXXXXXXX......',
  '.....XXXooXXXXXXXXX.....',
  '....XXXoXXXXXXXXXXXX....',
  '....XXXXXXXXXXXXXXXX....',
  '....XXXXXXXooXXXXXXX....',
  '....XXXXXXooooXXXXXX....',
  '....XXXXXooooooXXXXX....',
  '....XXXXooooooooXXXX....',
  '.....XXooooooooooXX.....',
  '....XoXooooooooooXoX....',
  '....XoXooooooooooXoX....',
  '.....XXooooooooooXX.....',
  '......XooooooooooX......',
  '......XooooooooooX......',
  '.......XooooooooX.......',
  '........XXXXXXXX........',
  '.........XooooX.........',
  '......XXXooXXooXXX......',
  '....XXXXXooXXooXXXXX....',
  '...XXXXXXXoXXoXXXXXXX...',
  '...XXXXXXXoXXoXXXXXXX...',
  '...XXXXXXXoXXoXXXXXXX...',
];

/** A patch painted over the base at (x, y); a space leaves the pixel alone. */
type Patch = readonly [x: number, y: number, ...rows: string[]];

// Eyes
const EYES_OPEN: Patch = [9, 11, 'XX  XX', 'XX  XX'];
const EYES_SHUT: Patch = [9, 12, 'XX  XX'];
const EYES_UP_RIGHT: Patch = [10, 10, 'XX  XX', 'XX  XX'];
const EYES_UP_LEFT: Patch = [8, 10, 'XX  XX', 'XX  XX'];
const EYES_WIDE: Patch = [8, 10, 'XXX  XXX', 'XoX  XoX', 'XXX  XXX'];
const EYES_SIDE: Patch = [8, 11, 'XXX  XXX', ' XX   XX'];
const BROWS_SAD: Patch = [8, 10, ' X    X ', 'X      X'];
const EYES_DOTS: Patch = [10, 12, 'X   X'];
const BROW_UP: Patch = [13, 9, 'XXX'];
const SHADES: Patch = [6, 10, 'XXXXXXXXXXXX', ' XXXX  XXXX ', ' XXXX  XXXX ', '  XX    XX  '];
const GLINT_LEFT: Patch = [8, 11, 'o'];
const GLINT_RIGHT: Patch = [14, 11, 'o'];

// Mouths
const SMILE: Patch = [9, 14, 'X    X', ' XXXX '];
const FLAT: Patch = [10, 15, 'XXXX'];
const HMM: Patch = [9, 14, 'XX'];
const GASP: Patch = [10, 14, 'XXXX', 'XooX', 'XXXX'];
const SMIRK: Patch = [10, 14, '    X', 'XXXX '];
const GRIN: Patch = [9, 14, 'XXXXXX', 'XooooX', ' XXXX '];
const FROWN: Patch = [9, 15, ' XXXX ', 'X    X'];

// Props. Anything beside the head keeps a clear column next to the hair
// (which spans columns 4-19), or it fuses with the silhouette.
const CHIN_FIST: Patch = [
  10, 16,
  '  XXXX  ',
  ' XooooX ',
  ' XooooX ',
  ' XooooX ',
  'oXXXXXXo',
  'oXXXXXXo',
  'oXXXXXXo',
  'oXXXXXXo',
];
const THOUGHT_1: Patch = [21, 6, 'XX', 'XX'];
const THOUGHT_2: Patch = [21, 1, 'XXX', 'XoX', 'XXX'];
// The sweat bead is drawn in white on the hair, where it reads at this size.
const SWEAT_HIGH: Patch = [14, 2, ' o ', 'ooo', 'ooo'];
const SWEAT_LOW: Patch = [14, 4, ' o ', 'ooo', 'ooo'];
const TEARS_SHORT: Patch = [8, 13, 'X      X', 'X      X'];
const TEARS_LONG: Patch = [8, 13, 'X      X', '        ', 'X      X'];
const SPARK_TOP_LEFT: Patch = [0, 2, ' X ', 'XXX', ' X '];
const SPARK_LOW_RIGHT: Patch = [21, 9, ' X ', 'XXX', ' X '];
const SPARK_TOP_RIGHT: Patch = [21, 2, ' X ', 'XXX', ' X '];
const SPARK_LOW_LEFT: Patch = [0, 9, ' X ', 'XXX', ' X '];

type Frame = { black: string; white: string };

/** Paint patches over a copy of the base and flatten to two SVG paths.
    `dip` lowers the whole drawing by one row for the down-beat of a bounce:
    the bottom rows of the jacket are identical, so the row that scrolls off
    is not missed and he reads as sinking into his seat. */
function compose(dip: boolean, patches: Patch[]): Frame {
  let grid = BASE.map((row) => row.padEnd(SIZE, '.').slice(0, SIZE).split(''));
  for (const [x, y, ...rows] of patches) {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx];
        const px = x + dx;
        const py = y + dy;
        if (ch === ' ' || px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;
        grid[py][px] = ch;
      }
    });
  }
  if (dip) grid = [Array<string>(SIZE).fill('.'), ...grid.slice(0, SIZE - 1)];
  // One sub-path per horizontal run keeps each frame to a few hundred bytes.
  const runs = (ink: string): string => {
    let d = '';
    for (let y = 0; y < SIZE; y++) {
      let x = 0;
      while (x < SIZE) {
        if (grid[y][x] !== ink) {
          x++;
          continue;
        }
        const start = x;
        while (x < SIZE && grid[y][x] === ink) x++;
        d += `M${start} ${y}h${x - start}v1h${start - x}z`;
      }
    }
    return d;
  };
  return { black: runs('X'), white: runs('o') };
}

type Step = { frame: Frame; ms: number };
const step = (ms: number, ...patches: Patch[]): Step => ({
  frame: compose(false, patches),
  ms,
});
/** The same frame one row lower — the down-beat of a bounce. */
const dip = (ms: number, ...patches: Patch[]): Step => ({
  frame: compose(true, patches),
  ms,
});

/* Half a bounce. Idle keeps this beat throughout; the blinks are cut out of an
   up-beat so they never knock the bounce off rhythm. */
const BEAT = 460;

const SEQUENCES: Record<AndyMood, Step[]> = {
  idle: [
    step(BEAT, EYES_OPEN, SMILE),
    dip(BEAT, EYES_OPEN, SMILE),
    step(BEAT, EYES_OPEN, SMILE),
    dip(BEAT, EYES_OPEN, SMILE),
    step(140, EYES_SHUT, SMILE),
    step(BEAT - 140, EYES_OPEN, SMILE),
    dip(BEAT, EYES_OPEN, SMILE),
    step(BEAT, EYES_OPEN, SMILE),
    dip(BEAT, EYES_OPEN, SMILE),
    step(BEAT, EYES_OPEN, SMILE),
    dip(BEAT, EYES_OPEN, SMILE),
    step(140, EYES_SHUT, SMILE),
    step(BEAT - 140, EYES_OPEN, SMILE),
    dip(BEAT, EYES_OPEN, SMILE),
  ],
  thinking: [
    step(380, EYES_UP_RIGHT, HMM, CHIN_FIST),
    step(380, EYES_UP_RIGHT, HMM, CHIN_FIST, THOUGHT_1),
    step(700, EYES_UP_RIGHT, HMM, CHIN_FIST, THOUGHT_1, THOUGHT_2),
    step(380, EYES_UP_LEFT, HMM, CHIN_FIST),
    step(380, EYES_UP_LEFT, HMM, CHIN_FIST, THOUGHT_1),
    step(700, EYES_UP_LEFT, HMM, CHIN_FIST, THOUGHT_1, THOUGHT_2),
  ],
  sweating: [
    step(320, EYES_WIDE, GASP, SWEAT_HIGH),
    step(320, EYES_WIDE, GASP, SWEAT_LOW, THOUGHT_1),
    step(320, EYES_WIDE, FLAT, SWEAT_HIGH, THOUGHT_1, THOUGHT_2),
    step(320, EYES_WIDE, FLAT, SWEAT_LOW),
  ],
  smug: [
    step(240, EYES_SIDE, SMIRK, BROW_UP),
    step(240, EYES_SIDE, SMIRK),
    step(240, EYES_SIDE, SMIRK, BROW_UP),
    // then he settles into the same bounce as idle, still smirking
    dip(BEAT, EYES_SIDE, SMIRK),
    step(BEAT, EYES_SIDE, SMIRK),
    dip(BEAT, EYES_SIDE, SMIRK),
    step(BEAT, EYES_SIDE, SMIRK),
    dip(BEAT, EYES_SIDE, SMIRK),
    step(140, EYES_SHUT, SMIRK),
  ],
  oops: [
    step(360, EYES_WIDE, GASP, SWEAT_HIGH),
    step(360, EYES_WIDE, GASP, SWEAT_LOW),
    step(900, EYES_WIDE, FLAT),
  ],
  win: [
    step(320, SHADES, GLINT_LEFT, GRIN, SPARK_TOP_LEFT, SPARK_LOW_RIGHT),
    step(320, SHADES, GLINT_RIGHT, GRIN, SPARK_TOP_RIGHT, SPARK_LOW_LEFT),
    step(320, SHADES, GRIN, SPARK_TOP_LEFT, SPARK_LOW_RIGHT),
    step(320, SHADES, GRIN, SPARK_TOP_RIGHT, SPARK_LOW_LEFT),
  ],
  loss: [
    step(360, BROWS_SAD, EYES_SHUT, FROWN, TEARS_SHORT),
    step(360, BROWS_SAD, EYES_SHUT, FROWN, TEARS_LONG),
  ],
  draw: [
    step(2200, EYES_SHUT, FLAT),
    step(900, EYES_DOTS, FLAT),
  ],
  // A single frame on purpose: he froze.
  frozen: [step(1000, EYES_DOTS, FLAT)],
};

const LABELS: Record<AndyMood, string> = {
  idle: 'Andy, waiting for your move',
  thinking: 'Andy, thinking',
  sweating: 'Andy, thinking and sweating',
  smug: 'Andy, looking smug',
  oops: 'Andy, looking worried',
  win: 'Andy, celebrating',
  loss: 'Andy, crying',
  draw: 'Andy, unimpressed',
  frozen: 'Andy, frozen',
};

/* Split out so the parent can remount it with key={mood}: every mood change
   then starts its loop from frame 0 without an effect that resets state. */
function SpriteLoop({ steps }: { steps: Step[] }) {
  const [index, setIndex] = useState(0);
  const current = steps[index % steps.length];

  useEffect(() => {
    if (steps.length < 2) return;
    const timer = window.setTimeout(
      () => setIndex((n) => (n + 1) % steps.length),
      current.ms,
    );
    return () => window.clearTimeout(timer);
  }, [steps, index, current.ms]);

  return (
    <>
      <path d={current.frame.white} fill="#ffffff" />
      <path d={current.frame.black} fill="#000000" />
    </>
  );
}

type AndySpriteProps = { mood: AndyMood; className?: string };

export default function AndySprite({ mood, className }: AndySpriteProps) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={LABELS[mood]}
      data-mood={mood}
    >
      <SpriteLoop key={mood} steps={SEQUENCES[mood]} />
    </svg>
  );
}
