/* ==========================================================================
   Desktop — the interactive System 1 desktop. Owns window lifecycle (open /
   close / focus + z-order), desktop-icon selection, the shared image Lightbox
   and URL sync (deep links /projects, /fun, /about; otherwise /desktop).
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import MenuBar from './MenuBar';
import MacWindow from './MacWindow';
import DesktopIcon from './DesktopIcon';
import Lightbox from './Lightbox';
import { DocumentIcon, FolderIcon, TrashIcon, ChessIcon } from './PixelIcons';
import { WINDOW_META, ROUTE_FOR_WINDOW, type WindowId } from './windowConfig';
import { useViewport } from '../hooks/useViewport';
import {
  centerWindowPosition,
  clampWindowPosition,
  getCascadeOffset,
  getDefaultWindowSize,
  getMaxWindowSize,
  getViewport,
  isCompactIcons,
} from '../lib/windowBounds';
import {
  DESKTOP_ICON_IDS,
  getDefaultIconPositions,
  clampIconPosition,
  type DesktopIconId,
  type IconPositions,
} from '../lib/iconLayout';
import { useIconDrag } from './useIconDrag';
import { useMarqueeSelect } from './useMarqueeSelect';

import ReadMeWindow from '../windows/ReadMeWindow';
import ProjectsWindow from '../windows/ProjectsWindow';
import FunWindow from '../windows/FunWindow';
import AboutWindow from '../windows/AboutWindow';
import ResumeWindow from '../windows/ResumeWindow';
import ChessWindow from '../windows/ChessWindow';
import TrashWindow from '../windows/TrashWindow';
import desktopBg1 from '../assets/bg.jpg';
import desktopBg2 from '../assets/bg2.jpg';

/* Pick a desktop wallpaper at random for each visit. Chosen once at module
   load so it stays stable for the lifetime of the page. */
const DESKTOP_BACKGROUNDS = [desktopBg1, desktopBg2];
const desktopBg =
  DESKTOP_BACKGROUNDS[Math.floor(Math.random() * DESKTOP_BACKGROUNDS.length)];

type OpenWin = { id: WindowId; x: number; y: number };

/** Brief, randomized "loading" beat (with the hourglass cursor) before a
   window mounts — varying it slightly makes the "loading" feel less robotic. */
const OPEN_DELAY_MIN_MS = 150;
const OPEN_DELAY_MAX_MS = 350;

type DesktopProps = {
  /** Window to open on top at boot, derived from a deep-link route */
  initialWindow?: WindowId;
  onShutDown: () => void;
};

const DESKTOP_ICONS: {
  id: DesktopIconId;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'readme', label: 'Read Me', icon: <DocumentIcon className="w-full h-full" /> },
  { id: 'projects', label: 'Projects', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'fun', label: 'Fun', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'about', label: 'About Me', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'resume', label: 'Résumé', icon: <DocumentIcon className="w-full h-full" /> },
  { id: 'chess', label: 'Andy Chess', icon: <ChessIcon className="w-full h-full" /> },
  { id: 'trash', label: 'Trash', icon: <TrashIcon className="w-full h-full" /> },
];

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

function iconIdToWindow(id: DesktopIconId): WindowId {
  return id;
}

