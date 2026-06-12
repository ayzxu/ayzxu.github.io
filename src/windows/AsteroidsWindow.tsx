/* ==========================================================================
   AsteroidsWindow — a System 1 orbital map of the asteroids making a close
   approach to Earth today, pulled live from NASA's public NeoWs feed. Earth
   sits at the centre; each near-Earth object orbits as a 1-bit dot placed by
   its miss distance, leaving a stippled trail behind it. Point at (or tap) an
   asteroid to see its name, stats and a link to its page on NASA/JPL.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNeoFeed,
  NeoError,
  type NeoErrorCode,
  type NearEarthObject,
} from '../lib/asteroids';

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; code: NeoErrorCode }
  | { status: 'ready'; objects: NearEarthObject[]; fetchedAt: Date };

/* Per-asteroid render model. Orbit size is stored as a fraction (0..1) of the
   available radius so the layout reflows when the window is resized; the actual
   pixel geometry is derived from the canvas size every frame. */
type Body = {
  neo: NearEarthObject;
  orbitFrac: number; // 0 (closest) .. 1 (farthest) → maps to orbit radius
  ecc: number; // orbit ellipse flattening
  inclination: number; // orbital-plane tilt about the X axis (rad)
  node: number; // longitude of ascending node — plane spin about Y (rad)
  angle: number; // current position along the orbit (rad), mutated each frame
  dir: 1 | -1; // travel direction
  speed: number; // rad per ms
  sizeFrac: number; // 0..1 → dot radius
};

/* A point in 3D world space (Earth at the origin), in pixel-ish units. */
type Vec3 = { x: number; y: number; z: number };

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
      // tilt each orbital plane through 3D: inclination ±70°, node 0..360°
      inclination: (((h >>> 8) % 140) - 70) * (Math.PI / 180),
      node: ((h >>> 18) % 360) * (Math.PI / 180),
      angle: ((h >>> 16) % 360) * (Math.PI / 180),
      dir: (h & 1 ? 1 : -1) as 1 | -1,
      // inner orbits sweep a little faster; faster asteroids a little faster
      speed:
        (0.00016 + velNorm * 0.0004) * (0.6 + (1 - orbitFrac) * 0.9),
      sizeFrac,
    };
  });
}

/* --- 3D geometry ----------------------------------------------------------- */

/** A body's position along its tilted elliptical orbit, in 3D world space. */
function orbitPoint(b: Body, angle: number, minR: number, maxR: number): Vec3 {
  const a = minR + b.orbitFrac * (maxR - minR);
  const bb = a * (1 - b.ecc);
  // Point in the orbital plane (z = 0).
  const px = a * Math.cos(angle);
  const pz = bb * Math.sin(angle);
  // Tilt the plane by inclination (about X), then spin by node (about Y).
  const ci = Math.cos(b.inclination);
  const si = Math.sin(b.inclination);
  const y1 = pz * si;
  const z1 = pz * ci;
  const cn = Math.cos(b.node);
  const sn = Math.sin(b.node);
  return {
    x: px * cn + z1 * sn,
    y: y1,
    z: -px * sn + z1 * cn,
  };
}

type Projected = { x: number; y: number; z: number; scale: number };

/** Rotate a world point by the camera (yaw then pitch) and perspective-project
    it to screen space. `z` is camera depth (larger = nearer the viewer) and
    `scale` is the perspective foreshortening used for sizing. */
