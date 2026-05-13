# Orbital — Browser-Based 3D Space Simulation Game
### Game Design Document & Technical Project Plan

---

## 1. Vision Statement

**Orbital** is a browser-based 3D rocket-building and space-exploration simulation inspired by Kerbal Space Program and Juno: New Origins. Players design and assemble rockets from modular parts, fly them through a physically simulated solar system, achieve orbit, land on alien worlds, and build a space program from scratch — all without installing anything.

**Core pillars:**
- **Real physics, approachable controls** — N-body gravity, atmospheric drag, rocket equation, all simplified for fun without sacrificing accuracy
- **Modular rocket assembly** — drag-and-drop parts editor with realistic mass, thrust, and fuel simulation
- **Procedural solar system** — multiple planets with unique atmospheres, terrain, and orbital parameters
- **Full browser delivery** — WebGL via Three.js, no plugins, playable on any modern desktop browser

---

## 2. Core Gameplay Loop

```
Design Rocket → Pre-launch Checklist → Launch & Fly → 
Achieve Mission Goal → Collect Science/Funds → 
Upgrade Parts → Design Next Rocket → ...
```

### 2.1 Game Modes

| Mode | Description |
|---|---|
| **Sandbox** | Unlimited parts, no funds, free exploration |
| **Career** | Start with basic parts, earn funds from missions, unlock tech tree |
| **Science** | No funds, earn science points to unlock parts |
| **Challenge** | Community-set missions with leaderboards |

---

## 3. Physics Engine Design

This is the heart of the game. All physics run at a fixed timestep (50Hz) and can be time-warped.

### 3.1 Orbital Mechanics

**Patched Conic Approximation** (same approach as KSP):
- Each celestial body defines a Sphere of Influence (SOI)
- Inside an SOI, only that body's gravity acts on the vessel
- Transitions between SOIs are computed by patching the conic sections
- This avoids the computational cost of true N-body simulation while remaining accurate enough for gameplay

**Key equations implemented:**
- Vis-viva: `v² = GM(2/r - 1/a)` — orbital speed at any point
- Hohmann transfer calculations for maneuver nodes
- Escape velocity: `v_e = √(2GM/r)`
- Kepler's laws for orbit prediction/rendering

### 3.2 Rocket Physics

- **Tsiolkovsky Rocket Equation:** `Δv = Isp × g₀ × ln(m₀/m_f)`
- **Thrust-to-Weight Ratio (TWR):** Must exceed 1.0 to leave the ground
- **Specific Impulse (Isp):** Varies per engine, degrades in atmosphere vs vacuum
- **Staging:** Multi-stage rockets drop spent stages to reduce mass
- **Center of Mass / Center of Thrust / Center of Pressure:** Visualized in editor; misalignment causes spin/instability

### 3.3 Atmospheric Model

Each planet with an atmosphere uses a simplified exponential pressure curve:

```
P(h) = P₀ × e^(-h / H)
```

Where `H` is the scale height (unique per planet). Drag force:

```
F_drag = 0.5 × ρ(h) × v² × Cd × A
```

- `ρ(h)` = air density at altitude h
- `Cd` = drag coefficient of the vessel (sum of parts)
- `A` = cross-sectional area

Reentry heating is visual only in v1.0 (particle effects + color shift); structural damage from heating added in v1.1.

### 3.4 Time Warp

| Warp Level | Factor | Constraint |
|---|---|---|
| 1× | Real time | Always available |
| 5× | 5× | Always available |
| 50× | 50× | Must be in stable orbit |
| 1000× | 1000× | Must be in stable orbit |
| 10,000× | 10,000× | Must be in SOI transition or deep space |
| 100,000× | 100,000× | Deep space only |

---

## 4. Vehicle Assembly Editor (VAB)

The Vehicle Assembly Building is where players build rockets.

### 4.1 Interface Layout

