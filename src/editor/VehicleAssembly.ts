import { Vec3, Quat } from '../physics/Vector3';
import { ActiveEngine, FuelTank, PartContribution, Vessel, VesselStage } from '../physics/Vessel';
import { CelestialBody } from '../physics/CelestialBody';
import { getPart, PartConfig } from './PartDatabase';

export interface PartInstance {
  id: string;
  partId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  /** Stage assignment — -1 means not staged (e.g. command pod). */
  stage: number;
  /** Symmetry group ID — siblings rebuild together. */
  symmetryGroup?: string;
  /** Parent attachment node, if attached. */
  attachedTo?: { partInstanceId: string; nodeId: string; selfNodeId: string };
}

export interface VesselDesign {
  id: string;
  name: string;
  parts: PartInstance[];
  /** Higher index = activates first. */
  stageOrder: number[];
  /** Total mass in tonnes (cached). */
  totalMass: number;
  /** Total cost (cached). */
  totalCost: number;
}

/**
 * Pure data layer for assembling a rocket. Tracks parts, attachment graph,
 * and staging assignments. UI / 3D rendering layers consume this.
 */
export class VehicleAssembly {
  design: VesselDesign;
  private undoStack: VesselDesign[] = [];
  private redoStack: VesselDesign[] = [];

  constructor(initial?: Partial<VesselDesign>) {
    this.design = {
      id: initial?.id ?? `vessel-${Date.now()}`,
      name: initial?.name ?? 'Untitled Craft',
      parts: initial?.parts ? [...initial.parts] : [],
      stageOrder: initial?.stageOrder ?? [],
      totalMass: 0,
      totalCost: 0,
    };
    this.recompute();
  }

  // -------- mutation API --------

