# `src/context/`

## Responsibility

React context providers: state that is owned once, high in the tree, and read by
components that do not share a path to it.

Today that is calibration. The `NeutralStanceBaseline` is needed by the defense
detector, by a HUD readout, and by the Recalibrate button — three places whose
only common ancestor is the screen root. Threading it as props would add a
`baseline` prop to every component in between purely to pass it along, and
`.claude/RULES.md` caps component size and warns against exactly that kind of
padding.

Context is used here because the alternative is worse, not because it is free.

## Shape of a provider here

A provider **holds no logic**. `CalibrationProvider` calls `useCalibration` and
publishes the result; every decision stays in the hook, and the measurement
itself stays in `src/boxing/calibration.ts`. If a provider in this folder starts
computing something, that computation belongs in a hook or in the domain.

The context object and its consumer hook live in `CalibrationContext.ts`,
separate from the `.tsx` provider. A module that exports a component is replaced
wholesale by Fast Refresh, and a context created in that module would be
replaced with it — leaving every consumer reading the default value after an
edit, with no error to explain it.

## Does NOT contain

Business logic (`src/boxing/`), effects (`src/hooks/`), or UI (`src/components/`).
No context for state that only one subtree needs — that is a prop.
