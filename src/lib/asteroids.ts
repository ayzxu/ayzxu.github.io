/* ==========================================================================
   asteroids — shared client for NASA's public NeoWs (Near Earth Object Web
   Service) feed. Returns the asteroids making a close approach to Earth today,
   closest first. Defaults to NASA's DEMO_KEY (rate-limited, no signup); set
   VITE_NASA_API_KEY to use a personal key with higher limits.
   ========================================================================== */

export type NearEarthObject = {
  id: string;
  /** Designation with the surrounding parens stripped, e.g. "2020 AB" */
  name: string;
  /** Link to the object's page on NASA/JPL Small-Body Database */
  nasaJplUrl: string;
  hazardous: boolean;
  /** Average estimated diameter in metres */
  diameterM: number;
  /** Close-approach miss distance from Earth in kilometres */
  missKm: number;
  /** Relative velocity at close approach in km/s */
  velocityKps: number;
  /** Moment of closest approach */
  approachTime: Date;
};

/* The shape of the slice of the NeoWs response we actually read. */
type RawNeo = {
  id: string;
  name: string;
  nasa_jpl_url: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: {
    meters: {
      estimated_diameter_min: number;
      estimated_diameter_max: number;
    };
  };
  close_approach_data: {
    epoch_date_close_approach: number;
    relative_velocity: { kilometers_per_second: string };
    miss_distance: { kilometers: string };
  }[];
};

/* The key comes from VITE_NASA_API_KEY, injected at build time (a GitHub
   Actions secret in CI; a local .env.local for development). It falls back to
   NASA's shared DEMO_KEY — fine for local poking but rate-limited to ~30 req/hr,
   so production builds should always supply a personal key. A blank value falls
   back rather than sending an empty api_key. */
const API_KEY = import.meta.env.VITE_NASA_API_KEY?.trim() || 'DEMO_KEY';

/** Cap so the orbital map stays legible even on the busiest days. */
const MAX_OBJECTS = 40;

/** Why a feed fetch failed — lets the UI explain rate limits vs. being offline. */
export type NeoErrorCode = 'rate-limit' | 'http' | 'offline';

export class NeoError extends Error {
  code: NeoErrorCode;
  constructor(code: NeoErrorCode, message: string) {
    super(message);
    this.name = 'NeoError';
    this.code = code;
  }
}

