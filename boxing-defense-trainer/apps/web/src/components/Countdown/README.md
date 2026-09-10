# `src/components/Countdown/`

## Responsibility

The countdown beat: "3 — 2 — 1 — BOX". Used before a training round, and by the
calibration flow to give the user time to settle into stance.

```ts
interface CountdownProps {
  from: number
  onComplete?: () => void
  onTick?: (secondsRemaining: number) => void
  finalLabel?: string // default 'BOX'
  className?: string
}
```

Counting starts on mount and **remounting restarts it** — change `from`, or give
it a `key`, to run it again.

## It owns its own tick

An earlier draft of this component was controlled, taking `secondsRemaining` from
outside so that "the session clock stays in one place". It is now
self-counting: a caller gets a countdown by mounting one.

`onTick` is what keeps that honest. A caller needing to act partway through —
`useCalibration` samples the stance during the final second — listens rather
than running a second clock that could drift against this one.

If the training loop later needs frame-exact control of the pre-round countdown,
the way back is an optional controlled override, not a second component.

## Does NOT contain

The countdown duration — that is `THRESHOLDS.session.countdownSeconds` in
`src/boxing/config/thresholds.ts`, passed in as `from`. No session state
transitions, no attack rendering, no audio cues, and no knowledge of what the
countdown is _for_.
