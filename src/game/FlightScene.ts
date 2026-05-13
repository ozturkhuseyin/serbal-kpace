import * as THREE from 'three';
import { SceneManager } from '../rendering/SceneManager';
import { PlanetRenderer } from '../rendering/PlanetRenderer';
import { VesselRenderer } from '../rendering/VesselRenderer';
import { OrbitRenderer } from '../rendering/OrbitRenderer';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { Starfield } from '../rendering/Starfield';
import { MapView } from '../rendering/MapView';
import { TerrainLOD } from '../rendering/TerrainLOD';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { SolarSystem } from '../physics/SolarSystem';
import { Vessel } from '../physics/Vessel';
import { SOLAR_SYSTEM_DATA } from '../data/SolarSystemData';
import { Quat, Vec3 } from '../physics/Vector3';
import { stateToElements } from '../physics/OrbitalMechanics';
import { CelestialBody } from '../physics/CelestialBody';
import { VehicleAssembly } from '../editor/VehicleAssembly';
import { FlightController } from './FlightController';
import { SAS } from './SAS';
import { StagingManager } from './StagingManager';
import { ScienceManager } from './ScienceManager';
import { AudioManager } from './AudioManager';
import { useFlightStore } from '../ui/stores/flightStore';

/**
 * Top-level flight scene wiring physics + rendering + input. Owns the
 * lifetime of the WebGL canvas and the simulation step.
 */
export class FlightScene {
  scene: SceneManager;
  system: SolarSystem;
  physics: PhysicsEngine;
  planets: PlanetRenderer;
  vessels: VesselRenderer;
  orbits: OrbitRenderer;
  particles: ParticleSystem;
  stars: Starfield;
  map: MapView;
  terrain: TerrainLOD | null = null;
  controller: FlightController;
  sas: SAS;
  staging: StagingManager;
  science: ScienceManager;
  audio: AudioManager;
  active: Vessel | null = null;
  private vesselOrbit: ReturnType<OrbitRenderer['addOrbit']> | null = null;
  private rafId = 0;
  private clock = performance.now();
  private destroyed = false;

  constructor(container: HTMLElement, audio: AudioManager) {
    this.scene = new SceneManager(container);
    this.system = new SolarSystem();
    for (const cfg of SOLAR_SYSTEM_DATA) this.system.addBody(cfg);
    this.system.setUniversalTime(0);

    this.physics = new PhysicsEngine(this.system);
    this.planets = new PlanetRenderer(this.scene.scene);
    this.system.forEach((b) => this.planets.add(b));

    this.vessels = new VesselRenderer(this.scene.scene);
    this.orbits = new OrbitRenderer(this.scene.scene);
    this.particles = new ParticleSystem(this.scene.scene, 2048);
    this.stars = new Starfield(this.scene.scene, 12000);
    this.map = new MapView(this.scene.scene, this.system);

    this.sas = new SAS();
    this.staging = new StagingManager(this.physics);
    this.controller = new FlightController(this.physics, this.sas, this.staging);
    this.controller.attach(window);
    this.controller.onMapToggle = () => this.toggleMap();
    this.controller.onCameraCycle = () => this.scene.cycleCameraMode();
    this.controller.onRecover = () => {};
    this.controller.onWarp = (dir) => this.adjustWarp(dir);

    this.science = new ScienceManager();
    this.audio = audio;

    this.physics.on((e) => {
      const setEvt = useFlightStore.getState().pushEvent;
      switch (e.type) {
        case 'staging': {
          this.audio.staging();
          setEvt('STAGING', `Stage ${e.data?.stage ?? '?'} activated`);
          const dropped = (e.data?.dropped as string[] | undefined) ?? [];
          if (dropped.length && this.active) {
            // Spawn a quick puff of separation smoke at each dropped part
            for (const id of dropped) {
              const c = this.active.partContributions.get(id);
              if (!c) continue;
              const worldPos = this.active.body.position.add(
                this.active.body.orientation.rotate(c.mountPosition),
              );
              this.particles.emit({
                position: worldPos,
                velocity: new Vec3(0, 0, 0),
                life: 0.6,
                size: 4,
                color: '#cccccc',
                spread: 1.5,
                count: 18,
                focus: this.scene.focusPosition,
              });
            }
            this.vessels.removeParts(this.active.id, dropped);
          }
          break;
        }
        case 'crash': {
          this.audio.explosion();
          setEvt('CRASH', `Vessel destroyed at ${(e.data?.speed as number ?? 0).toFixed(1)} m/s`);
          if (this.active) this.particles.explosion(this.active.body.position, this.scene.focusPosition, 1.5);
          break;
        }
        case 'soi-change': {
          setEvt('SOI', `Now in ${e.data?.to}`);
          break;
        }
        case 'flameout': {
          setEvt('FLAMEOUT', 'Engine starved of fuel');
          break;
        }
        case 'ignition': {
          setEvt('IGNITION', 'Engine lit');
          break;
        }
        case 'parachute': {
          setEvt('CHUTE', 'Parachute deployed');
          break;
        }
      }
    });
  }

