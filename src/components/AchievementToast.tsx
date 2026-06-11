/* ==========================================================================
   AchievementToast — a non-interactive System 1 style notification that
   slides in under the menu bar when an achievement unlocks. Toasts queue
   one at a time and dismiss themselves; pointer events pass right through.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import {
  onAchievementToast,
  type AchievementDef,
} from '../lib/achievements';

const SHOW_MS = 2500;
const EXIT_MS = 300;

export default function AchievementToast() {
  const [current, setCurrent] = useState<AchievementDef | null>(null);
  const [leaving, setLeaving] = useState(false);
  const queue = useRef<AchievementDef[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const showNext = () => {
      const next = queue.current.shift();
      if (!next) return;
      setCurrent(next);
      setLeaving(false);
      timers.current.push(
        window.setTimeout(() => {
          setLeaving(true);
          timers.current.push(
            window.setTimeout(() => {
              setCurrent(null);
              showNext();
            }, EXIT_MS),
          );
        }, SHOW_MS),
      );
    };

    const off = onAchievementToast((def) => {
      queue.current.push(def);
      // only kick the queue if nothing is on screen
      setCurrent((cur) => {
        if (cur === null) {
          // defer so state settles before showNext sets it again
          window.setTimeout(showNext, 0);
        }
        return cur;
      });
    });

    const t = timers.current;
    return () => {
      off();
      t.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  if (!current) return null;

  return (
    <div
      className={`achv-toast${leaving ? ' leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="achv-toast-glyph">{current.glyph}</span>
      <span className="achv-toast-body">
        <span className="achv-toast-title">Achievement unlocked!</span>
        <span className="achv-toast-name">{current.title}</span>
      </span>
    </div>
  );
}