/** Local date as YYYY-MM-DD for the NeoWs feed date parameters. */
function todayParam(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fetch today's near-Earth close approaches, closest miss distance first.
    Retries once on a transient network/5xx hiccup, but not on a 429 (the
    rate limit won't clear instantly). */
export async function fetchNeoFeed(): Promise<NearEarthObject[]> {
  const day = todayParam();
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${day}&end_date=${day}&api_key=${API_KEY}`;

  let res: Response;
  try {
    res = await fetch(url);
    if (res.status >= 500) {
      // One short retry for a transient server error.
      await new Promise((r) => setTimeout(r, 600));
      res = await fetch(url);
    }
  } catch {
    // Network error — retry once, then give up as "offline".
    try {
      await new Promise((r) => setTimeout(r, 600));
      res = await fetch(url);
    } catch {
      throw new NeoError('offline', 'Could not reach NASA');
    }
  }

  if (res.status === 429) {
    throw new NeoError('rate-limit', 'NASA rate limit reached');
  }
  if (!res.ok) {
    throw new NeoError('http', `HTTP ${res.status}`);
  }

  const data: { near_earth_objects: Record<string, RawNeo[]> } =
    await res.json();

  const raw = data.near_earth_objects[day] ?? [];
  const objects: NearEarthObject[] = [];
  for (const neo of raw) {
    const approach = neo.close_approach_data[0];
    if (!approach) continue;
    const dia = neo.estimated_diameter.meters;
    objects.push({
      id: neo.id,
      name: neo.name.replace(/^\(|\)$/g, '').trim(),
      nasaJplUrl: neo.nasa_jpl_url,
      hazardous: neo.is_potentially_hazardous_asteroid,
      diameterM: (dia.estimated_diameter_min + dia.estimated_diameter_max) / 2,
      missKm: Number(approach.miss_distance.kilometers),
      velocityKps: Number(approach.relative_velocity.kilometers_per_second),
      approachTime: new Date(approach.epoch_date_close_approach),
    });
  }

  objects.sort((a, b) => a.missKm - b.missKm);
  return objects.slice(0, MAX_OBJECTS);
}

/* ==========================================================================
   Orbital elements — the feed endpoint above doesn't include them, but the
   per-object lookup (`/neo/{id}`) returns full-precision osculating Keplerian
   elements straight from JPL's small-body solution. We fetch those lazily
   (the map falls back to a decorative orbit until they arrive) and cache them
   in localStorage: elements only change when JPL refits an orbit, so a cached
   copy spares the rate limit on every revisit.
   ========================================================================== */

export type OrbitClass = { type: string; description: string };

export type NeoOrbit = {
  /** Semi-major axis, AU */
  a: number;
  /** Eccentricity */
  e: number;
  /** Inclination, deg */
  i: number;
  /** Longitude of ascending node, deg */
  om: number;
  /** Argument of perihelion, deg */
  w: number;
  /** Mean anomaly at epoch, deg */
  ma: number;
  /** Mean motion, deg/day */
  n: number;
  /** Epoch of osculation, Julian Date */
  epochJd: number;
  orbitClass: OrbitClass | null;
};

type RawOrbitalData = {
  epoch_osculation: string;
  eccentricity: string;
  semi_major_axis: string;
  inclination: string;
  ascending_node_longitude: string;
  perihelion_argument: string;
  mean_anomaly: string;
  mean_motion: string;
  orbit_class?: {
    orbit_class_type?: string;
    orbit_class_description?: string;
  };
};

const ORBIT_CACHE_PREFIX = 'neo-orbit-v1:';
/** Refresh cached elements monthly in case JPL updates the solution. */
const ORBIT_CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

function readOrbitCache(id: string): NeoOrbit | null {
  try {
    const raw = localStorage.getItem(ORBIT_CACHE_PREFIX + id);
    if (!raw) return null;
    const { t, orbit } = JSON.parse(raw) as { t: number; orbit: NeoOrbit };
    if (Date.now() - t > ORBIT_CACHE_TTL_MS) return null;
    return orbit;
  } catch {
    return null;
  }
}

function writeOrbitCache(id: string, orbit: NeoOrbit): void {
  try {
    localStorage.setItem(
      ORBIT_CACHE_PREFIX + id,
      JSON.stringify({ t: Date.now(), orbit }),
    );
  } catch {
    /* storage full or unavailable — caching is best-effort */
  }
}

function parseOrbitalData(od: RawOrbitalData): NeoOrbit | null {
  const a = Number(od.semi_major_axis);
  const e = Number(od.eccentricity);
  const i = Number(od.inclination);
  const om = Number(od.ascending_node_longitude);
  const w = Number(od.perihelion_argument);
  const ma = Number(od.mean_anomaly);
  const n = Number(od.mean_motion);
  const epochJd = Number(od.epoch_osculation);
  if (![a, e, i, om, w, ma, n, epochJd].every(Number.isFinite)) return null;
  if (a <= 0 || e < 0 || e >= 1) return null; // bound orbits only
  const cls = od.orbit_class;
  return {
    a,
    e,
    i,
    om,
    w,
    ma,
    n,
    epochJd,
    orbitClass:
      cls?.orbit_class_type && cls.orbit_class_description
        ? { type: cls.orbit_class_type, description: cls.orbit_class_description }
        : null,
  };
}

/** Fetch one object's elements (cache-first). Throws NeoError on failure. */
export async function fetchOrbit(id: string): Promise<NeoOrbit> {
  const cached = readOrbitCache(id);
  if (cached) return cached;

  const url = `https://api.nasa.gov/neo/rest/v1/neo/${id}?api_key=${API_KEY}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new NeoError('offline', 'Could not reach NASA');
  }
  if (res.status === 429) throw new NeoError('rate-limit', 'Rate limited');
  if (!res.ok) throw new NeoError('http', `HTTP ${res.status}`);

  const data: { orbital_data?: RawOrbitalData } = await res.json();
  const orbit = data.orbital_data ? parseOrbitalData(data.orbital_data) : null;
  if (!orbit) throw new NeoError('http', 'No orbital data');
  writeOrbitCache(id, orbit);
  return orbit;
}

/** Fetch elements for many objects with limited concurrency, reporting each
    result as it lands. Stops requesting (but keeps reporting cached hits) once
    the rate limit trips so we don't dig the hole deeper. */
export async function fetchOrbits(
  ids: string[],
  onResult: (id: string, orbit: NeoOrbit | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  const queue = [...ids];
  let rateLimited = false;

  const worker = async () => {
    for (;;) {
      const id = queue.shift();
      if (id === undefined || signal?.aborted) return;
      const cached = readOrbitCache(id);
      if (cached) {
        onResult(id, cached);
        continue;
      }
      if (rateLimited) {
        onResult(id, null);
        continue;
      }
      try {
        onResult(id, await fetchOrbit(id));
      } catch (err) {
        if (err instanceof NeoError && err.code === 'rate-limit') {
          rateLimited = true;
        }
        onResult(id, null);
      }
    }
  };

  await Promise.all(Array.from({ length: 5 }, worker));
}
