# Boxing Defense Trainer

Boxing Defense Trainer is a browser-based boxing defense trainer that uses webcam pose detection to help users practice defensive movement and receive local scoring feedback. The MVP is intentionally local-first: all training logic runs in the browser and there is no backend.

**Status: MVP in progress** — repo hygiene and frontend scaffold complete; no training logic implemented yet.

## Stack

React 19 · TypeScript 6 (strict) · Vite 8 · Tailwind CSS 4 · Framer Motion · ESLint + Prettier

## Repository Structure

```text
boxing-defense-trainer/
├── apps/                  # Product applications
│   └── web/               # React + TypeScript + Vite frontend
│       ├── src/
│       │   ├── pages/         # Top-level screens; compose components + hooks
│       │   ├── components/    # Presentational React, one folder per area
│       │   │   ├── Boxer/         # Sparring partner + incoming-punch telegraph
│       │   │   ├── Webcam/        # Camera stream and its permission/error states
│       │   │   ├── PoseOverlay/   # Skeleton drawn over the feed
│       │   │   ├── TrainingHUD/   # Round, difficulty, timer, session controls
│       │   │   ├── ScoreDisplay/  # Live verdicts and end-of-session summary
│       │   │   └── Countdown/     # Pre-round 3–2–1 beat
│       │   ├── hooks/         # React adapters for the boxing core (effects, timing)
│       │   ├── animations/    # Shared Framer Motion variants
│       │   ├── boxing/        # The domain — zero React imports (lint-enforced)
│       │   │   ├── config/        # thresholds.ts: every tunable number
│       │   │   ├── engine/        # attackEngine, defenseDetector, scoring, difficulty
│       │   │   └── state/         # trainingMachine: phases as a pure reducer
│       │   ├── types/         # Shared vocabulary: attacks, poses, scores, phases
│       │   └── utils/         # Domain-neutral helpers (geometry, formatting)
│       └── tailwind.config.ts # Design tokens — the only place colours are defined
├── services/              # Potential service boundaries
│   └── api/               # Future backend placeholder; not implemented for the MVP
├── docs/                  # Project documentation
│   ├── architecture/      # Architecture documentation and exports
│   └── adr/               # Architecture Decision Records
├── .claude/               # Claude Code project rules
├── docker/                # Future container configuration
├── .github/               # GitHub configuration
│   └── workflows/         # CI workflow definitions
├── .gitignore             # Git exclusions
├── .claudeignore          # Claude Code context exclusions
├── .editorconfig          # Shared editor settings
└── README.md              # Project overview
```

Every folder under `apps/web/src/` carries its own `README.md` describing what belongs in it and what does not.

## Getting started

```bash
cd apps/web
npm install
npm run dev
```

| Script              | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Vite dev server                             |
| `npm run build`     | Type-check (`tsc -b`) then production build |
| `npm run preview`   | Serve the production build                  |
| `npm run typecheck` | Type-check only                             |
| `npm run lint`      | ESLint, including the architecture rules    |
| `npm run format`    | Prettier write                              |

## Ground rules

Read [Claude Code rules](.claude/RULES.md) before making changes — it defines the SOLID expectations, the framework-agnostic boxing core, the ~150-line component limit and the no-magic-numbers rule. The frontend layout is documented in [docs/architecture/frontend-structure.md](docs/architecture/frontend-structure.md), and decisions are recorded in [Architecture Decision Records](docs/adr/).
