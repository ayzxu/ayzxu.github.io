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
   through the dive. */
const ART_MARKUP = macSvg.slice(
  macSvg.indexOf('>', macSvg.indexOf('<svg')) + 1,
  macSvg.lastIndexOf('</svg>'),
);

const INK = '#5d5843';

export default function Macintosh(props: StartupDeviceProps) {
  return (
    <StartupScene
      {...props}
      geometry={MAC_GEOMETRY}
      prompt="click to start"
      glassRx={6}
      pool={{ cy: 540, rx: 300 }}
      sideFade={200}
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
