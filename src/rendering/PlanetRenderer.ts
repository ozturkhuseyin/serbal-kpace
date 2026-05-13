import * as THREE from 'three';
import { CelestialBody } from '../physics/CelestialBody';
import { Vec3 } from '../physics/Vector3';
import { atmosphereVertex, atmosphereFragment } from './shaders/atmosphere.glsl';
import { terrainVertex, terrainFragment } from './shaders/terrain.glsl';
import { buildLaunchPad } from './LaunchPad';

export interface PlanetRenderable {
  body: CelestialBody;
  group: THREE.Group;
  surface: THREE.Mesh;
  atmosphere?: THREE.Mesh;
  surfaceMat: THREE.ShaderMaterial;
  atmosphereMat?: THREE.ShaderMaterial;
}

export class PlanetRenderer {
  scene: THREE.Scene;
  planets: Map<string, PlanetRenderable> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  add(body: CelestialBody): PlanetRenderable {
    const group = new THREE.Group();
    group.name = `planet:${body.config.id}`;

    const segments = body.config.tier === 'star' ? 64 : 96;
    const geom = new THREE.SphereGeometry(body.config.radius, segments, segments / 2);

    const palette = derivePalette(body.config);
    const surfaceMat = new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      uniforms: {
        uTerrainAmplitude: { value: body.config.terrainAmplitude },
        uTime: { value: 0 },
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
        uColorLow: { value: new THREE.Color(palette.low) },
        uColorMid: { value: new THREE.Color(palette.mid) },
        uColorHigh: { value: new THREE.Color(palette.high) },
        uColorPole: { value: new THREE.Color(palette.pole) },
        uPlanetRadius: { value: body.config.radius },
        uOceanLevel: { value: oceanLevelFor(body.config.id) },
        uHasAtmosphere: { value: body.config.atmosphere ? 1.0 : 0.0 },
      },
    });
    const surface = new THREE.Mesh(geom, surfaceMat);
    surface.name = `surface:${body.config.id}`;
    if (body.config.tier === 'star') {
      surfaceMat.fragmentShader = starFragment;
      surfaceMat.uniforms.uSunDirection.value = new THREE.Vector3(0, 1, 0);
    }
    group.add(surface);

    let atmosphere: THREE.Mesh | undefined;
    let atmosphereMat: THREE.ShaderMaterial | undefined;
    if (body.config.atmosphere && body.config.atmosphereColor) {
      const atmRadius = body.config.radius + body.config.atmosphere.ceiling;
      const atmGeom = new THREE.SphereGeometry(atmRadius, 64, 32);
      atmosphereMat = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          uPlanetCenter: { value: new THREE.Vector3(0, 0, 0) },
          uPlanetRadius: { value: body.config.radius },
          uAtmosphereRadius: { value: atmRadius },
          uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
          uCameraPos: { value: new THREE.Vector3() },
          uAtmosphereColor: { value: new THREE.Color(body.config.atmosphereColor) },
          uIntensity: { value: 1.0 },
        },
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      atmosphere = new THREE.Mesh(atmGeom, atmosphereMat);
      atmosphere.name = `atmosphere:${body.config.id}`;
      group.add(atmosphere);
    }

    if (body.config.tier === 'star') {
      const glowGeom = new THREE.SphereGeometry(body.config.radius * 1.4, 64, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(body.config.color),
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      });
      group.add(new THREE.Mesh(glowGeom, glowMat));
      const point = new THREE.PointLight(0xffffff, 1.0, 0, 0);
      point.position.set(0, 0, 0);
      group.add(point);
    }

    this.scene.add(group);
    const renderable: PlanetRenderable = { body, group, surface, atmosphere, surfaceMat, atmosphereMat };
    this.planets.set(body.config.id, renderable);
    return renderable;
  }

  /**
   * Add a procedural launch pad on the body, parented to its rotating group so
   * it stays stuck to the surface. Idempotent per body.
   */
  addLaunchPad(bodyId: string): void {
    const r = this.planets.get(bodyId);
    if (!r) return;
    const existing = r.group.getObjectByName(`launchpad:${bodyId}`);
    if (existing) return;
    const pad = buildLaunchPad(r.body);
    r.group.add(pad);
  }

  /**
   * Update each planet's transform relative to the floating origin and
   * refresh shader uniforms.
   */
  update(time: number, focus: Vec3, sunWorld: Vec3, cameraWorld: Vec3): void {
    for (const r of this.planets.values()) {
      const pos = r.body.position;
      r.group.position.set(pos.x - focus.x, pos.y - focus.y, pos.z - focus.z);
      r.group.rotation.y = r.body.rotation;
      r.surfaceMat.uniforms.uTime.value = time;
      const sunDir = sunWorld.sub(pos).normalize();
      r.surfaceMat.uniforms.uSunDirection.value.set(sunDir.x, sunDir.y, sunDir.z);
      if (r.atmosphereMat) {
        r.atmosphereMat.uniforms.uSunDirection.value.set(sunDir.x, sunDir.y, sunDir.z);
        r.atmosphereMat.uniforms.uCameraPos.value.set(
          cameraWorld.x - focus.x,
          cameraWorld.y - focus.y,
          cameraWorld.z - focus.z,
        );
        r.atmosphereMat.uniforms.uPlanetCenter.value.copy(r.group.position);
      }
    }
  }
}

