/* ==========================================================================
   WritingsWindow — the Writings folder. Each essay ships as an "AndyWrite
   document" icon; opening one launches a read-only AndyWrite reader window
   (`writing-<slug>`).
   ========================================================================== */

import { writings } from '../data/writings';
import { AndyWriteIcon } from '../components/PixelIcons';
import { writingWindowId, type WindowId } from '../components/windowConfig';

type WritingsWindowProps = {
  onOpenWindow: (id: WindowId) => void;
};

export default function WritingsWindow({ onOpenWindow }: WritingsWindowProps) {
  return (
    <>
      <p className="win-meta" style={{ marginTop: 0 }}>
        {writings.length} items — AndyWrite documents
      </p>
      <div className="folder-doc-grid">
        {writings.map((w) => (
          <button
            key={w.slug}
            type="button"
            className="folder-app folder-doc"
            onClick={() => onOpenWindow(writingWindowId(w.slug))}
            title={w.blurb}
          >
            <span className="folder-app-icon">
              <AndyWriteIcon className="folder-app-glyph" />
            </span>
            <span className="folder-app-label">{w.title}</span>
            <span className="folder-doc-meta">
              {w.date} · {w.readTime}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
