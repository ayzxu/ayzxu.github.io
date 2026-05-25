/* ==========================================================================
   ProjectsWindow — the Projects folder contents. Each project is a content
   block with a pixel-font title, date, description, optional repo link and
   click-to-enlarge 1-bit thumbnails.
   ========================================================================== */

import { projects } from '../data/content';

type ProjectsWindowProps = {
  onOpenImage: (src: string, alt: string) => void;
};

export default function ProjectsWindow({ onOpenImage }: ProjectsWindowProps) {
  return (
    <>
      {projects.map((p, i) => (
        <div key={p.title} className="win-block">
          <div className="win-sub">{p.title}</div>
          <div className="win-meta">{p.date}</div>
          <p style={{ marginTop: 6 }}>{p.description}</p>

          {p.link && (
            <p>
              <a href={p.link} target="_blank" rel="noreferrer">
                View on GitHub
              </a>
            </p>
          )}

          {p.images && p.images.length > 0 && (
            <div className="thumb-row">
              {p.images.map((img) => (
                <img
                  key={img.src}
                  src={img.src}
                  alt={img.alt}
                  className="thumb bw-img pixelated"
                  onClick={() => onOpenImage(img.src, img.alt)}
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
