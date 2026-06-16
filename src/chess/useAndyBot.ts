/* ==========================================================================
   useAndyBot - React interface to the engine Web Worker. Exposes a promise-based
   requestMove(fen) with a `thinking` flag, and requestAnalysis(history) with an
   `analyzing` flag for the post-game review. The worker is created once per mount
   and terminated on unmount.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineResult, GameReview, LastMoveInfo } from './engine/types';

type Pending = {
  kind: 'move' | 'analysis';
  resolve: (r: unknown) => void;
  reject: (e: Error) => void;
};

type WorkerMessage =
  | { type: 'move'; id: number; result: EngineResult | null }
  | { type: 'analysis'; id: number; result: GameReview }
  | { type: 'error'; id: number; message: string };

export function useAndyBot() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef<Map<number, Pending>>(new Map());
  const idRef = useRef(0);
  const [thinking, setThinking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    // Capture the (stable) pending map so the cleanup closes over the same
    // reference the effect set up, satisfying the exhaustive-deps lint.
    const pendingMap = pending.current;
    const worker = new Worker(
      new URL('./andyBot.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    // Recompute the busy flags from whatever requests are still outstanding.
    const refreshFlags = () => {
      let move = false;
      let analysis = false;
      pendingMap.forEach((p) => {
        if (p.kind === 'analysis') analysis = true;
        else move = true;
      });
      setThinking(move);
      setAnalyzing(analysis);
    };

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;
      const entry = pendingMap.get(data.id);
      if (!entry) return;
      pendingMap.delete(data.id);
      refreshFlags();
      if (data.type === 'error') entry.reject(new Error(data.message));
      else entry.resolve(data.result);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingMap.clear();
      setThinking(false);
      setAnalyzing(false);
    };
  }, []);

  const requestMove = useCallback(
    (fen: string, lastMove?: LastMoveInfo): Promise<EngineResult | null> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error('Engine worker is not ready'));
          return;
        }
        const id = ++idRef.current;
        pending.current.set(id, {
          kind: 'move',
          resolve: resolve as (r: unknown) => void,
          reject,
        });
        setThinking(true);
        worker.postMessage({ type: 'move', id, fen, lastMove });
      });
    },
    [],
  );

  const requestAnalysis = useCallback(
    (history: string[], userColor: 'white' | 'black'): Promise<GameReview> => {
      return new Promise((resolve, reject) => {
        const worker = workerRef.current;
        if (!worker) {
          reject(new Error('Engine worker is not ready'));
          return;
        }
        const id = ++idRef.current;
        pending.current.set(id, {
          kind: 'analysis',
          resolve: resolve as (r: unknown) => void,
          reject,
        });
        setAnalyzing(true);
        worker.postMessage({ type: 'analyze', id, history, userColor });
      });
    },
    [],
  );

  return { requestMove, requestAnalysis, thinking, analyzing };
}
