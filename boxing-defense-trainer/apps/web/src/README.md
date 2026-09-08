# `apps/web/src/`

## Responsibility

The frontend source. The layering is deliberate and one-directional:

```
pages/  →  components/  →  hooks/  →  boxing/  →  types/
                    ↘  animations/      ↘  utils/
```

`boxing/` is the framework-agnostic core (rules, scoring, state machine) and
knows nothing above it. `hooks/` adapts that core to React. `components/` render
props. `pages/` compose. `types/` and `utils/` sit at the bottom and depend on
nothing. Arrows never point backwards — if you need one to, the code is in the
wrong folder.

Every folder here carries its own README stating what belongs in it and what
does not. Read `.claude/RULES.md` before adding to any of them.

## Does NOT contain

Build or tooling configuration (that sits at `apps/web/`), design tokens
(`tailwind.config.ts`), backend calls of any kind, or new top-level folders
added without a README.
