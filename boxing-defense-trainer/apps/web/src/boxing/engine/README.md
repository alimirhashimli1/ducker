# `src/boxing/engine/`

## Responsibility

The pure computations of the trainer, each in its own module with one job:
`attackEngine` generates punch sequences, `defenseDetector` classifies a window
of pose frames into a defensive movement, `scoring` turns an attack plus a
detection into points, and `difficulty` decides how hard the next round should
be. Every function here is deterministic and side-effect free — given the same
inputs it returns the same output — which is what makes the trainer testable
without a camera.

## Does NOT contain

Mutable session state or the ordering of the training loop (that is
`../state/`), timers, `setTimeout`/`requestAnimationFrame`, React, DOM access,
webcam or media-stream handling, or tuning constants (`../config/thresholds.ts`).
