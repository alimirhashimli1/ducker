# Claude Code Rules

## Required Reading

Every Claude Code session must read this file before making changes to the project.

## Project Purpose

Boxing Defense Trainer is a browser-based boxing defense trainer that uses webcam pose detection to help users practice and evaluate defensive movement. The MVP is local-first and has no backend; all training, detection, and scoring behavior runs in the browser.

## Non-Negotiable Architecture Rules

- **SOLID in every module:** Keep modules focused and replaceable throughout the project.
  - **Single Responsibility:** `attackEngine.ts` only generates attack sequences; it never touches the DOM or React state.
  - **Open/Closed:** Add a new difficulty strategy through a new implementation or configuration, without rewriting the existing scoring engine.
  - **Liskov Substitution:** Any defense detector implementation must be usable wherever the shared detector contract is expected, without changing caller behavior.
  - **Interface Segregation:** Keep pose, scoring, and training interfaces narrow so a consumer does not depend on methods it does not use.
  - **Dependency Inversion:** Core boxing logic depends on interfaces for pose input and timing, not on browser APIs or React components.
- Boxing logic, including attacks, defenses, scoring, difficulty, and the state machine, must live in `apps/web/src/boxing/` and must have zero React imports.
- No component may exceed approximately 150 lines. Extract hooks and helpers instead.
- Do not use magic numbers for thresholds. Every tunable threshold must live in `apps/web/src/boxing/config/thresholds.ts`.
- Every new module needs a colocated `*.md` file or a top-of-file documentation comment explaining its responsibility.
- Every new folder under `src/` needs a `README.md` explaining what belongs there and what does not belong there.
- Do not add backend calls or `fetch` calls to external APIs unless explicitly requested. This is a local-first app.
- TypeScript strict mode is always on. Do not use `any` without a comment justifying it.
- Commits should be small and scoped to one concern.

## Pre-Finish Checklist

Claude Code must run through this checklist before finishing every task:

- [ ] Did I keep boxing logic framework-agnostic?
- [ ] Did I avoid hardcoding thresholds or attack data in components?
- [ ] Did I update the relevant `README.md` if I added or changed a folder's responsibility?
- [ ] Did I avoid introducing a backend dependency?
- [ ] Did I add or update types in `src/types/` instead of duplicating inline types?
