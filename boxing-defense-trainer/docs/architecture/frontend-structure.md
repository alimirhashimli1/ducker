# Frontend structure

The canonical layout of `apps/web/src/`. Every folder listed here carries its
own `README.md` stating its single responsibility and an explicit "does NOT
contain" line, per [`.claude/RULES.md`](../../.claude/RULES.md).

## Layering

```
pages/  →  components/  →  hooks/  →  boxing/  →  types/
                    ↘  animations/      ↘  utils/
```

Dependencies point one way only. `boxing/` is the framework-agnostic core and
knows nothing about React; `hooks/` is the only adapter between that core and
the render layer. If a change requires an arrow to point backwards, the code is
in the wrong folder.

## Folders

```text
apps/web/
├── index.html                  # Vite entry document
├── vite.config.ts              # Vite + React + Tailwind plugins
├── tailwind.config.ts          # Design tokens (theme.extend) — the only place colours are defined
├── eslint.config.js            # Architecture rules enforced as lint errors
├── .prettierrc.json            # Formatting
├── tsconfig.app.json           # Strict TS for src/
├── tsconfig.node.json          # Strict TS for config files
└── src/
    ├── main.tsx                # React root
    ├── App.tsx                 # App shell: picks the page, hosts providers
    ├── index.css               # Tailwind entry + global element defaults
    ├── pages/                  # Top-level screens; compose components + hooks
    │   └── TrainerPage.tsx
    ├── components/             # Presentational React, one folder per area
    │   ├── Boxer/              # Sparring partner + incoming-punch telegraph
    │   ├── Webcam/             # Camera stream and its permission/error states
    │   ├── PoseOverlay/        # Skeleton drawn over the feed
    │   ├── TrainingHUD/        # Round, difficulty, timer, session controls
    │   ├── ScoreDisplay/       # Live verdicts and end-of-session summary
    │   └── Countdown/          # Pre-round 3–2–1 beat
    ├── hooks/                  # React adapters for the boxing core (effects, timing)
    ├── animations/             # Shared Framer Motion variants
    ├── boxing/                 # THE DOMAIN — zero React imports (lint-enforced)
    │   ├── config/             # thresholds.ts: every tunable number
    │   ├── engine/             # attackEngine, defenseDetector, scoring, difficulty
    │   ├── state/              # trainingMachine: phases as a pure reducer
    │   └── index.ts            # Public surface the UI imports from
    ├── types/                  # Shared vocabulary: attacks, poses, scores, phases
    └── utils/                  # Domain-neutral helpers (geometry, formatting)
```

## Enforcement

Two rules from `RULES.md` are enforced by `eslint.config.js` rather than by
review:

- `src/boxing/**` may not import `react`, `react-dom` or `framer-motion`
  (`no-restricted-imports`).
- `any` is an error (`@typescript-eslint/no-explicit-any`), and the disable
  comment that overrides it must carry a `-- reason` description
  (`@eslint-community/eslint-comments/require-description`).
