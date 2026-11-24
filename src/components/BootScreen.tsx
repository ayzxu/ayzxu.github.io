/* BootScreen — what the tube shows between switching on and the desktop: the
   Happy Mac, with the welcome typing itself out beneath.

   It's laid over the live desktop inside the screen layer, viewport-sized
   like the desktop, so the camera carries both at once and the hand-off
   between them is just this cover fading. App drives it frame by frame
   through the refs: the cover's opacity, the typed text and the caret.

   The untyped remainder is kept in the line, invisibly, so the centred text
   never shifts as it types. */

import type { RefObject } from 'react';
import { WELCOME_TEXT } from '../lib/introTimeline';

type BootScreenProps = {
  coverRef: RefObject<HTMLDivElement | null>;
  typedRef: RefObject<HTMLSpanElement | null>;
  restRef: RefObject<HTMLSpanElement | null>;
  caretRef: RefObject<HTMLElement | null>;
};

export default function BootScreen({ coverRef, typedRef, restRef, caretRef }: BootScreenProps) {
  return (
    <div ref={coverRef} className="boot-screen" aria-hidden="true">
      <svg className="boot-happy-mac" viewBox="0 0 48 56" shapeRendering="crispEdges">
        <rect x="4" y="2" width="40" height="52" fill="#ffffff" stroke="#000000" strokeWidth="2" />
        <rect x="9" y="7" width="30" height="24" fill="#ffffff" stroke="#000000" strokeWidth="2" />
        <rect x="15" y="14" width="3" height="5" fill="#000000" />
        <rect x="30" y="14" width="3" height="5" fill="#000000" />
        <path d="M15 23 Q24 29 33 23" fill="none" stroke="#000000" strokeWidth="2" shapeRendering="auto" />
        <rect x="13" y="38" width="22" height="3" fill="#000000" />
        <rect x="13" y="45" width="10" height="3" fill="#000000" />
      </svg>
      <p className="boot-welcome">
        <span ref={typedRef} />
        <i ref={caretRef} className="boot-caret" />
        <span ref={restRef} className="boot-untyped">
          {WELCOME_TEXT}
        </span>
      </p>
    </div>
  );
}
