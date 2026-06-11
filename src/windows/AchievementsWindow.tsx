/* ==========================================================================
   AchievementsWindow — the trophy case. Lists every achievement, earned or
   not; earned ones show the unlock date, locked ones render dimmed with a
   padlocked badge. Live-updates when something unlocks while it's open.
   ========================================================================== */

import { useEffect, useState } from 'react';
import {
  ACHIEVEMENTS,
  getUnlocks,
  onAchievementsChange,
  resetAchievements,
} from '../lib/achievements';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AchievementsWindow() {
  const [unlocks, setUnlocks] = useState(getUnlocks);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => onAchievementsChange(() => setUnlocks(getUnlocks())), []);

  const earned = ACHIEVEMENTS.filter((a) => unlocks[a.id]).length;

  return (
    <div className="achv-content">
      <div className="win-sub">Trophy Case</div>
      <p className="win-meta" style={{ marginTop: 0 }}>
        {earned} of {ACHIEVEMENTS.length} earned — go click around the desktop.
      </p>

      <ul className="achv-list">
        {ACHIEVEMENTS.map((a) => {
          const when = unlocks[a.id];
          return (
            <li
              key={a.id}
              className={`achv-item${when ? ' earned' : ' locked'}`}
            >
              <span className="achv-badge" aria-hidden="true">
                {when ? a.glyph : '?'}
              </span>
              <span className="achv-text">
                <span className="achv-title">{a.title}</span>
                <span className="achv-desc">{a.desc}</span>
              </span>
              <span className="achv-when win-meta">
                {when ? formatDate(when) : 'Locked'}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="achv-footer">
        {earned > 0 && !confirmReset && (
          <button
            type="button"
            className="mac-button"
            onClick={() => setConfirmReset(true)}
          >
            Reset Progress
          </button>
        )}
        {confirmReset && (
          <>
            <span className="win-meta">Wipe all trophies?</span>
            <button
              type="button"
              className="mac-button"
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="mac-button default"
              onClick={() => {
                resetAchievements();
                setConfirmReset(false);
              }}
            >
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}