```
┌─────────────────────────────────────────────────────┐
│  TOOLBAR: [ Save ] [ Load ] [ Launch ] [ Settings ] │
├──────────┬──────────────────────────────────┬───────┤
│  PARTS   │                                  │  INFO │
│  PANEL   │      3D VIEWPORT                 │  PANEL│
│          │   (drag & attach parts here)     │       │
│ ○ Engines│                                  │ Mass: │
│ ○ Tanks  │                                  │ TWR:  │
│ ○ Command│                                  │ Δv:   │
│ ○ Struct │                                  │ Cost: │
│ ○ Aero   │                                  │       │
│ ○ Science│                                  │ [CG]  │
│ ○ Landing│                                  │ [CT]  │
│          │                                  │ [CP]  │
└──────────┴──────────────────────────────────┴───────┘
```

### 4.2 Part Attachment System

- Parts snap to **attachment nodes** (defined in part config)
- Symmetry modes: 1×, 2×, 3×, 4×, 6×, 8×
- Radial attach for surface-mounted parts
- Undo/Redo stack (Ctrl+Z / Ctrl+Y)

### 4.3 Part Categories & Key Parts (v1.0 roster)

**Command Modules**
- MK1 Capsule (1 kerbal, 0.84t)
- MK1-2 Capsule (3 kerbals, 2.7t)
- Probe Core (unmanned, 0.1t)

**Engines**
- LV-T30 "Reliant" — 215kN, Isp 270s/310s (atm/vac)
- LV-T45 "Swivel" — 200kN, gimbaled ±3°, Isp 250s/320s
- LV-909 "Terrier" — 60kN vacuum engine, Isp 85s/345s
- Nerv "Atomic Rocket Motor" — 60kN, Isp 185s/800s
- Poodle — 250kN, twin-bell vacuum engine
- Solid Rocket Booster (SRB) — 315kN, non-throttleable

**Fuel Tanks** (Liquid Fuel + Oxidizer by default)
- FL-T100, FL-T200, FL-T400, FL-T800
- Mk1 Fuselage (inline)
- Mk3 Fuselage (spaceplane)

**Structural & Aerodynamic**
- Decouplers / Separators (staging)
- Fairings (protects payload during ascent)
- Nose Cones, Tail Fins
- Struts (rigidizes joints)
- Launch Clamps

**Landing & Recovery**
- Parachutes (drogue + main)
- Landing Legs (retractable)
- Airbags

**Science**
- Thermometer, Barometer
- Mystery Goo Experiment
- Materials Bay
- Antenna (for transmitting data)

---

## 5. Flight Controls & Instrumentation

### 5.1 Control Scheme

| Input | Action |
|---|---|
| W / S | Pitch up / down |
| A / D | Yaw left / right |
| Q / E | Roll CCW / CW |
| Shift / Ctrl | Throttle up / down |
| Z / X | Full throttle / Cut throttle |
| Space | Stage / Activate next stage |
| T | Toggle SAS (stability) |
| R | Toggle RCS |
| F | Full brakes |
| 1–0 | Throttle presets |
| , / . | Time warp decrease / increase |
| M | Toggle map view |
| Tab | Switch camera mode |
| Backspace | Recover / Return to Space Center |

### 5.2 Navball

The navball is the primary orientation instrument, always visible during flight:

- **Prograde** (yellow circle) — direction of velocity
- **Retrograde** (yellow circle with ×) — opposite of velocity
- **Normal / Anti-normal** — perpendicular to orbital plane
- **Radial in / out** — toward/away from planet center
- **Target markers** — when a target is selected
- **Maneuver node marker** — burn direction indicator

### 5.3 Instrument Panels

Left HUD:
- Altitude (AGL / ASL toggle)
- Vertical speed
- Horizontal speed
- Mach number / atmospheric density indicator

Right HUD:
- Throttle bar
- Stage Δv remaining
- Total Δv remaining
- Fuel levels (LF / Ox / Mono / EC)
- G-force meter

### 5.4 Map View

Full 3D solar system map:
- All bodies, orbits, SOI bubbles rendered
- Vessel trajectory shown as predicted conic
- Maneuver node creation: click orbit → drag handles for prograde/normal/radial Δv
- Encounter/intercept prediction patches
- Time warp available here

---

## 6. Celestial Bodies

