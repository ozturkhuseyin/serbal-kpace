import { Vec3 } from '../physics/Vector3';
import { Vessel } from '../physics/Vessel';

/**
 * Simple PID-based stability assist. Computes attitude control inputs that
 * drive the vessel toward a desired forward direction.
 */
export class SAS {
  /** Desired forward direction in world space. */
  desiredForward: Vec3 = new Vec3(0, 1, 0);
  /** Last error vector for derivative term. */
  private lastError: Vec3 = new Vec3();

  kp = 4.0;
  ki = 0.0;
  kd = 1.5;

  reset(): void {
    this.lastError.set(0, 0, 0);
  }

  /**
   * Compute body-frame torque demand (pitch, yaw, roll). Result will be added
   * to the player's manual input.
   */
  compute(v: Vessel, dt: number): Vec3 {
    if (v.sasMode === 'off') return new Vec3();
    const target = this.targetForVessel(v);
    if (!target) return new Vec3();
    const fwd = v.body.forwardWorld();
    const error = fwd.cross(target);
    const errorBody = v.body.orientation.conjugate().rotate(error);
    const derivative = errorBody.sub(this.lastError).div(Math.max(dt, 1e-3));
    this.lastError = errorBody;
    const command = errorBody.mul(this.kp).add(derivative.mul(this.kd));
    const damp = v.body.angularVelocity.mul(-0.4);
    return command.add(damp);
  }

  /** Map sas mode to the world-space direction the vessel should point at. */
  private targetForVessel(v: Vessel): Vec3 | null {
    const parent = v.parentBody;
    const relPos = v.body.position.sub(parent.position);
    const relVel = v.body.velocity.sub(parent.velocity);
    const radial = relPos.normalize();
    const prograde = relVel.normalize();
    const normal = relPos.cross(relVel).normalize();
    switch (v.sasMode) {
      case 'stability': return v.body.forwardWorld();
      case 'prograde': return prograde;
      case 'retrograde': return prograde.neg();
      case 'normal': return normal;
      case 'antinormal': return normal.neg();
      case 'radial-out': return radial;
      case 'radial-in': return radial.neg();
      default: return null;
    }
  }
}
