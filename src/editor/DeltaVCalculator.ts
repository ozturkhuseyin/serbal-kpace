import { calculateStageDeltaV, StageDeltaV, StageInfo, totalDeltaV } from '../physics/RocketEquation';
import { VehicleAssembly } from './VehicleAssembly';
import { getPart } from './PartDatabase';

/**
 * Live delta-V calculator. Walks the staging plan from the *bottom* (last
 * activated) stage upward, accumulating wet/dry masses for each stage.
 */
export interface DeltaVReport {
  stages: StageDeltaV[];
  totalAtm: number;
  totalVac: number;
  liftoffMass: number;
  liftoffTwrAtm: number;
  liftoffTwrVac: number;
}

export function computeDeltaV(assembly: VehicleAssembly, surfaceGravity = 9.81): DeltaVReport {
  const stagingPlan = assembly.buildStages();
  const partsByStage = new Map<number, string[]>();
  for (const p of assembly.design.parts) {
    if (p.stage < 0) continue;
    const arr = partsByStage.get(p.stage) ?? [];
    arr.push(p.id);
    partsByStage.set(p.stage, arr);
  }

  const numStages = stagingPlan.length;
  const stageInfos: StageInfo[] = [];

  let cumulativeDryMass = 0;
  let cumulativeFuelMass = 0;
  for (const p of assembly.design.parts) {
    if (p.stage >= 0) continue;
    const c = getPart(p.partId);
    if (!c) continue;
    cumulativeDryMass += c.mass * 1000;
    cumulativeFuelMass += ((c.fuelLF ?? 0) + (c.fuelOx ?? 0)) * 5;
  }

  for (let s = numStages - 1; s >= 0; s--) {
    let stageDry = 0;
    let stageFuel = 0;
    let thrustVac = 0, thrustAtm = 0;
    let weightedIspVac = 0, weightedIspAtm = 0;
    let totalThrustForIsp = 0;

    const ids = partsByStage.get(s) ?? [];
    for (const pid of ids) {
      const p = assembly.design.parts.find((x) => x.id === pid);
      if (!p) continue;
      const c = getPart(p.partId);
      if (!c) continue;
      stageDry += c.mass * 1000;
      stageFuel += ((c.fuelLF ?? 0) + (c.fuelOx ?? 0)) * 5;
    }

    for (const eid of stagingPlan[s].engineIds) {
      const p = assembly.design.parts.find((x) => x.id === eid);
      if (!p) continue;
      const c = getPart(p.partId);
      if (!c) continue;
      const tv = (c.thrustVac ?? 0) * 1000;
      const ta = (c.thrustAtm ?? 0) * 1000;
      thrustVac += tv;
      thrustAtm += ta;
      weightedIspVac += (c.ispVac ?? 0) * tv;
      weightedIspAtm += (c.ispAtm ?? 0) * ta;
      totalThrustForIsp += tv;
    }

    const ispVac = totalThrustForIsp > 0 ? weightedIspVac / totalThrustForIsp : 0;
    const ispAtm = thrustAtm > 0 ? weightedIspAtm / thrustAtm : ispVac;

    cumulativeDryMass += stageDry;
    const wet = cumulativeDryMass + cumulativeFuelMass + stageFuel;
    const dry = cumulativeDryMass + cumulativeFuelMass;

    stageInfos.unshift({
      wetMass: wet,
      dryMass: dry,
      thrustVac,
      thrustAtm,
      ispVac,
      ispAtm,
    });

    cumulativeFuelMass += stageFuel;
  }

  const stages = calculateStageDeltaV(stageInfos, surfaceGravity);
  const totalAtm = totalDeltaV(stages, true);
  const totalVac = totalDeltaV(stages, false);
  const liftoff = stageInfos[0] ?? { wetMass: 0, thrustAtm: 0, thrustVac: 0, ispAtm: 0, ispVac: 0, dryMass: 0 };
  const liftoffTwrAtm = liftoff.wetMass > 0 ? liftoff.thrustAtm / (liftoff.wetMass * surfaceGravity) : 0;
  const liftoffTwrVac = liftoff.wetMass > 0 ? liftoff.thrustVac / (liftoff.wetMass * surfaceGravity) : 0;

  return { stages, totalAtm, totalVac, liftoffMass: liftoff.wetMass, liftoffTwrAtm, liftoffTwrVac };
}
