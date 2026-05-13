import { Vec3 } from '../physics/Vector3';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { Vessel } from '../physics/Vessel';
import { SAS } from './SAS';
import { StagingManager } from './StagingManager';

/**
 * Translates keyboard input into physics commands for the active vessel.
 *
 * Keys (mapped per the design doc):
 *   W/S      pitch
 *   A/D      yaw
 *   Q/E      roll
 *   Shift/Ctrl  throttle ±
 *   Z/X      full / cut throttle
 *   Space    next stage
 *   T        toggle SAS
 *   R        toggle RCS
 *   ,/.      time warp − / +
 *   M        toggle map view
 *   Tab      cycle camera
 *   Backspace recover
 *   1–0      throttle presets
 */
export class FlightController {
  engine: PhysicsEngine;
  sas: SAS;
  staging: StagingManager;
  active: Vessel | null = null;
  /** Map of currently held keys. */
  private keys: Set<string> = new Set();
  /** Triggered keys this frame (cleared after read). */
  private triggers: Set<string> = new Set();

  /** Hooks for external systems (e.g. UI to toggle map, camera). */
  onMapToggle: () => void = () => {};
  onCameraCycle: () => void = () => {};
  onRecover: () => void = () => {};
  onWarp: (dir: 1 | -1) => void = () => {};

  constructor(engine: PhysicsEngine, sas: SAS, staging: StagingManager) {
    this.engine = engine;
    this.sas = sas;
    this.staging = staging;
  }

  attach(target: HTMLElement | Window = window): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    window.addEventListener('blur', this.clear as EventListener);
  }

  detach(target: HTMLElement | Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener);
    target.removeEventListener('keyup', this.onKeyUp as EventListener);
    window.removeEventListener('blur', this.clear as EventListener);
  }

  setActiveVessel(v: Vessel): void {
    this.active = v;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === 'tab' || (k >= '0' && k <= '9' && !e.metaKey && !e.ctrlKey)) e.preventDefault();
    if (this.keys.has(k)) return;
    this.keys.add(k);
    this.triggers.add(k);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private clear = (): void => {
    this.keys.clear();
  };

  /** Called from the game loop. Reads inputs and applies them. */
  update(dt: number): void {
    if (!this.active) {
      this.triggers.clear();
      return;
    }
    const v = this.active;

    // KSP-style mapping. Body axes: +X = right, +Y = forward (nose), +Z = up.
    //   W → pitch nose DOWN (negative torque around body +X)
    //   S → pitch nose UP
    //   A → yaw LEFT
    //   D → yaw RIGHT
    //   Q → roll LEFT (counter-clockwise viewed from behind)
    //   E → roll RIGHT
    let pitch = 0, yaw = 0, roll = 0;
    if (this.keys.has('w')) pitch -= 1;
    if (this.keys.has('s')) pitch += 1;
    if (this.keys.has('a')) yaw += 1;
    if (this.keys.has('d')) yaw -= 1;
    if (this.keys.has('q')) roll -= 1;
    if (this.keys.has('e')) roll += 1;

    const sasInput = this.sas.compute(v, dt);
    v.controlInput = new Vec3(pitch, roll, yaw).add(sasInput);

    if (this.keys.has('shift')) v.throttle = Math.min(1, v.throttle + dt);
    if (this.keys.has('control')) v.throttle = Math.max(0, v.throttle - dt);

    if (this.triggers.has('z')) v.throttle = 1;
    if (this.triggers.has('x')) v.throttle = 0;

    for (let i = 0; i <= 9; i++) {
      if (this.triggers.has(String(i))) {
        v.throttle = i / 9;
      }
    }

    if (this.triggers.has(' ') || this.triggers.has('space')) {
      this.staging.triggerNextStage(v);
    }

    if (this.triggers.has('t')) {
      v.sasMode = v.sasMode === 'off' ? 'stability' : 'off';
      this.sas.reset();
    }
    if (this.triggers.has('r')) v.rcsEnabled = !v.rcsEnabled;
    if (this.triggers.has('m')) this.onMapToggle();
    if (this.triggers.has('tab')) this.onCameraCycle();
    if (this.triggers.has('backspace')) this.onRecover();
    if (this.triggers.has(',')) this.onWarp(-1);
    if (this.triggers.has('.')) this.onWarp(1);

    this.triggers.clear();
  }
}
