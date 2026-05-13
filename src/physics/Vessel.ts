import { Vec3, Quat } from './Vector3';
import { RigidBody } from './RigidBody';
import { CelestialBody } from './CelestialBody';

/**
 * Per-engine runtime state used by the physics loop.
 */
export interface ActiveEngine {
  partId: string;
  /** Body-space mount position of the engine (typically negative Y for bottom). */
  mountPosition: Vec3;
  /** Engine forward direction in body frame (default -Y means thrust pushes vessel +Y). */
  thrustDirection: Vec3;
  /** Vacuum thrust (N). */
  thrustVac: number;
  /** Atmospheric thrust (N) at sea level pressure. */
  thrustAtm: number;
  /** Vacuum specific impulse (s). */
  ispVac: number;
  /** Atmospheric specific impulse (s). */
  ispAtm: number;
  /** Mass flow per unit thrust ratio used to deduct fuel each step. */
  propellants: { liquidFuel: number; oxidizer: number };
  /** Per-tick throttle applied (0–1). */
  currentThrottle: number;
  /** Whether this engine is in the active stage. */
  active: boolean;
  /** Gimbal range in radians. */
  gimbalRange: number;
  /** Current gimbal request (rad pitch, rad yaw). */
  gimbal: Vec3;
  /** True if engine has fuel and is firing this step. */
  firing: boolean;
}

export interface FuelTank {
  liquidFuel: number;
  oxidizer: number;
  /** Maximum capacities used to compute UI gauges. */
  maxLiquidFuel: number;
  maxOxidizer: number;
}

export interface VesselStage {
  /** Engines that ignite when this stage is activated. */
  engineIds: string[];
  /** Decoupler / separator part IDs that fire when this stage is activated. */
  decouplerIds: string[];
  /** Parachute ids that arm in this stage. */
  parachuteIds: string[];
}

/**
 * Per-part data tracked on the runtime vessel so we can subtract individual
 * parts (mass, fuel, drag, engines) when a decoupler fires.
 */
export interface PartContribution {
  partId: string;
  mass: number;            // dry mass in kg
  fuelLFMax: number;       // capacity (units)
  fuelOxMax: number;
  dragArea: number;
  isEngine: boolean;
  /** Local mount position in body frame, used for debris spawn position. */
  mountPosition: Vec3;
}

export type VesselSituation =
  | 'pre-launch'
  | 'flying-low'
  | 'flying-high'
  | 'in-space-low'
  | 'in-space-high'
  | 'landed'
  | 'splashed'
  | 'orbiting'
  | 'destroyed';

/**
 * Top-level player-controlled vessel. Owns its rigid body, fuel state, engine
 * list, control inputs and the staging plan.
 */
export class Vessel {
  id: string;
  name: string;
  body: RigidBody;
  engines: ActiveEngine[] = [];
  fuel: FuelTank;
  stages: VesselStage[];
  /** Index of the active (next to fire) stage. */
  currentStage: number;
  parentBody: CelestialBody;
  /** Player throttle 0–1. */
  throttle = 0;
  /** Active SAS hold mode. */
  sasMode: 'off' | 'stability' | 'prograde' | 'retrograde' | 'normal' | 'antinormal' | 'radial-in' | 'radial-out' = 'off';
  /** RCS enabled. */
  rcsEnabled = false;
  /** Drag coefficient sum (Cd · A) — simplified single value. */
  dragArea: number;
  /** Current overall TWR / thrust telemetry, recomputed each tick. */
  currentThrust = 0;
  /** Total dry mass (no fuel, kg). */
  dryMass: number;
  /** Total wet mass (kg). */
  wetMass: number;
  /** Player input vector: pitch, yaw, roll requests in [-1, 1]. */
  controlInput = new Vec3();
  /** Computed ground altitude (m above local terrain). */
  altitudeAGL = 0;
  /** Computed altitude above sea level (m). */
  altitudeASL = 0;
  /** Cached situation. */
  situation: VesselSituation = 'pre-launch';
  /** Total seconds since launch. */
  metSeconds = 0;
  /** Fairings deployed flag etc. */
  flags: Record<string, boolean> = {};
  /** Per-part contributions keyed by part instance id. */
  partContributions: Map<string, PartContribution> = new Map();
  /** decouplerId → set of part ids that drop when this decoupler fires. */
  dropGroups: Map<string, Set<string>> = new Map();
  /** Set of part ids currently still attached to the vessel. */
  attachedParts: Set<string> = new Set();
  /** Parts that have been jettisoned this tick (consumed by renderer). */
  recentlyDropped: Set<string> = new Set();

