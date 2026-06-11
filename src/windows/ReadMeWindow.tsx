/* ==========================================================================
   ReadMeWindow — the intro window, opened by default when the desktop boots.
   Mirrors the old Home hero: greeting, blurb, portrait and social links.
   ========================================================================== */

import { intro, socials } from '../data/content';
import type { WindowId } from '../components/windowConfig';

type ReadMeWindowProps = {
  onOpenWindow: (id: WindowId) => void;
  /** Windows the visitor has already opened — checked off automatically */
  visited: Set<WindowId>;
};

/* The grand tour, roughly best-first. Clicking a row opens the app. */
const TOUR: { id: WindowId; label: string }[] = [
  { id: 'projects', label: 'Browse my Projects' },
  { id: 'chess', label: 'Lose to Andy Chess Bot' },
  { id: 'paint', label: 'Doodle something in Paint' },
  { id: 'games', label: 'Play Minesweeper & Snake in Games' },
  { id: 'news', label: "Skim today's News" },
  { id: 'fun', label: 'Snoop around the Fun folder' },
  { id: 'resume', label: 'Read my Résumé' },
  { id: 'calc', label: 'Crunch numbers in the Calculator' },
];

export default function ReadMeWindow({ onOpenWindow, visited }: ReadMeWindowProps) {
  const done = TOUR.filter((t) => visited.has(t.id)).length;
  return (
    <div className="readme-content">
      {/* Two columns when the window is wide enough (container query);
          stacked intro-then-checklist otherwise. */}
      <div className="readme-columns">
        <div className="readme-intro">
          <div className="win-h">{intro.heading}</div>

          <img
            src={intro.portrait}
            alt="Andy Xu"
            decoding="async"
            className="bw-img pixelated readme-portrait"
          />

          <p>{intro.body}</p>
        </div>

        <div className="readme-tour-pane">
          <hr className="mac-rule readme-tour-rule" />
          <div className="win-sub">
            Things to check out{' '}
            <span className="readme-tour-count">
              ({done}/{TOUR.length})
            </span>
          </div>
          <div className="readme-tour">
            {TOUR.map((item) => {
              const checked = visited.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`tour-item${checked ? ' done' : ''}`}
                  onClick={() => onOpenWindow(item.id)}
                >
                  <span
                    className={`tour-box${checked ? ' checked' : ''}`}
                    aria-hidden
                  />
                  <span className="tour-label">{item.label}</span>
                </button>
              );
            })}
          </div>
          {done === TOUR.length && (
            <p className="win-meta" style={{ marginTop: 6 }}>
              You&apos;ve seen it all.
            </p>
          )}
        </div>
      </div>

      <hr className="mac-rule" />

      <div className="readme-links-row">
        <button
          type="button"
          className="mac-button default"
          onClick={() => onOpenWindow('resume')}
        >
          View Résumé
        </button>
        <p style={{ margin: 0 }}>
          {socials.map((s, i) => (
            <span key={s.name}>
              <a
                href={s.url}
                target={s.url.startsWith('http') ? '_blank' : undefined}
                rel={s.url.startsWith('http') ? 'noreferrer' : undefined}
              >
                {s.name}
              </a>
              {i < socials.length - 1 ? '  •  ' : ''}
            </span>
          ))}
        </p>
      </div>

      <p className="win-meta" style={{ marginTop: 14 }}>
        Double-click a folder on the desktop to explore.
      </p>
    </div>
  );
}
