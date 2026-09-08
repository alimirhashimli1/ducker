# ADR 0001: No Backend for MVP

- **Status:** Accepted
- **Date:** 2026-09-08

## Context

The specification asks whether the project needs a backend. The MVP is a browser-based boxing defense trainer using webcam pose detection, and its training logic can run locally in the browser.

## Decision

The MVP will have no backend. Attacks, defense detection, scoring, difficulty, and training state will run client-side in `apps/web`.

## Consequences

The app stays simple, local-first, and usable without a server or network service. Future features such as saved statistics, accounts, or cross-device history will require implementation in `services/api` and a deliberate data contract.

## Alternatives Considered

When a backend becomes necessary, Node.js with NestJS is the preferred option. It supports a structured service architecture and shared TypeScript types with the frontend. It is not being introduced during the MVP.
