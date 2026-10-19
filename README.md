# GRIDLOCK LAB — Interactive Traffic Deadlock Simulation

[![Vitest Tests](https://img.shields.io/badge/Vitest-Passing-2FBF71?style=flat-square)](./tests/core.test.ts)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Mode-3178C6?style=flat-square)](./tsconfig.json)
[![Offline Fonts](https://img.shields.io/badge/Fonts-Offline%20Bundled-E8664A?style=flat-square)](./package.json)

> **Course**: Operating Systems (**BACSE106**) · Module 2: Deadlock Management · DA-2  
> **Topic**: Analyzing and Resolving Physical Traffic Gridlocks at Urban Intersections  
> **Team**: **Group 03 | Team 13**  
> • B Priyadarshan (`25BLC1180`)  
> • U Sudharson (`25BLC1053`)  
> • E Sharukesh (`25BLC1125`)

---

## 🚦 Overview

**Gridlock Lab** is a live, interactive, projector-ready simulation demonstrating the theory of Operating System Deadlocks through the physical analogy of urban traffic gridlocks at narrow four-way intersections.

Built strictly with **Vite + TypeScript + HTML5 Canvas 2D**, the application is completely self-contained with offline fonts, zero game engines, zero external frameworks, and zero CDN dependencies.

### Key Demonstrations:
1. **The Fundamental Failure**: Simultaneous 4-vehicle arrival in Left-Hand Traffic resulting in the classic **A → B → C → D → A** circular wait deadlock.
2. **The "Break a Condition" Lab**: Interactive toggle matrix allowing the user to break any of the 4 Coffman conditions live (Flyover, Exit-Clear Rule, Police Preemption, Ordered Entry) and watch the deadlock dissolve.
3. **Four Traffic Coordination Modes**:
   - **Uncontrolled**: Greedy entry producing natural circular wait.
   - **Fixed-Time Signal**: 3-lamp heads demonstrating spillback gridlock when downstream exit lanes are blocked.
   - **Roundabout**: Clockwise flow demonstrating high throughput but vulnerability to ring saturation.
   - **Proposed Controller**: Slide 9 Exit-Clear Reservation Controller with atomic path reservation breaking **Hold-and-Wait**.
4. **5-Step Recovery Machine**: Slide 7 state machine executing *Detect → Stop Entry → Safe Manual Control (Victim Selection) → Clear Zones & Reroute → Restore Normal Coordination*.
5. **Head-to-Head 2×2 Benchmark**: Synchronized live simulation of all 4 modes on identical seeded arrival traffic with pure-canvas bar charts and PNG export.
6. **Live Code Debugger**: Line-by-line execution highlighting of Slide 9 pseudocode in IBM Plex Mono.

---

## 🛠️ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Run headless unit test suite
npm test

# 4. Build offline static production bundle (dist/)
npm run build
```

---

## 🎯 Keyboard Shortcuts

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Play / Pause Simulation |
| <kbd>→</kbd> | Step one tick forward |
| <kbd>R</kbd> | Reset current scenario (seeded determinism) |
| <kbd>1</kbd> – <kbd>8</kbd> | Jump directly to Scenarios 1 through 8 |
| <kbd>H</kbd> | Toggle **Presenter Mode** (hides chrome, maximizes stage) |
| <kbd>F</kbd> | Toggle Fullscreen |
| <kbd>D</kbd> | Spawn 4 simultaneous straight-moving vehicles |
| <kbd>B</kbd> | Toggle South exit downstream blockage |
| <kbd>Y</kbd> | Toggle Yellow-Box rule (Hold-and-Wait break) |
| <kbd>[</kbd> / <kbd>]</kbd> | Decrease / Increase simulation speed (0.25x to 4x) |
| <kbd>0</kbd> | Open Conclusion & References (Slide 10) |
| <kbd>?</kbd> | Open Keyboard Shortcuts Reference |

---

## 📂 Architecture

```
Operating_System_Presentation/
├── index.html                   # Control-room UI chrome & modals
├── package.json                 # Dependencies & scripts
├── tsconfig.json                # TypeScript strict configuration
├── vite.config.ts               # Vite bundler configuration (relative base)
├── docs/
│   └── PRESENTER_GUIDE.md       # 5-6 min run-of-show & defense Q&A
├── tests/
│   └── core.test.ts             # Vitest test suite (invariants, cycles, determinism)
└── src/
    ├── main.ts                  # Application bootstrap & DOM coordinator
    ├── audio/
    │   └── sound.ts             # Procedural WebAudio synthesizer (no assets)
    ├── styles/
    │   ├── theme.css            # Palette tokens & @fontsource imports
    │   └── layout.css           # Control room layout & component styling
    ├── render/
    │   ├── CanvasRenderer.ts    # HiDPI 2D canvas intersection & vehicle renderer
    │   ├── RAGRenderer.ts       # Bipartite graph & wait-for cycle renderer
    │   ├── MetricsRenderer.ts   # Rolling sparkline canvas charts
    │   └── ComparisonManager.ts # 2x2 synchronized comparison runner
    └── sim/
        ├── types.ts             # Core domain models, interfaces & states
        ├── prng.ts              # Deterministic Mulberry32 PRNG
        ├── geometry.ts          # 1000x1000 coordinate space & paths
        ├── rag.ts               # Bipartite RAG & DFS cycle detector
        ├── coffman.ts           # 4 Coffman conditions live evaluator
        ├── recovery.ts          # 5-Step recovery state machine
        ├── scenarios.ts         # Preset presentation scenarios 1 to 8
        ├── Simulation.ts        # Pure TypeScript headless engine
        └── controllers/
            ├── Controller.ts           # Controller interface
            ├── UncontrolledController.ts # Greedy first-quadrant entry
            ├── SignalController.ts     # 2-Phase fixed time signal
            ├── RoundaboutController.ts # Clockwise flow with yield-at-entry
            └── ProposedController.ts   # Slide 9 exit-clear reservation
```

---

## 📖 Presentation Guide

For complete slide-by-slide scripts, anticipated professor questions, and answers, refer to [docs/PRESENTER_GUIDE.md](./docs/PRESENTER_GUIDE.md).
