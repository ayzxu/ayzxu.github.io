/* ==========================================================================
   ReadMeWindow — the intro window, opened by default when the desktop boots.
   Mirrors the old Home hero: greeting, blurb, portrait and social links.
   ========================================================================== */

import { intro, socials } from '../data/content';
import type { WindowId } from '../components/windowConfig';

type ReadMeWindowProps = {
  onOpenWindow: (id: WindowId) => void;
};

export default function ReadMeWindow({ onOpenWindow }: ReadMeWindowProps) {
  return (
    <div className="readme-content">
      <div className="win-h">{intro.heading}</div>

      <img
        src={intro.portrait}
        alt="Andy Xu"
        decoding="async"
        className="bw-img pixelated readme-portrait"
      />

      <p>{intro.body}</p>

      <p style={{ marginTop: 10 }}>
        <button
          type="button"
          className="mac-button default"
          onClick={() => onOpenWindow('resume')}
        >
          View Résumé
        </button>
      </p>

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
    </div>
  );
}
