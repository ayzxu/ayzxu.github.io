/* ==========================================================================
   AsteroidsWindow — a System 1 orbital map of the asteroids making a close
   approach to Earth today, pulled live from NASA's public NeoWs feed. Earth
   sits at the centre; each near-Earth object orbits as a 1-bit dot placed by
   its miss distance, leaving a stippled trail behind it. Point at (or tap) an
   asteroid to see its name, stats and a link to its page on NASA/JPL.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNeoFeed, type NearEarthObject } from '../lib/asteroids';

type FetchState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; objects: NearEarthObject[]; fetchedAt: Date };

/* Per-asteroid render model. Orbit size is stored as a fraction (0..1) of the
   available radius so the layout reflows when the window is resized; the actual
   pixel geometry is derived from the canvas size every frame. */
type Body = {
  neo: NearEarthObject;
  orbitFrac: number; // 0 (closest) .. 1 (farthest) → maps to orbit radius
  ecc: number; // orbit ellipse flattening
  rot: number; // ellipse rotation (rad)
  angle: number; // current position along the orbit (rad), mutated each frame
  dir: 1 | -1; // travel direction
  speed: number; // rad per ms
  sizeFrac: number; // 0..1 → dot radius
};

/* Cheap deterministic hash so each asteroid's orbit looks distinct but stable
   across renders (same id → same eccentricity, phase, direction). */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Build the render models from the feed, normalising sizes/distances. */
function buildBodies(objects: NearEarthObject[]): Body[] {
  const misses = objects.map((o) => Math.log10(Math.max(1, o.missKm)));
  const minMiss = Math.min(...misses);
  const maxMiss = Math.max(...misses);
  const missSpan = maxMiss - minMiss || 1;

  const dias = objects.map((o) => Math.log10(Math.max(1, o.diameterM)));
  const minDia = Math.min(...dias);
  const maxDia = Math.max(...dias);
  const diaSpan = maxDia - minDia || 1;

  const vels = objects.map((o) => o.velocityKps);
  const minVel = Math.min(...vels);
  const maxVel = Math.max(...vels);
  const velSpan = maxVel - minVel || 1;

  return objects.map((neo) => {
    const h = hashStr(neo.id);
    const velNorm = (neo.velocityKps - minVel) / velSpan;
    const orbitFrac = (Math.log10(Math.max(1, neo.missKm)) - minMiss) / missSpan;
    const sizeFrac =
      (Math.log10(Math.max(1, neo.diameterM)) - minDia) / diaSpan;
    return {
      neo,
      orbitFrac,
      ecc: 0.06 + ((h >>> 3) % 22) / 100, // 0.06 .. 0.28
      rot: ((h >>> 8) % 360) * (Math.PI / 180),
      angle: ((h >>> 16) % 360) * (Math.PI / 180),
      dir: (h & 1 ? 1 : -1) as 1 | -1,
      // inner orbits sweep a little faster; faster asteroids a little faster
      speed:
        (0.00016 + velNorm * 0.0004) * (0.6 + (1 - orbitFrac) * 0.9),
      sizeFrac,
    };
  });
}

/* --- formatting helpers ---------------------------------------------------- */

function fmtKm(km: number): string {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(2)} million km`;
  return `${Math.round(km).toLocaleString()} km`;
}

/** Compact distance for the dense legend column. */
function fmtKmShort(km: number): string {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(1)}M km`;
  return `${Math.round(km / 1000).toLocaleString()}k km`;
}

