/* ==========================================================================
   ProjectWindow — a full case-study window for a single project, opened by
   double-clicking its document icon in the Projects folder. Renders the
   richer project metadata (tech stack, year, impact metrics) consistently.
   ========================================================================== */

import type { Project } from '../data/projects';
import Thumb from '../components/Thumb';
import type { WindowId } from '../components/windowConfig';

type ProjectWindowProps = {
  project: Project;
  onOpenImage: (src: string, alt: string) => void;
  onOpenWindow: (id: WindowId) => void;
};

export default function ProjectWindow({
  project: p,
  onOpenImage,
  onOpenWindow,
}: ProjectWindowProps) {
  return (
    <>
      <div className="win-h">{p.title}</div>
      <div className="win-meta">
        {p.date} · {p.year}
      </div>

      {p.techStack.length > 0 && (
        <div className="project-tags">
          {p.techStack.map((t) => (
            <span key={t} className="project-tag">
              {t}
            </span>
          ))}
        </div>
      )}

      <p style={{ marginTop: 10 }}>{p.description}</p>

      {p.impact && p.impact.length > 0 && (
        <>
          <hr className="mac-rule" />
          <div className="win-sub">Impact</div>
          <div style={{ marginTop: 6 }}>
            {p.impact.map((line, i) => (
              <p key={i} style={{ margin: '3px 0' }}>
                • {line}
              </p>
            ))}
          </div>
        </>
      )}

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
    </>
  );
}