### 6.1 Star: Kerbol (or custom star)

Central body, acts as gravity reference. No landing possible.

### 6.2 Planet Roster (v1.0)

| Body | Type | Atm | Gravity | Highlights |
|---|---|---|---|---|
| **Moho** | Rocky, innermost | None | 2.70 m/s² | Very hot, extreme Δv to reach |
| **Eve** | Venus-analog | Dense (5 atm) | 16.7 m/s² | Beautiful purple oceans, nearly impossible to return from |
| **Kerbin** | Earth-analog | 1 atm | 9.81 m/s² | Home planet, ocean, continents |
| **Mun** | Kerbin's moon | None | 1.63 m/s² | First major milestone |
| **Minmus** | Small moon | None | 0.49 m/s² | Very low gravity, great staging base |
| **Duna** | Mars-analog | Thin (0.06 atm) | 2.94 m/s² | Red planet, parachutes work (barely) |
| **Ike** | Duna's moon | None | 1.10 m/s² | Irregular shape, co-orbital with Duna |
| **Jool** | Gas giant | Very dense | 7.85 m/s² | Can't land; 5 moons to explore |
| **Laythe** (Jool moon) | Ocean world | 0.8 atm | 7.85 m/s² | Liquid water, can use jet engines here |
| **Vall** | Ice world | None | 2.31 m/s² | Frozen surface |
| **Tylo** | Large moon | None | 7.85 m/s² | Same gravity as Kerbin, no atm = brutal |
| **Bop** | Rubble moon | None | 0.589 m/s² | Irregular, eccentric orbit |
| **Pol** | Small rubble moon | None | 0.373 m/s² | Tiny, very low Δv |

### 6.3 Planet Rendering

Each planet uses:
- **WebGL procedural sphere** with normal maps
- **Procedural terrain** via noise heightmap (Three.js ShaderMaterial)
- **Atmosphere shader** — Rayleigh scattering approximation (single-pass)
- **LOD system** — terrain mesh subdivides as vessel approaches
- **Biome map** — determines science experiment results

---

## 7. Science System

### 7.1 Science Points

Collected by running experiments in different situations:
- Situations: Landed, Splashed Down, Flying Low, Flying High, In Space Low, In Space High
- Locations: Each biome of each body is unique

Science formula: `Science = baseValue × situationMultiplier × biomeMultiplier × recoveryFactor`

### 7.2 Technology Tree

Nodes organized into 5 tiers:
- Tier 1: Basic Rocketry (starting parts)
- Tier 2: General Rocketry (more engines, tanks)
- Tier 3: Advanced Rocketry (nuclear, high-performance)
- Tier 4: High Altitude Flight / Rocketry
- Tier 5: Advanced Exploration (ISRU, asteroid mining)

---

## 8. Technical Architecture

### 8.1 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Rendering** | Three.js r165+ | WebGL 3D scene, shaders, LOD |
| **Physics** | Custom TypeScript engine | Orbital mechanics, rigid body |
| **UI** | React 18 + Zustand | HUD, menus, editor panels |
| **Terrain** | Custom WebWorker + noise | Procedural generation off main thread |
| **Audio** | Howler.js | Spatial audio, engine sounds |
| **Networking** | Cloudflare Workers + KV | Leaderboards, cloud saves |
| **Build** | Vite 5 + TypeScript 5 | Fast bundling, strict types |
| **Testing** | Vitest + Playwright | Unit + E2E |

### 8.2 Repository Structure

