# `src/components/Webcam/`

## Responsibility

Shows the camera feed. `WebcamView` is handed a video ref and a status by
`useWebcam` and renders them: the mirrored `<video>`, the permission and error
states that come with asking a browser for a camera, an optional on/off toggle,
and a slot for an overlay layer above the picture.

It is purely presentational. It does not call `getUserMedia`, hold a
`MediaStream`, or decide when the camera should be on — that is
`src/hooks/useWebcam.ts`, and this component would render identically if the
video element were fed from a file.

## Why the video is mirrored

The user is looking at themselves, not at a recording, so the picture is flipped
(`-scale-x-100`) to behave like a mirror — otherwise "move your left hand" moves
the hand on the right of the screen and everyone hesitates.

Only the `<video>` is flipped. The overlay slot above it is not, so any text
rendered into it stays readable; the skeleton aligns itself against the flipped
video through `PoseOverlay`'s own `mirrored` prop.

## Pose maths and thresholds do NOT belong here

**See `src/boxing/defenseDetector.ts`.** This component draws a picture.
It runs no model, measures nothing, and holds no confidence thresholds — those
live in `src/boxing/config/thresholds.ts`.

## Does NOT contain

Camera acquisition (`src/hooks/useWebcam.ts`), pose detection
(`src/hooks/usePoseDetection.ts`), skeleton drawing (`../PoseOverlay/`), boxing
logic, or any uploading or recording of video: frames never leave the device.
