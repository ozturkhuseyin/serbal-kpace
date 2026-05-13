import { Vec3 } from './Vector3';
import { FIXED_DT, MAX_SUBSTEPS } from './Constants';
import { SolarSystem } from './SolarSystem';
import { Vessel } from './Vessel';
import { dragForce, dynamicPressure, machNumber } from './AtmosphericDrag';
import { effectiveIsp, massFlow } from './RocketEquation';
import { checkSphereTerrain, resolveCollision } from './CollisionDetection';
import { stateToElements } from './OrbitalMechanics';
import { TimeWarp } from './TimeWarp';

export interface VesselTelemetry {
  altitudeAGL: number;
  altitudeASL: number;
  speed: number;
  verticalSpeed: number;
  horizontalSpeed: number;
  apoapsis: number;
  periapsis: number;
  orbitalEccentricity: number;
  orbitalPeriod: number;
  inclination: number;
  parentBody: string;
  surfaceGravity: number;
  pressure: number;
  density: number;
  mach: number;
  q: number;
  gForce: number;
  fuelLF: number;
  fuelOx: number;
  fuelLFMax: number;
  fuelOxMax: number;
  totalMass: number;
  twr: number;
  thrust: number;
  isp: number;
  throttle: number;
  stage: number;
  totalStages: number;
  metSeconds: number;
  situation: string;
  sasMode: string;
  rcsEnabled: boolean;
  warpFactor: number;
  inStableOrbit: boolean;
}

export interface EngineEvent {
  type: 'ignition' | 'flameout' | 'staging' | 'crash' | 'soi-change' | 'parachute';
  vesselId: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/**
 * The main physics simulation. Runs at 50Hz with a fixed step accumulator and
 * supports time warp scaling. Designed to be deterministic and side-effect free
 * outside of the state it owns plus the listener callback queue.
 */
export class PhysicsEngine {
  readonly system: SolarSystem;
  vessels: Map<string, Vessel> = new Map();
  warp = new TimeWarp();
  private accumulator = 0;
  private listeners: Array<(e: EngineEvent) => void> = [];
  private eventQueue: EngineEvent[] = [];
  private lastG = 1;

  constructor(system: SolarSystem) {
    this.system = system;
  }

  addVessel(v: Vessel): void {
    this.vessels.set(v.id, v);
    v.syncActiveEngines();
  }

  removeVessel(id: string): void { this.vessels.delete(id); }