```
orbital/
├── src/
│   ├── physics/
│   │   ├── OrbitalMechanics.ts       # Conic sections, SOI, patched conics
│   │   ├── AtmosphericDrag.ts        # Drag model, density curves
│   │   ├── RocketEquation.ts         # Δv, TWR, staging calculator
│   │   ├── RigidBody.ts              # 6DOF rigid body integrator
│   │   ├── CollisionDetection.ts     # Sphere-terrain collision
│   │   └── TimeWarp.ts               # Fixed-step with warp scaling
│   ├── rendering/
│   │   ├── SceneManager.ts           # Three.js scene, camera rigs
│   │   ├── PlanetRenderer.ts         # Sphere mesh, atmosphere shader
│   │   ├── TerrainLOD.ts             # Adaptive mesh subdivision
│   │   ├── VesselRenderer.ts         # Part mesh assembly at runtime
│   │   ├── OrbitRenderer.ts          # Conic section line rendering
│   │   ├── ParticleSystem.ts         # Exhaust, reentry glow, explosions
│   │   └── shaders/
│   │       ├── atmosphere.glsl       # Rayleigh scatter
│   │       ├── terrain.glsl          # Normal map, biome blend
│   │       └── exhaust.glsl          # Engine plume shader
│   ├── editor/
│   │   ├── VehicleAssembly.ts        # Part graph, attachment logic
│   │   ├── SymmetryController.ts     # Symmetry mode handling
│   │   ├── PartDatabase.ts           # Part definitions loader
│   │   └── DeltaVCalculator.ts       # Stage-by-stage Δv
│   ├── game/
│   │   ├── SpaceCenter.ts            # Main menu / facility hub
│   │   ├── FlightController.ts       # Input → physics bridge
│   │   ├── StagingManager.ts         # Stage sequencing, decoupler events
│   │   ├── MissionControl.ts         # Mission objectives, contracts
│   │   ├── ScienceManager.ts         # Experiment collection, transmission
│   │   └── CareerManager.ts          # Funds, reputation, tech tree
│   ├── ui/
│   │   ├── components/
│   │   │   ├── Navball.tsx           # SVG navball with markers
│   │   │   ├── Altimeter.tsx
│   │   │   ├── FuelGauge.tsx
│   │   │   ├── StageIndicator.tsx
│   │   │   ├── MapView.tsx           # 3D orbit map
│   │   │   ├── ManeuverNode.tsx      # Drag handles for Δv
│   │   │   └── PartTooltip.tsx
│   │   └── stores/
│   │       ├── flightStore.ts        # Real-time telemetry state
│   │       ├── editorStore.ts        # VAB state
│   │       └── gameStore.ts          # Career/science progress
│   ├── data/
│   │   ├── parts/                    # JSON part configs
│   │   ├── bodies/                   # Planet orbital parameters
│   │   └── missions/                 # Contract templates
│   └── workers/
│       ├── terrainGen.worker.ts      # Noise generation in WebWorker
│       └── physics.worker.ts         # (v2) Physics on separate thread
├── public/
│   ├── models/                       # GLTF part meshes
│   ├── textures/                     # Planet textures, normal maps
│   └── audio/
├── tests/
├── docs/
└── vite.config.ts
```

### 8.3 Physics Loop

```typescript
// Main game loop (simplified)
class PhysicsEngine {
  readonly FIXED_DT = 0.02; // 50 Hz
  private accumulator = 0;

  tick(realDeltaTime: number, warpFactor: number) {
    const simDeltaTime = realDeltaTime * warpFactor;
    this.accumulator += simDeltaTime;

    while (this.accumulator >= this.FIXED_DT) {
      this.integrate(this.FIXED_DT);
      this.accumulator -= this.FIXED_DT;
    }

    // Interpolate render state
    const alpha = this.accumulator / this.FIXED_DT;
    this.interpolateRenderState(alpha);
  }

  private integrate(dt: number) {
    for (const vessel of this.vessels) {
      const gravity = this.computeGravity(vessel);
      const drag = this.computeDrag(vessel);
      const thrust = this.computeThrust(vessel);
      const totalForce = gravity.add(drag).add(thrust);
      vessel.applyForce(totalForce, dt);
      this.checkSOITransition(vessel);
      this.checkCollision(vessel);
    }
  }
}
```

### 8.4 Part System Design

Each part is defined by a JSON config:

