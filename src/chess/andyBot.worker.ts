/* ==========================================================================
   andyBot.worker.ts — runs the engine off the main thread so the 1-bit desktop
   never janks while Andy "thinks". The opening book and style profile are
   bundled (imported JSON), so there is no runtime fetch and no base-path issues.

   A small minimum think-time is enforced so instant book moves still feel like a
   human took a beat, scaled up a little for variety.
   ========================================================================== */

import { chooseMove } from './engine/andyBot';
import type { AndyProfile, EngineResult, OpeningBook } from './engine/types';
import bookJson from './data/opening-book.json';
import profileJson from './data/style-profile.json';

const BOOK = bookJson as unknown as OpeningBook;
const PROFILE = profileJson as unknown as AndyProfile;

const MIN_THINK_MS = 350;
const EXTRA_THINK_MS = 500;

type MoveRequest = { type: 'move'; id: number; fen: string };
type MoveResponse =
  | { type: 'move'; id: number; result: EngineResult | null }
  | { type: 'error'; id: number; message: string };

// Cast avoids needing the WebWorker lib alongside DOM in tsconfig.
const post = (msg: MoveResponse): void =>
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(msg);

self.onmessage = (e: MessageEvent<MoveRequest>) => {
  const msg = e.data;
  if (!msg || msg.type !== 'move') return;

  const start = Date.now();
  let result: EngineResult | null;
  try {
    result = chooseMove(msg.fen, PROFILE, BOOK);
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
    return;
  }

  const elapsed = Date.now() - start;
  const target = MIN_THINK_MS + Math.random() * EXTRA_THINK_MS;
  const wait = Math.max(0, target - elapsed);
  setTimeout(() => post({ type: 'move', id: msg.id, result }), wait);
};
