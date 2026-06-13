/* ==========================================================================
   kepler — just enough orbital mechanics for the Asteroids window.

   Propagates heliocentric Keplerian elements (from NASA/JPL) to a geocentric
   position at an arbitrary moment by solving Kepler's equation, using a
   standard low-precision Earth ephemeris (Standish 1800–2050 series) and a
   truncated lunar theory for the Moon. Everything works in the J2000 ecliptic
   frame; distances in km, angles in radians unless noted.

   Accuracy notes: two-body propagation of osculating elements near their
   epoch is good to a small fraction of a percent over the few days we plot.
   It deliberately ignores Earth's gravity during the encounter, so the very
   closest approaches bend a little less than reality — fine for a map,
   not for planetary defence.
   ========================================================================== */

export type Vec3 = { x: number; y: number; z: number };

/** Osculating heliocentric Keplerian elements (J2000 ecliptic). */
export type KeplerElements = {
  /** Semi-major axis, AU */
  a: number;
  /** Eccentricity */
  e: number;
  /** Inclination, rad */
  i: number;
  /** Longitude of the ascending node, rad */
  om: number;
  /** Argument of perihelion, rad */
  w: number;
  /** Mean anomaly at epoch, rad */
  ma: number;
  /** Mean motion, rad/day */
  n: number;
  /** Epoch of osculation, Julian Date (TDB ≈ fine at this precision) */
  epochJd: number;
};

export const AU_KM = 149_597_870.7;
export const LUNAR_DISTANCE_KM = 384_400;
const J2000 = 2451545.0;
const DEG = Math.PI / 180;

/** Gaussian gravitational constant → mean motion n = K / a^1.5 (rad/day). */
const GAUSS_K = 0.01720209895;

export function meanMotionRadPerDay(aAu: number): number {
  return GAUSS_K / Math.pow(aAu, 1.5);
}

/** Julian Date from a JS epoch-milliseconds timestamp. */
export function jdFromMs(ms: number): number {
  return ms / 86_400_000 + 2_440_587.5;
}

/* --- Kepler's equation ------------------------------------------------------ */

/** Solve E − e·sinE = M by Newton's method (radians). Robust for e < 0.99. */
export function solveKepler(M: number, e: number): number {
  // Normalise M to (−π, π] for a well-behaved starting guess.
  let m = M % (2 * Math.PI);
  if (m > Math.PI) m -= 2 * Math.PI;
  if (m < -Math.PI) m += 2 * Math.PI;

  let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
  for (let k = 0; k < 32; k++) {
    const f = E - e * Math.sin(E) - m;
    const fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/* --- element propagation ---------------------------------------------------- */

/** Rotate orbital-plane coordinates (AU; x toward perihelion) into
    heliocentric J2000 ecliptic km, by argument of perihelion (w),
    inclination (i), then ascending node (om). */
function planeToEcliptic(el: KeplerElements, xp: number, yp: number): Vec3 {
  const cw = Math.cos(el.w);
  const sw = Math.sin(el.w);
  const ci = Math.cos(el.i);
  const si = Math.sin(el.i);
  const co = Math.cos(el.om);
  const so = Math.sin(el.om);

  const x1 = cw * xp - sw * yp;
  const y1 = sw * xp + cw * yp;
  const y2 = ci * y1;
  const z2 = si * y1;

  return {
    x: (co * x1 - so * y2) * AU_KM,
    y: (so * x1 + co * y2) * AU_KM,
    z: z2 * AU_KM,
  };
}

/** Heliocentric position (km, J2000 ecliptic) of a body at Julian Date jd. */
export function heliocentricPosition(el: KeplerElements, jd: number): Vec3 {
  const M = el.ma + el.n * (jd - el.epochJd);
  const E = solveKepler(M, el.e);
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
  return planeToEcliptic(el, xp, yp);
}

/** n points around the complete orbit (uniform eccentric anomaly, so samples
    bunch toward perihelion where the body actually spends... the least time —
    but where the geometry curves hardest). Heliocentric km, x/y/z triplets. */
export function orbitEllipse(el: KeplerElements, n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const semiMinor = el.a * Math.sqrt(1 - el.e * el.e);
  for (let k = 0; k < n; k++) {
    const E = (k / n) * 2 * Math.PI;
    const p = planeToEcliptic(el, el.a * (Math.cos(E) - el.e), semiMinor * Math.sin(E));
    out[k * 3] = p.x;
    out[k * 3 + 1] = p.y;
    out[k * 3 + 2] = p.z;
  }
  return out;
}

/* --- Earth ------------------------------------------------------------------ */

/** Heliocentric position of the Earth–Moon barycentre (Standish 1800–2050). */
function embPosition(jd: number): Vec3 {
  const T = (jd - J2000) / 36525;
  const a = 1.00000261 + 0.00000562 * T;
  const e = 0.01671123 - 0.00004392 * T;
  const i = (-0.00001531 - 0.01294668 * T) * DEG;
  const L = (100.46457166 + 35999.37244981 * T) * DEG;
  const varpi = (102.93768193 + 0.32327364 * T) * DEG;
  const om = 0;

  const el: KeplerElements = {
    a,
    e,
    i,
    om,
    w: varpi - om,
    ma: L - varpi,
    n: 0, // unused: we pass jd === epoch
    epochJd: jd,
  };
  return heliocentricPosition(el, jd);
}

/** Geocentric position of the Moon (km, J2000 ecliptic). Truncated lunar
    theory — a few largest terms; good to ~0.5% in distance. */
export function moonGeocentric(jd: number): Vec3 {
  const d = jd - J2000;
  const Lp = (218.316 + 13.176396 * d) * DEG; // mean longitude
  const Mp = (134.963 + 13.064993 * d) * DEG; // mean anomaly
  const F = (93.272 + 13.22935 * d) * DEG; // argument of latitude

  const lambda = Lp + 6.289 * DEG * Math.sin(Mp);
  const beta = 5.128 * DEG * Math.sin(F);
  const dist = 385_001 - 20_905 * Math.cos(Mp);

  const cb = Math.cos(beta);
  return {
    x: dist * cb * Math.cos(lambda),
    y: dist * cb * Math.sin(lambda),
    z: dist * Math.sin(beta),
  };
}

/** Earth/(Earth+Moon) mass offset: the Earth sits this fraction of the
    Earth–Moon vector on the far side of the barycentre. */
const MOON_MASS_FRACTION = 0.0121505;

/** Heliocentric position of the Earth itself (km, J2000 ecliptic). */
export function earthHeliocentric(jd: number): Vec3 {
  const emb = embPosition(jd);
  const moon = moonGeocentric(jd);
  return {
    x: emb.x - moon.x * MOON_MASS_FRACTION,
    y: emb.y - moon.y * MOON_MASS_FRACTION,
    z: emb.z - moon.z * MOON_MASS_FRACTION,
  };
}

/** Geocentric position of a small body (km, J2000 ecliptic) at jd. */
export function geocentricPosition(el: KeplerElements, jd: number): Vec3 {
  const ast = heliocentricPosition(el, jd);
  const earth = earthHeliocentric(jd);
  return { x: ast.x - earth.x, y: ast.y - earth.y, z: ast.z - earth.z };
}

/** Unit vector from Earth toward the Sun (for lighting the globe). */
export function sunDirection(jd: number): Vec3 {
  const e = earthHeliocentric(jd);
  const len = Math.hypot(e.x, e.y, e.z) || 1;
  return { x: -e.x / len, y: -e.y / len, z: -e.z / len };
}

export function vecLength(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}
