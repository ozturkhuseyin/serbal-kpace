import { CelestialBody, BodyConfig } from './CelestialBody';
import { Vec3 } from './Vector3';

/**
 * Hierarchical solar system. The first body added with no parent is the root
 * (typically the central star).
 */
export class SolarSystem {
  bodies: Map<string, CelestialBody> = new Map();
  root!: CelestialBody;
  /** Universal time elapsed since epoch (s). */
  universalTime = 0;

  addBody(config: BodyConfig): CelestialBody {
    const body = new CelestialBody(config);
    this.bodies.set(config.id, body);
    if (config.orbit?.parentId) {
      const parent = this.bodies.get(config.orbit.parentId);
      if (parent) {
        body.parent = parent;
        parent.children.push(body);
      }
    } else if (!this.root) {
      this.root = body;
    }
    return body;
  }

  getBody(id: string): CelestialBody | undefined {
    return this.bodies.get(id);
  }

  /** Update the position of every body for the given simulation time. */
  setUniversalTime(t: number): void {
    this.universalTime = t;
    if (!this.root) return;
    const queue: CelestialBody[] = [this.root];
    while (queue.length) {
      const b = queue.shift()!;
      b.updateAtTime(t);
      for (const c of b.children) queue.push(c);
    }
  }

  /** Find the body whose SOI currently contains the position. Innermost wins. */
  findContainingBody(worldPos: Vec3): CelestialBody {
    let current = this.root;
    let changed = true;
    while (changed) {
      changed = false;
      for (const child of current.children) {
        if (child.containsPoint(worldPos)) {
          current = child;
          changed = true;
          break;
        }
      }
    }
    return current;
  }

  /** Iterate every body breadth-first. */
  forEach(fn: (body: CelestialBody) => void): void {
    if (!this.root) return;
    const queue: CelestialBody[] = [this.root];
    while (queue.length) {
      const b = queue.shift()!;
      fn(b);
      for (const c of b.children) queue.push(c);
    }
  }

  /** All bodies as a flat array. */
  list(): CelestialBody[] {
    const out: CelestialBody[] = [];
    this.forEach((b) => out.push(b));
    return out;
  }
}
