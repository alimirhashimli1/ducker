# `src/components/`

## Responsibility

Presentational React components, one folder per component area. A component
here receives everything it needs as props, renders it, and reports user intent
back through callbacks. Each area owns one visual concern — the sparring
partner, the camera feed, the skeleton overlay, the heads-up display, the score
readout, the pre-round countdown — and each folder keeps its component, its
subcomponents and its README together. Per `.claude/RULES.md` no component file
exceeds ~150 lines; when one grows, extract a hook into `src/hooks/` or a helper
into `src/utils/` rather than letting the file sprawl.

## Does NOT contain

Boxing rules of any kind — no attack generation, defense classification,
scoring or difficulty logic; all of that lives in `src/boxing/` and reaches
components as props. No hardcoded thresholds, timings or attack data. No page
composition or routing (`src/pages/`), no reusable stateful logic
(`src/hooks/`), and no animation variant definitions (`src/animations/`).
