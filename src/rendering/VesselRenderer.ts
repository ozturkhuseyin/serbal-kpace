import * as THREE from 'three';
import { Vessel } from '../physics/Vessel';
import { Vec3 } from '../physics/Vector3';
import { exhaustVertex, exhaustFragment } from './shaders/exhaust.glsl';
import { PartConfig, getPart } from '../editor/PartDatabase';
import { VesselDesign } from '../editor/VehicleAssembly';

/**
 * Builds a Three.js group from a vessel design and keeps it in sync with the
 * physics state. Procedurally generates basic part meshes since we ship without
 * a GLTF asset pipeline yet.
 */
export interface VesselRenderable {
  vessel: Vessel;
  group: THREE.Group;
  partMeshes: Map<string, THREE.Object3D>;
  exhausts: { engineId: string; mesh: THREE.Mesh; material: THREE.ShaderMaterial }[];
}

export class VesselRenderer {
  scene: THREE.Scene;
  vessels: Map<string, VesselRenderable> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** Build a 3D representation of a vessel from its design + physics object. */
  add(vessel: Vessel, design: VesselDesign): VesselRenderable {
    const group = new THREE.Group();
    group.name = `vessel:${vessel.id}`;
    const partMeshes = new Map<string, THREE.Object3D>();
    const exhausts: VesselRenderable['exhausts'] = [];

    for (const inst of design.parts) {
      const config = getPart(inst.partId);
      if (!config) continue;
      const mesh = createPartMesh(config);
      mesh.position.set(inst.position.x, inst.position.y, inst.position.z);
      mesh.rotation.set(inst.rotation.x, inst.rotation.y, inst.rotation.z);
      mesh.userData.partInstanceId = inst.id;
      partMeshes.set(inst.id, mesh);
      group.add(mesh);

      if (config.category === 'engine') {
        const exh = createExhaust(config);
        exh.mesh.position.set(inst.position.x, inst.position.y - 0.6, inst.position.z);
        partMeshes.set(`${inst.id}-exhaust`, exh.mesh);
        group.add(exh.mesh);
        exhausts.push({ engineId: inst.id, mesh: exh.mesh, material: exh.material });
      }
    }

    this.scene.add(group);
    const renderable: VesselRenderable = { vessel, group, partMeshes, exhausts };
    this.vessels.set(vessel.id, renderable);
    return renderable;
  }

  remove(id: string): void {
    const r = this.vessels.get(id);
    if (!r) return;
    this.scene.remove(r.group);
    r.group.traverse((o) => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      const mat = (o as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.vessels.delete(id);
  }

  /**
   * Remove the meshes associated with the given part instance ids from a
   * vessel. Used when a stage decoupler fires so the dropped boosters / spent
   * tanks visually disappear from the active vessel.
   */
  removeParts(vesselId: string, partIds: string[]): void {
    const r = this.vessels.get(vesselId);
    if (!r || partIds.length === 0) return;
    for (const id of partIds) {
      // Main part mesh
      const mesh = r.partMeshes.get(id);
      if (mesh) {
        r.group.remove(mesh);
        disposeMesh(mesh);
        r.partMeshes.delete(id);
      }
      // Engine exhaust mesh
      const exhMesh = r.partMeshes.get(`${id}-exhaust`);
      if (exhMesh) {
        r.group.remove(exhMesh);
        disposeMesh(exhMesh);
        r.partMeshes.delete(`${id}-exhaust`);
      }
      r.exhausts = r.exhausts.filter((e) => e.engineId !== id);
    }
  }

  update(focus: Vec3, time: number): void {
    for (const r of this.vessels.values()) {
      const p = r.vessel.body.position;
      r.group.position.set(p.x - focus.x, p.y - focus.y, p.z - focus.z);
      const q = r.vessel.body.orientation;
      r.group.quaternion.set(q.x, q.y, q.z, q.w);

      for (const exh of r.exhausts) {
        const engine = r.vessel.engines.find((e) => e.partId === exh.engineId);
        const throttle = engine?.firing ? engine.currentThrottle : 0;
        exh.material.uniforms.uTime.value = time;
        exh.material.uniforms.uThrottle.value = throttle;
      }
    }
  }
}

function disposeMesh(o: THREE.Object3D): void {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) (mat as THREE.Material).dispose();
  });
}

