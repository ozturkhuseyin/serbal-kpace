import partsData from '../data/parts.json';

export type PartCategory =
  | 'command'
  | 'engine'
  | 'srb'
  | 'tank'
  | 'decoupler'
  | 'fairing'
  | 'fin'
  | 'parachute'
  | 'leg'
  | 'science'
  | 'antenna'
  | 'structural';

export interface AttachNodeConfig {
  id: string;
  position: [number, number, number];
  size: number;
  /** Direction the node faces — used to align attached parts. */
  direction?: [number, number, number];
}

export interface PartConfig {
  id: string;
  name: string;
  category: PartCategory;
  /** Mass in tonnes (1t = 1000 kg). */
  mass: number;
  cost: number;
  description: string;
  /** Tech node required to unlock the part. */
  techRequired?: string;
  /** Visual radius for procedural meshes (m). */
  radius?: number;
  /** Visual height for procedural meshes (m). */
  height?: number;
  /** Engine fields. */
  thrustVac?: number;
  thrustAtm?: number;
  ispVac?: number;
  ispAtm?: number;
  gimbalRange?: number;
  propellants?: { liquidFuel: number; oxidizer: number };
  exhaustLength?: number;
  exhaustCore?: string;
  exhaustOuter?: string;
  /** Tank fields. */
  fuelLF?: number;
  fuelOx?: number;
  /** Drag coefficient · area (used in physics). */
  dragArea?: number;
  attachNodes: AttachNodeConfig[];
  /** Symmetry preference (1, 2, 3, 4, 6, 8). */
  defaultSymmetry?: number;
}

const parts: PartConfig[] = partsData as unknown as PartConfig[];
const partMap: Map<string, PartConfig> = new Map(parts.map((p) => [p.id, p]));

export function listParts(): PartConfig[] {
  return parts;
}

export function getPart(id: string): PartConfig | undefined {
  return partMap.get(id);
}

export function partsByCategory(): Record<PartCategory, PartConfig[]> {
  const out: Record<string, PartConfig[]> = {};
  for (const p of parts) {
    (out[p.category] ??= []).push(p);
  }
  return out as Record<PartCategory, PartConfig[]>;
}

export function unlockedParts(unlockedTech: Set<string>): PartConfig[] {
  return parts.filter((p) => !p.techRequired || unlockedTech.has(p.techRequired));
}
