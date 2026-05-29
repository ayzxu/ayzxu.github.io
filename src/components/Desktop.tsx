/* ==========================================================================
   Desktop — the interactive System 1 desktop. Owns window lifecycle (open /
   close / focus + z-order), desktop-icon selection, the shared image Lightbox
   and URL sync (deep links /projects, /fun, /about; otherwise /desktop).
   ========================================================================== */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MenuBar from './MenuBar';
import MacWindow from './MacWindow';
import DesktopIcon from './DesktopIcon';
import Lightbox from './Lightbox';
import { DocumentIcon, FolderIcon, TrashIcon } from './PixelIcons';
import { WINDOW_META, ROUTE_FOR_WINDOW, type WindowId } from './windowConfig';
import { useViewport } from '../hooks/useViewport';
import {
  centerWindowPosition,
  clampWindowPosition,
  getCascadeOffset,
  getDefaultWindowSize,
  getMaxWindowSize,
  getViewport,
  useCompactIcons,
} from '../lib/windowBounds';

import ReadMeWindow from '../windows/ReadMeWindow';
import ProjectsWindow from '../windows/ProjectsWindow';
import FunWindow from '../windows/FunWindow';
import AboutWindow from '../windows/AboutWindow';
import desktopBg from '../assets/bg.jpg';

type OpenWin = { id: WindowId; x: number; y: number };

type DesktopProps = {
  /** Window to open on top at boot, derived from a deep-link route */
  initialWindow?: WindowId;
  onShutDown: () => void;
};

const ICONS: { id: WindowId; label: string; icon: React.ReactNode }[] = [
  { id: 'readme', label: 'Read Me', icon: <DocumentIcon className="w-full h-full" /> },
  { id: 'projects', label: 'Projects', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'fun', label: 'Fun', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'about', label: 'About Me', icon: <FolderIcon className="w-full h-full" /> },
];

const ICON_COLUMN_TOPS = ['10%', '28%', '46%', '64%'] as const;

function buildInitialWindows(initialWindow?: WindowId): OpenWin[] {
  const viewport = getViewport();
  const readmeSize = getDefaultWindowSize(WINDOW_META.readme, viewport);
  const readmePos = centerWindowPosition(readmeSize, viewport);
  const wins: OpenWin[] = [{ id: 'readme', ...readmePos }];
  if (initialWindow && initialWindow !== 'readme') {
    const off = getCascadeOffset(viewport);
    const size = getDefaultWindowSize(WINDOW_META[initialWindow], viewport);
    wins.push({
      id: initialWindow,
      ...clampWindowPosition(
        { x: readmePos.x + off, y: readmePos.y + Math.round(off * 0.6) },
        size,
        viewport,
      ),
    });
  }
  return wins;
}

