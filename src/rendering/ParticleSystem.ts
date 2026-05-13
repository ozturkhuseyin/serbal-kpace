import * as THREE from 'three';
import { Vec3 } from '../physics/Vector3';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

/**
 * General-purpose CPU-driven additive particle system. We use one mesh per
 * effect kind (exhaust trail, reentry plasma, explosion). 1024 particle pool
 * per kind, recycled.
 */
export class ParticleSystem {
  scene: THREE.Scene;
  private mesh: THREE.Points;
  private geom: THREE.BufferGeometry;
  private capacity: number;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private particles: Particle[] = [];

  constructor(scene: THREE.Scene, capacity = 1024) {
    this.scene = scene;
    this.capacity = capacity;
    this.geom = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geom.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float a = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(vColor, a);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Points(this.geom, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  emit(opts: {
    position: Vec3;
    velocity?: Vec3;
    life: number;
    size: number;
    color: string;
    spread?: number;
    count?: number;
    focus: Vec3;
  }): void {
    const count = opts.count ?? 1;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.capacity) this.particles.shift();
      const spread = opts.spread ?? 0;
      const v = opts.velocity ?? new Vec3();
      const offset = new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
      this.particles.push({
        position: new THREE.Vector3(opts.position.x - opts.focus.x, opts.position.y - opts.focus.y, opts.position.z - opts.focus.z).add(offset),
        velocity: new THREE.Vector3(v.x + offset.x * 1.2, v.y + offset.y * 1.2, v.z + offset.z * 1.2),
        life: opts.life,
        maxLife: opts.life,
        size: opts.size,
        color: new THREE.Color(opts.color),
      });
    }
  }

  update(dt: number): void {
    let n = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;
      const t = p.life / p.maxLife;
      const a = Math.max(0, t);
      this.positions[n * 3 + 0] = p.position.x;
      this.positions[n * 3 + 1] = p.position.y;
      this.positions[n * 3 + 2] = p.position.z;
      this.colors[n * 3 + 0] = p.color.r * a;
      this.colors[n * 3 + 1] = p.color.g * a;
      this.colors[n * 3 + 2] = p.color.b * a;
      this.sizes[n] = p.size * (0.4 + 0.6 * t);
      n++;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.geom.setDrawRange(0, n);
    (this.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geom.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Convenience: explosion at world position. */
  explosion(world: Vec3, focus: Vec3, scale = 1): void {
    for (let i = 0; i < 100; i++) {
      this.emit({
        position: world,
        velocity: new Vec3((Math.random() - 0.5) * 30 * scale, (Math.random() - 0.2) * 30 * scale, (Math.random() - 0.5) * 30 * scale),
        life: 0.8 + Math.random() * 1.2,
        size: 6 + Math.random() * 8,
        color: i % 3 === 0 ? '#ffd44a' : i % 3 === 1 ? '#ff7733' : '#cc3322',
        focus,
      });
    }
  }

  reentry(world: Vec3, velocity: Vec3, focus: Vec3): void {
    for (let i = 0; i < 6; i++) {
      this.emit({
        position: world,
        velocity: velocity.mul(-0.3 + Math.random() * 0.3),
        life: 0.4 + Math.random() * 0.3,
        size: 5 + Math.random() * 6,
        color: '#ff8a55',
        spread: 0.4,
        focus,
      });
    }
  }
}
