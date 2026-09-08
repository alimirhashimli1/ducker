# `src/components/TrainingHUD/`

## Responsibility

The heads-up display layered over the training view: current round, difficulty,
time remaining, the combo being thrown, and the session controls (start, pause,
resume, end). It is the user's read on the state of the session and the place
they act on it, translating clicks into callbacks the page passes down.

## Does NOT contain

The session state machine (`src/boxing/state/trainingMachine.ts`) — the HUD
displays a phase, it does not decide transitions. No score aggregation
(`../ScoreDisplay/`), no countdown rendering (`../Countdown/`), no timers, and
no round or duration constants of its own.
