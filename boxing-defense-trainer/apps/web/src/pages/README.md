# `src/pages/`

## Responsibility

Top-level screens. A page composes components from `src/components/`, wires them
to hooks from `src/hooks/`, and passes data downward — it is the only layer that
knows how the pieces of a screen fit together.

| Page       | Is                                                 |
| ---------- | -------------------------------------------------- |
| `Home`     | Stance, mode and difficulty, then Start.           |
| `Training` | Boxer centre, camera in the corner, HUD beside it. |
| `Results`  | End-of-round totals and every exchange.            |

`Training` is a composition root: it acquires the camera and pose stream and
hands them to the hooks. Its inner `Round` sits inside `CalibrationProvider`
because that is the only way to read the baseline calibration produced.

## Navigation

`App.tsx` holds a typed screen union and switches on it. There is no router, and
the reasoning is written at the top of that file: nothing here is addressable, a
bookmarked round would name a live camera session that no longer exists, and
"back" mid-round is a bug rather than a feature.

## Does NOT contain

Reusable UI (`src/components/`), boxing rules (`src/boxing/`), or effect logic
that another screen could want (`src/hooks/`). A page should read as a layout
plus wiring; if it starts computing something, that computation belongs
elsewhere. `.claude/RULES.md` caps components at ~150 lines, and these pages are
where that pressure shows up first.