```json
{
  "id": "engine.lv-t45",
  "name": "LV-T45 Swivel",
  "category": "engines",
  "mass": 1.5,
  "cost": 1200,
  "thrustAtm": 167.97,
  "thrustVac": 200.0,
  "ispAtm": 250,
  "ispVac": 320,
  "gimbalRange": 3,
  "propellants": { "liquidFuel": 0.9, "oxidizer": 1.1 },
  "attachNodes": [
    { "id": "top",   "position": [0,  0.5, 0], "size": 1 },
    { "id": "bottom", "position": [0, -0.5, 0], "size": 1 }
  ],
  "mesh": "models/engine_swivel.glb",
  "techRequired": "basicRocketry"
}
```

---

## 9. Development Roadmap

### Phase 0: Prototype (Weeks 1–4)
**Goal:** Prove the core physics works in browser.

- [ ] Set up Vite + TypeScript + Three.js project
- [ ] Implement orbital mechanics core (Kepler equations, vis-viva)
- [ ] Single planet (Kerbin) with gravity
- [ ] Simple rocket: one part, thrust, gravity
- [ ] Basic navball (orientation display)
- [ ] Verify Δv calculations against known values
- [ ] Stable 60fps render loop with fixed physics step

**Deliverable:** A capsule that can launch, achieve orbit, and de-orbit. No UI polish.

---

### Phase 1: Foundation (Weeks 5–12)
**Goal:** Playable vertical slice — one rocket, one planet, orbit and land.

- [ ] **Editor:** Drag-and-drop part assembly with 5 part types
- [ ] **Staging:** Multi-stage decoupler system
- [ ] **Atmosphere:** Drag model, Mach effects
- [ ] **SAS:** Stability Assist System (holds orientation)
- [ ] **Map View:** 3D orbit display with SOI boundary
- [ ] **Terrain:** Procedural Kerbin terrain with basic LOD
- [ ] **Mun:** First target body (no atmosphere)
- [ ] **Parachutes:** Atmospheric descent recovery
- [ ] **Camera Modes:** Orbital, chase, free look
- [ ] **Navball:** Full working navball with all markers
- [ ] **Basic HUD:** Altitude, speed, fuel, stage info

**Deliverable:** Land on the Mun and return. Share-able link to the prototype.

---

### Phase 2: Core Feature Complete (Weeks 13–24)
**Goal:** Full solar system, science system, career mode.

- [ ] All 13 planetary bodies with correct parameters
- [ ] Planet atmosphere shaders (Rayleigh scattering)
- [ ] Patched conics (multi-SOI trajectory prediction)
- [ ] Maneuver node editor (drag to set Δv burns)
- [ ] Full part roster (~40 parts)
- [ ] Science experiments + biome system
- [ ] Tech tree (5 tiers, 40 nodes)
- [ ] Career mode: funds, contracts, reputation
- [ ] KSC facilities: VAB, launchpad, runway, tracking station
- [ ] Vessel recovery / funds reward
- [ ] Crew management (kerbals with names)
- [ ] Terrain LOD per-planet
- [ ] Audio: engine sounds, ambient, music
- [ ] Save/Load system (IndexedDB + cloud)

**Deliverable:** Beta release. Full career playthrough possible.

---

### Phase 3: Polish & Expansion (Weeks 25–36)
**Goal:** Retention, quality, community features.

- [ ] Reentry heating (visual + structural damage)
- [ ] Fairings with procedural shell geometry
- [ ] Docking ports + orbital rendezvous
- [ ] Space stations (persistent vessels in orbit)
- [ ] ISRU (mining resources on moons)
- [ ] Robotics parts (hinges, pistons)
- [ ] Challenge mode + leaderboards
- [ ] Craft sharing (upload/download vessel designs)
- [ ] Performance optimization (WebGPU upgrade path)
- [ ] Mobile support (touch controls, simplified renderer)
- [ ] Accessibility (colorblind modes, key remapping)

---

