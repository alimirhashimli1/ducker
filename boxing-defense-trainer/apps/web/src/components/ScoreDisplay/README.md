# `src/components/ScoreDisplay/`

## Responsibility

Presents scoring feedback: the running total, the current streak, the per-punch
verdict as it happens (clean, late, wrong, missed) and the end-of-session
summary. It turns `ScoreEvent` and `SessionScore` values into something readable
at a glance by someone who is out of breath.

## Does NOT contain

The scoring rules — points, timing windows and outcome classification all live
in `src/boxing/engine/scoring.ts` and arrive here already computed. No
persistence or history across sessions (that would need a backend, which the MVP
does not have — see `docs/adr/0001-no-backend-for-mvp.md`), and no point values
hardcoded in markup.
