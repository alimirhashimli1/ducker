# `src/pages/`

## Responsibility

Top-level screens. A page composes components from `src/components/`, wires them
to hooks from `src/hooks/`, and passes data downward — it is the only layer that
knows how the pieces of a screen fit together. For the MVP there is a single
page, the trainer itself.

## Does NOT contain

Reusable UI (`src/components/`), boxing rules (`src/boxing/`), or effect logic
that could be reused by another screen (`src/hooks/`). A page should read as a
layout plus wiring; if it starts computing things, that computation belongs
somewhere else.
