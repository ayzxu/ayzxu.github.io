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

import ReadMeWindow from '../windows/ReadMeWindow';
import ProjectsWindow from '../windows/ProjectsWindow';
import FunWindow from '../windows/FunWindow';
import AboutWindow from '../windows/AboutWindow';

type OpenWin = { id: WindowId; x: number; y: number };

type DesktopProps = {
  /** Window to open on top at boot, derived from a deep-link route */
  initialWindow?: WindowId;
  onShutDown: () => void;
};

/* Desktop icons down the right edge, classic Macintosh layout */
const ICONS: { id: WindowId; label: string; icon: React.ReactNode; top: number }[] =
  [
    { id: 'readme', label: 'Read Me', icon: <DocumentIcon className="w-full h-full" />, top: 40 },
    { id: 'projects', label: 'Projects', icon: <FolderIcon className="w-full h-full" />, top: 134 },
    { id: 'fun', label: 'Fun', icon: <FolderIcon className="w-full h-full" />, top: 228 },
    { id: 'about', label: 'About Me', icon: <FolderIcon className="w-full h-full" />, top: 322 },
  ];

export default function Desktop({ initialWindow, onShutDown }: DesktopProps) {
  const navigate = useNavigate();

  // Read Me opens by default; a deep-link window stacks on top of it
  const [openWins, setOpenWins] = useState<OpenWin[]>(() => {
    const wins: OpenWin[] = [{ id: 'readme', x: 70, y: 56 }];
    if (initialWindow && initialWindow !== 'readme') {
      wins.push({ id: initialWindow, x: 110, y: 90 });
    }
    return wins;
  });
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
        // Already open — just bring it to the front
        return [...wins.filter((w) => w.id !== id), existing];
      }
      // Cascade new windows so they never land exactly on top of each other
      const n = wins.length;
      return [...wins, { id, x: 70 + n * 28, y: 56 + n * 28 }];
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
      className="desktop-root bg-mac-desktop"
      onClick={() => setSelectedIcon(null)}
    >
      <MenuBar
        onOpenWindow={openWindow}
        onCloseActive={closeActive}
        onShutDown={onShutDown}
        hasActiveWindow={openWins.length > 0}
      />

      {/* Folder + document icons */}
      {ICONS.map((ic) => (
        <DesktopIcon
          key={ic.id}
          label={ic.label}
          icon={ic.icon}
          selected={selectedIcon === ic.id}
          onSelect={() => setSelectedIcon(ic.id)}
          onOpen={() => openWindow(ic.id)}
          style={{ top: ic.top, right: 22 }}
        />
      ))}

      {/* Trash always sits in the bottom-right corner */}
      <DesktopIcon
        label="Trash"
        icon={<TrashIcon className="w-full h-full" />}
        selected={selectedIcon === 'trash'}
        onSelect={() => setSelectedIcon('trash')}
        onOpen={() => openWindow('trash')}
        style={{ bottom: 26, right: 22 }}
      />

      {/* Open windows — array order is z-order, last entry is on top */}
      {openWins.map((win, i) => {
        const meta = WINDOW_META[win.id];
        return (
          <MacWindow
            key={win.id}
            title={meta.title}
            initial={{ x: win.x, y: win.y }}
            width={Math.min(meta.w, window.innerWidth - 40)}
            height={Math.min(meta.h, window.innerHeight - 70)}
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

/* "About This Macintosh" — a small spec sheet, period-accurate spirit */
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

/* The Trash — always empty */
function TrashContent() {
  return <p>The Trash is empty.</p>;
}
