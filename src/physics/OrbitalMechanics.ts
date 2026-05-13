import { Vec3 } from './Vector3';
import { TWO_PI, ORBIT_ECC_TOL, MIN_FLOAT } from './Constants';

/**
 * Classical Keplerian orbital elements describing an orbit around a central body.
 */
export interface OrbitElements {
  /** Semi-major axis (m). Negative for hyperbolic orbits. */
  a: number;
  /** Eccentricity. 0 = circular, <1 = elliptical, =1 = parabolic, >1 = hyperbolic. */
  e: number;
  /** Inclination (rad). */
  i: number;
  /** Longitude of ascending node (rad). */
  omega: number;
  /** Argument of periapsis (rad). */
  argp: number;
  /** True anomaly at epoch (rad). */
  nu: number;
  /** Specific angular momentum magnitude (m²/s). */
  h: number;
  /** Period (s). Infinity for parabolic/hyperbolic. */
  period: number;
  /** Periapsis distance from focus (m). */
  rp: number;
  /** Apoapsis distance from focus (m). Infinity for parabolic/hyperbolic. */
  ra: number;
  /** Standard gravitational parameter used (m³/s²). */
  mu: number;
}

/**
 * Convert state vectors (position, velocity) relative to the parent body to
 * Keplerian orbital elements.
 *
 * Reference: Vallado, "Fundamentals of Astrodynamics and Applications", Algorithm 9.
 */
export function stateToElements(r: Vec3, v: Vec3, mu: number): OrbitElements {
  const rMag = r.length();
  const vMag = v.length();

  const h = r.cross(v);
  const hMag = h.length();

  const k = new Vec3(0, 0, 1);
  const n = k.cross(h);
  const nMag = n.length();

  const eVec = v.cross(h).div(mu).sub(r.div(rMag));
  const eMag = eVec.length();

  const energy = (vMag * vMag) / 2 - mu / rMag;
  const a = Math.abs(energy) < MIN_FLOAT ? Infinity : -mu / (2 * energy);

  let i = Math.acos(clampUnit(h.z / hMag));
  if (!isFinite(i)) i = 0;

  let omega = nMag > ORBIT_ECC_TOL ? Math.acos(clampUnit(n.x / nMag)) : 0;
  if (n.y < 0) omega = TWO_PI - omega;

  let argp = 0;
  if (nMag > ORBIT_ECC_TOL && eMag > ORBIT_ECC_TOL) {
    argp = Math.acos(clampUnit(n.dot(eVec) / (nMag * eMag)));
    if (eVec.z < 0) argp = TWO_PI - argp;
  }

  let nu = 0;
  if (eMag > ORBIT_ECC_TOL) {
    nu = Math.acos(clampUnit(eVec.dot(r) / (eMag * rMag)));
    if (r.dot(v) < 0) nu = TWO_PI - nu;
  } else if (nMag > ORBIT_ECC_TOL) {
    nu = Math.acos(clampUnit(n.dot(r) / (nMag * rMag)));
    if (r.z < 0) nu = TWO_PI - nu;
  } else {
    nu = Math.atan2(r.y, r.x);
  }

  const rp = a * (1 - eMag);
  const ra = eMag < 1 ? a * (1 + eMag) : Infinity;
  const period = a > 0 && eMag < 1 ? TWO_PI * Math.sqrt((a * a * a) / mu) : Infinity;

  return { a, e: eMag, i, omega, argp, nu, h: hMag, period, rp, ra, mu };
}

/**
 * Convert Keplerian orbital elements back to state vectors relative to the
 * parent body's inertial frame.
 */
export function elementsToState(el: OrbitElements): { r: Vec3; v: Vec3 } {
  const { e, i, omega, argp, nu, mu } = el;
  const p = el.h * el.h / mu;
  const r = p / (1 + e * Math.cos(nu));

  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);
  const rPerifocal = new Vec3(r * cosNu, r * sinNu, 0);
  const vPerifocal = new Vec3(
    -(mu / el.h) * sinNu,
    (mu / el.h) * (e + cosNu),
    0,
  );

  const cosO = Math.cos(omega), sinO = Math.sin(omega);
  const cosI = Math.cos(i), sinI = Math.sin(i);
  const cosW = Math.cos(argp), sinW = Math.sin(argp);

  const m11 = cosO * cosW - sinO * sinW * cosI;
  const m12 = -cosO * sinW - sinO * cosW * cosI;
  const m13 = sinO * sinI;
  const m21 = sinO * cosW + cosO * sinW * cosI;
  const m22 = -sinO * sinW + cosO * cosW * cosI;
  const m23 = -cosO * sinI;
  const m31 = sinW * sinI;
  const m32 = cosW * sinI;
  const m33 = cosI;

  const transform = (vec: Vec3): Vec3 => new Vec3(
    m11 * vec.x + m12 * vec.y + m13 * vec.z,
    m21 * vec.x + m22 * vec.y + m23 * vec.z,
    m31 * vec.x + m32 * vec.y + m33 * vec.z,
  );

  return { r: transform(rPerifocal), v: transform(vPerifocal) };
}

