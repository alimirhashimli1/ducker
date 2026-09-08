# `src/utils/`

## Responsibility

Small, general-purpose helpers with no domain opinion: geometry and vector maths
on normalised coordinates, number formatting for readouts, time formatting, and
similar. Everything here is a pure function that would still make sense in a
completely different application.

## Does NOT contain

Anything boxing-specific — if a helper mentions punches, defenses, scoring or
difficulty, it belongs in `src/boxing/`. No React, no DOM access, no
configuration values, and no barely-used one-off helpers: a function used by a
single module stays next to that module.
