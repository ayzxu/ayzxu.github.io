/* ==========================================================================
   ProjectsWindow — the Projects folder contents. Each project is a content
   block with a pixel-font title, date, description, optional repo link and
   click-to-enlarge 1-bit thumbnails.
   ========================================================================== */

import { projects } from '../data/content';
import Thumb from '../components/Thumb';
import type { WindowId } from '../components/windowConfig';

type ProjectsWindowProps = {
  onOpenImage: (src: string, alt: string) => void;
  onOpenWindow: (id: WindowId) => void;
};

export default function ProjectsWindow({
  onOpenImage,
  onOpenWindow,
}: ProjectsWindowProps) {
  return (
    <>
      {projects.map((p, i) => (
        <div key={p.title} className="win-block">
          <div className="win-sub">{p.title}</div>
          <div className="win-meta">{p.date}</div>
          <p style={{ marginTop: 6 }}>{p.description}</p>

          {p.openApp ? (
            <p>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenWindow(p.openApp!);
                }}
              >
                {p.openAppLabel ?? 'Open'}
              </a>
            </p>
          ) : (
            p.link && (
              <p>
                <a href={p.link} target="_blank" rel="noreferrer">
                  View on GitHub
                </a>
              </p>
            )
          )}

          {p.images && p.images.length > 0 && (
            <div className="thumb-row">
              {p.images.map((img) => (
                <Thumb
                  key={img.src}
                  src={img.src}
                  alt={img.alt}
                  onOpen={onOpenImage}
                />
              ))}
            </div>
          )}

          {i < projects.length - 1 && <hr className="mac-rule" />}
        </div>
      ))}
    </>
  );
}
