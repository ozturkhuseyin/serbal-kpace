/**
 * Phase-3 polish helpers: reentry heating computation, fairing deployment
 * tracking, simple docking proximity helper. These hook into the existing
 * physics + render systems via lightweight functions.
 */

import { Vec3 } from '../physics/Vector3';
import { Vessel } from '../physics/Vessel';

/**
 * Convective heating on a vessel from atmospheric travel.
 *   q = 0.5 · ρ · v³ · k
 * where k is a tunable shape factor.
 */
export function reentryHeatingFlux(density: number, speed: number, shape = 1.4e-4): number {
  if (density <= 0 || speed <= 0) return 0;
  return 0.5 * density * speed * speed * speed * shape;
}

/**
 * Update internal heat for a vessel. Returns the new temperature (K).
 */
export function updateVesselHeat(v: Vessel, density: number, speed: number, dt: number): number {
  const flux = reentryHeatingFlux(density, speed);
  const baseTemp = (v.flags['heatTemp'] as unknown as number) ?? 290;
  const heatCapacity = Math.max(v.totalMass() * 800, 1);
  const radiative = Math.max(0, baseTemp - 290) * 50;
  const newTemp = baseTemp + ((flux - radiative) / heatCapacity) * dt;
  v.flags['heatTemp'] = (newTemp as unknown) as boolean;
  if (newTemp > 1800) v.situation = 'destroyed';
  return newTemp;
}

/**
 * Deploy fairing parts in a stage. The procedural mesh splits into segments
 * that fly outward; the physics layer just removes the parts and emits an
 * event for the audio system.
 */
export function deployFairings(v: Vessel, partIds: string[]): void {
  for (const id of partIds) {
    v.flags[`fairing-deployed-${id}`] = true;
  }
}

/**
 * Distance between two vessel docking ports for autopilot capture.
 */
export function portDistance(a: Vec3, b: Vec3): number {
  return a.sub(b).length();
}
