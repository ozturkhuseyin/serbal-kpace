import { Vec3 } from './Vector3';
import { AtmosphereModel, densityAtAltitude, pressureAtAltitude, temperatureAtAltitude } from './AtmosphericDrag';
import { OrbitElements, elementsToState, propagateAnomaly } from './OrbitalMechanics';

export interface BodyConfig {
  id: string;
  name: string;
  /** Mean radius (m). */
  radius: number;
  /** Standard gravitational parameter μ = G·M (m³/s²). */
  mu: number;
  /** Sphere of influence radius (m). Infinity for the central star. */
  soi: number;
  /** Sidereal rotation period (s). 0 = tidally locked / no rotation. */
  rotationPeriod: number;
  /** Atmosphere (null if airless). */
  atmosphere?: AtmosphereModel;
  /** Optional orbital parameters around its parent body. */
  orbit?: OrbitElements & { parentId: string; epoch: number };
  /** Display color hint for UI. */
  color: string;
  /** Surface roughness amplitude (m). For terrain shader. */
  terrainAmplitude: number;
  /** Sea level color (for ocean / surface). */
  surfaceColor: string;
  /** Atmosphere tint colour. */
  atmosphereColor?: string;
  /** Tier - distance class for rendering and SOI ordering. */
  tier: 'star' | 'planet' | 'moon';
  /** Highlights for the in-game encyclopedia. */
  description?: string;
}

/**
 * Runtime celestial body with derived helpers.
 */
export class CelestialBody {
  config: BodyConfig;
  /** World-space position cache (updated by SolarSystem.update). */
  position: Vec3 = new Vec3();
  /** World-space velocity cache. */
  velocity: Vec3 = new Vec3();
  /** Current rotation angle (rad). */
  rotation = 0;
  /** Parent body if any. */
  parent: CelestialBody | null = null;
  /** Children for hierarchical iteration. */
  children: CelestialBody[] = [];

  constructor(config: BodyConfig) {
    this.config = config;
  }

  /** Surface gravity at sea level (m/s²). */
  get surfaceGravity(): number {
    return this.config.mu / (this.config.radius * this.config.radius);
  }

  /** Synodic equatorial speed at sea level (m/s). */
  get rotationSpeed(): number {
    if (this.config.rotationPeriod <= 0) return 0;
    return (2 * Math.PI * this.config.radius) / this.config.rotationPeriod;
  }

  pressureAt(altitude: number): number {
    return this.config.atmosphere ? pressureAtAltitude(this.config.atmosphere, altitude) : 0;
  }

  densityAt(altitude: number): number {
    return this.config.atmosphere ? densityAtAltitude(this.config.atmosphere, altitude) : 0;
  }

  temperatureAt(altitude: number): number {
    return this.config.atmosphere ? temperatureAtAltitude(this.config.atmosphere, altitude) : 2.7;
  }

  /** Altitude above mean radius for a world-space position. */
  altitudeAt(worldPos: Vec3): number {
    const dist = worldPos.sub(this.position).length();
    return dist - this.config.radius;
  }

  /** Whether the given world position is within this body's sphere of influence. */
  containsPoint(worldPos: Vec3): boolean {
    const dist = worldPos.sub(this.position).length();
    return dist < this.config.soi;
  }

  /** Update orbit + rotation for the given universal time. */
  updateAtTime(universalTime: number): void {
    if (this.config.orbit && this.parent) {
      const dt = universalTime - this.config.orbit.epoch;
      const nu = propagateAnomaly(this.config.orbit, dt);
      const state = elementsToState({ ...this.config.orbit, nu });
      this.position = this.parent.position.add(state.r);
      this.velocity = this.parent.velocity.add(state.v);
    }
    if (this.config.rotationPeriod > 0) {
      this.rotation = (universalTime / this.config.rotationPeriod) * Math.PI * 2;
      this.rotation = ((this.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    }
  }
}
