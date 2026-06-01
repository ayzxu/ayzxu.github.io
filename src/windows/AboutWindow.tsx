/* ==========================================================================
   AboutWindow — the About Me folder contents: portraits, background blurb,
   the full work-experience history and a closing note.
   ========================================================================== */

import { about, experience } from '../data/content';

type AboutWindowProps = {
  onOpenImage: (src: string, alt: string) => void;
};

export default function AboutWindow({ onOpenImage }: AboutWindowProps) {
  return (
    <>
      <div className="win-h">About Me</div>

      <div className="thumb-row">
        {about.portraits.map((img) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            loading="lazy"
            decoding="async"
            className="thumb bw-img pixelated"
            onClick={() => onOpenImage(img.src, img.alt)}
          />
        ))}
      </div>

      <p style={{ marginTop: 10 }}>{about.background}</p>

      <hr className="mac-rule" />

      <div className="win-sub">Experience</div>

      {experience.map((exp, i) => (
        <div key={`${exp.org}-${exp.dates}`} className="win-block">
          <div className="win-sub" style={{ fontSize: 8, marginTop: 12 }}>
            {exp.role}
          </div>
          <div className="win-meta">
            <a href={exp.url} target="_blank" rel="noreferrer">
              {exp.org}
            </a>{' '}
            — {exp.location} — {exp.dates}
          </div>

          <div style={{ marginTop: 6 }}>
            {exp.bullets.map((b, j) => (
              <p key={j} style={{ margin: '3px 0' }}>
                • {b}
              </p>
            ))}
          </div>

          {exp.images && exp.images.length > 0 && (
            <div className="thumb-row">
              {exp.images.map((img) => (
                <img
                  key={img.src}
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  decoding="async"
                  className="thumb bw-img pixelated"
                  onClick={() => onOpenImage(img.src, img.alt)}
                />
              ))}
            </div>
          )}

          {i < experience.length - 1 && <hr className="mac-rule" />}
        </div>
      ))}

      <hr className="mac-rule" />

      <p>{about.closing}</p>
    </>
  );
}
