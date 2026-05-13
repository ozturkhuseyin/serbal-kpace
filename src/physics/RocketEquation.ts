import { G0 } from './Constants';

/**
 * Tsiolkovsky rocket equation.
 *   Δv = Isp · g0 · ln(m_initial / m_final)
 *
 * @param isp specific impulse in seconds (atm or vac depending on phase)
 * @param mInitial total wet mass (kg)
 * @param mFinal mass after burn (kg)
 */
export function deltaV(isp: number, mInitial: number, mFinal: number): number {
  if (mFinal <= 0 || mInitial <= mFinal) return 0;
  return isp * G0 * Math.log(mInitial / mFinal);
}

/**
 * Compute thrust-to-weight ratio at the given gravitational acceleration.
 */
export function twr(thrustN: number, massKg: number, gravity: number): number {
  if (massKg <= 0 || gravity <= 0) return 0;
  return thrustN / (massKg * gravity);
}

/**
 * Mass flow rate for an engine producing `thrust` Newtons at `isp` seconds.
 *   ṁ = F / (Isp · g0)
 */
export function massFlow(thrustN: number, isp: number): number {
  if (isp <= 0) return 0;
  return thrustN / (isp * G0);
}

/**
 * Atmosphere-aware Isp interpolation using ambient pressure (Pa).
 * Pressure 0 → vacuum Isp; pressure ≥ p0Atm → atmospheric Isp.
 */
export function effectiveIsp(ispVac: number, ispAtm: number, pressurePa: number, p0Atm = 101325): number {
  if (pressurePa <= 0) return ispVac;
  const t = Math.min(1, pressurePa / p0Atm);
  return ispVac + (ispAtm - ispVac) * t;
}

/**
 * Stage information for delta-v calculation.
 */
export interface StageInfo {
  /** Wet mass of this stage and everything above (kg). */
  wetMass: number;
  /** Dry mass after this stage's fuel is depleted (kg). */
  dryMass: number;
  /** Sum thrust of active engines in this stage (N). */
  thrustVac: number;
  thrustAtm: number;
  /** Effective specific impulse (s). */
  ispVac: number;
  ispAtm: number;
}

/**
 * Compute Δv for each stage, plus running totals.
 */
export interface StageDeltaV {
  stage: number;
  dvVac: number;
  dvAtm: number;
  twrAsl: number;
  twrVac: number;
  burnTime: number;
}

export function calculateStageDeltaV(stages: StageInfo[], surfaceGravity = 9.81): StageDeltaV[] {
  return stages.map((s, i) => {
    const dvVac = deltaV(s.ispVac, s.wetMass, s.dryMass);
    const dvAtm = deltaV(s.ispAtm, s.wetMass, s.dryMass);
    const fuelMass = s.wetMass - s.dryMass;
    const flow = massFlow(s.thrustVac, s.ispVac);
    const burnTime = flow > 0 ? fuelMass / flow : 0;
    return {
      stage: i,
      dvVac,
      dvAtm,
      twrAsl: twr(s.thrustAtm, s.wetMass, surfaceGravity),
      twrVac: twr(s.thrustVac, s.wetMass, surfaceGravity),
      burnTime,
    };
  });
}

export function totalDeltaV(stages: StageDeltaV[], inAtmosphere: boolean): number {
  return stages.reduce((sum, s) => sum + (inAtmosphere ? s.dvAtm : s.dvVac), 0);
}
