import { VehicleAssembly } from './VehicleAssembly';
import { Vec3 } from '../physics/Vector3';

/**
 * Pre-built rockets that ship with the game so the player has something to fly
 * before learning the editor.
 *
 * Staging convention: highest stage number activates FIRST when the player
 * presses SPACE. So a typical ascent rocket is staged like:
 *
 *   stage 3 (highest, fires first)  → main engine ignition
 *   stage 2                          → decouple booster, ignite upper stage
 *   stage 1                          → decouple upper stage
 *   stage 0 (lowest, fires last)     → deploy parachute
 *
 * Parts that belong to no stage (command pod, fuel tanks) use stage = -1.
 */

export interface StockDesignEntry {
  id: string;
  name: string;
  description: string;
  build: () => VehicleAssembly;
}

/* ---------- 1. Sounding Rocket — sub-orbital ballistic ------------------- */

export function createSoundingRocket(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'Sounding-1' });
  let y = 0;
  const pod = a.addPart('cmd.mk1-pod', new Vec3(0, y + 0.7, 0), { stage: -1 });
  a.addPart('para.mk16', new Vec3(0, y + 0.7 + 0.18, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });
  y -= 0.18;
  const dec = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });
  y -= 0.18 + 0.4;
  const tank = a.addPart('tank.fl-t100', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 0.4 + 0.55;
  a.addPart('engine.lv-t30', new Vec3(0, y, 0), {
    parent: { partInstanceId: tank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });
  return a;
}

/* ---------- 2. Kerbal-I — beginner ascent rocket ------------------------- */

export function createKerbalIBeginnerRocket(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'Kerbal-I' });
  let y = 0;
  const pod = a.addPart('cmd.mk1-pod', new Vec3(0, y + 0.7, 0), { stage: -1 });
  a.addPart('para.mk16', new Vec3(0, y + 0.7 + 0.18, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });
  y -= 0.18;
  const decoupler = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });
  y -= 0.18 + 0.92;
  const tank = a.addPart('tank.fl-t400', new Vec3(0, y, 0), {
    parent: { partInstanceId: decoupler.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 0.92 + 0.55;
  a.addPart('engine.lv-t45', new Vec3(0, y, 0), {
    parent: { partInstanceId: tank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });
  return a;
}

/* ---------- 3. Mun Explorer — single-stage heavy lifter ------------------ */

export function createMunRocket(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'Mun Explorer' });
  let y = 0;
  const pod = a.addPart('cmd.mk1-pod', new Vec3(0, y + 0.7, 0), { stage: -1 });
  a.addPart('para.mk16', new Vec3(0, y + 0.7 + 0.18, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });
  y -= 0.18;
  const decoupler = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });
  y -= 0.18 + 1.85;
  const tank = a.addPart('tank.fl-t800', new Vec3(0, y, 0), {
    parent: { partInstanceId: decoupler.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 1.85 + 0.55;
  a.addPart('engine.lv-t45', new Vec3(0, y, 0), {
    parent: { partInstanceId: tank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });
  return a;
}

/* ---------- 4. Two-Stage Voyager — proper multi-stage to LKO ------------- */

export function createTwoStageVoyager(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'Voyager-II' });
  let y = 0;

  // Crew section
  const pod = a.addPart('cmd.mk1-pod', new Vec3(0, y + 0.7, 0), { stage: -1 });
  a.addPart('para.mk16', new Vec3(0, y + 0.7 + 0.18, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });

  // Decoupler 1: separates upper stage from pod after orbital insertion
  y -= 0.18;
  const dec1 = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });

  // Upper stage tank + vacuum-optimised engine (LV-909)
  y -= 0.18 + 0.92;
  const upperTank = a.addPart('tank.fl-t400', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec1.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 0.92 + 0.5;
  const upperEngine = a.addPart('engine.lv-909', new Vec3(0, y, 0), {
    parent: { partInstanceId: upperTank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });

  // Decoupler 2: separates spent first stage from upper stage
  y -= 0.5 + 0.09;
  const dec2 = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: upperEngine.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });

  // First-stage booster tank + LV-T45 (gimballed) engine
  y -= 0.09 + 1.85;
  const boosterTank = a.addPart('tank.fl-t800', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec2.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 1.85 + 0.55;
  a.addPart('engine.lv-t45', new Vec3(0, y, 0), {
    parent: { partInstanceId: boosterTank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 3,
  });

  return a;
}

/* ---------- 5. SRB Booster Stack — solid-fuel kick start ------------------ */

export function createSrbBoosterStack(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'BACC Lifter' });
  let y = 0;
  const pod = a.addPart('cmd.mk1-pod', new Vec3(0, y + 0.7, 0), { stage: -1 });
  a.addPart('para.mk16', new Vec3(0, y + 0.7 + 0.18, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });
  y -= 0.18;
  const dec1 = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });
  y -= 0.18 + 0.92;
  const tank = a.addPart('tank.fl-t400', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec1.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 0.92 + 0.5;
  const sustainer = a.addPart('engine.lv-909', new Vec3(0, y, 0), {
    parent: { partInstanceId: tank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });
  y -= 0.5 + 0.09;
  const dec2 = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: sustainer.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });
  y -= 0.09 + 3.2;
  a.addPart('srb.bacc', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec2.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 3,
  });
  return a;
}

