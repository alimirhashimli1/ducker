# `src/boxing/`

## Responsibility

The entire boxing domain, as a framework-agnostic TypeScript library: attack
generation, defense detection from pose data, scoring, difficulty progression
and the training state machine. Everything in here is a pure function or a
plain object over the types in `src/types/`, which makes the rules of the game
testable in isolation, without a browser, a canvas or a renderer. The UI layer
consumes this folder; this folder knows nothing about the UI layer.

## Does NOT contain

React — no imports of `react`, `react-dom` or `framer-motion`, enforced by
`no-restricted-imports` in `eslint.config.js`. No JSX, no hooks, no DOM or
`window`/`document` access, no canvas drawing, no webcam or media-device code,
no direct calls to a pose-detection SDK (pose data arrives as `PoseFrame`
values). No tuning constants inline — those belong in `config/thresholds.ts`.
