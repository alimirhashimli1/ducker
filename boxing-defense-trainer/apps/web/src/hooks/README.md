# `src/hooks/`

## Responsibility

The adapter layer between the framework-agnostic boxing domain and React. Hooks
here own effects and React state: driving the session clock, feeding pose frames
into the detector, subscribing a component to the training state machine, and
managing the lifecycle of browser resources like media streams and animation
frames. This is where "when does it happen" lives.

## Does NOT contain

The rules themselves. A hook calls into `src/boxing/` and reflects the result —
it does not reimplement scoring, detection, difficulty or phase transitions. No
JSX or markup, and no thresholds of its own.
