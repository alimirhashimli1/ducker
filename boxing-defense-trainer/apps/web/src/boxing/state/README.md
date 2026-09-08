# `src/boxing/state/`

## Responsibility

The training loop as an explicit, framework-agnostic state machine: the phases a
session moves through (`idle → calibrating → countdown → active → paused →
complete`), the events that move it between them, and the reducer that applies
them. State transitions are plain data in, plain data out, so the whole session
lifecycle can be driven and asserted in a test without rendering anything.

## Does NOT contain

React state — no `useState`, `useReducer`, context or stores. The React layer
adapts this reducer via a hook in `src/hooks/`; it does not reimplement it.
No timers or scheduling (the caller supplies elapsed time via events), no
persistence, no scoring or detection maths (`../engine/`).
