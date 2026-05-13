import * as THREE from 'three';
import { Vec3 } from '../physics/Vector3';
import { CelestialBody } from '../physics/CelestialBody';

interface TerrainPatch {
  mesh: THREE.Mesh;
  centreLat: number;
  centreLon: number;
  arcRadius: number;
  resolution: number;
}

/**
 * High-resolution surface patch loader. When a vessel approaches a planet
 * (within ~5% of the planet radius), we generate a procedural heightmap
 * patch centred under the vessel and overlay it on the low-poly planet
 * sphere. Generation runs in a Web Worker.
 *
 * The patch is anchored on the planet *surface*, oriented so its local +Z
 * points radially outward, and tinted with per-vertex colours derived from
 * the biome map so it doesn't look like a flat single-colour quad.
 */
export class TerrainLOD {
  scene: THREE.Scene;
  body: CelestialBody;
  patch: TerrainPatch | null = null;
  private worker?: Worker;
  private requestId = 0;

  constructor(scene: THREE.Scene, body: CelestialBody) {
    this.scene = scene;
    this.body = body;
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/terrainGen.worker.ts', import.meta.url), { type: 'module' });
        this.worker.addEventListener('message', this.handleMessage);
      } catch {
        this.worker = undefined;
      }
    }
  }

  private handleMessage = (ev: MessageEvent): void => {
    const data = ev.data;
    if (data.bodyId !== this.body.config.id) return;
    if (this.patch) {
      this.scene.remove(this.patch.mesh);
      this.patch.mesh.geometry.dispose();
      (this.patch.mesh.material as THREE.Material).dispose();
    }
    const N = data.resolution;
    const sideMeters = data.arcRadius * this.body.config.radius * 2;
    const geom = new THREE.PlaneGeometry(sideMeters, sideMeters, N - 1, N - 1);
    const positions = geom.attributes.position as THREE.BufferAttribute;
    const colours = new Float32Array(positions.count * 3);
    const palette = palettesFor(this.body.config.id);
    for (let i = 0; i < positions.count; i++) {
      const h = data.heights[i] as number;
      positions.setZ(i, h);
      const b = (data.biome as Uint8Array)[i] ?? 1;
      const col = palette[b] ?? palette[1];
      // Slight per-vertex jitter so it doesn't look like flat polygons.
      const jitter = 0.92 + ((i * 2654435761) % 100) / 1500;
      colours[i * 3 + 0] = col[0] * jitter;
      colours[i * 3 + 1] = col[1] * jitter;
      colours[i * 3 + 2] = col[2] * jitter;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.04,
      roughness: 0.92,
      flatShading: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    this.scene.add(mesh);
    this.patch = { mesh, centreLat: data.centreLat ?? 0, centreLon: data.centreLon ?? 0, arcRadius: data.arcRadius ?? 0.01, resolution: N };
  };

  /** Decide whether to (re)generate a patch around the vessel position. */
  update(focus: Vec3, vesselWorld: Vec3): void {
    if (!this.worker) return;
    const rel = vesselWorld.sub(this.body.position);
    const dist = rel.length();
    const altitude = dist - this.body.config.radius;
    if (altitude > this.body.config.radius * 0.05) {
      if (this.patch) {
        this.scene.remove(this.patch.mesh);
        this.patch.mesh.geometry.dispose();
        (this.patch.mesh.material as THREE.Material).dispose();
        this.patch = null;
      }
      return;
    }
    if (this.patch) {
      // Anchor the patch on the planet *surface* directly below the vessel
      // and orient so its +Z normal points radially outward. This way the
      // height-displaced terrain appears as ground, not a floating quad at
      // the vessel's altitude.
      const radial = rel.normalize();
      const surfaceWorld = this.body.position.add(radial.mul(this.body.config.radius));
      const px = surfaceWorld.x - focus.x;
      const py = surfaceWorld.y - focus.y;
      const pz = surfaceWorld.z - focus.z;
      this.patch.mesh.position.set(px, py, pz);
      // The plane's local +Z is the normal. Make it point radially outward by
      // looking *toward* the planet center along its -Z axis. Three.js lookAt
      // points -Z at the target.
      this.patch.mesh.lookAt(this.body.position.x - focus.x, this.body.position.y - focus.y, this.body.position.z - focus.z);
      // After lookAt, +Z faces the camera/space; we want height displacement
      // to push outward. PlaneGeometry's Z attribute is along local +Z so
      // this is already correct.
    }
    if (this.requestId === 0 || this.requestId < Date.now() - 5000) {
      this.requestId = Date.now();
      const lat = Math.asin(rel.y / dist);
      const lon = Math.atan2(rel.z, rel.x);
      this.worker.postMessage({
        id: this.requestId,
        bodyId: this.body.config.id,
        centreLat: lat,
        centreLon: lon,
        arcRadius: 0.012,
        resolution: 96,
        amplitude: this.body.config.terrainAmplitude * 0.4,
        seed: hashString(this.body.config.id),
      });
    }
  }

  dispose(): void {
    if (this.worker) this.worker.terminate();
    if (this.patch) {
      this.scene.remove(this.patch.mesh);
      this.patch.mesh.geometry.dispose();
      (this.patch.mesh.material as THREE.Material).dispose();
    }
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

/**
 * Per-body biome → linear-RGB tints. Index matches worker's biome ids:
 *   0 = water/coast, 1 = lowland (grass/sand), 2 = mid (rock/forest),
 *   3 = high (mountain), 4 = polar ice.
 */
function palettesFor(id: string): number[][] {
  const p: Record<string, number[][]> = {
    kerbin: [
      [0.10, 0.30, 0.55], // water
      [0.30, 0.55, 0.32], // lowland green
      [0.46, 0.50, 0.28], // mid scrub
      [0.55, 0.42, 0.28], // mountain brown
      [0.92, 0.95, 0.98], // ice
    ],
    mun: [
      [0.42, 0.42, 0.45],
      [0.55, 0.55, 0.58],
      [0.65, 0.65, 0.68],
      [0.78, 0.78, 0.80],
      [0.92, 0.92, 0.94],
    ],
    duna: [
      [0.50, 0.25, 0.18],
      [0.65, 0.36, 0.22],
      [0.78, 0.50, 0.30],
      [0.85, 0.66, 0.45],
      [0.95, 0.92, 0.88],
    ],
  };
  return p[id] ?? [
    [0.30, 0.30, 0.30],
    [0.50, 0.50, 0.50],
    [0.70, 0.70, 0.70],
    [0.85, 0.85, 0.85],
    [0.95, 0.95, 0.95],
  ];
}
