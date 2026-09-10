# `src/components/CalibrationPanel/`

## Responsibility

The calibration half of the trainer screen: the "STAND IN YOUR BOXING STANCE"
prompt, the countdown, the measured baseline once it exists, the failure message
when it does not, and the **Recalibrate** button.

It reads calibration state from `src/context/`, not from props. The screen above
it therefore does not thread a baseline down purely to hand it here, and the
button can live wherever the layout wants it.

## Does NOT contain

The measurement (`src/boxing/calibration.ts`), the orchestration of prompt,
countdown and sampling (`src/hooks/useCalibration.ts`), the countdown itself
(`../Countdown/`), or the camera. It renders phases and forwards two callbacks.

Pose maths and thresholds do NOT belong here — see
`src/boxing/defenseDetector.ts`.
