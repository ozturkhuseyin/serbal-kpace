import { BodyConfig } from '../physics/CelestialBody';
import { stateToElements } from '../physics/OrbitalMechanics';
import { Vec3 } from '../physics/Vector3';

/**
 * Build a circular orbit around `parentMu` at radius `r`, plane inclined by `i` rad.
 * `phase` randomises the starting position.
 */
function circularOrbit(parentMu: number, parentId: string, r: number, i: number, phase: number, epoch = 0) {
  const v = Math.sqrt(parentMu / r);
  const cosP = Math.cos(phase), sinP = Math.sin(phase);
  let pos = new Vec3(r * cosP, r * sinP, 0);
  let vel = new Vec3(-v * sinP, v * cosP, 0);
  const cosI = Math.cos(i), sinI = Math.sin(i);
  pos = new Vec3(pos.x, pos.y * cosI - pos.z * sinI, pos.y * sinI + pos.z * cosI);
  vel = new Vec3(vel.x, vel.y * cosI - vel.z * sinI, vel.y * sinI + vel.z * cosI);
  const el = stateToElements(pos, vel, parentMu);
  return { ...el, parentId, epoch };
}

const KERBOL_MU = 1.1723328e18;
const KERBIN_MU = 3.5316e12;
const MUN_MU = 6.5138e10;
const MINMUS_MU = 1.7658e9;
const DUNA_MU = 3.0136e11;
const IKE_MU = 1.85684e10;
const JOOL_MU = 2.8253e14;
const LAYTHE_MU = 1.962e12;
const VALL_MU = 2.075e11;
const TYLO_MU = 2.825e12;
const BOP_MU = 2.486e9;
const POL_MU = 7.215e8;
const EVE_MU = 8.1717e12;
const MOHO_MU = 1.6863e11;

