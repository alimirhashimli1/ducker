# `src/components/Webcam/`

## Responsibility

Owns the camera feed as a piece of UI: requests the media stream, attaches it to
a `<video>` element, mirrors it so the user sees themselves as in a mirror, and
renders the permission, loading and error states that come with asking a browser
for a camera. It is the single place in the app that touches
`navigator.mediaDevices`.

## Does NOT contain

Pose detection or inference — it publishes frames and lets a consumer analyse
them. No skeleton drawing (`../PoseOverlay/`), no boxing logic, no scoring, and
no uploading or recording of video: frames never leave the device.
