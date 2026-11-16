/* Iphone — the startup hardware on phone-sized viewports, where the desktop
   renders as an iOS-style home screen. */

import iphoneClipart from '../assets/iphone.png';
import { IPHONE_GEOMETRY } from '../lib/startupGeometry';
import StartupScene, { type StartupDeviceProps } from './StartupScene';

/* The bitmap is 873×1530 with its white screen at (123,174)→(719,1238). Drawn
   at 0.366× with these offsets, that screen sits just inside
   IPHONE_GEOMETRY.glass and the foot rests on the desk. */
const ART_SCALE = 0.366;
const ART_X = 45.9;
const ART_Y = 17;

export default function Iphone(props: StartupDeviceProps) {
  return (
    <StartupScene
      {...props}
      geometry={IPHONE_GEOMETRY}
      prompt="tap to start"
      glassRx={4}
      pool={{ cy: 500, rx: 220 }}
      sideFade={120}
      footShadow={{ x: 84, y: 529, w: 232, h: 13 }}
      chassis={
        <image
          href={iphoneClipart}
          x={ART_X}
          y={ART_Y}
          width={873 * ART_SCALE}
          height={1530 * ART_SCALE}
        />
      }
    />
  );
}
