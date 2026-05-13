import { Vec3, Quat, quatDerivative } from './Vector3';

/**
 * Six-degree-of-freedom rigid body state for a vessel.
 *
 * Linear and angular state are integrated using semi-implicit Euler with the
 * physics fixed step. Forces and torques are accumulated over the frame and
 * cleared each step.
 */
export class RigidBody {
  position: Vec3;
  velocity: Vec3;
  orientation: Quat;
  /** Angular velocity in body frame (rad/s). */
  angularVelocity: Vec3;
  mass: number;
  /** Diagonal inertia tensor approximated as a sphere/cylinder. */
  inertia: Vec3;

  forceAccum: Vec3 = new Vec3();
  torqueAccum: Vec3 = new Vec3();

  constructor(opts: {
    position?: Vec3;
    velocity?: Vec3;
    orientation?: Quat;
    angularVelocity?: Vec3;
    mass: number;
    inertia?: Vec3;
  }) {
    this.position = opts.position?.clone() ?? new Vec3();
    this.velocity = opts.velocity?.clone() ?? new Vec3();
    this.orientation = opts.orientation?.clone() ?? Quat.identity();
    this.angularVelocity = opts.angularVelocity?.clone() ?? new Vec3();
    this.mass = opts.mass;
    this.inertia = opts.inertia?.clone() ?? new Vec3(1, 1, 1).mul(opts.mass);
  }

  /** Apply a force in world space at the centre of mass. */
  applyForce(force: Vec3): void {
    this.forceAccum.addInPlace(force);
  }

  /** Apply a force at a body-space offset, generating both linear force and torque. */
  applyForceAtPoint(force: Vec3, bodyOffset: Vec3): void {
    const worldOffset = this.orientation.rotate(bodyOffset);
    this.forceAccum.addInPlace(force);
    const torque = worldOffset.cross(force);
    const localTorque = this.orientation.conjugate().rotate(torque);
    this.torqueAccum.addInPlace(localTorque);
  }

  applyTorque(localTorque: Vec3): void {
    this.torqueAccum.addInPlace(localTorque);
  }

  /** Semi-implicit Euler integration step. */
  integrate(dt: number): void {
    if (this.mass <= 0) return;

    const accel = this.forceAccum.div(this.mass);
    this.velocity.addInPlace(accel.mul(dt));
    this.position.addInPlace(this.velocity.mul(dt));

    const invI = new Vec3(
      this.inertia.x > 0 ? 1 / this.inertia.x : 0,
      this.inertia.y > 0 ? 1 / this.inertia.y : 0,
      this.inertia.z > 0 ? 1 / this.inertia.z : 0,
    );
    const angAccel = new Vec3(
      this.torqueAccum.x * invI.x,
      this.torqueAccum.y * invI.y,
      this.torqueAccum.z * invI.z,
    );
    this.angularVelocity.addInPlace(angAccel.mul(dt));
    this.angularVelocity.mulInPlace(0.999);

    const dq = quatDerivative(this.orientation, this.angularVelocity).clone();
    this.orientation.x += dq.x * dt;
    this.orientation.y += dq.y * dt;
    this.orientation.z += dq.z * dt;
    this.orientation.w += dq.w * dt;
    this.orientation.normalizeInPlace();

    this.forceAccum.set(0, 0, 0);
    this.torqueAccum.set(0, 0, 0);
  }

  /** Body forward axis in world space (default +Y). */
  forwardWorld(): Vec3 { return this.orientation.rotate(new Vec3(0, 1, 0)); }
  upWorld(): Vec3 { return this.orientation.rotate(new Vec3(0, 0, 1)); }
  rightWorld(): Vec3 { return this.orientation.rotate(new Vec3(1, 0, 0)); }
}
