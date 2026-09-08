# `src/components/PoseOverlay/`

## Responsibility

Draws the detected skeleton on top of the camera feed: keypoints, the segments
that join them, and confidence-based styling so the user can see when tracking
is poor and reposition themselves. It is a pure projection of a `PoseFrame` onto
a canvas sized to match the video underneath it.

## Does NOT contain

Pose detection itself — it renders the `PoseFrame` values it is given and never
runs a model. No classification of movements into defenses
(`src/boxing/engine/defenseDetector.ts`), no scoring, no camera access, and no
confidence thresholds of its own (`src/boxing/config/thresholds.ts`).
