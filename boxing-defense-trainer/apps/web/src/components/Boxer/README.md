# `src/components/Boxer/`

## Responsibility

Renders the on-screen sparring partner and the visual telegraph of an incoming
punch: stance, the arm that is throwing, and the wind-up that gives the user
something to read and react to. It is driven entirely by props — the attack to
show and how far through it we are — and is the component that makes an
`Attack` legible to a human.

## Does NOT contain

Attack generation or selection (`src/boxing/engine/attackEngine.ts`), any
judgement about whether the user defended successfully, timing logic or
timers, and no punch-timing constants — those arrive as props from
`src/boxing/config/thresholds.ts`.