/* ---------- 6. Probe Satellite — unmanned science orbiter ---------------- */

export function createProbeSatellite(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'Probe Sat' });
  let y = 0;
  const probe = a.addPart('cmd.probe-core', new Vec3(0, y + 0.2, 0), { stage: -1 });
  // Science instruments + antenna mounted on probe (cosmetic radial)
  a.addPart('science.thermometer', new Vec3(0.4, y + 0.1, 0), {
    parent: { partInstanceId: probe.id, nodeId: 'top' },
    selfNode: 'root',
    stage: -1,
  });
  a.addPart('science.barometer', new Vec3(-0.4, y + 0.1, 0), {
    parent: { partInstanceId: probe.id, nodeId: 'top' },
    selfNode: 'root',
    stage: -1,
  });
  a.addPart('antenna.basic', new Vec3(0, y + 0.5, 0), {
    parent: { partInstanceId: probe.id, nodeId: 'top' },
    selfNode: 'root',
    stage: -1,
  });
  a.addPart('para.mk16', new Vec3(0, y + 0.2 + 0.18, 0), {
    parent: { partInstanceId: probe.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });
  y -= 0.18;
  const dec = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: probe.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });
  y -= 0.18 + 0.92;
  const tank = a.addPart('tank.fl-t400', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 0.92 + 0.5;
  a.addPart('engine.lv-909', new Vec3(0, y, 0), {
    parent: { partInstanceId: tank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });
  return a;
}

/* ---------- 7. Heavy Lifter — 3-stage Mun-and-back capable ---------------- */

export function createHeavyLifter(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'Heavy-3' });
  let y = 0;

  // Heavy 3-seat command pod
  const pod = a.addPart('cmd.mk1-2-pod', new Vec3(0, y + 0.9, 0), { stage: -1 });
  a.addPart('para.mk16', new Vec3(0, y + 0.9 + 0.18, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });

  // Stage 1: separates capsule from upper stage on return
  y -= 0.18;
  const dec1 = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });

  // Upper stage (transfer / capture burns): poodle + small tank
  y -= 0.18 + 0.4;
  const upperTank = a.addPart('tank.fl-t100', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec1.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 0.4 + 0.7;
  const upperEngine = a.addPart('engine.poodle', new Vec3(0, y, 0), {
    parent: { partInstanceId: upperTank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });

  // Stage 2 decoupler: drops middle stage
  y -= 0.7 + 0.09;
  const dec2 = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: upperEngine.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });

  // Middle stage: efficient LV-909 vacuum engine + medium tank
  y -= 0.09 + 0.92;
  const midTank = a.addPart('tank.fl-t400', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec2.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 0.92 + 0.5;
  const midEngine = a.addPart('engine.lv-909', new Vec3(0, y, 0), {
    parent: { partInstanceId: midTank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 3,
  });

  // Stage 3 decoupler: drops main booster
  y -= 0.5 + 0.09;
  const dec3 = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: midEngine.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 3,
  });

  // Booster: big LF-T800 tank + Swivel for atmospheric ascent
  y -= 0.09 + 1.85;
  const boosterTank = a.addPart('tank.fl-t800', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec3.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  y -= 1.85 + 0.55;
  a.addPart('engine.lv-t45', new Vec3(0, y, 0), {
    parent: { partInstanceId: boosterTank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 4,
  });

  return a;
}

/* ---------- 8. Mun Lander — equipped with landing legs ------------------- */

export function createMunLander(): VehicleAssembly {
  const a = new VehicleAssembly({ name: 'Mun Lander' });
  let y = 0;
  const pod = a.addPart('cmd.mk1-pod', new Vec3(0, y + 0.7, 0), { stage: -1 });
  a.addPart('para.mk16', new Vec3(0, y + 0.7 + 0.18, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'top' },
    selfNode: 'bottom',
    stage: 0,
  });
  y -= 0.18;
  const dec = a.addPart('decoupler.tr-18a', new Vec3(0, y, 0), {
    parent: { partInstanceId: pod.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 1,
  });
  y -= 0.18 + 0.92;
  const tank = a.addPart('tank.fl-t400', new Vec3(0, y, 0), {
    parent: { partInstanceId: dec.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: -1,
  });
  // Three landing legs around the bottom of the tank
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    a.addPart('leg.lt-1', new Vec3(Math.cos(angle) * 0.6, y - 0.4, Math.sin(angle) * 0.6), {
      parent: { partInstanceId: tank.id, nodeId: 'bottom' },
      selfNode: 'root',
      stage: -1,
    });
  }
  y -= 0.92 + 0.5;
  a.addPart('engine.lv-909', new Vec3(0, y, 0), {
    parent: { partInstanceId: tank.id, nodeId: 'bottom' },
    selfNode: 'top',
    stage: 2,
  });
  return a;
}

/* ---------- Registry ------------------------------------------------------ */

export const STOCK_DESIGNS: StockDesignEntry[] = [
  { id: 'sounding',    name: 'Sounding-1',    description: 'Tiny ballistic sounding rocket — perfect first launch.', build: createSoundingRocket },
  { id: 'kerbalI',     name: 'Kerbal-I',      description: 'Beginner ascent rocket. Good for sub-orbit & basic science.', build: createKerbalIBeginnerRocket },
  { id: 'munRocket',   name: 'Mun Explorer',  description: 'Single-stage heavy lifter capable of reaching low Kerbin orbit.', build: createMunRocket },
  { id: 'voyager',     name: 'Voyager-II',    description: 'Two-stage rocket for low Kerbin orbit with vacuum upper stage.', build: createTwoStageVoyager },
  { id: 'srbStack',    name: 'BACC Lifter',   description: 'Solid-fuel first stage + LV-909 sustainer. High TWR off the pad.', build: createSrbBoosterStack },
  { id: 'probe',       name: 'Probe Sat',     description: 'Unmanned science satellite. Cheap, lightweight.', build: createProbeSatellite },
  { id: 'heavy',       name: 'Heavy-3',       description: 'Three-stage heavy lifter. Capable of Mun-and-back missions.', build: createHeavyLifter },
  { id: 'munLander',   name: 'Mun Lander',    description: 'Compact lander with three landing legs and a Terrier engine.', build: createMunLander },
];