### Phase 4: Live Service (Month 9+)
- Content updates: new parts, missions, community challenges
- Multiplayer exploration (see each other's vessels in map view)
- Mod support (custom parts via JSON + GLTF upload)
- Steam/Epic release as Electron wrapper
- Native mobile app (React Native with WGPU)

---

## 10. Performance Targets

| Metric | Target |
|---|---|
| Frame rate | 60fps on mid-range GPU (GTX 1060 / RX 580) |
| Initial load | < 8 seconds on 10 Mbps connection |
| Physics tick | < 2ms per frame budget |
| Memory usage | < 512MB RAM |
| Draw calls | < 200 per frame during flight |
| Terrain triangles | < 500K visible per frame |

### Key Optimizations
- **Instanced mesh rendering** for repeated parts on large rockets
- **WebWorkers** for terrain generation (never blocks main thread)
- **Frustum culling** — only render what the camera can see
- **Level of Detail (LOD)** — terrain, planet meshes, part meshes
- **Orbit caching** — pre-compute conic sections, don't recalculate every frame
- **Physics culling** — far-away vessels simulate at lower frequency

---

## 11. Asset Requirements

### 3D Models (GLTF format)
- ~40 part meshes (command pods, engines, tanks, structural)
- 13 planetary body base meshes (UV-spheres, high-res for close approach)
- Space center facility models
- Kerbal character model (LOD: detailed for IVA, simple for EVA)

### Textures
- Planet surface textures: albedo, normal, roughness (4K)
- Biome masks (2K per planet)
- Part textures: albedo, metalness, normal (1K per part)
- Cloud layer textures (planets with atmosphere)

### Audio
- Engine sounds per engine type (layered: idle, throttle up, max)
- Ambient: space (silence), reentry (rumble), atmosphere (wind)
- UI sounds: staging, decoupler, parachute deploy
- Music: 4 tracks (exploration, launch, tension, success)

### Shaders (GLSL)
- Atmospheric scattering (Rayleigh + Mie)
- Terrain with biome blending
- Engine plume (heat distortion effect)
- Reentry heating glow
- Space skybox with star field

---

## 12. Monetization Strategy

**Free to play, premium one-time purchase:**
- **Free tier:** Sandbox mode, 3 planets (Kerbin, Mun, Duna), 20 parts, local saves
- **Orbital Pro ($14.99):** Full solar system, all 40+ parts, career mode, cloud saves, craft sharing
- **No gacha, no battle pass, no ads**

**Reasoning:** KSP's success came from being genuinely good, not monetization pressure. One fair price builds the community needed for longevity.

---

## 13. Team & Tooling

### Ideal Small Team (Solo → 4 people)
| Role | Responsibilities |
|---|---|
| Lead Developer | Physics engine, architecture |
| Frontend Dev | React UI, editor, HUD |
| 3D Artist | Part models, planet textures |
| Game Designer | Part balance, mission design, tech tree |

### Development Tools
- **Code:** VS Code + TypeScript strict mode
- **3D:** Blender (modeling), Substance Painter (textures)
- **Version control:** Git + GitHub
- **CI/CD:** GitHub Actions → Cloudflare Pages
- **Monitoring:** Sentry (errors), PostHog (analytics)
- **Issue tracking:** Linear

---

## 14. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Physics engine too slow in browser | Medium | High | Profile early; use WebWorkers; consider WebAssembly (Rust) for inner loop |
| Terrain generation stuttering | High | Medium | All generation in WebWorkers; pre-generate near KSC at load |
| Scope creep | High | High | Strict MVP definition; public roadmap; say no |
| Part balance requiring constant tuning | Medium | Medium | Data-driven JSON configs; community feedback |
| WebGL compatibility (old browsers) | Low | Low | Require WebGL2; show compatibility warning |
| Memory leaks in long sessions | Medium | Medium | Three.js dispose() calls; scene graph audits |

---

## 15. Milestone Summary

| Milestone | ETA | Key Feature |
|---|---|---|
| M0 — Physics Proof | Week 4 | Orbit the planet |
| M1 — Alpha | Week 12 | Land on the Mun |
| M2 — Beta | Week 24 | Full solar system + career |
| M3 — 1.0 Launch | Week 36 | Polish, leaderboards, craft sharing |
| M4 — 1.1 | Month 12 | Docking, space stations, ISRU |
| M5 — 2.0 | Month 18 | Multiplayer, mod support |

---

*Document version: 1.0 — Initial planning draft*
*Last updated: May 2026*
