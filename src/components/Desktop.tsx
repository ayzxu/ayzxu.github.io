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
import {
  DocumentIcon,
  FolderIcon,
  TrashIcon,
  ChessIcon,
  MusicIcon,
  TrophyIcon,
  TerminalIcon,
  AsteroidsIcon,
} from './PixelIcons';
import AchievementToast from './AchievementToast';
import Screensaver from './Screensaver';
import {
  WINDOW_META,
  getWindowMeta,
  routeForWindow,
  projectSlugFromWindowId,
  writingSlugFromWindowId,
  type WindowId,
} from './windowConfig';
import { getProject } from '../data/projects';
import { getWriting } from '../data/writings';
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
  type MarqueeRect,
} from '../lib/iconLayout';
import { useIconDrag } from './useIconDrag';
import { useMarqueeSelect } from './useMarqueeSelect';
import ShadowUser from './ShadowUser';
import ShadowOrb from './ShadowOrb';
import { playBasso, playWindowClick } from '../lib/sounds';

import ReadMeWindow from '../windows/ReadMeWindow';
import ProjectsWindow from '../windows/ProjectsWindow';
import ProjectWindow from '../windows/ProjectWindow';
import WritingsWindow from '../windows/WritingsWindow';
import WritingReaderWindow from '../windows/WritingReaderWindow';
import TerminalWindow from '../windows/TerminalWindow';
import FunWindow from '../windows/FunWindow';
import AboutWindow from '../windows/AboutWindow';
import ResumeWindow from '../windows/ResumeWindow';
import ChessWindow from '../windows/ChessWindow';
import NewsWindow from '../windows/NewsWindow';
import PaintWindow from '../windows/PaintWindow';
import AndyWriteWindow from '../windows/AndyWriteWindow';
import MusicWindow from '../windows/MusicWindow';
import PuzzleWindow from '../windows/PuzzleWindow';
import AchievementsWindow from '../windows/AchievementsWindow';
import CalculatorWindow from '../windows/CalculatorWindow';
import GamesWindow from '../windows/GamesWindow';
import AppsWindow from '../windows/AppsWindow';
import MinesweeperWindow from '../windows/MinesweeperWindow';
import SnakeWindow from '../windows/SnakeWindow';
import AsteroidsWindow from '../windows/AsteroidsWindow';
import TrashWindow from '../windows/TrashWindow';
import desktopBg1 from '../assets/backgrounds/bg1.webp';
import desktopBg2 from '../assets/backgrounds/bg2.webp';
import desktopBg3 from '../assets/backgrounds/bg3.webp';
import desktopBg4 from '../assets/backgrounds/bg4.webp';
import desktopBg5 from '../assets/backgrounds/bg5.webp';

/* Desktop wallpapers cycle with a slow crossfade. The starting wallpaper is
   randomized per visit (chosen once at module load so it survives remounts). */
const DESKTOP_BACKGROUNDS = [desktopBg1, desktopBg2, desktopBg3, desktopBg4, desktopBg5];
const INITIAL_BG_INDEX = Math.floor(Math.random() * DESKTOP_BACKGROUNDS.length);
const BG_ROTATE_INTERVAL_MS = 30_000;

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
  { id: 'writings', label: 'Writings', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'music', label: 'AndyMusic', icon: <MusicIcon className="w-full h-full" /> },
  { id: 'achievements', label: 'Achievements', icon: <TrophyIcon className="w-full h-full" /> },
  { id: 'games', label: 'Games', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'apps', label: 'Apps', icon: <FolderIcon className="w-full h-full" /> },
  { id: 'terminal', label: 'MacTerminal', icon: <TerminalIcon className="w-full h-full" /> },
  { id: 'asteroids', label: 'Asteroids', icon: <AsteroidsIcon className="w-full h-full" /> },
  { id: 'trash', label: 'Trash', icon: <TrashIcon className="w-full h-full" /> },
];

