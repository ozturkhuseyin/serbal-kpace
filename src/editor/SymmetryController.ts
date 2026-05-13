import { Vec3 } from '../physics/Vector3';
import { VehicleAssembly } from './VehicleAssembly';
import { getPart } from './PartDatabase';

/**
 * Helper that places multiple instances of a part radially around an axis to
 * achieve the symmetry counts familiar from KSP.
 */
export type SymmetryMode = 1 | 2 | 3 | 4 | 6 | 8;

export class SymmetryController {
  mode: SymmetryMode = 1;

  setMode(mode: SymmetryMode): void {
    this.mode = mode;
  }

  /**
   * Place a part with radial symmetry around a centre point. Distance is the
   * radial offset from the central axis. Returns the new instance ids.
   */
  placeRadial(assembly: VehicleAssembly, partId: string, axisOrigin: Vec3, distance: number): string[] {
    const config = getPart(partId);
    if (!config) return [];
    const groupId = `sym-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const ids: string[] = [];
    for (let i = 0; i < this.mode; i++) {
      const angle = (i / this.mode) * Math.PI * 2;
      const dx = Math.cos(angle) * distance;
      const dz = Math.sin(angle) * distance;
      const pos = new Vec3(axisOrigin.x + dx, axisOrigin.y, axisOrigin.z + dz);
      const inst = assembly.addPart(partId, pos, {
        rotation: new Vec3(0, -angle, 0),
        symmetryGroup: groupId,
      });
      ids.push(inst.id);
    }
    return ids;
  }
}
