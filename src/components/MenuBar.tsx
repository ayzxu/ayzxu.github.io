/* ==========================================================================
   MenuBar — the System 1 menu bar: Apple / File menus plus a live clock. The
   menus that do real work are Apple and File.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { AppleIcon, SpeakerOffIcon, SpeakerOnIcon } from './PixelIcons';
import NewsTicker from './NewsTicker';
import {
  getSfxVolume,
  isSfxMuted,
  setSfxMuted,
  setSfxVolume,
} from '../lib/sounds';
import { getNowPlaying, subscribe } from '../lib/nowPlaying';
import type { WindowId } from './windowConfig';

type MenuEntry =
  | { kind: 'item'; label: string; onClick?: () => void; disabled?: boolean }
  | { kind: 'sep' };

type MenuBarProps = {
  onOpenWindow: (id: WindowId) => void;
  onCloseActive: () => void;
  onShutDown: () => void;
  /** Replays the AndyAI tutorial (ShadowUser / ShadowOrb) from the top */
  onReplayTour: () => void;
  hasActiveWindow: boolean;
};

export default function MenuBar({
  onOpenWindow,
  onCloseActive,
  onShutDown,
  onReplayTour,
  hasActiveWindow,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [clock, setClock] = useState(formatClock);
  const [muted, setMuted] = useState(isSfxMuted);
  const [volume, setVolume] = useState(getSfxVolume);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [nowPlaying, setNowPlayingState] = useState(getNowPlaying);

  // Track the menu-bar now-playing song: seeded from the top 10, then switched
  // to whatever the visitor plays in AndyMusic.
  useEffect(() => subscribe(setNowPlayingState), []);

  const toggleMute = () => {
    const next = !muted;
    setSfxMuted(next);
    setMuted(next);
  };

  // Dragging the slider always takes effect immediately, so it also unmutes.
  const changeVolume = (value: number) => {
    setSfxVolume(value);
    setVolume(value);
    if (muted && value > 0) {
      setSfxMuted(false);
      setMuted(false);
    }
  };

  // Live clock — checked every second so the minute flips promptly; React
  // bails out of re-rendering while the formatted string is unchanged.
  useEffect(() => {
    const id = window.setInterval(() => setClock(formatClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Each menu is keyed by title; "apple" uses the icon instead of text.
  // desktopOnly menus are hidden on phone-sized screens (see .menu-title--desktop-only).
  // A menu with `action` (and no `entries`) is a direct-open title: clicking it
  // opens a window immediately instead of dropping a menu. These give recruiters
  // a one-click path to the Resume and Experience without hunting through File.
  const menus: {
    key: string;
    label: React.ReactNode;
    entries?: MenuEntry[];
    action?: () => void;
    desktopOnly?: boolean;
  }[] =
    [
      {
        key: 'apple',
        label: <AppleIcon className="h-3.5 w-3.5" />,
        entries: [
          {
            kind: 'item',
            label: 'About This Macintosh',
            onClick: () => onOpenWindow('aboutmac'),
          },
          { kind: 'sep' },
          {
            kind: 'item',
            label: 'Read Me',
            onClick: () => onOpenWindow('readme'),
          },
          {
            kind: 'item',
            label: 'Replay Tour',
            onClick: onReplayTour,
          },
          { kind: 'sep' },
          { kind: 'item', label: 'Shut Down', onClick: onShutDown },
        ],
      },
      {
        key: 'File',
        label: 'File',
        desktopOnly: true,
        entries: [
          {
            kind: 'item',
            label: 'Open Projects',
            onClick: () => onOpenWindow('projects'),
          },
          {
            kind: 'item',
            label: 'Open Fun',
            onClick: () => onOpenWindow('fun'),
          },
          {
            kind: 'item',
            label: 'Open About Me',
            onClick: () => onOpenWindow('about'),
          },
          {
            kind: 'item',
            label: 'Open Résumé',
            onClick: () => onOpenWindow('resume'),
          },
          {
            kind: 'item',
            label: 'Open Andy Chess',
            onClick: () => onOpenWindow('chess'),
          },
          {
            kind: 'item',
            label: 'Open News',
            onClick: () => onOpenWindow('news'),
          },
          {
            kind: 'item',
            label: 'Open Paint',
            onClick: () => onOpenWindow('paint'),
          },
          {
            kind: 'item',
            label: 'Open AndyWrite',
            onClick: () => onOpenWindow('andywrite'),
          },
          {
            kind: 'item',
            label: 'Open Writings',
            onClick: () => onOpenWindow('writings'),
          },
          {
            kind: 'item',
            label: 'Open AndyMusic',
            onClick: () => onOpenWindow('music'),
          },
          {
            kind: 'item',
            label: 'Open Achievements',
            onClick: () => onOpenWindow('achievements'),
          },
          {
            kind: 'item',
            label: 'Open Games',
            onClick: () => onOpenWindow('games'),
          },
          {
            kind: 'item',
            label: 'Open Calculator',
            onClick: () => onOpenWindow('calc'),
          },
          {
            kind: 'item',
            label: 'Open MacTerminal',
            onClick: () => onOpenWindow('terminal'),
          },
          {
            kind: 'item',
            label: 'Open Asteroids',
            onClick: () => onOpenWindow('asteroids'),
          },
          { kind: 'sep' },
          {
            kind: 'item',
            label: 'Close Window',
            onClick: onCloseActive,
            disabled: !hasActiveWindow,
          },
        ],
      },
      // Recruiter fast-path - top-level, one-click, no dropdown. Sits to the
      // right of the File menu.
      {
        key: 'Résumé',
        label: 'Résumé',
        desktopOnly: true,
        action: () => onOpenWindow('resume'),
      },
      {
        key: 'Experience',
        label: 'Experience',
        desktopOnly: true,
        action: () => onOpenWindow('about'),
      },
    ];

  const close = () => setOpenMenu(null);

  return (
    <>
      {/* Transparent catcher closes any open menu on an outside click */}
      {openMenu && (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        />
      )}

      <div className="menu-bar">
        {menus.map((menu) => (
          <div
            key={menu.key}
            className={`menu-title${
              menu.desktopOnly ? ' menu-title--desktop-only' : ''
            }${openMenu === menu.key ? ' open' : ''}`}
            style={{ position: 'relative' }}
            onClick={() => {
              if (menu.action) {
                // Direct-open title: fire the action and dismiss any open menu.
                setOpenMenu(null);
                menu.action();
                return;
              }
              setOpenMenu(openMenu === menu.key ? null : menu.key);
            }}
            // Hovering a direct-open title while another menu is open should
            // close that menu (there's nothing to switch to here).
            onMouseEnter={() =>
              openMenu && setOpenMenu(menu.action ? null : menu.key)
            }
          >
            {menu.label}

            {openMenu === menu.key && menu.entries && (
              <div className="menu-dropdown" style={{ left: 0 }}>
                {menu.entries.map((entry, i) =>
                  entry.kind === 'sep' ? (
                    <div key={i} className="menu-separator" />
                  ) : (
                    <div
                      key={i}
                      className={`menu-item${
                        entry.disabled ? ' disabled' : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (entry.disabled) return;
                        entry.onClick?.();
                        close();
                      }}
                    >
                      {entry.label}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        ))}

        <NewsTicker onOpenNews={() => onOpenWindow('news')} />

        <button
          type="button"
          className="menu-now-playing menu-title--desktop-only"
          onClick={() => onOpenWindow('music')}
          title={`Now playing: ${nowPlaying.title} — ${nowPlaying.artist}`}
          aria-label={`Now playing ${nowPlaying.title} by ${nowPlaying.artist} — open AndyMusic`}
        >
          <span className="menu-now-playing-note" aria-hidden>
            ♪
          </span>
          <span className="menu-now-playing-text">
            {nowPlaying.title} — {nowPlaying.artist}
          </span>
        </button>

        <div
          className="menu-sfx-wrap"
          onMouseEnter={() => setVolumeOpen(true)}
          onMouseLeave={() => setVolumeOpen(false)}
        >
          <button
            type="button"
            className="menu-sfx"
            onClick={toggleMute}
            title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted || volume === 0 ? (
              <SpeakerOffIcon className="h-3.5 w-3.5" />
            ) : (
              <SpeakerOnIcon className="h-3.5 w-3.5" />
            )}
          </button>

          {volumeOpen && (
            <div className="menu-volume-panel">
              <input
                type="range"
                className="menu-volume-slider"
                min={0}
                max={100}
                step={1}
                value={Math.round(volume * 100)}
                onChange={(e) => changeVolume(Number(e.target.value) / 100)}
                aria-label="Sound effects volume"
              />
              <div className="menu-volume-label">
                {muted ? 'MUTE' : `${Math.round(volume * 100)}%`}
              </div>
            </div>
          )}
        </div>

        <div className="menu-clock">{clock}</div>
      </div>
    </>
  );
}

/* "10:30 PM" — classic 12-hour clock */
function formatClock(): string {
  return new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}