function project(
  p: Vec3,
  yaw: number,
  pitch: number,
  cx: number,
  cy: number,
  focal: number,
  camDist: number,
): Projected {
  // Yaw about Y.
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const x1 = p.x * cyaw + p.z * syaw;
  const z1 = -p.x * syaw + p.z * cyaw;
  // Pitch about X.
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y2 = p.y * cp - z1 * sp;
  const z2 = p.y * sp + z1 * cp;
  const scale = focal / Math.max(1, camDist - z2);
  return { x: cx + x1 * scale, y: cy - y2 * scale, z: z2, scale };
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

  // Orbiting camera — a pleasant 3/4 view by default.
  const DEFAULT_YAW = 0.6;
  const DEFAULT_PITCH = 0.5;
  const yawRef = useRef(DEFAULT_YAW);
  const pitchRef = useRef(DEFAULT_PITCH);
  const lastInteractRef = useRef(0);

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
    } catch (err) {
      const code = err instanceof NeoError ? err.code : 'offline';
      setState({ status: 'error', code });
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

  // Recenter the camera to the default 3/4 view.
  const resetView = useCallback(() => {
    yawRef.current = DEFAULT_YAW;
    pitchRef.current = DEFAULT_PITCH;
    lastInteractRef.current = performance.now();
  }, []);

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
      ctx.arc(Math.round(x), Math.round(y), Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    };

    /* The viewing geometry derived from the current canvas size. Earth's world
       radius doubles as its (near-constant) on-screen radius for occlusion. */
    const geom = () => {
      const cx = W / 2;
      const cy = H / 2;
      const earthR = 13;
      const minR = earthR + 18;
      const maxR = Math.max(minR + 10, Math.min(W, H) / 2 - 18);
      const camDist = maxR * 2.4;
      return { cx, cy, earthR, minR, maxR, camDist, focal: camDist };
    };

    // Earth: a dithered disc plus two projected great-circle rings so the globe
    // visibly turns as the camera orbits.
    const drawEarth = (
      cx: number,
      cy: number,
      r: number,
      yaw: number,
      pitch: number,
      focal: number,
      camDist: number,
    ) => {
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
      // Front-facing wireframe rings (equator + meridian).
      const ring = (fn: (t: number) => Vec3) => {
        for (let i = 0; i < 60; i++) {
          const t = (i / 60) * Math.PI * 2;
          const rp = project(fn(t), yaw, pitch, cx, cy, focal, camDist);
          if (rp.z < 0) continue; // hidden on the far side of the globe
          ctx.fillRect(Math.round(rp.x), Math.round(rp.y), 1, 1);
        }
      };
      ctx.fillStyle = '#000000';
      ring((t) => ({ x: r * Math.cos(t), y: 0, z: r * Math.sin(t) }));
      ring((t) => ({ x: 0, y: r * Math.cos(t), z: r * Math.sin(t) }));
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

      const { cx, cy, earthR, minR, maxR, camDist, focal } = geom();

      // Gentle auto-spin once the user has been idle for a moment.
      if (now - lastInteractRef.current > 2500) {
        yawRef.current += 0.00006 * dt;
      }
      const yaw = yawRef.current;
      const pitch = pitchRef.current;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      const hovered = hoveredRef.current;
      const selected = selectedRef.current;

      // True when a projected point is hidden behind Earth's disc.
      const occluded = (p: Projected) =>
        p.z < 0 && (p.x - cx) ** 2 + (p.y - cy) ** 2 < earthR * earthR;

      // Advance + project every body, then draw back-to-front so the globe and
      // nearer asteroids correctly overlap the ones behind them.
      const draws = bodiesRef.current.map((b) => {
        b.angle += b.dir * b.speed * dt;
        const proj = project(
          orbitPoint(b, b.angle, minR, maxR),
          yaw,
          pitch,
          cx,
          cy,
          focal,
          camDist,
        );
        return { b, proj };
      });
      draws.sort((a, z) => a.proj.z - z.proj.z);

      const drawBody = ({ b, proj }: { b: Body; proj: Projected }) => {
        const focused = b.neo.id === hovered || b.neo.id === selected;

        // Dotted orbit path (denser when focused).
        ctx.fillStyle = '#000000';
        const ringSteps = focused ? 96 : 56;
        for (let i = 0; i < ringSteps; i++) {
          if (!focused && i % 2) continue;
          const ang = (i / ringSteps) * Math.PI * 2;
          const rp = project(
            orbitPoint(b, ang, minR, maxR),
            yaw,
            pitch,
            cx,
            cy,
            focal,
            camDist,
          );
          if (occluded(rp)) continue;
          ctx.fillRect(Math.round(rp.x), Math.round(rp.y), 1, 1);
        }

        // Trailing arc behind the asteroid — fades by spacing toward the tail.
        const arcSpan = 1.3;
        const samples = 25; // +25% trail density
        for (let k = 1; k <= samples; k++) {
          const t = k / samples;
          const step = 1 + Math.floor(t * 3);
          if (k % step) continue;
          const ang = b.angle - b.dir * t * arcSpan;
          const tp = project(
            orbitPoint(b, ang, minR, maxR),
            yaw,
            pitch,
            cx,
            cy,
            focal,
            camDist,
          );
          if (occluded(tp)) continue;
          dot(tp.x, tp.y, (1 - t) * 1.6 * tp.scale);
        }

        // The asteroid itself — perspective-scaled so nearer ones look bigger.
        const dotR = (1.8 + b.sizeFrac * 2.6) * proj.scale;
        dot(proj.x, proj.y, dotR);
        if (b.neo.hazardous) {
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#000000';
          ctx.beginPath();
          ctx.arc(Math.round(proj.x), Math.round(proj.y), dotR + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (focused) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000000';
          ctx.beginPath();
          ctx.arc(Math.round(proj.x), Math.round(proj.y), dotR + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.font = '16px "VT323", monospace';
          ctx.textBaseline = 'middle';
          const label = b.neo.name;
          const lx = proj.x + dotR + 9;
          const tw = ctx.measureText(label).width;
          const x = lx + tw > W - 4 ? proj.x - dotR - 9 - tw : lx;
          ctx.fillRect(Math.round(x - 2), Math.round(proj.y - 9), tw + 4, 18);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, Math.round(x), Math.round(proj.y));
          ctx.fillStyle = '#000000';
        }
      };

      let i = 0;
      for (; i < draws.length && draws[i].proj.z < 0; i++) drawBody(draws[i]);
      drawEarth(cx, cy, earthR, yaw, pitch, focal, camDist);
      for (; i < draws.length; i++) drawBody(draws[i]);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Hit-test the pointer against the projected asteroid positions.
    const bodyAt = (clientX: number, clientY: number): string | null => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const { cx, cy, minR, maxR, camDist, focal } = geom();
      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      let best: string | null = null;
      let bestD = 14 * 14; // within ~14px
      let bestZ = -Infinity;
      for (const b of bodiesRef.current) {
        const p = project(
          orbitPoint(b, b.angle, minR, maxR),
          yaw,
          pitch,
          cx,
          cy,
          focal,
          camDist,
        );
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        // Nearest in screen space; on a near-tie prefer the one closer to camera.
        if (d < bestD - 4 || (d < bestD + 4 && p.z > bestZ)) {
          bestD = d;
          bestZ = p.z;
          best = b.neo.id;
        }
      }
      return best;
    };

    // Drag rotates the camera; a click that doesn't drag selects an asteroid.
    let isDown = false;
    let isDrag = false;
    let startX = 0;
    let startY = 0;
    let prevX = 0;
    let prevY = 0;

    const onDown = (e: PointerEvent) => {
      isDown = true;
      isDrag = false;
      startX = prevX = e.clientX;
      startY = prevY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (isDown) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        prevX = e.clientX;
        prevY = e.clientY;
        if (!isDrag && Math.hypot(e.clientX - startX, e.clientY - startY) > 3) {
          isDrag = true;
          canvas.style.cursor = 'grabbing';
          if (hoveredRef.current !== null) setHoveredId(null);
        }
        if (isDrag) {
          yawRef.current += dx * 0.01;
          pitchRef.current = Math.max(
            -1.45,
            Math.min(1.45, pitchRef.current + dy * 0.01),
          );
          lastInteractRef.current = performance.now();
        }
        return;
      }
      setHoveredId(bodyAt(e.clientX, e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      if (isDown && !isDrag) {
        const id = bodyAt(e.clientX, e.clientY);
        if (id) setSelectedId(id);
      }
      isDown = false;
      isDrag = false;
      canvas.style.cursor = 'grab';
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
    };
    const onLeave = () => {
      if (!isDown) setHoveredId(null);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [state]);

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
          <p>
            {state.code === 'rate-limit'
              ? "NASA's tracking station is busy (rate limit) — give it a minute and try again."
              : "Lost contact with Deep Space Network — couldn't reach NASA."}
          </p>
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
              <span className="asteroids-drag-hint">drag to rotate</span>
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
            <button type="button" className="mac-button" onClick={resetView}>
              Reset View
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
