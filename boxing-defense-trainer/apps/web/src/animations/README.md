# `src/animations/`

## Responsibility

Shared Framer Motion definitions: variants, transitions and easing curves used
across the app, named for the moment they describe — the punch telegraph, the
verdict flash, the countdown beat, panel entrances. Keeping them here means
motion is consistent between components and the feel of the app can be tuned in
one file rather than hunted down across a dozen `motion.div`s.

## Does NOT contain

Components — a variant is data, not a renderer. No boxing logic and no timing
values that affect _scoring_: animation durations are cosmetic and live here,
while anything the trainer judges the user against belongs in
`src/boxing/config/thresholds.ts`. Never imported by `src/boxing/`.
