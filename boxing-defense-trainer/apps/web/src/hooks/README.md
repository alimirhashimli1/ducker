# `src/hooks/`

## Responsibility

The adapter layer between the framework-agnostic boxing domain and React. Hooks
here own effects and React state: driving the session clock, running the pose
model, managing the lifecycle of browser resources like media streams and
animation frames, and subscribing components to the training state machine. This
is where "when does it happen" lives.

| Hook                 | Owns                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| `useWebcam`          | The camera: permission, the `MediaStream`, the video element.             |
| `usePoseDetection`   | The pose model, the per-frame loop, and mapping to our types.             |
| `useTrainingSession` | Binding the training state machine to React and to the clock.             |
| `useCalibration`     | The calibration ritual: the countdown, the sampling window, the baseline. |

## Pose maths and thresholds do NOT belong here

**See `src/boxing/defenseDetector.ts`.** These hooks acquire and publish
pose data; they never interpret it. No angle measurement, no distance
comparison, no deciding whether a movement was a slip or a roll, and no
confidence or timing thresholds — those are tunables and live in
`src/boxing/config/thresholds.ts`.

The test for whether something belongs here: if it would still be true with the
camera replaced by a recorded fixture, it is domain logic and belongs in
`src/boxing/`.

## The MediaPipe boundary

`usePoseDetection.ts` is the **only** module in the app allowed to import from
`@mediapipe/tasks-vision`. Everything downstream consumes `PoseLandmarks` from
`src/types/pose.ts`, which owes nothing to any vendor — including the landmark
indices, since "landmark 11 is the left shoulder" is BlazePose's convention and
stops at that file. Swapping detectors is a rewrite of one file.

## Where the model comes from

`poseAssets.ts` holds the two URLs. By default they point at MediaPipe's CDN,
fetched once and then browser-cached; inference itself is entirely local, and no
frame or landmark ever leaves the device.

To remove the third-party origin as well, run `npm run pose:assets` — it copies
the WASM out of `node_modules` and downloads the model into `public/mediapipe/`
— then switch the two constants to their `LOCAL_*` values. That costs about
40 MB in `dist/` and in the container image, which is why it is opt-in.

### Network audit, and one thing left to confirm

`detectForVideo` is synchronous and returns landmarks directly, so **inference
makes no network call per frame**. Auditing the built bundle for external
origins turns up exactly three that are not documentation links:

| Origin                   | What it is                             |
| ------------------------ | -------------------------------------- |
| `cdn.jsdelivr.net`       | the WASM runtime, fetched once         |
| `storage.googleapis.com` | the model, fetched once                |
| `odml.pa.googleapis.com` | **MediaPipe's own telemetry endpoint** |

That third one is not ours. MediaPipe ships a logger that POSTs to
`https://odml.pa.googleapis.com/v1/log` on an interval. The public API exposes
`enableLogging()` and no counterpart, which reads as opt-in, and this app never
calls it — but the shipped bundle is minified and that could not be confirmed by
reading it.

**Confirm it in the browser's Network tab** while the preview page runs: filter
for `odml` and expect nothing after the model has loaded. If anything does
appear, the fix is to self-host the assets as above and add a Content-Security-
Policy `connect-src 'self'`, which blocks the endpoint outright without
affecting inference.

## Does NOT contain

The rules themselves. A hook calls into `src/boxing/` and reflects the result —
it does not reimplement scoring, detection, difficulty or phase transitions. No
JSX or markup.
