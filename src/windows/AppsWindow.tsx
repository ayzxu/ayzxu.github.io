/* ==========================================================================
   AppsWindow — the Apps folder. Holds the everyday utilities (Calculator,
   Paint, AndyWrite, News) so they don't clutter the desktop / home screen.
   ========================================================================== */

import {
  AndyWriteIcon,
  CalcIcon,
  NewsIcon,
  PaintIcon,
} from '../components/PixelIcons';
import type { WindowId } from '../components/windowConfig';

type AppsWindowProps = {
  onOpenWindow: (id: WindowId) => void;
};

const APPS: { id: WindowId; label: string; icon: React.ReactNode }[] = [
  { id: 'calc', label: 'Calculator', icon: <CalcIcon className="folder-app-glyph" /> },
  { id: 'paint', label: 'Paint', icon: <PaintIcon className="folder-app-glyph" /> },
  { id: 'andywrite', label: 'AndyWrite', icon: <AndyWriteIcon className="folder-app-glyph" /> },
  { id: 'news', label: 'News', icon: <NewsIcon className="folder-app-glyph" /> },
];

export default function AppsWindow({ onOpenWindow }: AppsWindowProps) {
  return (
    <>
      <p className="win-meta" style={{ marginTop: 0 }}>
        {APPS.length} items
      </p>
      <div className="folder-app-row">
        {APPS.map((a) => (
          <button
            key={a.id}
            type="button"
            className="folder-app"
            onClick={() => onOpenWindow(a.id)}
          >
            <span className="folder-app-icon">{a.icon}</span>
            <span className="folder-app-label">{a.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
