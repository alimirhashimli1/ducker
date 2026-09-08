# `src/types/`

## Responsibility

Shared TypeScript types for the whole application: the vocabulary that the
boxing domain, the React layer and the utilities all agree on — attacks,
defenses, difficulty levels, pose frames, scoring events and training phases.
A type used by more than one folder belongs here, declared exactly once and
imported everywhere else, so there is a single definition of what an "Attack"
or a "Pose" is.

## Does NOT contain

Runtime code of any kind. No functions, no classes, no constants, no `enum`
(use string literal unions instead — they erase at compile time). Types used by
exactly one module stay colocated with that module; only shared vocabulary is
promoted here. Tuning values live in `src/boxing/config/thresholds.ts`, not here.