function buildInitialWindows(initialWindow?: WindowId): OpenWin[] {
  const viewport = getViewport();
  const readmeSize = getDefaultWindowSize(WINDOW_META.readme, viewport);
  const readmePos = centerWindowPosition(readmeSize, viewport);
  const wins: OpenWin[] = [{ id: 'readme', ...readmePos }];
  if (initialWindow && initialWindow !== 'readme') {
    const off = getCascadeOffset(viewport);
    const size = getDefaultWindowSize(getWindowMeta(initialWindow), viewport);
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

/* --- visited tracking — feeds the Read Me "check these out" checklist ------ */
const VISITED_STORAGE_KEY = 'visited-windows';

function readVisitedWindows(): Set<WindowId> {
  try {
    const raw = localStorage.getItem(VISITED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed) ? (parsed.filter((x) => typeof x === 'string') as WindowId[]) : [],
    );
  } catch {
    return new Set();
  }
}

export default function Desktop({ initialWindow, onShutDown }: DesktopProps) {
  const navigate = useNavigate();
  const viewport = useViewport();
  const compactIcons = isCompactIcons(viewport);
  const maxWindowSize = getMaxWindowSize(viewport);
  const prevCompact = useRef(compactIcons);

  /* Rotating wallpaper: advance every BG_ROTATE_INTERVAL_MS; layers crossfade
     via CSS opacity transitions (see .mac-desktop-bg in index.css). */
  const [bgIndex, setBgIndex] = useState(INITIAL_BG_INDEX);
  useEffect(() => {
    const t = setInterval(
      () => setBgIndex((i) => (i + 1) % DESKTOP_BACKGROUNDS.length),
      BG_ROTATE_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, []);

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
  /* Rubber-band drawn by the AndyAI shadow user (see ShadowUser.tsx) — kept
     here so it renders inside the icon layer with true desktop stacking. */
  const [ghostMarquee, setGhostMarquee] = useState<MarqueeRect | null>(null);
  /* Bumped by "Replay Tour" in the Apple menu — remounts the AndyAI tour;
     nonzero also tells it to bypass its played-once memory. */
  const [tourNonce, setTourNonce] = useState(0);
  const [visited, setVisited] = useState<Set<WindowId>>(readVisitedWindows);

  /* Every window that gets opened (icon, menu, deep link, checklist) lands in
     openWins, so watching it is enough to keep the visited set current. */
  useEffect(() => {
    setVisited((prev) => {
      if (openWins.every((w) => prev.has(w.id))) return prev;
      const next = new Set(prev);
      for (const w of openWins) next.add(w.id);
      try {
        localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable — checklist still works for this session */
      }
      return next;
    });
  }, [openWins]);
  const [busy, setBusy] = useState(false);
  const busyTimer = useRef<number | null>(null);
  /* Windows asked to open while another is "loading" — drained in order */
  const openQueue = useRef<WindowId[]>([]);

  /* Toggle the hourglass cursor on <body> while a window is "loading".
     The cleanup also runs on unmount, so shutting down mid-load can't leave
     the hourglass cursor stuck on the exterior screen. */
  useEffect(() => {
    document.body.classList.toggle('mac-busy', busy);
    return () => document.body.classList.remove('mac-busy');
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
      const size = getDefaultWindowSize(getWindowMeta(id), viewport);
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
    // New window → flash the hourglass for a beat, then mount it. Opens
    // requested while one is already "loading" are queued, not dropped.
    if (busyTimer.current !== null) {
      if (!openQueue.current.includes(id)) openQueue.current.push(id);
      return;
    }
    setBusy(true);
    const delay =
      OPEN_DELAY_MIN_MS +
      Math.random() * (OPEN_DELAY_MAX_MS - OPEN_DELAY_MIN_MS);
    busyTimer.current = window.setTimeout(() => {
      busyTimer.current = null;
      setBusy(false);
      mountWindow(id);
      playWindowClick(true);
      const next = openQueue.current.shift();
      if (next) openWindow(next);
    }, delay);
  };

  const openDropGuard = () => {
    // Classic Mac error beep as the "don't do that" dialog pops up.
    playBasso();
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
    // iPhone mode: a single tap launches the app
    openOnSingleTap: compactIcons,
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
    const route = top ? routeForWindow(top.id) : undefined;
    navigate(route ?? '/desktop', { replace: true });
  }, [openWins, navigate]);

  const closeWindow = (id: WindowId) => {
    if (openWins.some((w) => w.id === id)) playWindowClick(false);
    setOpenWins((wins) => wins.filter((w) => w.id !== id));
  };

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

  /* iPhone mode: the home button returns to the icon grid — every "app"
     closes, like pressing home on an actual iPhone. */
  const goHome = () => setOpenWins([]);

  const onOpenImage = (src: string, alt: string) => setLightbox({ src, alt });

  return (
    <div className="desktop-root mac-desktop-surface">
      {DESKTOP_BACKGROUNDS.map((bg, i) => (
        <div
          key={bg}
          aria-hidden
          className="mac-desktop-bg"
          style={
            {
              '--desktop-bg': `url(${bg})`,
              opacity: i === bgIndex ? 1 : 0,
            } as React.CSSProperties
          }
        />
      ))}
      <MenuBar
        onOpenWindow={openWindow}
        onCloseActive={closeActive}
        onShutDown={onShutDown}
        onReplayTour={() => setTourNonce((n) => n + 1)}
        hasActiveWindow={openWins.length > 0}
      />

      <div
        ref={layerRef}
        className={[
          'desktop-icons-layer',
          compactIcons && 'desktop-icons-layer--ios',
          iconLayerActive && 'desktop-icons-layer--active',
        ]
          .filter(Boolean)
          .join(' ')}
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
        {ghostMarquee && ghostMarquee.width + ghostMarquee.height > 0 && (
          <div
            className="selection-marquee"
            style={{
              left: ghostMarquee.left,
              top: ghostMarquee.top,
              width: ghostMarquee.width,
              height: ghostMarquee.height,
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
        const meta = getWindowMeta(win.id);
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
            // iPhone mode: apps go fullscreen; system alerts stay dialogs
            fullscreen={compactIcons && win.id !== 'dropguard'}
            onHome={goHome}
          >
            {renderWindow(win.id, onOpenImage, openWindow, closeWindow, visited)}
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

      {compactIcons ? (
        <ShadowOrb
          key={tourNonce}
          viewport={viewport}
          iconPositions={iconPositions}
          replay={tourNonce > 0}
          // Deep-linked boot: the orb narrates without pressing anything, so
          // the tour never navigates the visitor away from shared content.
          passive={initialWindow !== undefined && initialWindow !== 'readme'}
          onSelectIcons={(ids) => setSelectedIcons(new Set(ids))}
          onOpenWindow={openWindow}
          onCloseWindow={closeWindow}
        />
      ) : (
        <ShadowUser
          key={tourNonce}
          viewport={viewport}
          iconPositions={iconPositions}
          replay={tourNonce > 0}
          onMarquee={setGhostMarquee}
          onSelectIcons={(ids) => setSelectedIcons(new Set(ids))}
          onMoveIcon={(id, pos) =>
            setIconPositions((prev) => ({ ...prev, [id]: pos }))
          }
          onOpenWindow={openWindow}
          onCloseWindow={closeWindow}
        />
      )}

      <AchievementToast />

      <Screensaver />
    </div>
  );
}

function renderWindow(
  id: WindowId,
  onOpenImage: (src: string, alt: string) => void,
  onOpenWindow: (id: WindowId) => void,
  onCloseWindow: (id: WindowId) => void,
  visited: Set<WindowId>,
): React.ReactNode {
  /* Dynamic document windows: project case studies and writing readers */
  const projectSlug = projectSlugFromWindowId(id);
  if (projectSlug !== null) {
    const project = getProject(projectSlug);
    return project ? (
      <ProjectWindow
        project={project}
        onOpenImage={onOpenImage}
        onOpenWindow={onOpenWindow}
      />
    ) : null;
  }
  const writingSlug = writingSlugFromWindowId(id);
  if (writingSlug !== null) {
    const writing = getWriting(writingSlug);
    return writing ? <WritingReaderWindow writing={writing} /> : null;
  }

  switch (id) {
    case 'readme':
      return <ReadMeWindow onOpenWindow={onOpenWindow} visited={visited} />;
    case 'projects':
      return <ProjectsWindow onOpenWindow={onOpenWindow} />;
    case 'fun':
      return <FunWindow onOpenImage={onOpenImage} />;
    case 'about':
      return <AboutWindow onOpenImage={onOpenImage} />;
    case 'resume':
      return <ResumeWindow />;
    case 'chess':
      return <ChessWindow />;
    case 'news':
      return <NewsWindow />;
    case 'paint':
      return <PaintWindow />;
    case 'andywrite':
      return <AndyWriteWindow />;
    case 'writings':
      return <WritingsWindow onOpenWindow={onOpenWindow} />;
    case 'terminal':
      return (
        <TerminalWindow
          onOpenWindow={onOpenWindow}
          onClose={() => onCloseWindow('terminal')}
        />
      );
    case 'music':
      return <MusicWindow />;
    case 'puzzle':
      return <PuzzleWindow />;
    case 'achievements':
      return <AchievementsWindow />;
    case 'calc':
      return <CalculatorWindow />;
    case 'games':
      return <GamesWindow onOpenWindow={onOpenWindow} />;
    case 'apps':
      return <AppsWindow onOpenWindow={onOpenWindow} />;
    case 'minesweeper':
      return <MinesweeperWindow />;
    case 'snake':
      return <SnakeWindow />;
    case 'asteroids':
      return <AsteroidsWindow />;
    case 'aboutmac':
      return <AboutMacContent />;
    case 'trash':
      return <TrashWindow />;
    case 'dropguard':
      return <DropGuardContent />;
    default:
      return null;
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
