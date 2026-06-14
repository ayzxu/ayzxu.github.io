/* ==========================================================================
   AsteroidsWindow — a System 1 orrery of the asteroids making a close
   approach to Earth today, pulled live from NASA's NeoWs feed.

   Unlike the usual decorative starfield, the orbits here are real: each
   object's osculating Keplerian elements are fetched from JPL's small-body
   solution and propagated by solving Kepler's equation, with Earth placed by
   a standard analytic ephemeris — so every trajectory you see is the actual
   geocentric path of that rock over a ±48-hour window. A time bar scrubs
   (or fast-forwards) the simulation through the encounter; a scale toggle
   switches between a legible log-radial layout and the honest true-scale
   picture with the Moon's orbit for reference.

   Rendering is WebGL2: the scene is drawn in grayscale off-screen and
   snapped to 1-bit black & white by a Bayer ordered-dither shader (see
   lib/ditherGL.ts), which is what shades the globe's day/night terminator
   and stipples the trails. Labels and pick-rings live on a 2D overlay.
   ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchNeoFeed,
  fetchOrbits,
  NeoError,
  type NeoErrorCode,
  type NeoOrbit,
  type NearEarthObject,
} from '../lib/asteroids';
import {
  earthHeliocentric,
  heliocentricPosition,
  jdFromMs,
  orbitEllipse,
  LUNAR_DISTANCE_KM,
  moonGeocentric,
  sunDirection,
  type KeplerElements,
  type Vec3,
} from '../lib/kepler';
import {
  DitherRenderer,
  POINT_STRIDE,
  projectPoint,
  rotationMatrix,
  type Camera,
} from '../lib/ditherGL';

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; code: NeoErrorCode }
  | { status: 'ready'; objects: NearEarthObject[]; fetchedAt: Date };

type ScaleMode = 'log' | 'true';

/* Two ways of seeing the same sky. "Classic" is the original System 1 toy:
   every asteroid sweeps a hash-seeded decorative ring at its catalogued miss
   distance — busy, hypnotic, and proudly unphysical. "Real" propagates the
   actual JPL orbital elements through Kepler's equation, with the time
   machine, the Moon, and the full orbital ellipses. */
type ViewMode = 'classic' | 'real';

/* Per-asteroid simulation model. `el` arrives asynchronously from JPL; until
   then (or if the lookup fails) the body rides a decorative circular orbit at
   its catalogued miss distance so the map never has holes. */
type SimBody = {
  neo: NearEarthObject;
  el: KeplerElements | null;
  orbitClass: string | null;
  /** Sampled geocentric path (km) across the time window, x/y/z triplets. */
  pathKm: Float32Array | null;
  /** The complete orbital ellipse (heliocentric km, x/y/z triplets). */
  orbitKm: Float32Array | null;
  /** Computed moment & distance of closest approach within the window. */
  caTimeMs: number | null;
  caKm: number | null;
  /** Decorative ring orbit (hash-seeded, stable per id): used by every body
      in classic mode, and as the fallback in real mode while elements load. */
  fb: {
    inc: number;
    node: number;
    phase: number;
    /** Real-mode fallback sweep, rad per *simulated* ms (days per lap). */
    omega: number;
    /** Classic-mode sweep, rad per *wall-clock* ms (the old hypnotic pace). */
    classicSpeed: number;
    dir: 1 | -1;
  };
  sizeFrac: number;
  /** Last projected screen position (CSS px) for hit-testing / overlay. */
  sx: number;
  sy: number;
  sz: number;
  sr: number;
  visible: boolean;
};

/* --- tuning ----------------------------------------------------------------- */

const WINDOW_HALF_MS = 5 * 24 * 3600 * 1000; // simulate ±5 days around "now"
const PATH_SAMPLES = 192;
const WAKE_SAMPLES = 10;
const WAKE_SPAN_MS = 14 * 3600 * 1000;

const ORBIT_SAMPLES = 240; // points around each full orbital ellipse

const R_MAX = 100; // world-space radius of the map
const R_INNER = 9; // log mode: where the closest distance lands
const EARTH_R_LOG = 5; // log mode: globe display radius (world units)
const EARTH_RADIUS_KM = 6371;
const CAM_DIST = 2.8 * R_MAX;
const MOON_RING_SAMPLES = 144;

const PLAY_SPEEDS = [
  { label: '30 min/s', simPerSec: 1800 },
  { label: '3 h/s', simPerSec: 10800 },
  { label: '12 h/s', simPerSec: 43200 },
];

/* --- helpers ----------------------------------------------------------------- */

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DEG = Math.PI / 180;

