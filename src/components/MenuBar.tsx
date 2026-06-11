/* ==========================================================================
   MenuBar — the System 1 menu bar: Apple / File / Edit / View menus plus a
   live clock. Edit and View carry the classic (disabled) items; the menus
   that do real work are Apple and File.
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
import type { WindowId } from './windowConfig';

type MenuEntry =
  | { kind: 'item'; label: string; onClick?: () => void; disabled?: boolean }
  | { kind: 'sep' };

type MenuBarProps = {
  onOpenWindow: (id: WindowId) => void;
  onCloseActive: () => void;
  onShutDown: () => void;
  hasActiveWindow: boolean;
};

export default function MenuBar({
  onOpenWindow,
  onCloseActive,
  onShutDown,
  hasActiveWindow,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [clock, setClock] = useState(formatClock);
  const [muted, setMuted] = useState(isSfxMuted);
  const [volume, setVolume] = useState(getSfxVolume);
  const [volumeOpen, setVolumeOpen] = useState(false);

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

  // Each menu is keyed by title; "apple" uses the icon instead of text
  const menus: { key: string; label: React.ReactNode; entries: MenuEntry[] }[] =
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
          { kind: 'sep' },
          { kind: 'item', label: 'Shut Down', onClick: onShutDown },
        ],
      },
      {
        key: 'File',
        label: 'File',
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
          { kind: 'sep' },
          {
            kind: 'item',
            label: 'Close Window',
            onClick: onCloseActive,
            disabled: !hasActiveWindow,
          },
        ],
      },
      {
        key: 'Edit',
        label: 'Edit',
        entries: [
          { kind: 'item', label: 'Undo', disabled: true },
          { kind: 'sep' },
          { kind: 'item', label: 'Cut', disabled: true },
          { kind: 'item', label: 'Copy', disabled: true },
          { kind: 'item', label: 'Paste', disabled: true },
        ],
      },
      {
        key: 'View',
        label: 'View',
        entries: [
          { kind: 'item', label: 'by Icon', disabled: true },
          { kind: 'item', label: 'by Name', disabled: true },
        ],
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
            className={`menu-title${openMenu === menu.key ? ' open' : ''}`}
            style={{ position: 'relative' }}
            onClick={() =>
              setOpenMenu(openMenu === menu.key ? null : menu.key)
            }
            onMouseEnter={() => openMenu && setOpenMenu(menu.key)}
          >
            {menu.label}

            {openMenu === menu.key && (
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
