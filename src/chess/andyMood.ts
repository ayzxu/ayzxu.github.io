/* andyMood.ts — decides how the Andy sprite in the chess window reacts.

   Pure logic, no React: given the move that was just played (and, for Andy's
   own moves, what the engine reported about it) it returns a mood for the
   sprite and an optional line for his speech bubble. Every trigger is a real
   game event — a check, material actually won, the engine's own blunder flag,
   an evaluation swing — so the reactions can't drift out of sync with the
   board the way a timer would. */

import type { Chess, Move, PieceSymbol } from 'chess.js';
import type { MoveSource } from './engine/types';

/** Every pose the sprite can show. `thinking` and `sweating` are the two
    "bot is computing" poses; the last four are driven by game status. */
export type AndyMood =
  | 'idle'
  | 'thinking'
  | 'sweating'
  | 'smug'
  | 'oops'
  | 'win'
  | 'loss'
  | 'draw'
  | 'frozen';

/** What a single move makes Andy do. `line: null` means "say nothing new". */
export type Reaction = {
  mood: 'idle' | 'sweating' | 'smug' | 'oops';
  line: string | null;
};

export type LineKind =
  | 'greeting'
  | 'check'
  | 'capture'
  | 'promote'
  | 'userBlunder'
  | 'checked'
  | 'hit'
  | 'userPromote'
  | 'goodMove'
  | 'oops'
  | 'outOfBook'
  | 'win'
  | 'loss'
  | 'draw';

/** Shown while the engine has failed. A constant because it is read during
    render, where drawing from a shuffled bag would not be pure. */
export const FROZEN_LINE = 'uh. brain froze';

/* Kept short on purpose: the bubble is a fixed size (so the board never
   shifts) and fits roughly three lines of ~20 characters at phone width. */
const LINES: Record<LineKind, readonly string[]> = {
  greeting: [
    'gl hf',
    "let's see what you got",
    "be gentle, i'm ~1500",
    'ready when you are',
    'no clock. lucky you',
  ],
  check: [
    'check.',
    'knock knock',
    'watch your king',
    'king looks drafty over there',
    'check. your move, i guess',
  ],
  capture: [
    "i'll take that",
    'thanks for the free piece',
    'yoink',
    'was that a gift?',
    'mine now',
    "you weren't using that, right?",
  ],
  promote: ['new queen just dropped', 'and that one is a queen now'],
  userBlunder: [
    'you sure about that one?',
    'hmm. interesting choice',
    'i think that was a mistake',
    'oh? thanks',
  ],
  checked: [
    'ok ok, i see it',
    'rude',
    'hey, personal space',
    "that's fine. totally fine",
  ],
  hit: [
    'wait, that was hanging?',
    'i meant to do that',
    'ok that hurt',
    "didn't need it anyway",
    '...i was getting to that',
    'mouse slip. definitely',
  ],
  userPromote: ['oh come on', "that's a lot of queen"],
  goodMove: ["ok you're cooking", 'huh. good move', "didn't see that one"],
  oops: [
    '...wait',
    'hold on, can i take that back',
    "pretend you didn't see that",
    'that was a mouse slip',
  ],
  outOfBook: [
    "ok, we're out of my prep",
    'never seen this before. fun',
    'now i have to actually think',
  ],
  win: ['gg! told you it plays like me', 'gg. rematch?', 'checkmate. gg wp'],
  loss: [
    'gg... you got me',
    'ok that was clean. gg',
    "i'm blaming the training data",
    'rematch. right now.',
  ],
  draw: ["a draw? i'll take it", "gg. nobody's happy", 'call it even'],
};

/* One shuffled bag per kind, refilled only when empty, so a line never repeats
   until every other line of its kind has been used. Module-level so the bags
   outlive a New Game (and the window being closed and reopened). */
const bags = new Map<LineKind, string[]>();
const lastSaid = new Map<LineKind, string>();

/** Pick the next line of a kind, without repeating until the pool runs out. */
export function say(kind: LineKind): string {
  let bag = bags.get(kind);
  if (!bag || bag.length === 0) {
    bag = [...LINES[kind]];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // A fresh shuffle must not open with the line that closed the last bag.
    if (bag.length > 1 && bag[bag.length - 1] === lastSaid.get(kind)) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    bags.set(kind, bag);
  }
  const line = bag.pop() as string;
  lastSaid.set(kind, line);
  return line;
}

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function isCapture(mv: Move): boolean {
  return mv.flags.includes('c') || mv.flags.includes('e');
}

/** True when a capture actually wins material rather than starting an even
    trade: it took something worth more than the capturing piece, or the piece
    now standing on that square can't be taken back. `after` must already
    reflect the move. */
export function winsMaterial(mv: Move, after: Chess): boolean {
  if (!isCapture(mv) || !mv.captured) return false;
  if (VALUE[mv.captured] > VALUE[mv.piece]) return true;
  return !after.isAttacked(mv.to, after.turn());
}

/** Andy's reaction to the move the player just made — shown while he thinks. */
export function reactToUserMove(mv: Move, after: Chess): Reaction {
  if (after.inCheck()) return { mood: 'sweating', line: say('checked') };
  if (mv.promotion) return { mood: 'sweating', line: say('userPromote') };
  if (winsMaterial(mv, after)) return { mood: 'sweating', line: say('hit') };
  return { mood: 'idle', line: null };
}

/** What the engine knew when it played Andy's move. */
export type AndyMoveContext = {
  source: MoveSource;
  /** engine eval of this move, centipawns from Andy's side */
  evalCp: number;
  /** eval of his previous searched move this game, or null if none yet */
  prevEvalCp: number | null;
  /** his previous move came from the opening book */
  wasInBook: boolean;
  /** he already reacted out loud to the player's last move */
  alreadyReacted: boolean;
  /** this is the first move of the game (he is White) */
  firstMove: boolean;
};

/* An eval change this large between two of his own moves means the player's
   move in between was a real mistake (or a real shot); smaller swings are
   search noise from the shallow depth. The second figure keeps him from
   gloating or worrying while the position is still roughly level. */
const SWING_CP = 200;
const CLEAR_EDGE_CP = 150;

/** Andy's reaction to his own move — held while he waits on the player. */
export function reactToAndyMove(
  mv: Move,
  after: Chess,
  ctx: AndyMoveContext,
): Reaction {
  if (after.inCheck()) return { mood: 'smug', line: say('check') };
  if (mv.promotion) return { mood: 'smug', line: say('promote') };
  if (winsMaterial(mv, after)) return { mood: 'smug', line: say('capture') };
  // The humanizer deliberately played a losing move: let it show on his face.
  if (ctx.source === 'blunder') return { mood: 'oops', line: say('oops') };

  const searched = ctx.source !== 'book';
  if (searched && ctx.prevEvalCp !== null) {
    const swing = ctx.evalCp - ctx.prevEvalCp;
    if (swing >= SWING_CP && ctx.evalCp >= CLEAR_EDGE_CP) {
      return { mood: 'smug', line: say('userBlunder') };
    }
    if (swing <= -SWING_CP && ctx.evalCp <= -CLEAR_EDGE_CP && !ctx.alreadyReacted) {
      return { mood: 'oops', line: say('goodMove') };
    }
  }
  if (searched && ctx.wasInBook) return { mood: 'idle', line: say('outOfBook') };
  if (ctx.firstMove) return { mood: 'idle', line: say('greeting') };
  return { mood: 'idle', line: null };
}