function toKepler(o: NeoOrbit): KeplerElements {
  return {
    a: o.a,
    e: o.e,
    i: o.i * DEG,
    om: o.om * DEG,
    w: o.w * DEG,
    ma: o.ma * DEG,
    n: o.n * DEG, // deg/day → rad/day
    epochJd: o.epochJd,
  };
}

function fmtKmShort(km: number): string {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(1)}M km`;
  return `${Math.round(km / 1000).toLocaleString()}k km`;
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AsteroidsWindow() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('log');
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [timeMs, setTimeMs] = useState(() => Date.now());
  const [orbitsLoaded, setOrbitsLoaded] = useState(0);
  const [approxCount, setApproxCount] = useState(0);
  const [glFailed, setGlFailed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const bodiesRef = useRef<SimBody[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const viewModeRef = useRef<ViewMode>('classic');
  const scaleModeRef = useRef<ScaleMode>('log');
  const playingRef = useRef(false);
  const speedIdxRef = useRef(1);
  const staticDirtyRef = useRef(true);

  // Simulation window, fixed at load time.
  const t0Ref = useRef(Date.now());
  const tRef = useRef(Date.now());

  // Distance→radius mapping bounds (km), fixed per feed so the map is stable.
  // True scale spans the flyby region; the log scale stretches further so the
  // complete orbital ellipses (out to a few AU from Earth) stay on the map.
  const dMinRef = useRef(10_000);
  const dMinClassicRef = useRef(10_000);
  const dMaxRef = useRef(10_000_000);
  const dMaxLogRef = useRef(10_000_000);

  // Camera.
  const DEFAULT_YAW = 0.6;
  const DEFAULT_PITCH = 0.5;
  const yawRef = useRef(DEFAULT_YAW);
  const pitchRef = useRef(DEFAULT_PITCH);
  const zoomRef = useRef(1);
  const lastInteractRef = useRef(0);

  useEffect(() => {
    hoveredRef.current = hoveredId;
  }, [hoveredId]);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    viewModeRef.current = viewMode;
    staticDirtyRef.current = true;
  }, [viewMode]);
  useEffect(() => {
    scaleModeRef.current = scaleMode;
    staticDirtyRef.current = true;
    // Each scale is its own "place" — re-enter it at the overview zoom.
    // (True scale earns deep zoom so you can dive down to the Moon's orbit;
    // log scale already keeps everything on screen.)
    zoomRef.current = 1;
  }, [scaleMode]);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedIdxRef.current = speedIdx;
  }, [speedIdx]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setSelectedId(null);
    setHoveredId(null);
    setPlaying(false);
    setOrbitsLoaded(0);
    setApproxCount(0);
    try {
      const objects = await fetchNeoFeed();
      const now = Date.now();
      t0Ref.current = now;
      tRef.current = now;
      setTimeMs(now);
      setState({ status: 'ready', objects, fetchedAt: new Date() });
    } catch (err) {
      const code = err instanceof NeoError ? err.code : 'offline';
      setState({ status: 'error', code });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* Build simulation bodies + the distance mapping when a feed arrives.
     (Declared before the render effect so it runs first.) */
  useEffect(() => {
    if (state.status !== 'ready') {
      bodiesRef.current = [];
      return;
    }
    const objects = state.objects;

    const dias = objects.map((o) => Math.log10(Math.max(1, o.diameterM)));
    const minDia = Math.min(...dias);
    const diaSpan = Math.max(...dias) - minDia || 1;

    const vels = objects.map((o) => o.velocityKps);
    const minVel = Math.min(...vels);
    const velSpan = Math.max(...vels) - minVel || 1;
    const misses = objects.map((o) => Math.log10(Math.max(1, o.missKm)));
    const minMiss = Math.min(...misses);
    const missSpan = Math.max(...misses) - minMiss || 1;

    bodiesRef.current = objects.map((neo) => {
      const h = hashStr(neo.id);
      // The original window's pacing: inner orbits sweep a little faster,
      // faster asteroids a little faster.
      const velNorm = (neo.velocityKps - minVel) / velSpan;
      const orbitFrac = (Math.log10(Math.max(1, neo.missKm)) - minMiss) / missSpan;
      return {
        neo,
        el: null,
        orbitClass: null,
        pathKm: null,
        orbitKm: null,
        caTimeMs: null,
        caKm: null,
        fb: {
          inc: (((h >>> 8) % 140) - 70) * DEG,
          node: ((h >>> 18) % 360) * DEG,
          phase: ((h >>> 16) % 360) * DEG,
          omega:
            ((h & 1 ? 1 : -1) * 2 * Math.PI) / ((3.5 + ((h >>> 5) % 30) / 10) * 86_400_000),
          classicSpeed:
            (0.00016 + velNorm * 0.0004) * (0.6 + (1 - orbitFrac) * 0.9),
          dir: (h & 1 ? 1 : -1) as 1 | -1,
        },
        sizeFrac: (Math.log10(Math.max(1, neo.diameterM)) - minDia) / diaSpan,
        sx: -1,
        sy: -1,
        sz: 0,
        sr: 2,
        visible: false,
      };
    });

    // Fixed mapping bounds: closest catalogued miss … farthest any object can
    // wander in ±48 h (miss + velocity × window), padded a touch.
    if (objects.length > 0) {
      // The Moon's orbit is the map's reference ring, so the log scale must
      // always start at (or below) lunar distance to place it honestly.
      const dMin = Math.max(
        EARTH_RADIUS_KM + 1000,
        Math.min(LUNAR_DISTANCE_KM * 0.8, Math.min(...objects.map((o) => o.missKm)) / 1.4),
      );
      const dMax =
        Math.max(
          ...objects.map((o) => o.missKm + o.velocityKps * (WINDOW_HALF_MS / 1000)),
        ) * 1.05;
      dMinRef.current = dMin;
      dMinClassicRef.current = Math.max(
        EARTH_RADIUS_KM + 1000,
        Math.min(...objects.map((o) => o.missKm)) / 1.4,
      );
      dMaxRef.current = Math.max(dMax, LUNAR_DISTANCE_KM * 1.4);
    } else {
      dMinRef.current = 100_000;
      dMinClassicRef.current = 100_000;
      dMaxRef.current = LUNAR_DISTANCE_KM * 1.4;
    }
    dMaxLogRef.current = dMaxRef.current; // grows as full orbits arrive
    staticDirtyRef.current = true;
  }, [state]);

  /* Fetch real orbital elements (cache-first, concurrency-limited) and sample
     each body's geocentric path across the window as they land. */
  useEffect(() => {
    if (state.status !== 'ready') return;
    const bodies = bodiesRef.current;
    const abort = new AbortController();

    // Earth's heliocentric position at each path sample, shared by all bodies.
    const tStart = t0Ref.current - WINDOW_HALF_MS;
    const stepMs = (2 * WINDOW_HALF_MS) / (PATH_SAMPLES - 1);
    const earthAt: Vec3[] = Array.from({ length: PATH_SAMPLES }, (_, s) =>
      earthHeliocentric(jdFromMs(tStart + s * stepMs)),
    );

    const samplePath = (b: SimBody) => {
      if (!b.el) return;
      const path = new Float32Array(PATH_SAMPLES * 3);
      let caIdx = 0;
      let caD = Infinity;
      for (let s = 0; s < PATH_SAMPLES; s++) {
        const jd = jdFromMs(tStart + s * stepMs);
        const p = heliocentricPosition(b.el, jd);
        const e = earthAt[s];
        const x = p.x - e.x;
        const y = p.y - e.y;
        const z = p.z - e.z;
        path[s * 3] = x;
        path[s * 3 + 1] = y;
        path[s * 3 + 2] = z;
        const d = Math.hypot(x, y, z);
        if (d < caD) {
          caD = d;
          caIdx = s;
        }
      }
      b.pathKm = path;
      b.orbitKm = orbitEllipse(b.el, ORBIT_SAMPLES);
      // Stretch the log scale to hold the whole ellipse (relative to Earth
      // at the window's centre — Earth barely moves at this scale).
      const e0 = earthHeliocentric(jdFromMs(t0Ref.current));
      let far = dMaxLogRef.current;
      for (let k = 0; k < ORBIT_SAMPLES; k++) {
        const d = Math.hypot(
          b.orbitKm[k * 3] - e0.x,
          b.orbitKm[k * 3 + 1] - e0.y,
          b.orbitKm[k * 3 + 2] - e0.z,
        );
        if (d > far) far = d;
      }
      dMaxLogRef.current = far * 1.04;
      // Refine the closest approach between the neighbouring samples.
      let lo = tStart + Math.max(0, caIdx - 1) * stepMs;
      let hi = tStart + Math.min(PATH_SAMPLES - 1, caIdx + 1) * stepMs;
      const distAt = (ms: number) => {
        const jd = jdFromMs(ms);
        const p = heliocentricPosition(b.el as KeplerElements, jd);
        const e = earthHeliocentric(jd);
        return Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z);
      };
      for (let k = 0; k < 24; k++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        if (distAt(m1) < distAt(m2)) hi = m2;
        else lo = m1;
      }
      b.caTimeMs = (lo + hi) / 2;
      b.caKm = distAt(b.caTimeMs);
    };

    let loaded = 0;
    let failed = 0;
    void fetchOrbits(
      bodies.map((b) => b.neo.id),
      (id, orbit) => {
        if (abort.signal.aborted) return;
        const b = bodies.find((bb) => bb.neo.id === id);
        if (!b) return;
        if (orbit) {
          b.el = toKepler(orbit);
          b.orbitClass = orbit.orbitClass?.type ?? null;
          samplePath(b);
          loaded++;
        } else {
          failed++;
        }
        staticDirtyRef.current = true;
        setOrbitsLoaded(loaded);
        setApproxCount(failed);
      },
      abort.signal,
    );

    return () => abort.abort();
  }, [state]);

  const resetView = useCallback(() => {
    yawRef.current = DEFAULT_YAW;
    pitchRef.current = DEFAULT_PITCH;
    zoomRef.current = 1;
    lastInteractRef.current = performance.now();
  }, []);

  const jumpToNow = useCallback(() => {
    const t = Math.min(
      t0Ref.current + WINDOW_HALF_MS,
      Math.max(t0Ref.current - WINDOW_HALF_MS, Date.now()),
    );
    tRef.current = t;
    setTimeMs(t);
  }, []);

  /* The renderer + simulation loop. */
  useEffect(() => {
    if (state.status !== 'ready') return;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !overlay || !wrap) return;

    let renderer: DitherRenderer;
    try {
      renderer = new DitherRenderer(canvas);
    } catch {
      setGlFailed(true);
      return;
    }
    setGlFailed(false);

    const octx = overlay.getContext('2d');
    if (!octx) return;

    let W = 0;
    let H = 0;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const resize = () => {
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.style.width = overlay.style.width = `${W}px`;
      canvas.style.height = overlay.style.height = `${H}px`;
      overlay.width = Math.round(W * dpr);
      overlay.height = Math.round(H * dpr);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.resize(W, H, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* Distance (km) → display radius (world units); −1 culls the point
       (true scale only — anything past the rim simply leaves the view). */
    const mapRadius = (dKm: number): number => {
      const classic = viewModeRef.current === 'classic';
      const dMin = classic ? dMinClassicRef.current : dMinRef.current;
      if (scaleModeRef.current === 'true') {
        const R = (dKm / dMaxRef.current) * R_MAX;
        return R > R_MAX * 1.04 ? -1 : R;
      }
      // Classic rings live at flyby distances; real mode stretches the log
      // axis so the full orbital ellipses (a few AU out) stay on the map.
      const dMax = classic ? dMaxRef.current : dMaxLogRef.current;
      const f =
        (Math.log10(Math.max(dMin, dKm)) - Math.log10(dMin)) /
        (Math.log10(dMax) - Math.log10(dMin));
      return Math.min(R_MAX * 1.04, R_INNER + f * (R_MAX - R_INNER));
    };

    /* Ecliptic km → render world (x → x, ecliptic z → up, ecliptic y → z). */
    const W3 = { x: 0, y: 0, z: 0 };
    const toWorld = (x: number, y: number, z: number) => {
      const d = Math.hypot(x, y, z) || 1;
      const R = mapRadius(d);
      if (R < 0) return null;
      const s = R / d;
      W3.x = x * s;
      W3.y = z * s;
      W3.z = y * s;
      return W3;
    };

    /* A point on a body's decorative ring (radius = catalogued miss distance,
       hash-tilted plane), in ecliptic km. Tilt about x, spin about z. */
    const ringPos = (b: SimBody, ang: number) => {
      const r = b.neo.missKm;
      const px = r * Math.cos(ang);
      const py = r * Math.sin(ang);
      const ci = Math.cos(b.fb.inc);
      const si = Math.sin(b.fb.inc);
      const cn = Math.cos(b.fb.node);
      const sn = Math.sin(b.fb.node);
      return {
        x: px * cn - py * ci * sn,
        y: px * sn + py * ci * cn,
        z: py * si,
      };
    };

    const fallbackPos = (b: SimBody, tMs: number) =>
      ringPos(b, b.fb.phase + b.fb.omega * (tMs - t0Ref.current));

    /* Classic mode sweeps on the wall clock, like the original window. */
    const classicAngle = (b: SimBody, nowMs: number) =>
      b.fb.phase + b.fb.dir * b.fb.classicSpeed * nowMs;

    const geocentric = (b: SimBody, tMs: number, earth: Vec3 | null): Vec3 => {
      if (!b.el || !earth) return fallbackPos(b, tMs);
      const p = heliocentricPosition(b.el, jdFromMs(tMs));
      return { x: p.x - earth.x, y: p.y - earth.y, z: p.z - earth.z };
    };

    /* Static point cloud: every body's orbit path (dotted) + the Moon's orbit. */
    const rebuildStatic = () => {
      const bodies = bodiesRef.current;
      const pts: number[] = [];
      const push = (x: number, y: number, z: number, size: number, shade: number) => {
        const w = toWorld(x, y, z);
        if (w) pts.push(w.x, w.y, w.z, size, shade);
      };

      if (viewModeRef.current === 'classic') {
        // The original look: a dense dotted ring per asteroid, nothing else.
        for (const b of bodies) {
          for (let s = 0; s < 144; s++) {
            const p = ringPos(b, (s / 144) * 2 * Math.PI);
            push(p.x, p.y, p.z, 1.05, 0.12);
          }
        }
        renderer.setStaticPoints(new Float32Array(pts));
        return;
      }

      for (const b of bodies) {
        if (b.pathKm) {
          for (let s = 0; s < PATH_SAMPLES; s++) {
            push(b.pathKm[s * 3], b.pathKm[s * 3 + 1], b.pathKm[s * 3 + 2], 1.2, 0.05);
          }
        } else {
          for (let s = 0; s < 96; s += 2) {
            const p = ringPos(b, (s / 96) * 2 * Math.PI);
            push(p.x, p.y, p.z, 1.05, 0.3);
          }
        }
      }

      // The Moon's orbit, sampled over one sidereal month — a real, slightly
      // tilted ring — plus its anchor in both scale modes.
      const monthMs = 27.32 * 86_400_000;
      for (let s = 0; s < MOON_RING_SAMPLES; s += 2) {
        const m = moonGeocentric(jdFromMs(t0Ref.current + (s / MOON_RING_SAMPLES) * monthMs));
        push(m.x, m.y, m.z, 1.0, 0.42);
      }

      renderer.setStaticPoints(new Float32Array(pts));
    };

    // Dynamic buffer: bodies + wakes + moon + focused dense path.
    const dynCapacity =
      bodiesRef.current.length * (1 + WAKE_SAMPLES + ORBIT_SAMPLES) + PATH_SAMPLES + 8;
    const dyn = new Float32Array(dynCapacity * POINT_STRIDE);

    let raf = 0;
    let last = performance.now();
    let lastUiSync = 0;

    const frame = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;

      if (staticDirtyRef.current) {
        staticDirtyRef.current = false;
        rebuildStatic();
      }

      // Advance simulation time when playing; wrap at the window's end.
      if (playingRef.current) {
        let t = tRef.current + dt * PLAY_SPEEDS[speedIdxRef.current].simPerSec;
        if (t > t0Ref.current + WINDOW_HALF_MS) t = t0Ref.current - WINDOW_HALF_MS;
        tRef.current = t;
      }
      const tMs = tRef.current;
      if (now - lastUiSync > 150) {
        lastUiSync = now;
        setTimeMs((prev) => (Math.abs(prev - tMs) > 500 ? tMs : prev));
      }

      // Idle auto-spin.
      if (now - lastInteractRef.current > 2500 && !playingRef.current) {
        yawRef.current += 0.00006 * dt;
      }

      const classic = viewModeRef.current === 'classic';
      const jd = jdFromMs(tMs);
      const earthNow = earthHeliocentric(jd);
      const sunEcl = sunDirection(jd);
      const sunWorld: [number, number, number] = [sunEcl.x, sunEcl.z, sunEcl.y];

      const focalBase = (Math.max(40, Math.min(W, H)) / 2 - 14) * (CAM_DIST / R_MAX);
      const cam: Camera = {
        yaw: yawRef.current,
        pitch: pitchRef.current,
        camDist: CAM_DIST,
        focal: focalBase * zoomRef.current,
      };
      const rot = rotationMatrix(cam.yaw, cam.pitch);

      // Earth's display radius. Log mode: a fixed friendly globe. True mode:
      // the real 6371 km, but never smaller than ~3 px on screen.
      const scaleAtOrigin = cam.focal / CAM_DIST;
      const earthR =
        scaleModeRef.current === 'log'
          ? EARTH_R_LOG
          : Math.max((EARTH_RADIUS_KM / dMaxRef.current) * R_MAX, 3.0 / scaleAtOrigin);

      const hovered = hoveredRef.current;
      const selected = selectedRef.current;
      const focusId = hovered ?? selected;

      /* Build this frame's dynamic points. */
      let n = 0;
      const push = (wx: number, wy: number, wz: number, size: number, shade: number) => {
        if (n >= dynCapacity) return;
        const o = n * POINT_STRIDE;
        dyn[o] = wx;
        dyn[o + 1] = wy;
        dyn[o + 2] = wz;
        dyn[o + 3] = size;
        dyn[o + 4] = shade;
        n++;
      };

      // Earth positions for the wake samples are shared across bodies.
      const wakeEarth: (Vec3 | null)[] = [];
      if (!classic) {
        for (let k = 1; k <= WAKE_SAMPLES; k++) {
          wakeEarth.push(earthHeliocentric(jdFromMs(tMs - (k / WAKE_SAMPLES) * WAKE_SPAN_MS)));
        }
      }

      for (const b of bodiesRef.current) {
        const focused = b.neo.id === focusId;
        const ang = classic ? classicAngle(b, now) : 0;
        const p = classic
          ? ringPos(b, ang)
          : geocentric(b, tMs, b.el ? earthNow : null);
        const w = toWorld(p.x, p.y, p.z);
        if (w) {
          const proj = projectPoint(w.x, w.y, w.z, rot, cam, W, H);
          const dotPx = 1.8 + b.sizeFrac * 2.6;
          b.sx = proj.x;
          b.sy = proj.y;
          b.sz = proj.z;
          b.sr = dotPx * (CAM_DIST / Math.max(1, CAM_DIST - proj.z));
          b.visible = proj.x > -40 && proj.x < W + 40 && proj.y > -40 && proj.y < H + 40;
          push(w.x, w.y, w.z, dotPx, 0);
        } else {
          b.visible = false;
        }

        // The complete orbital ellipse, drawn relative to Earth's position at
        // the scrub time. Faint stipple normally; ink when focused.
        if (!classic && b.orbitKm) {
          const ok = b.orbitKm;
          const oSize = focused ? 1.5 : 1.0;
          const oShade = focused ? 0.1 : 0.55;
          for (let k = 0; k < ORBIT_SAMPLES; k++) {
            const ow = toWorld(
              ok[k * 3] - earthNow.x,
              ok[k * 3 + 1] - earthNow.y,
              ok[k * 3 + 2] - earthNow.z,
            );
            if (ow) push(ow.x, ow.y, ow.z, oSize, oShade);
          }
        }

        // Fading wake behind the body — a trailing arc along the ring in
        // classic mode, the true recent path in real mode.
        for (let k = 1; k <= WAKE_SAMPLES; k++) {
          const f = k / (WAKE_SAMPLES + 1);
          const wp = classic
            ? ringPos(b, ang - b.fb.dir * (k / WAKE_SAMPLES) * 1.3)
            : geocentric(b, tMs - (k / WAKE_SAMPLES) * WAKE_SPAN_MS, b.el ? wakeEarth[k - 1] : null);
          const ww = toWorld(wp.x, wp.y, wp.z);
          if (ww) push(ww.x, ww.y, ww.z, ((1 - f) * 1.7 + 0.4) * 2, f * 0.85);
        }

        // Embolden the focused body's track: its full ring in classic mode,
        // its flyby arc in real mode.
        if (focused && classic) {
          for (let s = 0; s < 96; s++) {
            const rp = ringPos(b, (s / 96) * 2 * Math.PI);
            const ww = toWorld(rp.x, rp.y, rp.z);
            if (ww) push(ww.x, ww.y, ww.z, 1.6, 0.05);
          }
        } else if (focused && b.pathKm) {
          for (let s = 0; s < PATH_SAMPLES; s += 2) {
            const ww = toWorld(b.pathKm[s * 3], b.pathKm[s * 3 + 1], b.pathKm[s * 3 + 2]);
            if (ww) push(ww.x, ww.y, ww.z, 2.0, 0.05);
          }
        }
      }

      // The Moon itself.
      let moonW: { x: number; y: number; z: number } | null = null;
      if (!classic) {
        const moon = moonGeocentric(jd);
        const moonRaw = toWorld(moon.x, moon.y, moon.z);
        moonW = moonRaw ? { ...moonRaw } : null;
        if (moonW) push(moonW.x, moonW.y, moonW.z, 2.6, 0.18);
      }

      renderer.setDynamicPoints(dyn, n);
      // Pass the zoom-independent focal so the Sun sits as a stable, distant
      // backdrop rather than ballooning when you zoom into the scene.
      renderer.render(cam, earthR, sunWorld, focalBase);

      /* Overlay: hazard rings, focus ring + label, CA marker, Moon label. */
      octx.clearRect(0, 0, W, H);
      octx.lineWidth = 1;
      octx.strokeStyle = '#000000';
      for (const b of bodiesRef.current) {
        if (!b.visible || !b.neo.hazardous) continue;
        octx.beginPath();
        octx.arc(Math.round(b.sx), Math.round(b.sy), b.sr + 3, 0, Math.PI * 2);
        octx.stroke();
      }

      const moonProj = moonW ? projectPoint(moonW.x, moonW.y, moonW.z, rot, cam, W, H) : null;
      if (moonProj && moonProj.x > 0 && moonProj.x < W && moonProj.y > 12 && moonProj.y < H) {
        octx.fillStyle = '#000000';
        octx.font = '14px "VT323", monospace';
        octx.textBaseline = 'middle';
        octx.fillText('Moon', Math.round(moonProj.x + 6), Math.round(moonProj.y - 7));
      }

      const focus = bodiesRef.current.find((b) => b.neo.id === focusId);
      if (focus && focus.visible) {
        octx.lineWidth = 2;
        octx.beginPath();
        octx.arc(Math.round(focus.sx), Math.round(focus.sy), focus.sr + 6, 0, Math.PI * 2);
        octx.stroke();

        octx.font = '16px "VT323", monospace';
        octx.textBaseline = 'middle';
        const label = focus.neo.name;
        const tw = octx.measureText(label).width;
        const lx = focus.sx + focus.sr + 9;
        const x = lx + tw > W - 4 ? focus.sx - focus.sr - 9 - tw : lx;
        octx.fillStyle = '#000000';
        octx.fillRect(Math.round(x - 2), Math.round(focus.sy - 9), tw + 4, 18);
        octx.fillStyle = '#ffffff';
        octx.fillText(label, Math.round(x), Math.round(focus.sy));

        // ⊕ marker at the computed closest approach (real mode only).
        if (!classic && focus.el && focus.caTimeMs !== null) {
          const e = earthHeliocentric(jdFromMs(focus.caTimeMs));
          const cp = geocentric(focus, focus.caTimeMs, e);
          const cw = toWorld(cp.x, cp.y, cp.z);
          const cproj = cw ? projectPoint(cw.x, cw.y, cw.z, rot, cam, W, H) : null;
          if (cproj) {
            octx.strokeStyle = '#000000';
            octx.lineWidth = 1;
            octx.beginPath();
            octx.moveTo(cproj.x - 5, cproj.y);
            octx.lineTo(cproj.x + 5, cproj.y);
            octx.moveTo(cproj.x, cproj.y - 5);
            octx.lineTo(cproj.x, cproj.y + 5);
            octx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    /* Pointer interaction: drag rotates, click selects, wheel/pinch zooms. */
    const bodyAt = (clientX: number, clientY: number): string | null => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      let best: string | null = null;
      let bestD = 14 * 14;
      let bestZ = -Infinity;
      for (const b of bodiesRef.current) {
        if (!b.visible) continue;
        const d = (b.sx - mx) ** 2 + (b.sy - my) ** 2;
        if (d < bestD - 4 || (d < bestD + 4 && b.sz > bestZ)) {
          bestD = d;
          bestZ = b.sz;
          best = b.neo.id;
        }
      }
      return best;
    };

    const clampZoom = (z: number) =>
      Math.min(scaleModeRef.current === 'log' ? 10 : 400, Math.max(0.5, z));

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    let isDrag = false;
    let startX = 0;
    let startY = 0;

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      isDrag = false;
      startX = e.clientX;
      startY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        setHoveredId(bodyAt(e.clientX, e.clientY));
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) {
          zoomRef.current = clampZoom(zoomRef.current * (d / pinchDist));
        }
        pinchDist = d;
        lastInteractRef.current = performance.now();
        return;
      }

      if (!isDrag && Math.hypot(e.clientX - startX, e.clientY - startY) > 3) {
        isDrag = true;
        canvas.style.cursor = 'grabbing';
        if (hoveredRef.current !== null) setHoveredId(null);
      }
      if (isDrag) {
        yawRef.current += dx * 0.01;
        pitchRef.current = Math.max(-1.45, Math.min(1.45, pitchRef.current + dy * 0.01));
        lastInteractRef.current = performance.now();
      }
    };
    const onUp = (e: PointerEvent) => {
      const wasPointer = pointers.delete(e.pointerId);
      pinchDist = 0;
      if (wasPointer && !isDrag && pointers.size === 0) {
        const id = bodyAt(e.clientX, e.clientY);
        if (id) setSelectedId(id);
      }
      if (pointers.size === 0) {
        isDrag = false;
        canvas.style.cursor = 'grab';
      }
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    const onLeave = () => {
      if (pointers.size === 0) setHoveredId(null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = clampZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0014));
      lastInteractRef.current = performance.now();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [state]);

  /* --- UI --------------------------------------------------------------- */

  const objects = state.status === 'ready' ? state.objects : [];
  const detailId = hoveredId ?? selectedId;
  const detailBody = bodiesRef.current.find((b) => b.neo.id === detailId) ?? null;
  const detail = detailBody?.neo ?? null;
  const hazardCount = objects.filter((o) => o.hazardous).length;

  const winStart = t0Ref.current - WINDOW_HALF_MS;
  const winSpan = 2 * WINDOW_HALF_MS;
  const sliderVal = Math.round(((timeMs - winStart) / winSpan) * 1000);

  const onScrub = (v: number) => {
    const t = winStart + (v / 1000) * winSpan;
    tRef.current = t;
    setTimeMs(t);
  };

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
          {' · '}
          {viewMode === 'classic'
            ? 'close approaches via NASA NeoWs'
            : 'real orbits via NASA/JPL, propagated by Kepler\u2019s equation'}
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
              <canvas ref={overlayRef} className="asteroids-overlay" />
              {glFailed && (
                <p className="asteroids-status asteroids-gl-error">
                  This map needs WebGL2, which your browser has turned off.
                </p>
              )}
              <span className="asteroids-drag-hint">
                drag to rotate · scroll to zoom
              </span>
            </div>

            <div className="asteroids-side">
              <div className="asteroids-detail">
                {detail ? (
                  <>
                    <div className="win-sub asteroids-detail-name">
                      {detail.name}
                      {detail.hazardous && <span className="asteroids-pha"> ⚠ PHA</span>}
                    </div>
                    <dl className="asteroids-stats">
                      <dt>Miss</dt>
                      <dd>{fmtKmShort(detail.missKm)}</dd>
                      <dt>&nbsp;</dt>
                      <dd>= {(detail.missKm / LUNAR_DISTANCE_KM).toFixed(1)} LD</dd>
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
                      <dt>Orbit</dt>
                      <dd>
                        {detailBody?.el
                          ? detailBody.orbitClass ?? 'JPL elements'
                          : 'resolving…'}
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
                    {viewMode === 'real' && ' The ⊕ mark is its closest approach.'}
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
                    <span className="asteroids-legend-dist">{fmtKmShort(o.missKm)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {viewMode === 'real' && (
          <div className="asteroids-timebar">
            <button
              type="button"
              className="mac-button asteroids-play"
              onClick={() => setPlaying((p) => !p)}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              className="mac-button asteroids-speed"
              onClick={() => setSpeedIdx((i) => (i + 1) % PLAY_SPEEDS.length)}
              title="Playback speed"
            >
              {PLAY_SPEEDS[speedIdx].label}
            </button>
            <input
              type="range"
              className="asteroids-scrub"
              min={0}
              max={1000}
              value={Math.max(0, Math.min(1000, sliderVal))}
              onChange={(e) => onScrub(Number(e.target.value))}
              aria-label="Simulation time"
            />
            <button type="button" className="mac-button" onClick={jumpToNow}>
              Now
            </button>
            <span className="win-meta asteroids-clock">{fmtClock(timeMs)}</span>
          </div>
          )}

          <hr className="mac-rule" />
          <div className="asteroids-footer">
            <button type="button" className="mac-button" onClick={() => void load()}>
              Refresh
            </button>
            <button type="button" className="mac-button" onClick={resetView}>
              Reset View
            </button>
            <button
              type="button"
              className="mac-button"
              onClick={() => setViewMode((m) => (m === 'classic' ? 'real' : 'classic'))}
              title="Classic is the original decorative map; Real propagates actual JPL orbital elements with a time machine."
            >
              Mode: {viewMode === 'classic' ? 'Classic' : 'Real'}
            </button>
            <button
              type="button"
              className="mac-button"
              onClick={() => setScaleMode((m) => (m === 'log' ? 'true' : 'log'))}
              title="Log scale keeps everything readable; true scale shows honest distances — zoom in to find the Moon's orbit."
            >
              Scale: {scaleMode === 'log' ? 'Log' : 'True'}
            </button>
            <span className="win-meta">
              {objects.length} tracked · {hazardCount} hazardous ·{' '}
              {viewMode === 'classic'
                ? `updated ${state.fetchedAt.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : orbitsLoaded + approxCount < objects.length
                  ? `orbits ${orbitsLoaded}/${objects.length}…`
                  : approxCount > 0
                    ? `${approxCount} approx.`
                    : 'JPL orbits'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
