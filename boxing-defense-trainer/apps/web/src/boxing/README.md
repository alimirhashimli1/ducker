# `src/boxing/`

## Responsibility

The entire boxing domain, as a framework-agnostic TypeScript library: the
catalogue of punches and defenses, attack generation, defense detection from
pose data, scoring, difficulty progression and the training state machine.

Everything in here is a pure function or a plain object over the types in
`src/types/`. There is no clock, no randomness and no I/O that the caller does
not pass in — time arrives as a parameter, entropy arrives as a `RandomSource`,
and pose data arrives as `PoseFrame` values. That is what makes the rules of the
game testable in isolation, without a browser, a canvas or a renderer.

The UI layer consumes this folder; this folder knows nothing about the UI layer.

## Module boundaries

| Module                     | Owns                                                                                             | Does not own                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `attacks.ts`               | What a punch _is_: duration, which defenses answer it, and how it mirrors for southpaw.          | When to throw one; whether the user answered it.              |
| `defenses.ts`              | What a defense _is_: display metadata, and which punches it answers — derived from `attacks.ts`. | Recognising one in a pose stream.                             |
| `difficulty.ts`            | What a mode and level _mean_: sequence shape, punch pool, delay windows, progression.            | Building a sequence; running a clock.                         |
| `attackEngine.ts`          | Choosing what to throw next and how long to wait first.                                          | Doing the waiting; scoring the result.                        |
| `calibration.ts`           | Averaging pose samples into a `NeutralStanceBaseline`.                                           | Capturing the samples, or timing when to.                     |
| `config/thresholds.ts`     | Every tunable number, as the single `THRESHOLDS` object.                                         | Any logic that uses them.                                     |
| `defenseDetector.ts`       | Classifying pose geometry into a defensive movement.                                             | Which punch is incoming, or whether the movement was correct. |
| `scoring.ts`               | Grading one exchange: correctness, reaction, movement, balance.                                  | Detecting movement; driving the session.                      |
| `state/trainingMachine.ts` | The transitions between `TrainingState` phases.                                                  | Effects, timers, or rendering.                                |
| `index.ts`                 | The public surface. The UI imports from `../boxing`, never deeper.                               | Logic of its own.                                             |

## `attackEngine.ts` — public interface

```ts
type RandomSource = () => number

generateNextSequence(
  mode: TrainingMode,
  difficulty: DifficultyLevel,
  stance: Stance,
  random?: RandomSource,   // defaults to Math.random
): AttackSequence

getInterAttackDelay(
  mode: TrainingMode,
  difficulty: DifficultyLevel,
  random?: RandomSource,
): number                  // ms to wait before the NEXT sequence

getIntraSequenceDelay(
  mode: TrainingMode,
  difficulty: DifficultyLevel,
): number                  // ms between punches WITHIN a sequence
```

What a caller can rely on:

- **Attacks come back stance-resolved.** A southpaw sequence already carries the
  mirrored defenses; the caller never adapts them.
- **Ids are unique within the sequence** (`jab#0`, `jab#1`), because a
  combination may throw the same punch twice and scoring keys exchanges by id.
  They are _not_ unique across sequences — a consumer holding exchanges from
  several sequences at once must namespace them itself.
- **The sequence is never empty**, and every punch in it is one the level has
  unlocked.
- **It is deterministic given a `RandomSource`.** The default is `Math.random`,
  so the three-argument form reads cleanly; passing a stub replays a session
  exactly, which is how the tests assert specific sequences rather than
  sampling.

What it deliberately will not do: wait. `getInterAttackDelay` returns a number,
and the state machine decides what to do with it. There is no `setTimeout` in
this folder and there must never be one — that is what lets a whole session be
generated and asserted in microseconds.

Difficulty behaviour lives in `difficulty.ts`, not here: `beginner` is always one
punch, `combination` is always 2–3, and `reaction` runs from 1 up to the level's
combo length with a jittered rest. Adding a level or a mode is a change to that
file and not to the engine.

## Calibration, and why detection depends on it

`calibration.ts` turns a burst of pose samples — captured while the user stands
still during the pre-round countdown — into the measurement everything else is
judged against.

