# `src/components/TrainingHUD/`

## Responsibility

The live readout of a round: punch progress, the round clock, the running score
and reaction average, the last exchange's breakdown, and the Start/Pause
control.

Purely presentational — every value arrives as a prop from `useTrainingSession`.
It reflects the state machine; it never advances it. The two buttons call
callbacks and nothing else.

Deliberately sparse. The spec asks for an uncluttered training screen, and the
user's attention belongs on the boxer, not on this panel. The score breakdown
sits in a fixed-height slot so the panel does not jump as results come and go.

## Does NOT contain

Timers — `src/hooks/useTrainingSession.ts` owns the clock, including the round
clock this displays. No scoring: every figure comes from `boxing/scoring.ts` via
the session. No decision about when a round ends; that is
`isRoundComplete` in `boxing/trainingStateMachine.ts`.

Pose maths and thresholds do NOT belong here — see
`src/boxing/defenseDetector.ts`.
