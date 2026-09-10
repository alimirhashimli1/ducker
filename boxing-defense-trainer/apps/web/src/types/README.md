# `src/types/`

## Responsibility

Shared TypeScript types for the whole application: the vocabulary that the
boxing domain, the React layer and the utilities all agree on. A type used by
more than one folder belongs here, declared exactly once and imported
everywhere else, so there is a single definition of what an "Attack" or a
"Pose" is.

| File          | Holds                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| `boxing.ts`   | Stance, punches, defenses, difficulty, mode, and the scoring vocabulary.  |
| `training.ts` | The training loop's states, the session shape, and the round accumulator. |
| `pose.ts`     | Landmarks and frames, defined on our terms rather than a detector SDK's.  |
| `index.ts`    | The barrel. Import from `../types`, not from a file inside.               |

Two conventions worth knowing:

- **Punches are named by role, not by side.** `leadHook`, never `leftHook` —
  which hand throws it depends on stance, so the label stays stance-relative and
  `resolveForStance()` in `src/boxing/attacks.ts` mirrors it on demand.
- **`pose.ts` is a deliberate abstraction barrier.** Nothing outside the detector
  adapter may import MediaPipe's or TensorFlow's types. The domain depends on
  `PoseLandmarks`; the adapter maps the vendor down to it. Swapping detectors is
  then a change to one file (Dependency Inversion, per `.claude/RULES.md`).

## Does NOT contain

Runtime code of any kind. No functions, no classes, no constants, no `enum`
(use string literal unions instead — they erase at compile time). The barrel
uses `export type *`, so a value declared here would not even be re-exported.
Initial values live with the module that owns them: `emptyRoundStats` and
`initialTrainingState` are in `src/boxing/state/trainingMachine.ts`.

Types used by exactly one module stay colocated with that module; only shared
vocabulary is promoted here. Tuning values live in
`src/boxing/config/thresholds.ts`, not here.
