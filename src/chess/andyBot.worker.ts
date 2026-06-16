/* ==========================================================================
   andyBot.worker.ts — runs the engine off the main thread so the 1-bit desktop
   never janks while Andy "thinks". The opening book and style profile are
   bundled (imported JSON), so there is no runtime fetch and no base-path issues.

   The reply is delayed to the engine's human-modelled think time (see
   think.ts), so the pause before each move follows Andy's real clock habits —
   instant recaptures, blitzed book moves, long tanks in sharp middlegames.
   ========================================================================== */

import { chooseMove } from './engine/andyBot';
import { analyzeGame } from './engine/analyze';
import type {
  AndyProfile,
  EngineResult,
  GameReview,
  LastMoveInfo,
  OpeningBook,
} from './engine/types';
import bookJson from './data/opening-book.json';
import profileJson from './data/style-profile.json';

const BOOK = bookJson as unknown as OpeningBook;
const PROFILE = profileJson as unknown as AndyProfile;

const FALLBACK_MIN_MS = 350;
const FALLBACK_EXTRA_MS = 500;

type MoveRequest = {
  type: 'move';
  id: number;
  fen: string;
  lastMove?: LastMoveInfo;
};
type AnalyzeRequest = {
  type: 'analyze';
  id: number;
  history: string[];
  userColor: 'white' | 'black';
};
type WorkerRequest = MoveRequest | AnalyzeRequest;
type WorkerResponse =
  | { type: 'move'; id: number; result: EngineResult | null }
  | { type: 'analysis'; id: number; result: GameReview }
  | { type: 'error'; id: number; message: string };

// Cast avoids needing the WebWorker lib alongside DOM in tsconfig.
const post = (msg: WorkerResponse): void =>
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(msg);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (!msg) return;

  if (msg.type === 'analyze') {
    try {
      const result = analyzeGame(msg.history, msg.userColor, BOOK);
      post({ type: 'analysis', id: msg.id, result });
    } catch (err) {
      post({
        type: 'error',
        id: msg.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type !== 'move') return;

  const start = Date.now();
  let result: EngineResult | null;
  try {
    result = chooseMove(msg.fen, PROFILE, BOOK, Math.random, msg.lastMove);
  } catch (err) {
    post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
    return;
  }

  // Present the move after the human-modelled delay; computation time counts
  // toward it. Falls back to the old flat pause if no delay was produced.
  const elapsed = Date.now() - start;
  const target =
    result?.delayMs ?? FALLBACK_MIN_MS + Math.random() * FALLBACK_EXTRA_MS;
  const wait = Math.max(0, target - elapsed);
  setTimeout(() => post({ type: 'move', id: msg.id, result }), wait);
};