  /** Attach a vessel built from a VehicleAssembly to the scene. */
  launchAssembly(assembly: VehicleAssembly, parent: CelestialBody): void {
    if (this.active) {
      this.physics.removeVessel(this.active.id);
      this.vessels.remove(this.active.id);
      if (this.vesselOrbit) {
        this.orbits.remove(this.vesselOrbit);
        this.vesselOrbit = null;
      }
    }
    // Pad'in üst yüzeyi yaklaşık radius + 2 m. Roket parçaları kütle merkezinden
    // -3.5 m'e kadar uzanabildiği için kütle merkezini radius + 6 m'e koyuyoruz
    // ki en alt motor pad'in hemen üstünde kalsın.
    const launchPosition = parent.position.add(new Vec3(parent.config.radius + 6, 0, 0));
    const launchOrientation = Quat.fromAxisAngle(new Vec3(0, 0, 1), -Math.PI / 2);
    const v = assembly.buildRuntime(parent, launchPosition, launchOrientation);
    v.body.velocity = new Vec3(0, 0, parent.rotationSpeed);
    v.situation = 'pre-launch';
    v.flags['launch-clamp'] = true;
    this.physics.addVessel(v);
    this.vessels.add(v, assembly.design);
    this.active = v;
    this.controller.setActiveVessel(v);
    if (this.terrain) this.terrain.dispose();
    this.terrain = new TerrainLOD(this.scene.scene, parent);
    this.planets.addLaunchPad(parent.config.id);
    this.scene.cameraDistance = 32;
    this.scene.cameraPhi = Math.PI / 2 - 0.18;
    this.scene.cameraTheta = -Math.PI / 2;
    useFlightStore.getState().pushEvent('LAUNCH', `${v.name} placed on launch pad`);
    useFlightStore.getState().pushEvent('READY', 'Press SPACE to ignite engines, then Z for full throttle');
  }

  toggleMap(): void {
    const enabling = !this.scene.mapMode;
    this.scene.setMapMode(enabling);
    this.map.setVisible(enabling);
    if (enabling && this.active) {
      // Centre map on the vessel itself so the player always sees their own
      // marker. Choose a zoom level that frames the vessel's parent body
      // (close-in view when on/near surface, SOI-fit when in orbit).
      const parent = this.active.parentBody;
      const altitude = this.active.body.position.sub(parent.position).length() - parent.config.radius;
      this.scene.mapTarget = this.active.body.position.clone();
      const soi = isFinite(parent.config.soi) ? parent.config.soi : 1e10;
      if (altitude < parent.config.radius * 0.05) {
        // Surface / very low altitude: frame the planet so vessel + planet
        // both fit on screen with the planet looking sizeable.
        this.scene.mapZoom = Math.max(parent.config.radius * 4, 3e6);
      } else if (altitude < parent.config.radius * 2) {
        // Sub-orbital / low orbit: show the planet plus the orbit.
        this.scene.mapZoom = Math.max((parent.config.radius + altitude) * 3, 5e6);
      } else {
        // High orbit or escape trajectory: show the whole SOI.
        this.scene.mapZoom = Math.max(soi * 1.2, parent.config.radius * 6);
      }
      this.scene.mapTheta = 0;
      this.scene.mapPhi = Math.PI / 2.6;
    }
    useFlightStore.getState().setMapMode(this.scene.mapMode);
    useFlightStore.getState().pushEvent('VIEW', enabling ? 'Map view' : 'Flight view');
  }

