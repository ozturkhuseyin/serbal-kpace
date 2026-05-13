/**
 * Lightweight Vector3 used by the physics layer.
 * Kept independent from Three.js so the physics engine can run inside a Web Worker.
 */
export class Vec3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static zero(): Vec3 { return new Vec3(0, 0, 0); }
  static one(): Vec3 { return new Vec3(1, 1, 1); }
  static unitX(): Vec3 { return new Vec3(1, 0, 0); }
  static unitY(): Vec3 { return new Vec3(0, 1, 0); }
  static unitZ(): Vec3 { return new Vec3(0, 0, 1); }
  static from(v: { x: number; y: number; z: number }): Vec3 {
    return new Vec3(v.x, v.y, v.z);
  }

  clone(): Vec3 { return new Vec3(this.x, this.y, this.z); }

  set(x: number, y: number, z: number): this {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  copy(v: Vec3): this {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
  }

  add(v: Vec3): Vec3 { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: Vec3): Vec3 { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(s: number): Vec3 { return new Vec3(this.x * s, this.y * s, this.z * s); }
  div(s: number): Vec3 { return new Vec3(this.x / s, this.y / s, this.z / s); }
  neg(): Vec3 { return new Vec3(-this.x, -this.y, -this.z); }

  addInPlace(v: Vec3): this {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
  }
  subInPlace(v: Vec3): this {
    this.x -= v.x; this.y -= v.y; this.z -= v.z;
    return this;
  }
  mulInPlace(s: number): this {
    this.x *= s; this.y *= s; this.z *= s;
    return this;
  }

  dot(v: Vec3): number { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v: Vec3): Vec3 {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  lengthSq(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length(): number { return Math.sqrt(this.lengthSq()); }

  normalize(): Vec3 {
    const len = this.length();
    if (len < 1e-30) return new Vec3();
    return new Vec3(this.x / len, this.y / len, this.z / len);
  }

  normalizeInPlace(): this {
    const len = this.length();
    if (len < 1e-30) return this;
    this.x /= len; this.y /= len; this.z /= len;
    return this;
  }

  distanceTo(v: Vec3): number { return this.sub(v).length(); }
  distanceSqTo(v: Vec3): number { return this.sub(v).lengthSq(); }

  lerp(v: Vec3, t: number): Vec3 {
    return new Vec3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t,
    );
  }

  toArray(): [number, number, number] { return [this.x, this.y, this.z]; }
  toJSON(): { x: number; y: number; z: number } { return { x: this.x, y: this.y, z: this.z }; }
}

/**
 * Quaternion used for rocket attitude. Follows the convention (x, y, z, w).
 */
export class Quat {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x; this.y = y; this.z = z; this.w = w;
  }

  static identity(): Quat { return new Quat(0, 0, 0, 1); }

  static fromAxisAngle(axis: Vec3, angle: number): Quat {
    const half = angle / 2;
    const s = Math.sin(half);
    const n = axis.normalize();
    return new Quat(n.x * s, n.y * s, n.z * s, Math.cos(half));
  }

  static fromEuler(pitch: number, yaw: number, roll: number): Quat {
    const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
    const cr = Math.cos(roll / 2), sr = Math.sin(roll / 2);
    return new Quat(
      sr * cp * cy - cr * sp * sy,
      cr * sp * cy + sr * cp * sy,
      cr * cp * sy - sr * sp * cy,
      cr * cp * cy + sr * sp * sy,
    );
  }

  clone(): Quat { return new Quat(this.x, this.y, this.z, this.w); }
  copy(q: Quat): this { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }

  multiply(q: Quat): Quat {
    return new Quat(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
    );
  }

  /** Rotates a vector by this quaternion (assumes unit quaternion). */
  rotate(v: Vec3): Vec3 {
    const qv = new Vec3(this.x, this.y, this.z);
    const t = qv.cross(v).mul(2);
    return v.add(t.mul(this.w)).add(qv.cross(t));
  }

  conjugate(): Quat { return new Quat(-this.x, -this.y, -this.z, this.w); }

  normalize(): Quat {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (len < 1e-30) return Quat.identity();
    return new Quat(this.x / len, this.y / len, this.z / len, this.w / len);
  }

  normalizeInPlace(): this {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (len < 1e-30) { this.x = 0; this.y = 0; this.z = 0; this.w = 1; return this; }
    this.x /= len; this.y /= len; this.z /= len; this.w /= len;
    return this;
  }

  toArray(): [number, number, number, number] { return [this.x, this.y, this.z, this.w]; }
}

/** Quaternion derivative from angular velocity (body-frame). */
export function quatDerivative(q: Quat, omega: Vec3): Quat {
  const w = new Quat(omega.x, omega.y, omega.z, 0);
  const dq = w.multiply(q);
  return new Quat(dq.x * 0.5, dq.y * 0.5, dq.z * 0.5, dq.w * 0.5);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
