import { PhysicsEngine, EngineEvent } from '../physics/PhysicsEngine';
import { Vessel } from '../physics/Vessel';

/**
 * Coordinates stage activation. The PhysicsEngine.stage call already handles
 * engine ignition; this layer adds parachute deployment, decoupler events, etc.
 */
export class StagingManager {
  engine: PhysicsEngine;

  constructor(engine: PhysicsEngine) {
    this.engine = engine;
    engine.on((e) => this.handleEvent(e));
  }

  triggerNextStage(v: Vessel): void {
    if (v.currentStage <= 0) return;
    this.engine.stage(v);
  }

  private handleEvent(e: EngineEvent): void {
    if (e.type !== 'staging') return;
    const vessel = this.engine.vessels.get(e.vesselId);
    if (!vessel) return;
    const stageIdx = vessel.currentStage;
    if (stageIdx < 0 || stageIdx >= vessel.stages.length) return;
    const stage = vessel.stages[stageIdx];
    for (const id of stage.parachuteIds) {
      vessel.flags[`parachute-${id}`] = true;
    }
  }

  /** Apply parachute drag boost when parachutes are deployed in atmosphere. */
  applyParachutes(v: Vessel): number {
    const parent = v.parentBody;
    const altitude = v.body.position.sub(parent.position).length() - parent.config.radius;
    const density = parent.densityAt(altitude);
    if (density <= 0) return 0;
    let parachuteDrag = 0;
    for (const flag of Object.keys(v.flags)) {
      if (flag.startsWith('parachute-') && v.flags[flag]) parachuteDrag += 6.5;
    }
    return parachuteDrag;
  }
}