```ts
interface NeutralStanceBaseline {
  head: Point2D //  the nose at rest
  shoulders: { left: Point2D; right: Point2D; center: Point2D }
  hips: { left: Point2D; right: Point2D; center: Point2D }
  wrists: { left: Point2D; right: Point2D } //  the resting guard
  bodyWidth: number //  shoulder-to-shoulder distance at rest
  sampleCount: number //  how many usable samples were averaged
}
```

`wrists` exists for `detectGuard`: a guard is a movement _toward_ the head, and
"toward" needs to know where the hands already were. Unlike the torso landmarks
they are not required for calibration to succeed — a hand may be occluded
without invalidating the stance — so they can be less reliable than the rest.

All positions are in the same normalised [0,1] frame coordinates as the
landmarks they came from.

### Why it must run first

Two things in this folder are meaningless without it.

**Every threshold is a ratio of `bodyWidth`.** `slipLateralRatio: 0.35` means
"35% of the distance between this user's shoulders". That is what lets one
number work for a tall adult two metres from the camera and a shorter one at
one metre. Without a measured `bodyWidth` there is no unit, and the thresholds
in `config/thresholds.ts` are not merely inaccurate — they do not convert to
anything.

**Every movement is a displacement from rest.** A slip is the head leaving
`head`; a step back is the shoulders narrowing from `bodyWidth`. Absent a
baseline, the detector cannot tell whether a head at y=0.42 is a slip in
progress or simply where that person's head lives when they stand still.

So detection against a missing baseline is not degraded, it is undefined — which
is why `useCalibration` gates training on it rather than falling back to a
default. A default would be a guess about a specific human body, and it would be
wrong for almost everyone.

### Why it is re-runnable

A baseline is invalidated by anything that changes the geometry: the user
stepping toward the camera, the laptop being nudged, or a different person
taking a turn. A stale baseline is worse than none, because it looks valid while
describing a stance nobody is standing in — every subsequent movement is then
measured from the wrong origin. Hence the Recalibrate button, and hence
`recalibrate()` discarding the old baseline before measuring rather than after.

### The averaging

A weighted mean, weighted by the detector's own confidence in each landmark, over
the samples that show the whole torso confidently. Pose jitter is roughly
zero-mean, so a mean cancels it and the error falls as 1/sqrt(n); weighting by
confidence keeps tracking glitches — which almost always arrive with low
confidence — from dragging the result the way a plain mean would, without giving
up that variance reduction to a median. The reasoning is written out in full at
the top of `calibration.ts`.

## Defense detection

`defenseDetector.ts` answers one question: what defensive movement, if any, is
this pose? It is the most accuracy-sensitive module here and the one most likely
to be wrong in ways nothing else notices — a detector that fires too easily
produces a trainer that congratulates the user for movements they never made.

```ts
detectDefense(context: DetectionContext): DefenseDetection | null

interface DetectionContext {
  landmarks: PoseLandmarks
  baseline: NeutralStanceBaseline
  history: readonly PoseLandmarks[] // oldest first
  stance: Stance
  incomingSide?: 'left' | 'right' // the boxer's own side
}

interface DefenseDetection {
  type: DefenseType
  magnitude: number // in shoulder-widths
  confidence: number // [0,1]
}
```

### The detectors

| Function                                                  | Fires when                                                              | What stops the false positive                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `detectSlip(landmarks, baseline, direction)`              | The head leaves the centreline sideways past `slipLateralRatio`.        | It must **not** have dropped past `rollVerticalRatio` — otherwise it is a roll.                       |
| `detectRoll(landmarks, baseline, direction)`              | The head drops **and** arcs sideways **and** the hips drop with it.     | Hips must follow. Head-alone is a nod, and rewarding a nod teaches a movement that gets the user hit. |
| `detectStepBack(landmarks, baseline)`                     | The shoulders narrow past `stepBackRatio` of their calibrated width.    | The head must stay near the centreline — turning side-on narrows them too.                            |
| `detectGuard(landmarks, baseline)`                        | Both wrists come inside `guardHandToHeadRatio` of the **current** head. | Must be _tighter_ than the calibrated resting guard, or hands-up scores every frame.                  |
| `detectParry(landmarks, baseline, incomingSide, history)` | The wrist on the incoming side travels past `parryHandTravelRatio`.     | The wrist must outrun the head — a hand carried by the body turning is not a parry.                   |

