# `src/boxing/config/`

## Responsibility

Every tunable value in the trainer, in one place: a single exported `THRESHOLDS`
object holding movement geometry, timing windows, pose-confidence gates, scoring
weights and per-difficulty pacing.

Two conventions run through it. Distances are expressed as ratios of the user's
shoulder width rather than in pixels, because shoulder width is the one body
measurement that stays stable as the user moves toward or away from the camera —
so a threshold written this way holds at any camera distance and for any body
size. Times are milliseconds.

Every field carries a comment saying what it controls and what raising or
lowering it does, so a value can be tuned by someone who did not write the
detector.

Per `.claude/RULES.md` there are no magic numbers anywhere else in the codebase:
if a value might ever need tuning against real training footage, it is declared
here as a named, documented constant so it can be adjusted in one edit.

## Does NOT contain

Logic that _uses_ the values (that lives in the modules beside it and in `../state/`),
per-user or persisted settings, feature flags, or visual/design values —
colours, spacing and typography are design tokens and belong in
`tailwind.config.ts`.
