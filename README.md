# Serbal Kpace — Browser-Based 3D Space Simulation Game

A browser-based 3D rocket-building and space-exploration simulator inspired by Kerbal Space Program.

## Features

- **Real physics** — N-body gravity (patched conics), atmospheric drag, rocket equation
- **Modular rocket assembly** — Drag-and-drop parts editor with realistic mass, thrust, and fuel simulation
- **Procedural solar system** — 13 planetary bodies with unique atmospheres, terrain, and orbital parameters
- **Full browser delivery** — WebGL via Three.js, no plugins
- **Career mode** — Funds, contracts, science tree, reputation
- **Modern UI** — KSP-inspired HUD with navball, map view, and maneuver nodes

## Tech Stack

- Three.js r165+ (WebGL2 rendering, custom GLSL shaders)
- React 18 + Zustand (UI / state)
- Custom TypeScript physics engine (50Hz fixed-step)
- Vite 5 + TypeScript 5 (build)
- Howler.js (audio)
- IndexedDB (saves)

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Controls

| Input | Action |
|---|---|
| W / S | Pitch up / down |
| A / D | Yaw left / right |
| Q / E | Roll CCW / CW |
| Shift / Ctrl | Throttle up / down |
| Z / X | Full throttle / Cut throttle |
| Space | Stage |
| T | Toggle SAS |
| R | Toggle RCS |
| M | Toggle map view |
| Tab | Cycle camera mode |
| , / . | Time warp - / + |
| Backspace | Recover vessel |

## Project Structure

```
src/
├── physics/    # Orbital mechanics, drag, rocket equation
├── rendering/  # Three.js scene, planets, vessels, particles
│   └── shaders/
├── editor/     # VAB part assembly, delta-V calc
├── game/       # Flight controller, staging, mission, career
├── ui/         # React HUD, map view, navball
│   ├── components/
│   └── stores/
├── data/       # JSON: parts, bodies, missions
└── workers/    # Terrain generation worker
```
