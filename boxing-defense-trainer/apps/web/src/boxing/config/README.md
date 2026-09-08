# `src/boxing/config/`

## Responsibility

Every tunable value in the trainer, in one place: timing windows, detection
thresholds, scoring weights and per-difficulty settings. Per `.claude/RULES.md`
there are no magic numbers anywhere else in the codebase — if a value might
ever need tuning against real training footage, it is declared here as a named,
documented constant so it can be adjusted in one edit.

## Does NOT contain

Logic that _uses_ the values (that lives in `../engine/` and `../state/`),
per-user or persisted settings, feature flags, or visual/design values —
colours, spacing and typography are design tokens and belong in
`tailwind.config.ts`.