  constructor(opts: {
    id: string;
    name: string;
    parentBody: CelestialBody;
    position: Vec3;
    velocity?: Vec3;
    orientation?: Quat;
    dryMass: number;
    fuel: FuelTank;
    engines: ActiveEngine[];
    stages: VesselStage[];
    dragArea: number;
    partContributions?: PartContribution[];
    dropGroups?: Record<string, string[]>;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.parentBody = opts.parentBody;
    this.dryMass = opts.dryMass;
    this.fuel = opts.fuel;
    this.engines = opts.engines;
    this.stages = opts.stages;
    this.currentStage = opts.stages.length;
    this.dragArea = opts.dragArea;
    this.wetMass = opts.dryMass + opts.fuel.liquidFuel + opts.fuel.oxidizer;
    this.body = new RigidBody({
      position: opts.position,
      velocity: opts.velocity ?? new Vec3(),
      orientation: opts.orientation ?? Quat.identity(),
      mass: this.wetMass,
      inertia: new Vec3(this.wetMass * 0.6, this.wetMass * 0.4, this.wetMass * 0.6),
    });
    if (opts.partContributions) {
      for (const c of opts.partContributions) {
        this.partContributions.set(c.partId, c);
        this.attachedParts.add(c.partId);
      }
    }
    if (opts.dropGroups) {
      for (const [k, v] of Object.entries(opts.dropGroups)) {
        this.dropGroups.set(k, new Set(v));
      }
    }
  }

  /**
   * Process all decouplers belonging to the given stage index. Drops every
   * part in the corresponding drop group: subtracts mass, fuel capacity, drag
   * area, removes engines, and records the dropped ids for the renderer.
   * Returns the set of dropped part ids.
   */
  processStageDecouplers(stageIndex: number): Set<string> {
    const dropped = new Set<string>();
    if (stageIndex < 0 || stageIndex >= this.stages.length) return dropped;
    const stage = this.stages[stageIndex];
    for (const decId of stage.decouplerIds) {
      const group = this.dropGroups.get(decId);
      if (!group) continue;
      for (const id of group) {
        if (!this.attachedParts.has(id)) continue;
        this.attachedParts.delete(id);
        dropped.add(id);
      }
    }
    if (dropped.size === 0) return dropped;

    let droppedMass = 0;
    let droppedLFMax = 0;
    let droppedOxMax = 0;
    let droppedDrag = 0;
    for (const id of dropped) {
      const c = this.partContributions.get(id);
      if (!c) continue;
      droppedMass += c.mass;
      droppedLFMax += c.fuelLFMax;
      droppedOxMax += c.fuelOxMax;
      droppedDrag += c.dragArea;
    }
    this.dryMass = Math.max(0, this.dryMass - droppedMass);
    this.fuel.maxLiquidFuel = Math.max(0, this.fuel.maxLiquidFuel - droppedLFMax);
    this.fuel.maxOxidizer = Math.max(0, this.fuel.maxOxidizer - droppedOxMax);
    this.fuel.liquidFuel = Math.min(this.fuel.liquidFuel, this.fuel.maxLiquidFuel);
    this.fuel.oxidizer = Math.min(this.fuel.oxidizer, this.fuel.maxOxidizer);
    this.dragArea = Math.max(1, this.dragArea - droppedDrag);
    this.engines = this.engines.filter((e) => !dropped.has(e.partId));
    this.recomputeMass();
    for (const id of dropped) this.recentlyDropped.add(id);
    return dropped;
  }

  /** Drain & return the parts dropped since the last call. */
  consumeRecentlyDropped(): string[] {
    if (this.recentlyDropped.size === 0) return [];
    const ids = Array.from(this.recentlyDropped);
    this.recentlyDropped.clear();
    return ids;
  }

  totalMass(): number {
    return this.dryMass + this.fuel.liquidFuel + this.fuel.oxidizer;
  }

  recomputeMass(): void {
    this.body.mass = this.totalMass();
    this.body.inertia.set(this.body.mass * 0.6, this.body.mass * 0.4, this.body.mass * 0.6);
  }

  hasFuel(): boolean {
    return this.fuel.liquidFuel > 0 && this.fuel.oxidizer > 0;
  }

  /** Mark engines whose IDs appear in the *current* stage as active. */
  syncActiveEngines(): void {
    if (this.currentStage >= this.stages.length) {
      this.engines.forEach((e) => (e.active = false));
      return;
    }
    const ids = new Set(this.stages[this.currentStage].engineIds);
    for (const e of this.engines) {
      e.active = ids.has(e.partId);
    }
  }
}