`detectDefense` runs all of them and returns the **most confident**, not the
first. Several fire at once — a roll is also, briefly, sideways movement — and
picking by confidence stops the registry order from quietly becoming a priority
list nobody documented.

### Two conventions everything depends on

**Distances are ratios of `baseline.bodyWidth`**, never pixels. That is what
makes one threshold work for a tall user two metres away and a shorter one at
one metre. `magnitude` is reported in those units too, so it is comparable
across users and sessions.

**Left and right are the boxer's own, read out of the baseline.** Whether the
subject's left shoulder sits at a higher or lower x depends on the detector's
labelling and on whether the image is mirrored. `lateralAxis` derives the
direction from the calibrated shoulders instead of assuming it. Hard-coding
"left means smaller x" is the easiest way to silently invert every lateral
detector — and it would still pass a test written under the same assumption,
which is why there is a test that flips the whole world and re-checks.

### Adding a new defense

1. Add the name to `DefenseType` in `src/types/boxing.ts`, and give it an entry
   in `DEFENSE_CATALOGUE` in `defenses.ts` (display name, description, whether
   it is lateral). The compiler will demand both.
2. Add whatever tunables it needs to `config/thresholds.ts`, with a comment
   saying what raising and lowering them does. **No numeric literals in the
   detector** — `.claude/RULES.md` forbids it and the review will catch it.
3. Write `detectYourDefense(landmarks, baseline, ...)` in `defenseDetector.ts`.
   Return `null` early for anything it cannot measure; return a
   `DefenseDetection` otherwise.
4. Add **one line** to the `DETECTORS` registry.
5. Write the pair of tests: one clear movement it must catch, one near-miss it
   must refuse. The refusal is the one that matters.

No existing detector changes at any point — that is the Open/Closed part, and it
is why the registry exists rather than a chain of `if`s.

### What is deliberately not modelled

There is no depth, because there is one camera. Distance is inferred from
apparent shoulder width, a proxy that cannot tell a retreat from a user turning
side-on except by the corroborating checks above. Nothing here uses velocity
except `detectParry`; a movement is judged by where the body ended up, not how
fast it got there. Both are places the detector could be made smarter once there
is real footage to tune against.

## Scoring

`scoring.ts` judges one exchange. It is handed what the punch expected, what the
detector saw, and when — and returns numbers. It detects nothing, generates
nothing, and runs no session, which is what lets the rules be argued about and
retuned without touching anything that produces the inputs.

```ts
scoreDefense(input: ScoreDefenseInput): DefenseScore

interface DefenseScore {
  correct: boolean
  reactionMs: number // signed; negative is early. For a miss, the window we waited.
  reactionScore: number // 0-100
  movementScore: number // 0-100
  balanceScore: number // 0-100
  total: number // 0-100
}
```

### The formula

```
total = (reaction·Wr + movement·Wm + balance·Wb) / (Wr + Wm + Wb)   if correct
total = 0                                                           otherwise
```

Weights live in `THRESHOLDS.scoring.weights` and are **normalised at use**, so
they can be edited freely without having to keep them summing to one.

| Component  | 100 when                                 | 0 when                                | Weight |
| ---------- | ---------------------------------------- | ------------------------------------- | ------ |
| `reaction` | within `reactionToleranceMs` of landing  | `missWindowMs` off, either direction  | 0.5    |
| `movement` | magnitude ≥ `movementFullCreditRatio`    | magnitude ≤ `minMovementRatio`        | 0.3    |
| `balance`  | head within `balanceReturnRatio` of rest | still displaced by `slipLateralRatio` | 0.2    |

Timing is measured from when the punch **lands** — `attackStartTime +
attack.duration` — not from when it was thrown. Reacting to a jab as it arrives
is on time; reacting the instant it left is precognition, and the 700 ms between
the two is the reaction window the drill is training.

