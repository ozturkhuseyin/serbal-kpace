import * as THREE from 'three';
import { SolarSystem } from '../physics/SolarSystem';
import { CelestialBody } from '../physics/CelestialBody';
import { Vec3 } from '../physics/Vector3';
import { OrbitElements, sampleOrbit, stateToElements } from '../physics/OrbitalMechanics';
import { Vessel } from '../physics/Vessel';

/**
 * Map view: a parallel scene group that renders bodies as small icons, their
 * orbits as conic lines, SOI bubbles, and the active vessel's trajectory.
 *
 * Toggled by SceneManager.setMapMode. Uses the same scaled / floating-origin
 * convention as the regular scene.
 */
export class MapView {
  scene: THREE.Scene;
  group: THREE.Group;
  system: SolarSystem;
  bodyMarkers: Map<string, THREE.Mesh> = new Map();
  bodyOrbits: Map<string, THREE.Line> = new Map();
  soiBubbles: Map<string, THREE.Mesh> = new Map();
  vesselTrajectory: THREE.Line | null = null;
  vesselMarker: THREE.Mesh;
  parentLinkLine!: THREE.Line;
  apoapsisMarker: THREE.Mesh;
  periapsisMarker: THREE.Mesh;
  maneuverGroup: THREE.Group;

  constructor(scene: THREE.Scene, system: SolarSystem) {
    this.scene = scene;
    this.system = system;
    this.group = new THREE.Group();
    this.group.name = 'MapView';
    this.group.visible = false;
    scene.add(this.group);

    system.forEach((body) => {
      // Use a large absolute floor so even tiny moons are always visible.
      const visualRadius = Math.max(body.config.radius * 8, 2e6);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(visualRadius, 24, 12),
        new THREE.MeshBasicMaterial({ color: body.config.color, transparent: true, opacity: 0.95 }),
      );
      sphere.userData.scaleByCamera = true;
      sphere.userData.minScreenSize = body.config.tier === 'star' ? 30 : body.config.tier === 'planet' ? 16 : 10;
      this.group.add(sphere);
      this.bodyMarkers.set(body.config.id, sphere);

      // Outer halo to make planets pop in the void.
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(visualRadius * 1.6, 16, 8),
        new THREE.MeshBasicMaterial({ color: body.config.color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      sphere.add(halo);

      if (body.parent) {
        const samples = sampleOrbit(body.config.orbit!, 256);
        const positions = new Float32Array(samples.length * 3);
        for (let i = 0; i < samples.length; i++) {
          positions[i * 3 + 0] = samples[i].x;
          positions[i * 3 + 1] = samples[i].y;
          positions[i * 3 + 2] = samples[i].z;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: body.config.color, transparent: true, opacity: 0.7 }));
        line.frustumCulled = false;
        this.group.add(line);
        this.bodyOrbits.set(body.config.id, line);
      }

      if (body.config.tier !== 'star' && isFinite(body.config.soi)) {
        const bubble = new THREE.Mesh(
          new THREE.SphereGeometry(body.config.soi, 24, 12),
          new THREE.MeshBasicMaterial({ color: body.config.color, transparent: true, opacity: 0.06, wireframe: true }),
        );
        this.group.add(bubble);
        this.soiBubbles.set(body.config.id, bubble);
      }
    });

    // Vessel marker: bright always-on-top diamond + halo so it's never hidden
    // inside a planet sphere or by depth tests at any zoom level.
    const vesselMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe97a,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.vesselMarker = new THREE.Mesh(new THREE.OctahedronGeometry(8e5, 0), vesselMaterial);
    this.vesselMarker.renderOrder = 1000;
    this.vesselMarker.userData.scaleByCamera = true;
    this.vesselMarker.userData.minScreenSize = 18;
    this.group.add(this.vesselMarker);

    // Outer pulsing halo so the marker pops on a star-field background.
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(8e5, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffe97a,
        transparent: true,
        opacity: 0.25,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.renderOrder = 999;
    halo.userData.scaleByCamera = true;
    halo.userData.minScreenSize = 36;
    this.vesselMarker.add(halo);

    // Line connecting vessel to its parent body so the player can see their
    // position relative to the planet they're orbiting.
    const linkMat = new THREE.LineDashedMaterial({
      color: 0xffe97a,
      dashSize: 5e5,
      gapSize: 3e5,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });
    const linkGeom = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );
    this.parentLinkLine = new THREE.Line(linkGeom, linkMat);
    this.parentLinkLine.frustumCulled = false;
    this.parentLinkLine.renderOrder = 998;
    this.parentLinkLine.visible = false;
    this.group.add(this.parentLinkLine);