export default function Desktop({ initialWindow, onShutDown }: DesktopProps) {
  const navigate = useNavigate();
  const viewport = useViewport();
  const compactIcons = isCompactIcons(viewport);
  const maxWindowSize = getMaxWindowSize(viewport);
  const prevCompact = useRef(compactIcons);

  const [openWins, setOpenWins] = useState<OpenWin[]>(() =>
    buildInitialWindows(initialWindow),
  );
  const [selectedIcons, setSelectedIcons] = useState<Set<DesktopIconId>>(
    () => new Set(),
  );
  const [iconPositions, setIconPositions] = useState<IconPositions>(() => {
    const vp = getViewport();
    return getDefaultIconPositions(vp, isCompactIcons(vp));
  });
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const busyTimer = useRef<number | null>(null);

  /* Toggle the hourglass cursor on <body> while a window is "loading" */
  useEffect(() => {
    document.body.classList.toggle('mac-busy', busy);
  }, [busy]);

  /* Clear any pending open timer on unmount */
  useEffect(
    () => () => {
      if (busyTimer.current !== null) window.clearTimeout(busyTimer.current);
    },
    [],
  );

  /* Re-layout icons when switching column ↔ compact; clamp on mere resize */
  useEffect(() => {
    if (prevCompact.current !== compactIcons) {
      setIconPositions(getDefaultIconPositions(viewport, compactIcons));
      prevCompact.current = compactIcons;
      return;
    }
    setIconPositions((prev) => {
      const next = { ...prev };
      for (const id of DESKTOP_ICON_IDS) {
        next[id] = clampIconPosition(prev[id], viewport);
      }
      return next;
    });
  }, [compactIcons, viewport]);

  const mountWindow = (id: WindowId) =>
    setOpenWins((wins) => {
      if (wins.some((w) => w.id === id)) return wins;
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

  const openWindow = (id: WindowId) => {
    // Already open → bring it to the front instantly, no "loading".
    if (openWins.some((w) => w.id === id)) {
      setOpenWins((wins) => {
        const w = wins.find((x) => x.id === id);
        if (!w) return wins;
        return [...wins.filter((x) => x.id !== id), w];
      });
      return;
    }
    // New window → flash the hourglass for a beat, then mount it.
    if (busyTimer.current !== null) return; // one open at a time
    setBusy(true);
    const delay =
      OPEN_DELAY_MIN_MS +
      Math.random() * (OPEN_DELAY_MAX_MS - OPEN_DELAY_MIN_MS);
    busyTimer.current = window.setTimeout(() => {
      busyTimer.current = null;
      setBusy(false);
      mountWindow(id);
    }, delay);
  };

  const openDropGuard = () => {
    const size = getDefaultWindowSize(WINDOW_META.dropguard, viewport);
    const pos = centerWindowPosition(size, viewport);
    setOpenWins((wins) => {
      const rest = wins.filter((w) => w.id !== 'dropguard');
      return [...rest, { id: 'dropguard', ...pos }];
    });
  };

  const {
    draggingIds,
    onIconPointerDown,
    onIconPointerMove,
    onIconPointerUp,
  } = useIconDrag({
    positions: iconPositions,
    setPositions: setIconPositions,
    viewport,
    selectedIcons,
    onSelectSingle: (id) => setSelectedIcons(new Set([id])),
    onOpen: (id) => openWindow(iconIdToWindow(id)),
    onDropOnTarget: () => openDropGuard(),
  });

  const {
    layerRef,
    marquee,
    onSurfacePointerDown,
  } = useMarqueeSelect({
    iconPositions,
    onSelectionChange: setSelectedIcons,
    disabled: draggingIds.size > 0,
  });

  /* Only float the icon layer above windows while *dragging* an icon. During a
     marquee selection the layer (and its rubber-band) must stay below the open
     windows, preserving the on-screen stacking order. */
  const iconLayerActive = draggingIds.size > 0;

  /* Keep the URL in step with the topmost window so links stay shareable */
  useEffect(() => {
    const top = openWins[openWins.length - 1];
    const route = top ? ROUTE_FOR_WINDOW[top.id] : undefined;
    navigate(route ?? '/desktop', { replace: true });
  }, [openWins, navigate]);

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
    >
      <MenuBar
        onOpenWindow={openWindow}
        onCloseActive={closeActive}
        onShutDown={onShutDown}
        hasActiveWindow={openWins.length > 0}
      />

      <div
        ref={layerRef}
        className={
          iconLayerActive
            ? 'desktop-icons-layer desktop-icons-layer--active'
            : 'desktop-icons-layer'
        }
      >
        <div
          className="desktop-surface"
          onPointerDown={onSurfacePointerDown}
          aria-hidden
        />
        {marquee && marquee.width + marquee.height > 0 && (
          <div
            className="selection-marquee"
            style={{
              left: marquee.left,
              top: marquee.top,
              width: marquee.width,
              height: marquee.height,
            }}
          />
        )}
        {DESKTOP_ICONS.map((ic) => (
          <DesktopIcon
            key={ic.id}
            id={ic.id}
            label={ic.label}
            icon={ic.icon}
            x={iconPositions[ic.id].x}
            y={iconPositions[ic.id].y}
            selected={selectedIcons.has(ic.id)}
            dragging={draggingIds.has(ic.id)}
            onPointerDown={onIconPointerDown}
            onPointerMove={onIconPointerMove}
            onPointerUp={onIconPointerUp}
          />
        ))}
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
            {renderWindow(win.id, onOpenImage, openWindow)}
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

function renderWindow(
  id: WindowId,
  onOpenImage: (src: string, alt: string) => void,
  onOpenWindow: (id: WindowId) => void,
): React.ReactNode {
  switch (id) {
    case 'readme':
      return <ReadMeWindow onOpenWindow={onOpenWindow} />;
    case 'projects':
      return (
        <ProjectsWindow onOpenImage={onOpenImage} onOpenWindow={onOpenWindow} />
      );
    case 'fun':
      return <FunWindow onOpenImage={onOpenImage} />;
    case 'about':
      return <AboutWindow onOpenImage={onOpenImage} />;
    case 'resume':
      return <ResumeWindow />;
    case 'chess':
      return <ChessWindow />;
    case 'aboutmac':
      return <AboutMacContent />;
    case 'trash':
      return <TrashWindow />;
    case 'dropguard':
      return <DropGuardContent />;
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

function DropGuardContent() {
  return (
    <p style={{ margin: 0 }}>
      Don&apos;t do that, I didn&apos;t think that far yet.
    </p>
  );
}