export default function Desktop({ initialWindow, onShutDown }: DesktopProps) {
  const navigate = useNavigate();
  const viewport = useViewport();
  const compactIcons = useCompactIcons(viewport);
  const maxWindowSize = getMaxWindowSize(viewport);

  const [openWins, setOpenWins] = useState<OpenWin[]>(() =>
    buildInitialWindows(initialWindow),
  );
  const [selectedIcon, setSelectedIcon] = useState<WindowId | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );

  /* Keep the URL in step with the topmost window so links stay shareable */
  useEffect(() => {
    const top = openWins[openWins.length - 1];
    const route = top ? ROUTE_FOR_WINDOW[top.id] : undefined;
    navigate(route ?? '/desktop', { replace: true });
  }, [openWins, navigate]);

  const openWindow = (id: WindowId) => {
    setOpenWins((wins) => {
      const existing = wins.find((w) => w.id === id);
      if (existing) {
        return [...wins.filter((w) => w.id !== id), existing];
      }
      const n = wins.length;
      const off = getCascadeOffset(viewport);
      const size = getDefaultWindowSize(WINDOW_META[id], viewport);
      return [
        ...wins,
        {
          id,
          ...clampWindowPosition(
            { x: 88 + n * off, y: 70 + n * off },
            size,
            viewport,
          ),
        },
      ];
    });
  };

  const closeWindow = (id: WindowId) =>
    setOpenWins((wins) => wins.filter((w) => w.id !== id));

  const focusWindow = (id: WindowId) =>
    setOpenWins((wins) => {
      const w = wins.find((x) => x.id === id);
      if (!w || wins[wins.length - 1].id === id) return wins;
      return [...wins.filter((x) => x.id !== id), w];
    });

  const closeActive = () => {
    const top = openWins[openWins.length - 1];
    if (top) closeWindow(top.id);
  };

  const onOpenImage = (src: string, alt: string) => setLightbox({ src, alt });

  return (
    <div
      className="desktop-root mac-desktop-surface"
      style={{ '--desktop-bg': `url(${desktopBg})` } as React.CSSProperties}
      onClick={() => setSelectedIcon(null)}
    >
      <MenuBar
        onOpenWindow={openWindow}
        onCloseActive={closeActive}
        onShutDown={onShutDown}
        hasActiveWindow={openWins.length > 0}
      />

      <div
        className={
          compactIcons
            ? 'desktop-icons desktop-icons--compact'
            : 'desktop-icons desktop-icons--column'
        }
      >
        {ICONS.map((ic, i) => (
          <DesktopIcon
            key={ic.id}
            label={ic.label}
            icon={ic.icon}
            selected={selectedIcon === ic.id}
            onSelect={() => setSelectedIcon(ic.id)}
            onOpen={() => openWindow(ic.id)}
            style={
              compactIcons
                ? undefined
                : { top: ICON_COLUMN_TOPS[i], right: 28 }
            }
          />
        ))}
        <DesktopIcon
          label="Trash"
          icon={<TrashIcon className="w-full h-full" />}
          selected={selectedIcon === 'trash'}
          onSelect={() => setSelectedIcon('trash')}
          onOpen={() => openWindow('trash')}
          style={compactIcons ? undefined : { bottom: 33, right: 28 }}
        />
      </div>

      {openWins.map((win, i) => {
        const meta = WINDOW_META[win.id];
        const size = getDefaultWindowSize(meta, viewport);
        return (
          <MacWindow
            key={win.id}
            title={meta.title}
            initial={{ x: win.x, y: win.y }}
            width={size.w}
            height={size.h}
            maxSize={maxWindowSize}
            viewport={viewport}
            z={10 + i}
            active={i === openWins.length - 1}
            onClose={() => closeWindow(win.id)}
            onFocus={() => focusWindow(win.id)}
          >
            {renderWindow(win.id, onOpenImage)}
          </MacWindow>
        );
      })}

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

/* Map a window id to its content. */
function renderWindow(
  id: WindowId,
  onOpenImage: (src: string, alt: string) => void,
): React.ReactNode {
  switch (id) {
    case 'readme':
      return <ReadMeWindow />;
    case 'projects':
      return <ProjectsWindow onOpenImage={onOpenImage} />;
    case 'fun':
      return <FunWindow onOpenImage={onOpenImage} />;
    case 'about':
      return <AboutWindow onOpenImage={onOpenImage} />;
    case 'aboutmac':
      return <AboutMacContent />;
    case 'trash':
      return <TrashContent />;
  }
}

function AboutMacContent() {
  return (
    <>
      <div className="win-h">Macintosh</div>
      <p>System Software 1.0</p>
      <p>Total Memory&nbsp;&nbsp;128 K</p>
      <hr className="mac-rule" />
      <p className="win-meta">
        Andy Xu's portfolio, reimagined as a 1984 Macintosh. Built with React,
        TypeScript and Vite.
      </p>
    </>
  );
}

function TrashContent() {
  return <p>The Trash is empty.</p>;
}