/**
 * Vis-viva equation. Returns orbital speed at radius `r` for an orbit with
 * semi-major axis `a` around a body with gravitational parameter `mu`.
 */
export function visViva(r: number, a: number, mu: number): number {
  return Math.sqrt(mu * (2 / r - 1 / a));
}

/**
 * Escape velocity from radius `r` around a body with gravitational parameter `mu`.
 */
export function escapeVelocity(r: number, mu: number): number {
  return Math.sqrt(2 * mu / r);
}

/**
 * Hohmann transfer Δv between two coplanar circular orbits.
 *
 * Returns total Δv = burn 1 (raise apoapsis) + burn 2 (circularize at target).
 */
export function hohmannTransferDeltaV(r1: number, r2: number, mu: number): {
  dv1: number;
  dv2: number;
  total: number;
  transferTime: number;
} {
  const aTransfer = (r1 + r2) / 2;
  const v1 = Math.sqrt(mu / r1);
  const v2 = Math.sqrt(mu / r2);
  const vtp = visViva(r1, aTransfer, mu);
  const vta = visViva(r2, aTransfer, mu);
  const dv1 = vtp - v1;
  const dv2 = v2 - vta;
  const transferTime = Math.PI * Math.sqrt(aTransfer ** 3 / mu);
  return { dv1, dv2, total: Math.abs(dv1) + Math.abs(dv2), transferTime };
}

/**
 * Solve Kepler's equation for the eccentric anomaly E given mean anomaly M
 * and eccentricity e (elliptical case, e < 1). Newton-Raphson iteration.
 */
export function solveKepler(M: number, e: number, tol = 1e-10, maxIter = 32): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let n = 0; n < maxIter; n++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

/** Convert eccentric anomaly to true anomaly. */
export function eccentricToTrueAnomaly(E: number, e: number): number {
  const sin = Math.sqrt(1 - e * e) * Math.sin(E);
  const cos = Math.cos(E) - e;
  return Math.atan2(sin, cos);
}

/** Convert true anomaly to eccentric anomaly. */
export function trueToEccentricAnomaly(nu: number, e: number): number {
  const cos = (e + Math.cos(nu)) / (1 + e * Math.cos(nu));
  const sin = Math.sqrt(1 - e * e) * Math.sin(nu) / (1 + e * Math.cos(nu));
  return Math.atan2(sin, cos);
}

/**
 * Propagate the orbit forward by time dt (s) starting from the given elements.
 * Returns updated true anomaly. Only valid for elliptic orbits (e < 1).
 */
export function propagateAnomaly(el: OrbitElements, dt: number): number {
  if (el.e >= 1 || !isFinite(el.period)) return el.nu;
  const E0 = trueToEccentricAnomaly(el.nu, el.e);
  const M0 = E0 - el.e * Math.sin(E0);
  const n = TWO_PI / el.period;
  const M = M0 + n * dt;
  const E = solveKepler(M, el.e);
  return eccentricToTrueAnomaly(E, el.e);
}

/**
 * Sample N points along the orbit for visualisation (in body-relative frame).
 */
export function sampleOrbit(el: OrbitElements, samples = 128): Vec3[] {
  const points: Vec3[] = [];
  if (el.e >= 1) {
    const limit = Math.acos(-1 / el.e) * 0.99;
    for (let i = 0; i <= samples; i++) {
      const nu = -limit + (limit * 2) * (i / samples);
      points.push(elementsToState({ ...el, nu }).r);
    }
  } else {
    for (let i = 0; i <= samples; i++) {
      const nu = (i / samples) * TWO_PI;
      points.push(elementsToState({ ...el, nu }).r);
    }
  }
  return points;
}

function clampUnit(v: number): number {
  return v > 1 ? 1 : v < -1 ? -1 : v;
}