export default function AsteroidsWindow() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodiesRef = useRef<Body[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  // Keep the animation loop's view of selection in sync without re-running it.
  useEffect(() => {
    hoveredRef.current = hoveredId;
  }, [hoveredId]);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setSelectedId(null);
    setHoveredId(null);
    try {
      const objects = await fetchNeoFeed();
      setState({ status: 'ready', objects, fetchedAt: new Date() });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Rebuild render models whenever a fresh feed arrives.
  useEffect(() => {
    bodiesRef.current =
      state.status === 'ready' ? buildBodies(state.objects) : [];
  }, [state]);

  /* Position of a body along its (rotated, elliptical) orbit at a given angle,
     in logical canvas coordinates. */
  const posAt = useCallback(
    (b: Body, angle: number, cx: number, cy: number, minR: number, maxR: number) => {
      const a = minR + b.orbitFrac * (maxR - minR);
      const bb = a * (1 - b.ecc);
      const px = a * Math.cos(angle);
      const py = bb * Math.sin(angle);
      const c = Math.cos(b.rot);
      const s = Math.sin(b.rot);
      return { x: cx + px * c - py * s, y: cy + px * s + py * c };
    },
    [],
  );

  // Canvas setup + animation loop. Runs once we have data to show.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const resize = () => {
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const dot = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
      ctx.fill();
    };

    // Earth: a black-outlined disc with a 2px checker dither for that 1-bit
    // "globe" look, drawn at the centre.
    const drawEarth = (cx: number, cy: number, r: number) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      for (let y = -r; y <= r; y += 2) {
        for (let x = -r; x <= r; x += 2) {
          if (x * x + y * y <= r * r && ((Math.round(x / 2) + Math.round(y / 2)) & 1)) {
            ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 2, 2);
          }
        }
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    };

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(60, now - last);
      last = now;

      const bodies = bodiesRef.current;
      const cx = W / 2;
      const cy = H / 2;
      const earthR = 12;
      const minR = earthR + 16;
      const maxR = Math.max(minR + 10, Math.min(W, H) / 2 - 16);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const hovered = hoveredRef.current;
      const selected = selectedRef.current;

      for (const b of bodies) {
        b.angle += b.dir * b.speed * dt;
        const focused = b.neo.id === hovered || b.neo.id === selected;

        // Faint dotted orbit ring (denser when focused) for context.
        ctx.fillStyle = '#000000';
        const ringSteps = focused ? 96 : 56;
        for (let i = 0; i < ringSteps; i++) {
          if (!focused && i % 2) continue; // sparse stipple when idle
          const ang = (i / ringSteps) * Math.PI * 2;
          const p = posAt(b, ang, cx, cy, minR, maxR);
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }

        // Trailing arc behind the asteroid — fades by spacing toward the tail.
        const arcSpan = 1.3;
        const samples = 20;
        for (let k = 1; k <= samples; k++) {
          const t = k / samples; // 0 near asteroid → 1 tail
          const step = 1 + Math.floor(t * 3);
          if (k % step) continue; // sparser (=fainter) the further back we go
          const ang = b.angle - b.dir * t * arcSpan;
          const p = posAt(b, ang, cx, cy, minR, maxR);
          dot(p.x, p.y, Math.max(0.5, (1 - t) * 1.6));
        }

        // The asteroid itself.
        const p = posAt(b, b.angle, cx, cy, minR, maxR);
        const dotR = 1.8 + b.sizeFrac * 2.6;
        dot(p.x, p.y, dotR);
        if (b.neo.hazardous) {
          // Potentially-hazardous asteroids get a warning ring.
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#000000';
          ctx.beginPath();
          ctx.arc(Math.round(p.x), Math.round(p.y), dotR + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (focused) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000000';
          ctx.beginPath();
          ctx.arc(Math.round(p.x), Math.round(p.y), dotR + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.font = '16px "VT323", monospace';
          ctx.textBaseline = 'middle';
          const label = b.neo.name;
          const lx = p.x + dotR + 9;
          const tw = ctx.measureText(label).width;
          // Flip the label to the other side near the right edge.
          const x = lx + tw > W - 4 ? p.x - dotR - 9 - tw : lx;
          ctx.fillRect(Math.round(x - 2), Math.round(p.y - 9), tw + 4, 18);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, Math.round(x), Math.round(p.y));
          ctx.fillStyle = '#000000';
        }
      }

      drawEarth(cx, cy, earthR);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Hit-test the pointer against current asteroid positions.
    const bodyAt = (clientX: number, clientY: number): string | null => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const cx = W / 2;
      const cy = H / 2;
      const earthR = 12;
      const minR = earthR + 16;
      const maxR = Math.max(minR + 10, Math.min(W, H) / 2 - 16);
      let best: string | null = null;
      let bestD = 12 * 12; // within ~12px
      for (const b of bodiesRef.current) {
        const p = posAt(b, b.angle, cx, cy, minR, maxR);
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < bestD) {
          bestD = d;
          best = b.neo.id;
        }
      }
      return best;
    };

    const onMove = (e: PointerEvent) => setHoveredId(bodyAt(e.clientX, e.clientY));
    const onLeave = () => setHoveredId(null);
    const onClick = (e: PointerEvent) => {
      const id = bodyAt(e.clientX, e.clientY);
      if (id) setSelectedId(id);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onClick);
    };
  }, [state, posAt]);

  const objects = state.status === 'ready' ? state.objects : [];
  const detailId = hoveredId ?? selectedId;
  const detail = objects.find((o) => o.id === detailId) ?? null;
  const hazardCount = objects.filter((o) => o.hazardous).length;

  return (
    <div className="asteroids-content">
      <div className="asteroids-masthead">
        <div className="win-h">Near-Earth Asteroids</div>
        <div className="win-meta">
          {new Date().toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {' · '}close approaches via NASA NeoWs
        </div>
      </div>

      <hr className="mac-rule" />

      {state.status === 'loading' && (
        <p className="asteroids-status">Tracking the sky&hellip;</p>
      )}

      {state.status === 'error' && (
        <div className="asteroids-status">
          <p>Lost contact with Deep Space Network — couldn&apos;t reach NASA.</p>
          <button type="button" className="mac-button" onClick={() => void load()}>
            Try Again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <div className="asteroids-stage">
            <div className="asteroids-viewport" ref={wrapRef}>
              <canvas ref={canvasRef} className="asteroids-canvas" />
            </div>

            <div className="asteroids-side">
              <div className="asteroids-detail">
                {detail ? (
                  <>
                    <div className="win-sub asteroids-detail-name">
                      {detail.name}
                      {detail.hazardous && (
                        <span className="asteroids-pha"> ⚠ PHA</span>
                      )}
                    </div>
                    <dl className="asteroids-stats">
                      <dt>Miss distance</dt>
                      <dd>{fmtKm(detail.missKm)}</dd>
                      <dt>Diameter</dt>
                      <dd>≈ {Math.round(detail.diameterM).toLocaleString()} m</dd>
                      <dt>Velocity</dt>
                      <dd>{detail.velocityKps.toFixed(1)} km/s</dd>
                      <dt>Closest at</dt>
                      <dd>
                        {detail.approachTime.toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </dd>
                    </dl>
                    <a
                      href={detail.nasaJplUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="asteroids-link"
                    >
                      View on NASA/JPL ▸
                    </a>
                  </>
                ) : (
                  <p className="asteroids-hint">
                    Point at an asteroid to read its name &amp; orbit, or pick one
                    from the list below.
                  </p>
                )}
              </div>

              <ul className="asteroids-legend">
                {objects.map((o) => (
                  <li
                    key={o.id}
                    className={`asteroids-legend-item${
                      o.id === selectedId ? ' is-selected' : ''
                    }`}
                    onPointerEnter={() => setHoveredId(o.id)}
                    onPointerLeave={() => setHoveredId(null)}
                    onClick={() => setSelectedId(o.id)}
                  >
                    <span className="asteroids-legend-name">
                      {o.hazardous ? '⚠ ' : ''}
                      {o.name}
                    </span>
                    <span className="asteroids-legend-dist">
                      {fmtKmShort(o.missKm)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <hr className="mac-rule" />
          <div className="asteroids-footer">
            <button
              type="button"
              className="mac-button"
              onClick={() => void load()}
            >
              Refresh
            </button>
            <span className="win-meta">
              {objects.length} tracked · {hazardCount} hazardous · updated{' '}
              {state.fetchedAt.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
