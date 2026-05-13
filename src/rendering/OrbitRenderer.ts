import * as THREE from 'three';
import { OrbitElements, sampleOrbit } from '../physics/OrbitalMechanics';
import { Vec3 } from '../physics/Vector3';
import { CelestialBody } from '../physics/CelestialBody';

export interface OrbitLine {
  line: THREE.Line;
  positions: THREE.BufferAttribute;
  centerWorld: () => Vec3;
}

/**
 * Draws orbit conic sections relative to the floating origin.
 */
export class OrbitRenderer {
  scene: THREE.Scene;
  lines: OrbitLine[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Add an orbit line for a vessel or body. The world centre is the parent
   * body's world position (resolved each frame).
   */
  addOrbit(elements: OrbitElements, parent: CelestialBody, color = 0xffaa66): OrbitLine {
    const samples = sampleOrbit(elements, 256);
    const positions = new Float32Array(samples.length * 3);
    for (let i = 0; i < samples.length; i++) {
      positions[i * 3 + 0] = samples[i].x;
      positions[i * 3 + 1] = samples[i].y;
      positions[i * 3 + 2] = samples[i].z;
    }
    const geom = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(positions, 3);
    geom.setAttribute('position', attr);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.7 });
    const line = new THREE.Line(geom, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    const orbit: OrbitLine = { line, positions: attr, centerWorld: () => parent.position };
    this.lines.push(orbit);
    return orbit;
  }

  /** Update relative position based on focus. */
  update(focus: Vec3): void {
    for (const o of this.lines) {
      const c = o.centerWorld();
      o.line.position.set(c.x - focus.x, c.y - focus.y, c.z - focus.z);
    }
  }

  /** Recompute the line for a moving vessel orbit. */
  updateLine(orbit: OrbitLine, elements: OrbitElements): void {
    const samples = sampleOrbit(elements, 256);
    const arr = orbit.positions.array as Float32Array;
    for (let i = 0; i < samples.length; i++) {
      arr[i * 3 + 0] = samples[i].x;
      arr[i * 3 + 1] = samples[i].y;
      arr[i * 3 + 2] = samples[i].z;
    }
    orbit.positions.needsUpdate = true;
  }

  remove(orbit: OrbitLine): void {
    this.scene.remove(orbit.line);
    orbit.line.geometry.dispose();
    (orbit.line.material as THREE.Material).dispose();
    this.lines = this.lines.filter((l) => l !== orbit);
  }

  clear(): void {
    for (const o of [...this.lines]) this.remove(o);
  }
}
