import * as THREE from 'three';
import { starfieldVertex, starfieldFragment } from './shaders/starfield.glsl';

/**
 * 12 000 stars distributed on a large sphere at "infinity". Followed by the
 * camera so it always renders behind everything.
 */
export class Starfield {
  scene: THREE.Scene;
  points: THREE.Points;
  material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene, count = 12_000, radius = 1e11) {
    this.scene = scene;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      sizes[i] = Math.pow(Math.random(), 2.5) * 3.5 + 0.5;
      seeds[i] = Math.random();
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: starfieldVertex,
      fragmentShader: starfieldFragment,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geom, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(time: number, cameraPos: THREE.Vector3): void {
    this.material.uniforms.uTime.value = time;
    this.points.position.copy(cameraPos);
  }
}
