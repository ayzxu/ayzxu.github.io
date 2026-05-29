/* ==========================================================================
   ReadMeWindow — the intro window, opened by default when the desktop boots.
   Mirrors the old Home hero: greeting, blurb, portrait and social links.
   ========================================================================== */

import { intro, socials } from '../data/content';

export default function ReadMeWindow() {
  return (
    <>
      <div className="win-h">{intro.heading}</div>

      <img
        src={intro.portrait}
        alt="Andy Xu"
        className="bw-img pixelated readme-portrait"
      />

      <p>{intro.body}</p>

      <hr className="mac-rule" />

      <div className="win-sub">Find me online</div>
      <p style={{ marginTop: 8 }}>
        {socials.map((s, i) => (
          <span key={s.name}>
            <a
              href={s.url}
              target={s.url.startsWith('http') ? '_blank' : undefined}
              rel={s.url.startsWith('http') ? 'noreferrer' : undefined}
            >
              {s.name}
            </a>
            {i < socials.length - 1 ? '  •  ' : ''}
          </span>
        ))}
      </p>

      <p className="win-meta" style={{ marginTop: 14 }}>
        Double-click a folder on the desktop to explore.
      </p>
    </>
  );
}
