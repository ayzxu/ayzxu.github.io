/* ==========================================================================
   GamesWindow — the Games folder. Holds Minesweeper and Snake; Andy Chess
   lives on the desktop proper, not in here.
   ========================================================================== */

import { MineIcon, SnakeIcon } from '../components/PixelIcons';
import type { WindowId } from '../components/windowConfig';

type GamesWindowProps = {
  onOpenWindow: (id: WindowId) => void;
};

const GAMES: { id: WindowId; label: string; icon: React.ReactNode }[] = [
  { id: 'minesweeper', label: 'Minesweeper', icon: <MineIcon className="folder-app-glyph" /> },
  { id: 'snake', label: 'Snake', icon: <SnakeIcon className="folder-app-glyph" /> },
];

export default function GamesWindow({ onOpenWindow }: GamesWindowProps) {
  return (
    <>
      <p className="win-meta" style={{ marginTop: 0 }}>
        {GAMES.length} items
      </p>
      <div className="folder-app-row">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className="folder-app"
            onClick={() => onOpenWindow(g.id)}
          >
            <span className="folder-app-icon">{g.icon}</span>
            <span className="folder-app-label">{g.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
