/**
 * Time-warp manager. Encodes the constraints from the design doc.
 */
export const WARP_LEVELS = [1, 5, 10, 50, 100, 1000, 10000, 100000] as const;
export type WarpLevel = (typeof WARP_LEVELS)[number];

export interface WarpConstraints {
  /** Vessel altitude above the surface (m). */
  altitudeAGL: number;
  /** Whether vessel is currently landed. */
  landed: boolean;
  /** Whether the vessel is in a stable orbit (apoapsis above atmosphere). */
  inStableOrbit: boolean;
  /** Whether the player is in map view (allows higher warp). */
  mapView: boolean;
}

export class TimeWarp {
  private level = 0;

  factor(): number { return WARP_LEVELS[this.level]; }
  index(): number { return this.level; }

  canWarpTo(level: number, c: WarpConstraints): boolean {
    if (level < 0 || level >= WARP_LEVELS.length) return false;
    const target = WARP_LEVELS[level];
    if (target <= 5) return true;
    if (target <= 50) return c.inStableOrbit || c.landed || c.altitudeAGL > 70_000;
    if (target <= 1000) return c.inStableOrbit || c.landed;
    return c.inStableOrbit || c.mapView;
  }

  step(direction: 1 | -1, c: WarpConstraints): void {
    const next = this.level + direction;
    if (this.canWarpTo(next, c)) this.level = next;
  }

  reset(): void { this.level = 0; }
}
