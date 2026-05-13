import { Vec3 } from './Vector3';

export interface AtmosphereModel {
  /** Sea-level pressure (Pa). 0 means no atmosphere. */
  p0: number;
  /** Scale height (m). */
  scaleHeight: number;
  /** Sea-level temperature (K). */
  t0: number;
  /** Atmosphere top altitude above sea level (m). Above this drag is zero. */
  ceiling: number;
  /** Sea-level air density (kg/m³). */
  rho0: number;
}

/**
 * Pressure at altitude h (m) using exponential model: P(h) = P0 · exp(-h / H).
 */
export function pressureAtAltitude(atm: AtmosphereModel, altitude: number): number {
  if (atm.p0 <= 0 || altitude >= atm.ceiling) return 0;
  if (altitude < 0) return atm.p0;
  return atm.p0 * Math.exp(-altitude / atm.scaleHeight);
}

/**
 * Density at altitude h (m). Approximated by exponential decay matching pressure curve.
 */
export function densityAtAltitude(atm: AtmosphereModel, altitude: number): number {
  if (atm.p0 <= 0 || altitude >= atm.ceiling) return 0;
  if (altitude < 0) return atm.rho0;
  return atm.rho0 * Math.exp(-altitude / atm.scaleHeight);
}

/**
 * Drag force vector on a vessel.
 *  F_drag = -0.5 · ρ · v² · Cd · A · v̂
 *
 * @param velocity Vessel velocity relative to the atmosphere (m/s)
 * @param density  Local atmospheric density (kg/m³)
 * @param dragCoefficient  Sum-of-parts Cd
 * @param crossSectionArea  Cross-sectional area facing the velocity (m²)
 */
export function dragForce(
  velocity: Vec3,
  density: number,
  dragCoefficient: number,
  crossSectionArea: number,
): Vec3 {
  const v2 = velocity.lengthSq();
  if (v2 <= 0 || density <= 0) return new Vec3();
  const speed = Math.sqrt(v2);
  const magnitude = 0.5 * density * v2 * dragCoefficient * crossSectionArea;
  return velocity.mul(-magnitude / speed);
}

/**
 * Mach number for the vessel given atmosphere temperature.
 * c = √(γ · R · T / M)
 */
export function machNumber(speed: number, temperatureK: number): number {
  const gamma = 1.4;
  const R = 8.31446;
  const M = 0.0289644;
  const c = Math.sqrt(gamma * R * temperatureK / M);
  return c > 0 ? speed / c : 0;
}

/**
 * Dynamic pressure (Pa) — a key indicator of structural and aerodynamic stress.
 */
export function dynamicPressure(density: number, speed: number): number {
  return 0.5 * density * speed * speed;
}

/**
 * Atmospheric temperature with simple linear lapse below scale height.
 */
export function temperatureAtAltitude(atm: AtmosphereModel, altitude: number): number {
  if (atm.p0 <= 0) return 2.7;
  const lapse = -0.0065;
  const t = atm.t0 + lapse * altitude;
  return Math.max(t, 60);
}
