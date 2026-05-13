import { Vec3 } from './Vector3';

export interface CollisionResult {
  collided: boolean;
  /** World-space contact point. */
  point: Vec3;
  /** Outward normal at contact (toward space). */
  normal: Vec3;
  /** Penetration depth (m). */
  depth: number;
  /** Surface altitude at contact (m above mean radius). */
  surfaceAltitude: number;
}

/**
 * Sphere-vs-planet collision against a body of given radius.
 * `vesselRadius` is a bounding sphere; `bodyCenter` is in the same frame
 * as `vesselPosition`. `surfaceAltitudeFn` lets us account for terrain.
 */
export function checkSphereTerrain(
  vesselPosition: Vec3,
  vesselRadius: number,
  bodyCenter: Vec3,
  bodyRadius: number,
  surfaceAltitudeFn?: (point: Vec3) => number,
): CollisionResult {
  const offset = vesselPosition.sub(bodyCenter);
  const dist = offset.length();
  const dir = dist > 1e-6 ? offset.div(dist) : new Vec3(0, 1, 0);
  const surfaceAlt = surfaceAltitudeFn ? surfaceAltitudeFn(dir) : 0;
  const surfaceR = bodyRadius + surfaceAlt;
  const altitude = dist - surfaceR - vesselRadius;

  if (altitude <= 0) {
    return {
      collided: true,
      point: bodyCenter.add(dir.mul(surfaceR)),
      normal: dir,
      depth: -altitude,
      surfaceAltitude: surfaceAlt,
    };
  }
  return {
    collided: false,
    point: bodyCenter.add(dir.mul(surfaceR)),
    normal: dir,
    depth: 0,
    surfaceAltitude: surfaceAlt,
  };
}

/**
 * Resolve a vertical collision: place the vessel just above the surface and
 * reflect/dampen the vertical component of velocity.
 */
export function resolveCollision(
  position: Vec3,
  velocity: Vec3,
  contact: CollisionResult,
  restitution = 0.05,
  friction = 0.85,
): { position: Vec3; velocity: Vec3; impactSpeed: number } {
  const normal = contact.normal;
  const newPos = contact.point.add(normal.mul(contact.depth + 0.01));
  const vNormal = normal.mul(velocity.dot(normal));
  const vTangent = velocity.sub(vNormal);
  const reflected = vNormal.mul(-restitution).add(vTangent.mul(friction));
  return { position: newPos, velocity: reflected, impactSpeed: vNormal.length() };
}
