/* Macintosh — the desktop startup hardware: a Macintosh 128K on the desk.
   The chassis is `mac-128k.svg` (by itomato, CC0, via Wikimedia Commons). */

import macSvg from '../assets/mac-128k.svg?raw';
import { MAC_GEOMETRY } from '../lib/startupGeometry';
import StartupScene, { type StartupDeviceProps } from './StartupScene';

/* The artwork's viewBox is 835.2×775.82, with the case 493.7 wide and its
   screen centred on x≈396.8. Drawn at 0.8386× the case is 414 wide; the
   offsets centre the screen on x=310 and rest the foot on the desk, which
   puts the artwork's screen just inside MAC_GEOMETRY.glass. */
const ART_SCALE = 0.8386;
const ART_X = -22.8;
const ART_Y = 11.6;

/* Inlined rather than drawn as an <image>, so it's there on the first frame
   (no async decode when the scene remounts for shutdown) and stays sharp
   through the dive. The artwork's own floor shadows (a blurred trapezoid and
   a dark band under the foot) are dropped: the Mac floats now, and the scene
   casts its shadow on the floor below. */
const BAKED_SHADOWS = ['path8297-9', 'rect2818-9-0-2-2-9'];
const ART_MARKUP = BAKED_SHADOWS.reduce(
  (markup, id) => markup.replace(new RegExp(`<[a-z]+ id="${id}"[^>]*/>`), ''),
  macSvg.slice(macSvg.indexOf('>', macSvg.indexOf('<svg')) + 1, macSvg.lastIndexOf('</svg>')),
);

const INK = '#5d5843';

export default function Macintosh(props: StartupDeviceProps) {
  return (
    <StartupScene
      {...props}
      geometry={MAC_GEOMETRY}
      prompt="click to start"
      glassRx={6}
      cable={{ edge: '#36332a', body: '#a8a28b', width: 1.9 }}
      plug={
        // The keyboard cord's RJ-11 plug, seated in the port on the base
        <g>
          <rect x="458.5" y="529" width="16" height="19" rx="1.6" fill="#d4cfbb" stroke="#5c5746" strokeWidth="0.8" />
          <rect x="461" y="531.5" width="11" height="3.5" rx="0.6" fill="#8d8873" opacity="0.7" />
          <rect x="462" y="546.5" width="9" height="9" rx="2.2" fill="#9f9a84" stroke="#45412f" strokeWidth="0.6" />
        </g>
      }
      chassis={
        <g
          transform={`translate(${ART_X} ${ART_Y}) scale(${ART_SCALE})`}
          dangerouslySetInnerHTML={{ __html: ART_MARKUP }}
        />
      }
    >
      {/* AndyOS badge on the front panel, beside the case's logo plate */}
      <g transform="translate(142,430) scale(0.74)" fill={INK}>
        <path d="M17 3 Q22 3 21 9 Q16 9 17 3 Z" />
        <path
          d="M16 9 C10 7 4 11 5 19 C6 27 11 30 14 28 C15 27 17 27 18 28
             C21 30 26 27 27 19 C28 12 23 8 18 10 C20 12 21 15 19 16
             C16 17 14 13 16 9 Z"
        />
      </g>
      <text x="178" y="449" fill={INK} fontFamily='"Press Start 2P", monospace' fontSize="10">
        AndyOS
      </text>
    </StartupScene>
  );
}