function oceanLevelFor(id: string): number {
  // Elevation in [0, 1]; values above produce land. -1 disables ocean.
  switch (id) {
    case 'kerbin': return 0.52;
    case 'laythe': return 0.55;
    case 'eve':    return 0.50;
    default:       return -1;
  }
}

function derivePalette(c: { id: string; surfaceColor: string }): {
  low: string; mid: string; high: string; pole: string;
} {
  const presets: Record<string, [string, string, string, string]> = {
    kerbol: ['#ffd066', '#ffbb33', '#ff8800', '#ffe6a8'],
    moho:   ['#5a3422', '#7a4a30', '#a0623e', '#caa68a'],
    eve:    ['#5e2a6b', '#7d3984', '#a05199', '#d2c0e0'],
    kerbin: ['#1d4e88', '#3a7d44', '#76553b', '#e6f1f7'],
    mun:    ['#6b6b6f', '#8b8b8e', '#cccccf', '#ffffff'],
    minmus: ['#7ec3a6', '#a8d6c0', '#d4ebd9', '#ffffff'],
    duna:   ['#7a3a23', '#a55530', '#d27746', '#f3dcc8'],
    ike:    ['#5e5e62', '#777a82', '#a0a4ad', '#dcdde0'],
    jool:   ['#6f9b4a', '#94c270', '#c5dcaf', '#dceac4'],
    laythe: ['#1f4f6d', '#2c6d92', '#5b8eaa', '#dde9ec'],
    vall:   ['#82a3b1', '#a5c2cc', '#d4e3e8', '#ffffff'],
    tylo:   ['#f0e6d2', '#cabba0', '#9a8a72', '#fff8e9'],
    bop:    ['#46362a', '#5e493a', '#7d6754', '#a99884'],
    pol:    ['#a89a55', '#c4b675', '#dcce96', '#f1ebcb'],
  };
  const p = presets[c.id] ?? ['#444', '#666', '#888', '#bbb'];
  return { low: p[0], mid: p[1], high: p[2], pole: p[3] };
}

const starFragment = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform float uTime;
  void main() {
    vec3 n = normalize(vLocalPos);
    float swirl = sin(n.y * 18.0 + uTime * 0.3) * 0.1
                 + sin(n.x * 24.0 - uTime * 0.4) * 0.08;
    vec3 c = mix(uColorLow, uColorMid, 0.5 + swirl);
    c = mix(c, uColorHigh, smoothstep(0.7, 1.0, abs(n.y)));
    float corona = 1.0 - clamp(dot(n, normalize(cameraPosition - vWorldPos)), 0.0, 1.0);
    gl_FragColor = vec4(c + uColorHigh * corona * 0.6, 1.0);
  }
`;
