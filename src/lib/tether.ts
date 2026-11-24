/* tether — the cable that hangs from the floating machine and runs off the
   bottom of the frame: the Mac's coiled keyboard cord, the iPhone's charging
   cable. It's rebuilt every frame from where the plug is (the machine bobs
   and rolls), so it flexes as the machine floats.

   The hang is one cubic Bézier: straight down out of the plug, through a sag
   that trails the machine's motion by a beat, to a fixed point off-frame. A
   coiled cord winds loops along that curve: a circle travelling down the
   cable, seen side-on, is a prolate cycloid, which is exactly the look of a
   telephone cord. All in scene units. */

export type Tether = {
  /** Where it plugs into the machine, with the machine at rest */
  port: { x: number; y: number };
  /** How far it falls straight out of the plug before it starts to curve */
  drop: number;
  /** The low point the cable sags through */
  sag: { x: number; y: number };
  /** Where it leaves the frame (fixed: the far end isn't attached to the
      floating machine) */
  end: { x: number; y: number };
  /** Coil radius and the length of cable per loop; radius 0 = a plain cable */
  coil: { radius: number; pitch: number };
  /** Straight length at the plug before the coils start */
  lead: number;
};

type Pt = { x: number; y: number };

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, u: number): Pt {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** The cable's path and its drawn length (loops included, which is what a
    pulse of light travelling along it has to cover). `plug` is the port's
    current position; `sway` shifts the sag, so the slack swings behind the
    machine's motion. */
export function tetherPath(t: Tether, plug: Pt, sway: Pt): { d: string; length: number } {
  const p0 = plug;
  const p1 = { x: plug.x, y: plug.y + t.drop };
  const p2 = { x: t.sag.x + sway.x, y: t.sag.y + sway.y };
  const p3 = t.end;

  // The centreline, finely sampled, with its arc length.
  const N = 96;
  const line: Pt[] = [];
  const arc: number[] = [0];
  for (let i = 0; i <= N; i++) {
    line.push(bezier(p0, p1, p2, p3, i / N));
    if (i > 0) {
      arc.push(arc[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y));
    }
  }
  const total = arc[N];

  const { radius, pitch } = t.coil;
  if (radius <= 0) {
    let d = `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}`;
    for (let i = 1; i <= N; i++) d += `L${line[i].x.toFixed(2)} ${line[i].y.toFixed(2)}`;
    return { d, length: total };
  }

  // Walk the centreline at a fixed step, winding the coil around it.
  const step = pitch / 14;
  let d = '';
  let length = 0;
  let prev: Pt | null = null;
  let seg = 0;
  for (let s = 0; s <= total; s += step) {
    while (seg < N - 1 && arc[seg + 1] < s) seg++;
    const f = (s - arc[seg]) / Math.max(1e-6, arc[seg + 1] - arc[seg]);
    const a = line[seg];
    const b = line[seg + 1];
    const c = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    // Coils swell in just past the plug's straight lead.
    const r = radius * Math.min(1, Math.max(0, (s - t.lead) / (pitch * 1.5)));
    const phi = ((s - t.lead) / pitch) * Math.PI * 2;
    const along = r * 0.95 * Math.sin(phi);
    const across = r * (1 - Math.cos(phi));
    const pt = { x: c.x + tx * along - ty * across, y: c.y + ty * along + tx * across };
    d += `${prev ? 'L' : 'M'}${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    if (prev) length += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return { d, length };
}