export const SOLAR_SYSTEM_DATA: BodyConfig[] = [
  {
    id: 'kerbol',
    name: 'Kerbol',
    radius: 261_600_000,
    mu: KERBOL_MU,
    soi: Infinity,
    rotationPeriod: 432000,
    color: '#ffd066',
    surfaceColor: '#ffe5a8',
    terrainAmplitude: 0,
    tier: 'star',
    description: 'The yellow main-sequence star at the centre of the system.',
  },
  {
    id: 'moho',
    name: 'Moho',
    radius: 250_000,
    mu: MOHO_MU,
    soi: 9_646_663,
    rotationPeriod: 1_210_000,
    color: '#a05a35',
    surfaceColor: '#7a4a30',
    terrainAmplitude: 600,
    tier: 'planet',
    description: 'Innermost planet, hot and barren.',
    orbit: circularOrbit(KERBOL_MU, 'kerbol', 5_263_138_304, 0.122, Math.PI * 0.1),
  },
  {
    id: 'eve',
    name: 'Eve',
    radius: 700_000,
    mu: EVE_MU,
    soi: 85_109_365,
    rotationPeriod: 80_500,
    color: '#9c5cb1',
    surfaceColor: '#7d3984',
    atmosphereColor: '#a877b5',
    terrainAmplitude: 1500,
    tier: 'planet',
    description: 'Purple Venus-analog with crushing 5-atm atmosphere.',
    atmosphere: { p0: 506_625, scaleHeight: 7000, t0: 380, ceiling: 90_000, rho0: 6.0 },
    orbit: circularOrbit(KERBOL_MU, 'kerbol', 9_832_684_544, 0.037, Math.PI * 0.4),
  },
  {
    id: 'kerbin',
    name: 'Kerbin',
    radius: 600_000,
    mu: KERBIN_MU,
    soi: 84_159_286,
    rotationPeriod: 21_549,
    color: '#3a7d44',
    surfaceColor: '#3a7d44',
    atmosphereColor: '#88aaff',
    terrainAmplitude: 1100,
    tier: 'planet',
    description: 'Home. Earth-analog with oceans and continents.',
    atmosphere: { p0: 101_325, scaleHeight: 5600, t0: 288, ceiling: 70_000, rho0: 1.225 },
    orbit: circularOrbit(KERBOL_MU, 'kerbol', 13_599_840_256, 0, 0),
  },
  {
    id: 'mun',
    name: 'Mun',
    radius: 200_000,
    mu: MUN_MU,
    soi: 2_429_559,
    rotationPeriod: 138_984,
    color: '#bbbbbb',
    surfaceColor: '#8b8b8e',
    terrainAmplitude: 800,
    tier: 'moon',
    description: 'Kerbin\'s grey moon. Major first milestone.',
    orbit: circularOrbit(KERBIN_MU, 'kerbin', 12_000_000, 0, Math.PI * 0.6),
  },
  {
    id: 'minmus',
    name: 'Minmus',
    radius: 60_000,
    mu: MINMUS_MU,
    soi: 2_247_428,
    rotationPeriod: 40_400,
    color: '#a8d6c0',
    surfaceColor: '#a8d6c0',
    terrainAmplitude: 200,
    tier: 'moon',
    description: 'Mint-coloured low-gravity moon.',
    orbit: circularOrbit(KERBIN_MU, 'kerbin', 47_000_000, 0.105, Math.PI * 1.4),
  },
  {
    id: 'duna',
    name: 'Duna',
    radius: 320_000,
    mu: DUNA_MU,
    soi: 17_158_769,
    rotationPeriod: 65_517,
    color: '#a55530',
    surfaceColor: '#a55530',
    atmosphereColor: '#c87766',
    terrainAmplitude: 900,
    tier: 'planet',
    description: 'Mars-analog with a thin atmosphere.',
    atmosphere: { p0: 6755, scaleHeight: 3000, t0: 240, ceiling: 50_000, rho0: 0.07 },
    orbit: circularOrbit(KERBOL_MU, 'kerbol', 20_726_155_264, 0.0017, Math.PI * 0.9),
  },
  {
    id: 'ike',
    name: 'Ike',
    radius: 130_000,
    mu: IKE_MU,
    soi: 1_049_598,
    rotationPeriod: 65_517,
    color: '#777a82',
    surfaceColor: '#777a82',
    terrainAmplitude: 500,
    tier: 'moon',
    description: 'Duna\'s rocky moon.',
    orbit: circularOrbit(DUNA_MU, 'duna', 3_200_000, 0.038, 0),
  },
  {
    id: 'jool',
    name: 'Jool',
    radius: 6_000_000,
    mu: JOOL_MU,
    soi: 2_455_985_185,
    rotationPeriod: 36_000,
    color: '#94c270',
    surfaceColor: '#94c270',
    atmosphereColor: '#b9d896',
    terrainAmplitude: 0,
    tier: 'planet',
    description: 'Gas giant. Cannot be landed on.',
    atmosphere: { p0: 1_519_875, scaleHeight: 18000, t0: 165, ceiling: 200_000, rho0: 4.5 },
    orbit: circularOrbit(KERBOL_MU, 'kerbol', 68_773_560_320, 0.0228, Math.PI * 1.7),
  },
  {
    id: 'laythe',
    name: 'Laythe',
    radius: 500_000,
    mu: LAYTHE_MU,
    soi: 3_723_645,
    rotationPeriod: 52_980,
    color: '#2c6d92',
    surfaceColor: '#2c6d92',
    atmosphereColor: '#aaccee',
    terrainAmplitude: 800,
    tier: 'moon',
    description: 'Ocean moon of Jool with a breathable-ish atmosphere.',
    atmosphere: { p0: 80_000, scaleHeight: 5000, t0: 230, ceiling: 50_000, rho0: 1.0 },
    orbit: circularOrbit(JOOL_MU, 'jool', 27_184_000, 0, 0.5),
  },
  {
    id: 'vall',
    name: 'Vall',
    radius: 300_000,
    mu: VALL_MU,
    soi: 2_406_401,
    rotationPeriod: 105_962,
    color: '#a5c2cc',
    surfaceColor: '#a5c2cc',
    terrainAmplitude: 700,
    tier: 'moon',
    description: 'Frozen ice moon orbiting Jool.',
    orbit: circularOrbit(JOOL_MU, 'jool', 43_152_000, 0, 1.2),
  },
  {
    id: 'tylo',
    name: 'Tylo',
    radius: 600_000,
    mu: TYLO_MU,
    soi: 10_856_518,
    rotationPeriod: 211_926,
    color: '#cabba0',
    surfaceColor: '#cabba0',
    terrainAmplitude: 1200,
    tier: 'moon',
    description: 'Massive airless moon — Kerbin gravity, no atmosphere.',
    orbit: circularOrbit(JOOL_MU, 'jool', 68_500_000, 0.0044, 2.0),
  },
  {
    id: 'bop',
    name: 'Bop',
    radius: 65_000,
    mu: BOP_MU,
    soi: 1_221_060,
    rotationPeriod: 544_507,
    color: '#5e493a',
    surfaceColor: '#5e493a',
    terrainAmplitude: 350,
    tier: 'moon',
    description: 'Captured asteroid moon of Jool.',
    orbit: circularOrbit(JOOL_MU, 'jool', 128_500_000, 0.262, 2.7),
  },
  {
    id: 'pol',
    name: 'Pol',
    radius: 44_000,
    mu: POL_MU,
    soi: 1_042_138,
    rotationPeriod: 901_902,
    color: '#dcce96',
    surfaceColor: '#dcce96',
    terrainAmplitude: 200,
    tier: 'moon',
    description: 'Tiny pollen-coloured moon of Jool.',
    orbit: circularOrbit(JOOL_MU, 'jool', 179_890_000, 0.074, 3.4),
  },
];

/** The body the player launches from. */
export const HOME_BODY_ID = 'kerbin';
