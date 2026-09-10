# `src/components/ScoreDisplay/`

## Responsibility

One exchange's breakdown: which defense was recognised, whether it was the right
answer for the punch thrown (✓/✗), and the Reaction / Movement / Balance / Total
figures behind it.

It formats a `DefenseResult` it is handed. A miss has no defense to name, so it
says "No defense" rather than rendering a blank row.

`bare` drops the component's own frame, for embedding in a panel that already
has one — which is how `TrainingHUD` uses it.

## Does NOT contain

Any scoring. Every number here is computed in `src/boxing/scoring.ts`; this
rounds them for display. No knowledge of the round, the session, or what happens
next.

Pose maths and thresholds do NOT belong here — see
`src/boxing/defenseDetector.ts`.
