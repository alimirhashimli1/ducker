# `src/components/Countdown/`

## Responsibility

The pre-round countdown: the full-screen "3 — 2 — 1 — BOX" beat that gets the
user into stance before punches start. It renders whatever number it is given
and announces when it reaches zero, so the session can begin.

## Does NOT contain

The countdown duration (`COUNTDOWN_SECONDS` in
`src/boxing/config/thresholds.ts`) and no timer of its own — the tick is driven
from outside so the session clock stays in one place. No session state
transitions, no attack rendering, and no audio cue handling.
