/* ==========================================================================
   ProjectsWindow — the Projects folder, Finder-style. Each project is a
   document icon; opening one launches a full case-study window
   (`project-<slug>`) with room to breathe, instead of one flat list.
   ========================================================================== */

import { projects } from '../data/projects';
import { DocumentIcon } from '../components/PixelIcons';
import { projectWindowId, type WindowId } from '../components/windowConfig';

type ProjectsWindowProps = {
  onOpenWindow: (id: WindowId) => void;
};

export default function ProjectsWindow({ onOpenWindow }: ProjectsWindowProps) {
  return (
    <>
      <p className="win-meta" style={{ marginTop: 0 }}>
        {projects.length} items
      </p>
      <div className="folder-doc-grid">
        {projects.map((p) => (
          <button
            key={p.slug}
            type="button"
            className="folder-app folder-doc"
            onClick={() => onOpenWindow(projectWindowId(p.slug))}
            title={`Open ${p.title}`}
          >
            <span className="folder-app-icon">
              <DocumentIcon className="folder-app-glyph" />
            </span>
            <span className="folder-app-label">{p.title}</span>
            <span className="folder-doc-meta">{p.date}</span>
          </button>
        ))}
      </div>
    </>
  );
}
