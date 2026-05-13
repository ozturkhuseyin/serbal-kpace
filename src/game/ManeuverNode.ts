import { Vec3 } from '../physics/Vector3';
import { OrbitElements, elementsToState, propagateAnomaly, stateToElements } from '../physics/OrbitalMechanics';
import { CelestialBody } from '../physics/CelestialBody';

export interface ManeuverNode {
  id: string;
  /** True anomaly along the *current* orbit at which to execute the burn. */
  trueAnomaly: number;
  /** Δv components in the prograde / normal / radial frame at that point (m/s). */
  prograde: number;
  normal: number;
  radial: number;
}

/**
 * Apply a maneuver to a Keplerian orbit and return the new orbit.
 */
export function applyManeuver(orbit: OrbitElements, parent: CelestialBody, node: ManeuverNode): OrbitElements {
  const state = elementsToState({ ...orbit, nu: node.trueAnomaly });
  const r = state.r.length();
  const v = state.v.length();
  const progradeDir = state.v.normalize();
  const radialDir = state.r.normalize();
  const normalDir = state.r.cross(state.v).normalize();
  const newV = state.v
    .add(progradeDir.mul(node.prograde))
    .add(normalDir.mul(node.normal))
    .add(radialDir.mul(node.radial));
  return stateToElements(state.r, newV, parent.config.mu);
}

/** Time (s) until the vessel reaches the maneuver node along its current orbit. */
export function timeToManeuver(orbit: OrbitElements, currentNu: number, nodeNu: number): number {
  if (orbit.e >= 1 || !isFinite(orbit.period)) return 0;
  const a = orbit.e;
  const E = (nu: number) => Math.atan2(Math.sqrt(1 - a * a) * Math.sin(nu), a + Math.cos(nu));
  const M = (nu: number) => {
    const e = E(nu);
    return e - a * Math.sin(e);
  };
  const M0 = M(currentNu);
  const Mn = M(nodeNu);
  const meanMotion = (Math.PI * 2) / orbit.period;
  let dt = (Mn - M0) / meanMotion;
  while (dt < 0) dt += orbit.period;
  return dt;
}

void propagateAnomaly;
void Vec3;
