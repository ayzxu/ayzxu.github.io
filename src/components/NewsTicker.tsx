/* ==========================================================================
   NewsTicker — a thin scrolling wire of today's top headlines that lives in
   the menu bar between the menus and the SFX/clock controls. Headlines come
   from the Hacker News front page; clicking the ticker opens the News window.
   Renders nothing while loading or if the wire is unreachable, so the menu
   bar never breaks.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { fetchFrontPage } from '../lib/hackerNews';

/** How many headlines ride the ticker */
const TICKER_COUNT = 10;
/** Refresh the wire every 10 minutes while the page stays open */
const REFRESH_MS = 10 * 60 * 1000;
/** Scroll speed — seconds per character keeps long wires readable */
const SECONDS_PER_CHAR = 0.18;
const MIN_DURATION_S = 30;

type NewsTickerProps = {
  onOpenNews: () => void;
};

export default function NewsTicker({ onOpenNews }: NewsTickerProps) {
  const [headlines, setHeadlines] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchFrontPage(TICKER_COUNT)
        .then((stories) => {
          if (!cancelled) setHeadlines(stories.map((s) => s.title));
        })
        .catch(() => {
          /* wire unreachable — keep whatever we already have */
        });
    };

    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (headlines.length === 0) return null;

  const wire = headlines.join('  +++  ');
  const duration = Math.max(MIN_DURATION_S, wire.length * SECONDS_PER_CHAR);

  return (
    <div
      className="menu-ticker"
      role="button"
      tabIndex={0}
      title="Open News"
      aria-label="Today's top headlines — open News"
      onClick={onOpenNews}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenNews();
        }
      }}
    >
      <div
        className="menu-ticker-track"
        style={{ animationDuration: `${Math.round(duration)}s` }}
      >
        {/* Wire is doubled so the loop wraps seamlessly */}
        <span className="menu-ticker-text">{wire}</span>
        <span className="menu-ticker-text" aria-hidden>
          {wire}
        </span>
      </div>
    </div>
  );
}