function createPartMesh(config: PartConfig): THREE.Object3D {
  const group = new THREE.Group();
  switch (config.category) {
    case 'command': {
      const geom = new THREE.ConeGeometry(0.6, 1.4, 24, 1, false);
      const mat = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 0.6, roughness: 0.4 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 0.7;
      group.add(mesh);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.05, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x444a55, metalness: 0.7, roughness: 0.3 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0;
      group.add(ring);
      break;
    }
    case 'tank': {
      const h = config.height ?? 1.6;
      const r = config.radius ?? 0.625;
      const geom = new THREE.CylinderGeometry(r, r, h, 24);
      const mat = new THREE.MeshStandardMaterial({ color: 0xe6e6ea, metalness: 0.5, roughness: 0.45 });
      const mesh = new THREE.Mesh(geom, mat);
      group.add(mesh);
      const stripe = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 1.001, r * 1.001, 0.06, 24),
        new THREE.MeshStandardMaterial({ color: 0xff8c2a, metalness: 0.4, roughness: 0.5 }),
      );
      stripe.position.y = h / 2 - 0.2;
      group.add(stripe);
      const stripe2 = stripe.clone();
      stripe2.position.y = -h / 2 + 0.2;
      group.add(stripe2);
      break;
    }
    case 'engine': {
      const r = config.radius ?? 0.6;
      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.85, r, 0.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x202022, metalness: 0.7, roughness: 0.4 }),
      );
      upper.position.y = 0.05;
      group.add(upper);
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.45, r * 1.05, 0.7, 24, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xb87a3a, metalness: 0.85, roughness: 0.2, side: THREE.DoubleSide }),
      );
      bell.position.y = -0.4;
      group.add(bell);
      break;
    }
    case 'srb': {
      const r = config.radius ?? 0.4;
      const h = config.height ?? 4.5;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 18),
        new THREE.MeshStandardMaterial({ color: 0xd9d9dd, metalness: 0.4, roughness: 0.5 }),
      );
      group.add(body);
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(r, r * 1.4, 18),
        new THREE.MeshStandardMaterial({ color: 0xe89a2a, metalness: 0.3, roughness: 0.6 }),
      );
      nose.position.y = h / 2 + r * 0.7;
      group.add(nose);
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.45, r * 0.85, 0.45, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x22241f, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }),
      );
      nozzle.position.y = -h / 2 - 0.2;
      group.add(nozzle);
      break;
    }
    case 'decoupler': {
      const r = config.radius ?? 0.625;
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.18, 24),
        new THREE.MeshStandardMaterial({ color: 0xff7733, metalness: 0.5, roughness: 0.4 }),
      );
      group.add(ring);
      break;
    }
    case 'fairing': {
      const r = config.radius ?? 1.0;
      const h = config.height ?? 2.5;
      const geom = new THREE.ConeGeometry(r, h, 24, 1, true);
      const mat = new THREE.MeshStandardMaterial({ color: 0xf5f1e2, metalness: 0.2, roughness: 0.7, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = h / 2;
      group.add(mesh);
      break;
    }
    case 'fin': {
      const geom = new THREE.BoxGeometry(0.05, 0.6, 0.5);
      const mat = new THREE.MeshStandardMaterial({ color: 0x7a7d83, metalness: 0.4, roughness: 0.5 });
      const m = new THREE.Mesh(geom, mat);
      m.position.x = 0.7;
      group.add(m);
      const m2 = m.clone();
      m2.position.x = -0.7;
      group.add(m2);
      break;
    }
    case 'parachute': {
      const r = config.radius ?? 0.45;
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.35, 16),
        new THREE.MeshStandardMaterial({ color: 0xb13c3c, metalness: 0.4, roughness: 0.6 }),
      );
      group.add(cap);
      break;
    }
    case 'leg': {
      const geom = new THREE.BoxGeometry(0.08, 0.9, 0.08);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.7, roughness: 0.3 });
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(geom, mat);
        const a = (i / 3) * Math.PI * 2;
        m.position.set(Math.cos(a) * 0.5, -0.4, Math.sin(a) * 0.5);
        m.rotation.z = Math.cos(a) * 0.2;
        m.rotation.x = Math.sin(a) * 0.2;
        group.add(m);
      }
      break;
    }
    case 'science': {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshStandardMaterial({ color: 0xd4dee9, metalness: 0.3, roughness: 0.6 }),
      );
      group.add(cube);
      break;
    }
    case 'antenna': {
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }),
      );
      dish.rotation.x = Math.PI;
      group.add(dish);
      break;
    }
    case 'structural':
    default: {
      const geom = new THREE.BoxGeometry(0.6, 0.4, 0.6);
      const mat = new THREE.MeshStandardMaterial({ color: 0x9098a3, metalness: 0.5, roughness: 0.5 });
      group.add(new THREE.Mesh(geom, mat));
    }
  }
  return group;
}

function createExhaust(config: PartConfig): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const r = (config.radius ?? 0.6) * 0.8;
  const geom = new THREE.ConeGeometry(r, 4.5, 16, 1, true);
  geom.rotateX(Math.PI);
  const mat = new THREE.ShaderMaterial({
    vertexShader: exhaustVertex,
    fragmentShader: exhaustFragment,
    uniforms: {
      uTime: { value: 0 },
      uThrottle: { value: 0 },
      uLength: { value: config.exhaustLength ?? 1.0 },
      uCoreColor: { value: new THREE.Color(config.exhaustCore ?? '#fff5dc') },
      uOuterColor: { value: new THREE.Color(config.exhaustOuter ?? '#ff8a3a') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.y = -2.0;
  return { mesh, material: mat };
}