    this.apoapsisMarker = new THREE.Mesh(
      new THREE.SphereGeometry(4e5, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x7be38f, depthTest: false, depthWrite: false }),
    );
    this.apoapsisMarker.renderOrder = 998;
    this.apoapsisMarker.userData.scaleByCamera = true;
    this.apoapsisMarker.userData.minScreenSize = 8;
    this.group.add(this.apoapsisMarker);

    this.periapsisMarker = new THREE.Mesh(
      new THREE.SphereGeometry(4e5, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff7766, depthTest: false, depthWrite: false }),
    );
    this.periapsisMarker.renderOrder = 998;
    this.periapsisMarker.userData.scaleByCamera = true;
    this.periapsisMarker.userData.minScreenSize = 8;
    this.group.add(this.periapsisMarker);

    this.maneuverGroup = new THREE.Group();
    this.group.add(this.maneuverGroup);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  /** Apply size correction so bodies stay readable at any zoom level. */
  applyScreenScale(camera: THREE.PerspectiveCamera, viewportHeight: number): void {
    const fovTan = Math.tan((camera.fov * Math.PI) / 360);
    this.group.traverse((obj) => {
      if (!obj.userData.scaleByCamera) return;
      const mesh = obj as THREE.Mesh;
      const geomRadius = (mesh.geometry as THREE.SphereGeometry).parameters?.radius ?? 1;
      const distance = camera.position.distanceTo(mesh.position);
      const minPixels = obj.userData.minScreenSize as number;
      const desiredWorld = (minPixels / viewportHeight) * (2 * fovTan * distance);
      const scale = Math.max(1, desiredWorld / geomRadius);
      mesh.scale.setScalar(scale);
    });
  }

  update(focus: Vec3, vessel?: Vessel): void {
    this.system.forEach((body) => {
      const m = this.bodyMarkers.get(body.config.id);
      if (m) m.position.set(body.position.x - focus.x, body.position.y - focus.y, body.position.z - focus.z);
      const orbit = this.bodyOrbits.get(body.config.id);
      if (orbit && body.parent) {
        orbit.position.set(body.parent.position.x - focus.x, body.parent.position.y - focus.y, body.parent.position.z - focus.z);
      }
      const bubble = this.soiBubbles.get(body.config.id);
      if (bubble) bubble.position.set(body.position.x - focus.x, body.position.y - focus.y, body.position.z - focus.z);
    });
    if (!vessel) {
      if (this.vesselTrajectory) this.vesselTrajectory.visible = false;
      this.vesselMarker.visible = false;
      this.parentLinkLine.visible = false;
      this.apoapsisMarker.visible = false;
      this.periapsisMarker.visible = false;
      return;
    }
    this.vesselMarker.visible = true;
    this.vesselMarker.position.set(
      vessel.body.position.x - focus.x,
      vessel.body.position.y - focus.y,
      vessel.body.position.z - focus.z,
    );

    const parent = vessel.parentBody;
    const relPos = vessel.body.position.sub(parent.position);
    const relVel = vessel.body.velocity.sub(parent.velocity);

    // Update the dashed line connecting the vessel to its parent body so the
    // player can see "I am HERE relative to Kerbin/Mun/Eve".
    {
      const positions = (this.parentLinkLine.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      positions[0] = parent.position.x - focus.x;
      positions[1] = parent.position.y - focus.y;
      positions[2] = parent.position.z - focus.z;
      positions[3] = vessel.body.position.x - focus.x;
      positions[4] = vessel.body.position.y - focus.y;
      positions[5] = vessel.body.position.z - focus.z;
      (this.parentLinkLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      this.parentLinkLine.computeLineDistances();
      this.parentLinkLine.visible = true;
    }
    let elements: OrbitElements | null = null;
    try {
      elements = stateToElements(relPos, relVel, parent.config.mu);
    } catch {
      elements = null;
    }
    if (elements && elements.e < 1) {
      this.drawTrajectory(elements, parent, focus);
      this.placeApsides(elements, parent, focus);
    } else {
      if (this.vesselTrajectory) this.vesselTrajectory.visible = false;
      this.apoapsisMarker.visible = false;
      this.periapsisMarker.visible = false;
    }
  }

  private drawTrajectory(el: OrbitElements, parent: CelestialBody, focus: Vec3): void {
    const samples = sampleOrbit(el, 256);
    if (!this.vesselTrajectory) {
      const positions = new Float32Array(samples.length * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      this.vesselTrajectory = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0xffe97a, transparent: true, opacity: 0.85 }));
      this.vesselTrajectory.frustumCulled = false;
      this.group.add(this.vesselTrajectory);
    }
    const arr = (this.vesselTrajectory.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < samples.length; i++) {
      arr[i * 3 + 0] = samples[i].x;
      arr[i * 3 + 1] = samples[i].y;
      arr[i * 3 + 2] = samples[i].z;
    }
    (this.vesselTrajectory.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.vesselTrajectory.visible = true;
    this.vesselTrajectory.position.set(parent.position.x - focus.x, parent.position.y - focus.y, parent.position.z - focus.z);
  }

  private placeApsides(el: OrbitElements, parent: CelestialBody, focus: Vec3): void {
    const apo = pointOnOrbit(el, Math.PI);
    const peri = pointOnOrbit(el, 0);
    this.apoapsisMarker.visible = isFinite(el.ra);
    this.periapsisMarker.visible = true;
    this.apoapsisMarker.position.set(parent.position.x - focus.x + apo.x, parent.position.y - focus.y + apo.y, parent.position.z - focus.z + apo.z);
    this.periapsisMarker.position.set(parent.position.x - focus.x + peri.x, parent.position.y - focus.y + peri.y, parent.position.z - focus.z + peri.z);
  }
}

function pointOnOrbit(el: OrbitElements, nu: number): Vec3 {
  const p = el.h * el.h / el.mu;
  const r = p / (1 + el.e * Math.cos(nu));
  const cosO = Math.cos(el.omega), sinO = Math.sin(el.omega);
  const cosI = Math.cos(el.i), sinI = Math.sin(el.i);
  const cosW = Math.cos(el.argp + nu), sinW = Math.sin(el.argp + nu);
  const x = r * (cosO * cosW - sinO * sinW * cosI);
  const y = r * (sinO * cosW + cosO * sinW * cosI);
  const z = r * (sinW * sinI);
  return new Vec3(x, y, z);
}
