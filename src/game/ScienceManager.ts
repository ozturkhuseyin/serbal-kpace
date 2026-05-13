import { Vessel } from '../physics/Vessel';
import { CelestialBody } from '../physics/CelestialBody';

export interface ScienceExperiment {
  id: string;
  name: string;
  baseValue: number;
  /** Required altitude band. */
  situations: ('landed' | 'flying-low' | 'flying-high' | 'in-space-low' | 'in-space-high')[];
}

export const EXPERIMENTS: ScienceExperiment[] = [
  { id: 'crewReport', name: 'Crew Report', baseValue: 5, situations: ['landed', 'flying-low', 'flying-high', 'in-space-low', 'in-space-high'] },
  { id: 'temperature', name: 'Temperature Scan', baseValue: 8, situations: ['flying-low', 'flying-high', 'in-space-low'] },
  { id: 'pressure', name: 'Atmospheric Pressure', baseValue: 12, situations: ['landed', 'flying-low', 'flying-high'] },
  { id: 'goo', name: 'Mystery Goo', baseValue: 10, situations: ['landed', 'flying-low', 'in-space-low', 'in-space-high'] },
  { id: 'materials', name: 'Materials Bay', baseValue: 25, situations: ['flying-high', 'in-space-low', 'in-space-high'] },
];

export interface CollectedScience {
  experimentId: string;
  bodyId: string;
  situation: string;
  value: number;
  recovered: boolean;
}

const BODY_MULT: Record<string, number> = {
  kerbin: 1, mun: 4, minmus: 5, duna: 8, ike: 10, eve: 8, gilly: 12,
  jool: 12, laythe: 14, vall: 12, tylo: 16, bop: 18, pol: 18, moho: 9, kerbol: 0,
};

export class ScienceManager {
  collected: CollectedScience[] = [];

  classifySituation(v: Vessel, parent: CelestialBody): CollectedScience['situation'] {
    if (v.situation === 'landed' || v.situation === 'splashed') return 'landed';
    const altitude = v.altitudeASL;
    const atmosphereCeiling = parent.config.atmosphere?.ceiling ?? 0;
    if (altitude < atmosphereCeiling * 0.4) return 'flying-low';
    if (altitude < atmosphereCeiling) return 'flying-high';
    if (altitude < parent.config.radius * 1.5) return 'in-space-low';
    return 'in-space-high';
  }

  /** Run all experiments that match the current situation. Returns added science points. */
  runExperiments(v: Vessel, parent: CelestialBody): number {
    const situation = this.classifySituation(v, parent);
    let total = 0;
    for (const exp of EXPERIMENTS) {
      if (!exp.situations.includes(situation as any)) continue;
      const key = `${exp.id}@${parent.config.id}@${situation}`;
      if (this.collected.some((c) => c.experimentId === exp.id && c.bodyId === parent.config.id && c.situation === situation)) continue;
      void key;
      const value = exp.baseValue * (BODY_MULT[parent.config.id] ?? 1);
      this.collected.push({ experimentId: exp.id, bodyId: parent.config.id, situation, value, recovered: false });
      total += value;
    }
    return total;
  }

  /** Recover all collected science to home base; returns total points. */
  recoverAll(): number {
    let total = 0;
    for (const c of this.collected) {
      if (!c.recovered) {
        c.recovered = true;
        total += c.value;
      }
    }
    return total;
  }
}
