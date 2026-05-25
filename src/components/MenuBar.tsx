/* ==========================================================================
   MenuBar — the System 1 menu bar: Apple / File / Edit / View / Special
   menus plus a live clock. Edit and View carry the classic (disabled) items;
   the menus that do real work are Apple, File and Special.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { AppleIcon } from './PixelIcons';
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

  // Live clock — refreshed once a minute is enough for "10:30 PM"
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
      {
        key: 'Special',
        label: 'Special',
        entries: [
          { kind: 'item', label: 'Clean Up Desktop', disabled: true },
          { kind: 'item', label: 'Empty Trash', disabled: true },
          { kind: 'sep' },
          { kind: 'item', label: 'Shut Down', onClick: onShutDown },
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