Reaction is weighted heaviest because this is a reaction trainer: being in the
right place too late is the failure the app exists to fix. Balance is lightest
because recovering is what makes the _next_ defense possible rather than this
one correct.

### Three decisions worth knowing

**A wrong defense scores zero, but its sub-scores are still reported.** A fast,
committed, balanced slip against a hook is still a punch in the face, and paying
partial credit for it would teach that the choice of defense barely matters —
the one thing this drill exists to teach. The components survive so the UI can
say "fast and committed, but you slipped into it": feedback without reward.

**Small delays cost nothing.** Anything inside the tolerance window is full
marks. A drill that shaved points for being 40 ms out would be scoring detector
jitter rather than the boxer.

**Unmeasured balance is dropped, not zeroed.** When no recovery pose is supplied
its weight falls out of the blend and the rest renormalise. Scoring an unknown
as bad would quietly cap every total at 80.

### Retuning it later

- **Change the emphasis:** edit `THRESHOLDS.scoring.weights`. No arithmetic to
  rebalance — they are normalised. The tests assert the _ordering_ of the
  weights, not their values, so a retune does not break the suite unless it
  changes what the drill rewards, which is exactly when a test should object.
- **Change what counts as on time:** `timing.reactionToleranceMs` and
  `timing.missWindowMs`. Per-difficulty scaling is already handled — callers
  pass `toleranceFactor`, which is why scoring never imports `difficulty.ts`.
- **Change what counts as committed:** `scoring.movementFullCreditRatio`.

**Known limitation.** Magnitudes are not comparable between defenses: a slip is
head displacement, a step back is a fraction of shoulder width. One universal
`movementFullCreditRatio` therefore under-scores step-backs for the same quality
of movement. The fix, once there is footage, is a per-defense full-credit ratio;
`scoreMovement` keeps its shape either way.

## Dependency directions

Three directions of dependency are deliberate and worth preserving:

- **`defenses.ts` derives from `attacks.ts`, never the reverse.** The punch/defense
  pairing is written once, in the attack catalogue, because scoring reads it
  there. `punchesAnsweredBy()` inverts that catalogue at module load rather than
  restating it, so the two cannot drift.
- **`attackEngine.ts` reads `difficulty.ts`, never `config/thresholds.ts`.** The
  engine asks what shape of sequence to build and is told; it never interprets a
  raw number. That is what keeps difficulty tuning out of the engine
  (Open/Closed).
- **Nothing here imports a pose-detection SDK.** Pose data is defined by
  `src/types/pose.ts` on our terms; the adapter that wraps MediaPipe (or whatever
  replaces it) maps down to those types, so a detector swap touches one file.

## Does NOT contain

**This folder must never import from React or `components/`.** No JSX, no hooks,
no `react`, `react-dom` or `framer-motion`, no DOM or `window`/`document` access,
no canvas drawing, no webcam or media-device code, and no imports from
`components/`, `hooks/`, `pages/` or `animations/`. The dependency runs one way:
the UI depends on the domain.

This is enforced, not merely documented — `no-restricted-imports` in
`eslint.config.js` is scoped to `src/boxing/**/*.ts` and fails the build on any
of the above.

Also not here: tuning constants inline (they belong in `config/thresholds.ts`),
and types shared with the UI layer (they belong in `src/types/`).

## Current state

Implemented and tested: the vocabulary, both catalogues, `difficulty.ts`,
`attackEngine.ts`, `calibration.ts`, `defenseDetector.ts` and `scoring.ts`.

Still stubs, with their logic marked `TODO`: `state/trainingMachine.ts`,
and `nextDifficulty` in `difficulty.ts`.
The `engine/` folder is gone — it was down to one file, and `scoring.ts` now
sits beside the rest of the domain.

Every value in `config/thresholds.ts` and `attacks.ts` is a boxing-standard
estimate carrying a `TODO(tuning)` note until it is calibrated against real
footage. The punch pools in `difficulty.ts` are likewise a judgement call about
what to teach first, not a measured result.
