/* ==========================================================================
   useAndyBot — React interface to the engine Web Worker. Exposes a promise-based
   requestMove(fen) and a `thinking` flag for the UI. The worker is created once
   per mount and terminated on unmount.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineResult } from './engine/types';

type Pending = {
  resolve: (r: EngineResult | null) => void;
  reject: (e: Error) => void;
};

type WorkerMessage =
  | { type: 'move'; id: number; result: EngineResult | null }
  | { type: 'error'; id: number; message: string };

export function useAndyBot() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef<Map<number, Pending>>(new Map());
  const idRef = useRef(0);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    // Capture the (stable) pending map so the cleanup closes over the same
    // reference the effect set up, satisfying the exhaustive-deps lint.
    const pendingMap = pending.current;
    const worker = new Worker(
      new URL('./andyBot.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;
      const entry = pendingMap.get(data.id);
      if (!entry) return;
      pendingMap.delete(data.id);
      if (pendingMap.size === 0) setThinking(false);
      if (data.type === 'error') entry.reject(new Error(data.message));
      else entry.resolve(data.result);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingMap.clear();
      setThinking(false);
    };
  }, []);

  const requestMove = useCallback((fen: string): Promise<EngineResult | null> => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('Engine worker is not ready'));
        return;
      }
      const id = ++idRef.current;
      pending.current.set(id, { resolve, reject });
      setThinking(true);
      worker.postMessage({ type: 'move', id, fen });
    });
  }, []);

  return { requestMove, thinking };
}