  adjustWarp(dir: 1 | -1): void {
    if (!this.active) return;
    const t = this.physics.telemetry(this.active);
    this.physics.warp.step(dir, {
      altitudeAGL: t.altitudeAGL,
      landed: t.situation === 'landed',
      inStableOrbit: t.inStableOrbit,
      mapView: this.scene.mapMode,
    });
  }

  start(): void {
    const loop = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (now - this.clock) / 1000);
      this.clock = now;
      this.controller.update(dt);
      this.physics.tick(dt);
      this.updateRender(dt);
      this.scene.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.controller.detach(window);
    this.scene.dispose();
    if (this.terrain) this.terrain.dispose();
  }

  private updateRender(dt: number): void {
    const t = performance.now() / 1000;
    if (this.active) {
      this.scene.setFocus(this.active.body.position);
    } else {
      const home = this.system.getBody('kerbin');
      if (home) this.scene.setFocus(home.position);
    }
    if (this.active) {
      const localUp = this.active.body.position.sub(this.active.parentBody.position).normalize();
      const fwd = this.active.body.forwardWorld();
      this.scene.updateCamera(this.active.body.position, localUp, fwd);
    } else {
      this.scene.updateCamera(this.scene.focusPosition);
    }
    const sun = this.system.root.position;
    const camWorld = this.scene.focusPosition.add(new Vec3(this.scene.camera.position.x, this.scene.camera.position.y, this.scene.camera.position.z));
    this.planets.update(t, this.scene.focusPosition, sun, camWorld);
    this.vessels.update(this.scene.focusPosition, t);
    this.orbits.update(this.scene.focusPosition);
    if (this.terrain && this.active) this.terrain.update(this.scene.focusPosition, this.active.body.position);
    this.stars.update(t, this.scene.camera.position);

    if (this.active) {
      const tel = this.physics.telemetry(this.active);
      useFlightStore.getState().setTelemetry(tel);

      const parent = this.active.parentBody;
      const relPos = this.active.body.position.sub(parent.position);
      const relVel = this.active.body.velocity.sub(parent.velocity);
      try {
        const elements = stateToElements(relPos, relVel, parent.config.mu);
        if (elements.e < 1) {
          if (!this.vesselOrbit) {
            this.vesselOrbit = this.orbits.addOrbit(elements, parent, 0xffe97a);
          } else {
            this.orbits.updateLine(this.vesselOrbit, elements);
            this.vesselOrbit.line.position.set(parent.position.x - this.scene.focusPosition.x, parent.position.y - this.scene.focusPosition.y, parent.position.z - this.scene.focusPosition.z);
          }
        } else if (this.vesselOrbit) {
          this.orbits.remove(this.vesselOrbit);
          this.vesselOrbit = null;
        }
      } catch {
        /* singular state — skip */
      }

      for (const e of this.active.engines) {
        if (e.firing) {
          const worldDir = this.active.body.orientation.rotate(new Vec3(0, -1, 0));
          const exhaustWorld = this.active.body.position.add(worldDir.mul(2));
          this.particles.emit({
            position: exhaustWorld,
            velocity: worldDir.mul(15 + e.currentThrottle * 25),
            life: 0.3,
            size: 4 + e.currentThrottle * 3,
            color: '#ffd44a',
            spread: 0.2,
            count: 2,
            focus: this.scene.focusPosition,
          });
        }
      }

      const mach = tel.mach;
      if (mach > 0.6 && tel.density > 0.05) {
        this.particles.reentry(this.active.body.position, this.active.body.velocity, this.scene.focusPosition);
      }

      this.audio.setEngineState(this.active.throttle * (tel.thrust > 0 ? 1 : 0), tel.density);
      this.audio.setAmbientState(tel.density, tel.speed);

      if (this.scene.mapMode) {
        this.map.update(this.scene.focusPosition, this.active);
        this.map.applyScreenScale(this.scene.mapCamera, this.scene.renderer.domElement.clientHeight);
      }
    }

    this.particles.update(dt);
  }
}
