# `src/components/PoseOverlay/`

## Responsibility

Draws the detected skeleton over the camera feed — the landmarks, the segments
that join them, and confidence-based styling so the user can see when tracking
is poor and reposition themselves. It also renders the
**"Move into view of the camera."** message when `detectionStatus` is
`'noPerson'`, which is the app's only cue that the camera is working but nobody
is in frame.

It is a pure projection of `PoseLandmarks` onto an SVG. SVG rather than canvas
because the segments are a direct function of the landmarks: declaring them lets
React diff them, and leaves the overlay inspectable in tests and devtools.

## The `mirrored` prop

The video underneath is flipped, so the skeleton is flipped to match. It
defaults to `true` and is a prop rather than an assumption so the overlay can
also be drawn over unmirrored footage — a recorded fixture, say — without
lying about where the limbs are.

The message is deliberately outside the flipped element. Mirrored text is
unreadable.

## Pose maths and thresholds do NOT belong here

**See `src/boxing/defenseDetector.ts`.** This component renders the
landmarks it is given and never runs a model, never classifies a movement into a
defense, and never scores anything.

It does read `THRESHOLDS.pose.minKeypointScore` to dim low-confidence
landmarks — but it only reads it. The value is a tunable and lives in
`src/boxing/config/thresholds.ts`; a threshold declared here would be a magic
number in a component, which `.claude/RULES.md` forbids.

## Does NOT contain

Pose detection itself (`src/hooks/usePoseDetection.ts`), camera access
(`src/hooks/useWebcam.ts`), movement classification, or scoring.
