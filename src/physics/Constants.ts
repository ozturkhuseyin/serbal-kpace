/**
 * Physical constants used throughout the simulation.
 * Values approximate Kerbal Space Program scale (about 1/10 real solar system).
 */

export const G = 6.6743e-11;

export const G0 = 9.80665;

export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;
export const HALF_PI = Math.PI / 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export const KM = 1000;
export const AU = 1.496e11;

/** Default fixed-step physics interval (seconds) — 50Hz. */
export const FIXED_DT = 0.02;

/** Maximum number of physics sub-steps per frame to avoid spiral of death. */
export const MAX_SUBSTEPS = 8;

/** Universal gas constant (J/(mol·K)). */
export const R_UNIVERSAL = 8.31446;

/** Earth-equivalent gas molecular weight (kg/mol) for atmosphere model. */
export const M_AIR = 0.0289644;

export const MIN_FLOAT = 1e-30;
export const ORBIT_ECC_TOL = 1e-9;