  /** Add a part to the design. Returns the new instance. */
  addPart(partId: string, position: Vec3, options?: {
    parent?: { partInstanceId: string; nodeId: string };
    selfNode?: string;
    rotation?: Vec3;
    stage?: number;
    symmetryGroup?: string;
  }): PartInstance {
    this.pushUndo();
    const config = getPart(partId);
    if (!config) throw new Error(`Unknown part: ${partId}`);
    const instance: PartInstance = {
      id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partId,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: options?.rotation?.x ?? 0, y: options?.rotation?.y ?? 0, z: options?.rotation?.z ?? 0 },
      stage: options?.stage ?? this.suggestStage(config),
      symmetryGroup: options?.symmetryGroup,
      attachedTo: options?.parent && options?.selfNode
        ? { partInstanceId: options.parent.partInstanceId, nodeId: options.parent.nodeId, selfNodeId: options.selfNode }
        : undefined,
    };
    this.design.parts.push(instance);
    this.ensureStage(instance.stage);
    this.recompute();
    return instance;
  }

  removePart(instanceId: string): void {
    this.pushUndo();
    const part = this.design.parts.find((p) => p.id === instanceId);
    if (!part) return;
    const removeIds = new Set<string>([instanceId]);
    if (part.symmetryGroup) {
      for (const p of this.design.parts) {
        if (p.symmetryGroup === part.symmetryGroup) removeIds.add(p.id);
      }
    }
    let stillRemoving = true;
    while (stillRemoving) {
      stillRemoving = false;
      for (const p of this.design.parts) {
        if (p.attachedTo && removeIds.has(p.attachedTo.partInstanceId) && !removeIds.has(p.id)) {
          removeIds.add(p.id);
          stillRemoving = true;
        }
      }
    }
    this.design.parts = this.design.parts.filter((p) => !removeIds.has(p.id));
    this.recompute();
  }

  movePart(instanceId: string, position: Vec3): void {
    this.pushUndo();
    const p = this.design.parts.find((x) => x.id === instanceId);
    if (!p) return;
    p.position = { x: position.x, y: position.y, z: position.z };
    this.recompute();
  }

  setStage(instanceId: string, stage: number): void {
    this.pushUndo();
    const p = this.design.parts.find((x) => x.id === instanceId);
    if (!p) return;
    p.stage = stage;
    this.ensureStage(stage);
    this.recompute();
  }

  rename(name: string): void {
    this.pushUndo();
    this.design.name = name;
  }

  // -------- queries --------

  totalMassKg(): number { return this.design.totalMass * 1000; }

  /**
   * Build the staging plan. Stages are activated from highest index downward.
   * Returns array indexed 0..maxStage with engine + decoupler IDs to fire.
   */
  buildStages(): VesselStage[] {
    const map = new Map<number, VesselStage>();
    for (const p of this.design.parts) {
      if (p.stage < 0) continue;
      const config = getPart(p.partId);
      if (!config) continue;
      const stage = map.get(p.stage) ?? { engineIds: [], decouplerIds: [], parachuteIds: [] };
      if (config.category === 'engine' || config.category === 'srb') stage.engineIds.push(p.id);
      if (config.category === 'decoupler') stage.decouplerIds.push(p.id);
      if (config.category === 'parachute') stage.parachuteIds.push(p.id);
      map.set(p.stage, stage);
    }
    const max = Math.max(0, ...this.design.parts.map((p) => p.stage));
    const arr: VesselStage[] = [];
    for (let i = 0; i <= max; i++) {
      arr.push(map.get(i) ?? { engineIds: [], decouplerIds: [], parachuteIds: [] });
    }
    return arr;
  }

  /** Compose a runtime Vessel ready for the physics engine. */
  buildRuntime(parentBody: CelestialBody, position: Vec3, orientation: Quat = Quat.identity()): Vessel {
    let dryMass = 0;
    let lf = 0, ox = 0, lfMax = 0, oxMax = 0;
    let dragArea = 0;
    const engines: ActiveEngine[] = [];
    const partContributions: PartContribution[] = [];

    for (const p of this.design.parts) {
      const config = getPart(p.partId);
      if (!config) continue;
      const partMass = config.mass * 1000;
      const partLF = (config.fuelLF ?? 0) * 5;
      const partOx = (config.fuelOx ?? 0) * 5;
      const partDrag = config.dragArea ?? 0.5;
      const isEngine = config.category === 'engine' || config.category === 'srb';
      dryMass += partMass;
      dragArea += partDrag;
      lf += partLF; lfMax += partLF;
      ox += partOx; oxMax += partOx;
      partContributions.push({
        partId: p.id,
        mass: partMass,
        fuelLFMax: partLF,
        fuelOxMax: partOx,
        dragArea: partDrag,
        isEngine,
        mountPosition: new Vec3(p.position.x, p.position.y, p.position.z),
      });
      if (isEngine) {
        engines.push({
          partId: p.id,
          mountPosition: new Vec3(p.position.x, p.position.y, p.position.z),
          thrustDirection: new Vec3(0, -1, 0),
          thrustVac: (config.thrustVac ?? 0) * 1000,
          thrustAtm: (config.thrustAtm ?? 0) * 1000,
          ispVac: config.ispVac ?? 250,
          ispAtm: config.ispAtm ?? 200,
          propellants: config.propellants ?? { liquidFuel: 0.9, oxidizer: 1.1 },
          currentThrottle: 0,
          active: false,
          gimbalRange: ((config.gimbalRange ?? 0) * Math.PI) / 180,
          gimbal: new Vec3(),
          firing: false,
        });
      }
    }

    const fuel: FuelTank = {
      liquidFuel: lf,
      oxidizer: ox,
      maxLiquidFuel: lfMax,
      maxOxidizer: oxMax,
    };

    const stages = this.buildStages();
    const dropGroups = this.computeDropGroups();

    return new Vessel({
      id: this.design.id,
      name: this.design.name,
      parentBody,
      position,
      orientation,
      dryMass,
      fuel,
      engines,
      stages,
      dragArea: Math.max(dragArea, 1),
      partContributions,
      dropGroups,
    });
  }

  /**
   * For every decoupler in the design, compute the set of part instance ids
   * that should jettison when it fires. Algorithm:
   *   1. Build an undirected attach graph between parts via `attachedTo`.
   *   2. Identify the "root" part (first command part, or first part).
   *   3. For each decoupler, simulate removing it from the graph and BFS from
   *      the root. Drop group = parts unreachable from the root + the
   *      decoupler itself.
   */
  computeDropGroups(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const parts = this.design.parts;
    if (parts.length === 0) return result;

    // Build adjacency
    const adj = new Map<string, Set<string>>();
    for (const p of parts) adj.set(p.id, new Set());
    for (const p of parts) {
      if (p.attachedTo) {
        const parent = p.attachedTo.partInstanceId;
        if (adj.has(parent)) {
          adj.get(p.id)!.add(parent);
          adj.get(parent)!.add(p.id);
        }
      }
    }

    // Pick root: first command part, else first part
    const root = parts.find((p) => getPart(p.partId)?.category === 'command') ?? parts[0];

    // Find decouplers
    const decouplers = parts.filter((p) => getPart(p.partId)?.category === 'decoupler');

    for (const dec of decouplers) {
      // BFS from root, treating decoupler as removed
      const reachable = new Set<string>();
      const queue: string[] = [root.id];
      reachable.add(root.id);
      while (queue.length) {
        const cur = queue.shift()!;
        if (cur === dec.id) continue;
        for (const nb of adj.get(cur) ?? []) {
          if (nb === dec.id) continue;
          if (reachable.has(nb)) continue;
          reachable.add(nb);
          queue.push(nb);
        }
      }
      const drop: string[] = [dec.id];
      for (const p of parts) {
        if (p.id === dec.id) continue;
        if (!reachable.has(p.id)) drop.push(p.id);
      }
      result[dec.id] = drop;
    }
    return result;
  }

  // -------- undo/redo --------

  pushUndo(): void {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 64) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.snapshot());
    this.design = prev;
    this.recompute();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.snapshot());
    this.design = next;
    this.recompute();
  }

  private snapshot(): VesselDesign {
    return JSON.parse(JSON.stringify(this.design));
  }

  // -------- internals --------

  private ensureStage(stage: number): void {
    while (this.design.stageOrder.length <= stage) {
      this.design.stageOrder.push(this.design.stageOrder.length);
    }
  }

  /** Default staging suggestion based on part type. */
  private suggestStage(config: PartConfig): number {
    if (config.category === 'command' || config.category === 'science' || config.category === 'antenna') return -1;
    const max = Math.max(-1, ...this.design.parts.map((p) => p.stage));
    if (config.category === 'engine' || config.category === 'srb') return max + 1;
    if (config.category === 'decoupler') return max + 1;
    if (config.category === 'parachute') return Math.max(0, max);
    return -1;
  }

  private recompute(): void {
    let mass = 0, cost = 0;
    for (const p of this.design.parts) {
      const c = getPart(p.partId);
      if (!c) continue;
      mass += c.mass + (c.fuelLF ?? 0) * 0.005 + (c.fuelOx ?? 0) * 0.005;
      cost += c.cost;
    }
    this.design.totalMass = mass;
    this.design.totalCost = cost;
  }
}
