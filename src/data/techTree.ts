export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  tier: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
  unlocks: string[];
}

export const TECH_TREE: TechNode[] = [
  {
    id: 'basicRocketry',
    name: 'Basic Rocketry',
    description: 'The first step into space. Unlocks essential parts.',
    cost: 0,
    tier: 1,
    prerequisites: [],
    unlocks: ['cmd.mk1-pod', 'tank.fl-t100', 'tank.fl-t400', 'engine.lv-t30', 'engine.lv-t45', 'srb.bacc', 'decoupler.tr-18a', 'para.mk16'],
  },
  {
    id: 'basicAerodynamics',
    name: 'Basic Aerodynamics',
    description: 'Atmospheric flight basics.',
    cost: 5,
    tier: 1,
    prerequisites: ['basicRocketry'],
    unlocks: ['fin.aerodynamic', 'fairing.aero-1m'],
  },
  {
    id: 'basicScience',
    name: 'Basic Science',
    description: 'First scientific instruments.',
    cost: 5,
    tier: 1,
    prerequisites: ['basicRocketry'],
    unlocks: ['cmd.probe-core', 'science.thermometer', 'science.barometer', 'antenna.basic'],
  },
  {
    id: 'generalRocketry',
    name: 'General Rocketry',
    description: 'Larger, more efficient liquid engines.',
    cost: 15,
    tier: 2,
    prerequisites: ['basicRocketry'],
    unlocks: ['tank.fl-t800'],
  },
  {
    id: 'advancedRocketry',
    name: 'Advanced Rocketry',
    description: 'Vacuum-optimised engines and command modules.',
    cost: 45,
    tier: 3,
    prerequisites: ['generalRocketry'],
    unlocks: ['cmd.mk1-2-pod', 'engine.lv-909', 'engine.poodle', 'leg.lt-1'],
  },
  {
    id: 'heavyRocketry',
    name: 'Heavy Rocketry',
    description: 'High thrust engines for big payloads.',
    cost: 90,
    tier: 4,
    prerequisites: ['advancedRocketry'],
    unlocks: [],
  },
  {
    id: 'advancedScience',
    name: 'Advanced Science',
    description: 'Materials bays and high-gain antennae.',
    cost: 90,
    tier: 4,
    prerequisites: ['basicScience'],
    unlocks: [],
  },
  {
    id: 'experimentalScience',
    name: 'Experimental Science',
    description: 'Cutting-edge experiments for the outer system.',
    cost: 300,
    tier: 5,
    prerequisites: ['advancedScience'],
    unlocks: [],
  },
];