  on(fn: (e: EngineEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(e: EngineEvent): void {
    this.eventQueue.push(e);
  }

  private flushEvents(): void {
    if (this.eventQueue.length === 0) return;
    const batch = this.eventQueue.splice(0);
    for (const e of batch) {
      for (const l of this.listeners) l(e);
    }
  }

  /** Top-level tick called from the render loop. */
  tick(realDt: number): void {
    const factor = this.warp.factor();
    const simDt = realDt * factor;
    this.accumulator += simDt;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.integrate(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps >= MAX_SUBSTEPS) this.accumulator = 0;
    this.flushEvents();
  }

  private integrate(dt: number): void {
    this.system.setUniversalTime(this.system.universalTime + dt);
    for (const v of this.vessels.values()) {
      this.stepVessel(v, dt);
    }
  }

  private stepVessel(v: Vessel, dt: number): void {
    if (v.situation === 'destroyed') return;
    v.metSeconds += dt;

    const parent = v.parentBody;
    const relPos = v.body.position.sub(parent.position);
    const distance = relPos.length();
    const altitudeASL = distance - parent.config.radius;
    v.altitudeASL = altitudeASL;
    v.altitudeAGL = altitudeASL;

    // Launch clamp: hold the vessel perfectly still on the pad until the
    // first staging fires. Stops the rocket from falling onto the surface and
    // exploding before the player can press Space.
    if (v.flags['launch-clamp']) {
      const radial = relPos.normalize();
      v.body.position = parent.position.add(radial.mul(parent.config.radius + 6));
      v.body.velocity = parent.velocity.clone();
      v.body.angularVelocity.set(0, 0, 0);
      v.situation = 'pre-launch';
      // Engines may still ignite; if any are firing, release the clamp so the
      // rocket can move.
      let anyFiring = false;
      for (const e of v.engines) if (e.active && v.throttle > 0 && v.hasFuel()) { anyFiring = true; break; }
      if (anyFiring) {
        v.flags['launch-clamp'] = false;
        v.situation = 'flying-low';
      }
    }

    const gravityMag = parent.config.mu / Math.max(distance * distance, 1);
    const gravityDir = relPos.div(Math.max(distance, 1)).neg();
    const gravity = gravityDir.mul(gravityMag * v.body.mass);
    if (!v.flags['launch-clamp']) v.body.applyForce(gravity);

    const density = parent.densityAt(altitudeASL);
    const pressure = parent.pressureAt(altitudeASL);
    if (density > 0) {
      const surfaceVelocity = v.body.velocity;
      const drag = dragForce(surfaceVelocity, density, 1.0, v.dragArea);
      v.body.applyForce(drag);
    }

    let totalThrust = 0;
    let weightedIsp = 0;
    let activeEngineCount = 0;
    for (const e of v.engines) {
      e.firing = false;
      if (!e.active) continue;
      if (v.throttle <= 0) continue;
      if (!v.hasFuel()) continue;
      const isp = effectiveIsp(e.ispVac, e.ispAtm, pressure);
      const thrustMax = pressure > 0
        ? e.thrustVac + (e.thrustAtm - e.thrustVac) * Math.min(1, pressure / 101325)
        : e.thrustVac;
      const thrust = thrustMax * v.throttle;
      const flow = massFlow(thrust, isp);
      const lfNeed = flow * dt * (e.propellants.liquidFuel / (e.propellants.liquidFuel + e.propellants.oxidizer));
      const oxNeed = flow * dt * (e.propellants.oxidizer / (e.propellants.liquidFuel + e.propellants.oxidizer));
      if (v.fuel.liquidFuel < lfNeed || v.fuel.oxidizer < oxNeed) {
        if (v.throttle > 0 && !v.flags['flamed-out']) {
          this.emit({ type: 'flameout', vesselId: v.id, timestamp: this.system.universalTime });
          v.flags['flamed-out'] = true;
        }
        continue;
      }
      v.fuel.liquidFuel -= lfNeed;
      v.fuel.oxidizer -= oxNeed;
      // Compute thrust direction in body frame, optionally gimballed by the
      // pilot's pitch / yaw input. The applyForceAtPoint cross product takes
      // care of the resulting torque sign, so we just nudge the direction.
      const baseDir = e.thrustDirection.normalize().neg();
      let dirBody = baseDir;
      if (e.gimbalRange > 0) {
        const pitchOffset = -v.controlInput.x * e.gimbalRange;
        const yawOffset = v.controlInput.z * e.gimbalRange;
        dirBody = new Vec3(yawOffset, baseDir.y, pitchOffset).normalize();
      }
      const dirWorld = v.body.orientation.rotate(dirBody);
      v.body.applyForceAtPoint(dirWorld.mul(thrust), e.mountPosition);
      totalThrust += thrust;
      weightedIsp += isp * thrust;
      activeEngineCount++;
      e.firing = true;
      e.currentThrottle = v.throttle;
    }
    v.currentThrust = totalThrust;
    v.recomputeMass();

    // Reaction control (RCS / reaction wheels). Authority scales with mass so
    // small craft turn fast, big craft slowly. ~0.6 N·m per kg gives roughly
    // 30°/s peak rate for a 10t vessel.
    const torqueMag = v.body.mass * 0.6;
    const torque = v.controlInput.mul(torqueMag);
    v.body.applyTorque(torque);

    v.body.integrate(dt);

    if (!v.flags['launch-clamp']) {
      const collision = checkSphereTerrain(v.body.position, 1.5, parent.position, parent.config.radius);
      if (collision.collided) {
        const result = resolveCollision(v.body.position, v.body.velocity, collision);
        v.body.position = result.position;
        v.body.velocity = result.velocity;
        const hardness = result.impactSpeed;
        if (hardness > 22) {
          v.situation = 'destroyed';
          v.throttle = 0;
          this.emit({ type: 'crash', vesselId: v.id, data: { speed: hardness }, timestamp: this.system.universalTime });
        } else {
          v.situation = 'landed';
        }
      }
    }

    const newParent = this.system.findContainingBody(v.body.position);
    if (newParent !== v.parentBody) {
      const oldName = v.parentBody.config.name;
      v.parentBody = newParent;
      this.emit({
        type: 'soi-change',
        vesselId: v.id,
        data: { from: oldName, to: newParent.config.name },
        timestamp: this.system.universalTime,
      });
    }

    this.lastG = gravityMag;
    if (v.situation !== 'landed' && v.situation !== 'destroyed') {
      // pre-launch is sticky only while the launch clamp is still engaged.
      if (v.situation === 'pre-launch' && v.flags['launch-clamp']) {
        // keep it
      } else {
        const altGate = parent.config.atmosphere?.ceiling ?? 0;
        if (altitudeASL > altGate) v.situation = 'in-space-low';
        else if (altitudeASL > 5000) v.situation = 'flying-high';
        else v.situation = 'flying-low';
      }
    }

    if (totalThrust > 0 && !v.flags['ignition-emitted']) {
      this.emit({ type: 'ignition', vesselId: v.id, timestamp: this.system.universalTime });
      v.flags['ignition-emitted'] = true;
    }
  }

  /** Trigger the next stage (called from input). */
  stage(vessel: Vessel): void {
    if (vessel.currentStage <= 0) return;
    vessel.currentStage -= 1;
    const dropped = vessel.processStageDecouplers(vessel.currentStage);
    vessel.syncActiveEngines();
    vessel.flags['ignition-emitted'] = false;
    vessel.flags['flamed-out'] = false;
    this.emit({
      type: 'staging',
      vesselId: vessel.id,
      data: { stage: vessel.currentStage, dropped: Array.from(dropped) },
      timestamp: this.system.universalTime,
    });
  }

  /** Compute live telemetry for HUD consumption. */
  telemetry(v: Vessel): VesselTelemetry {
    const parent = v.parentBody;
    const relPos = v.body.position.sub(parent.position);
    const relVel = v.body.velocity.sub(parent.velocity);
    const radial = relPos.normalize();
    const verticalSpeed = relVel.dot(radial);
    const horizontalSpeed = Math.sqrt(Math.max(0, relVel.lengthSq() - verticalSpeed * verticalSpeed));
    const altitude = relPos.length() - parent.config.radius;
    const pressure = parent.pressureAt(altitude);
    const density = parent.densityAt(altitude);
    const temperature = parent.temperatureAt(altitude);
    const speed = relVel.length();
    const mach = density > 0 ? machNumber(speed, temperature) : 0;
    const q = dynamicPressure(density, speed);

    let elements = null;
    try {
      elements = stateToElements(relPos, relVel, parent.config.mu);
    } catch {
      elements = null;
    }

    let activeIsp = 0, activeThrust = 0, totalMass = v.totalMass();
    let engineCount = 0;
    for (const e of v.engines) {
      if (!e.active || !e.firing) continue;
      const isp = effectiveIsp(e.ispVac, e.ispAtm, pressure);
      const thrustMax = pressure > 0
        ? e.thrustVac + (e.thrustAtm - e.thrustVac) * Math.min(1, pressure / 101325)
        : e.thrustVac;
      activeIsp += isp;
      activeThrust += thrustMax * e.currentThrottle;
      engineCount++;
    }
    if (engineCount > 0) activeIsp /= engineCount;

    const surfaceGravity = parent.surfaceGravity;
    const localGravity = parent.config.mu / Math.max(relPos.lengthSq(), 1);
    const inStableOrbit =
      elements !== null && elements.e < 1 && elements.rp > parent.config.radius + (parent.config.atmosphere?.ceiling ?? 0);

    return {
      altitudeAGL: v.altitudeAGL,
      altitudeASL: altitude,
      speed,
      verticalSpeed,
      horizontalSpeed,
      apoapsis: elements ? Math.max(0, elements.ra - parent.config.radius) : 0,
      periapsis: elements ? Math.max(-parent.config.radius, elements.rp - parent.config.radius) : 0,
      orbitalEccentricity: elements?.e ?? 0,
      orbitalPeriod: elements?.period ?? 0,
      inclination: elements?.i ?? 0,
      parentBody: parent.config.name,
      surfaceGravity,
      pressure,
      density,
      mach,
      q,
      gForce: localGravity / 9.81,
      fuelLF: v.fuel.liquidFuel,
      fuelOx: v.fuel.oxidizer,
      fuelLFMax: v.fuel.maxLiquidFuel,
      fuelOxMax: v.fuel.maxOxidizer,
      totalMass,
      twr: localGravity > 0 ? activeThrust / Math.max(totalMass * localGravity, 1) : 0,
      thrust: activeThrust,
      isp: activeIsp,
      throttle: v.throttle,
      stage: v.currentStage,
      totalStages: v.stages.length,
      metSeconds: v.metSeconds,
      situation: v.situation,
      sasMode: v.sasMode,
      rcsEnabled: v.rcsEnabled,
      warpFactor: this.warp.factor(),
      inStableOrbit,
    };
  }
}
