/**
 * Responsibility: the shape of pose data as it enters the application from the
 * webcam pose detector. Deliberately detector-agnostic — the boxing domain
 * consumes these types, never a vendor's SDK types, so the detector can be
 * swapped without touching domain code.
 */

/** Landmarks the trainer cares about. A detector may report more; we map down to these. */
export type KeypointName =
  | 'nose'
  | 'leftEye'
  | 'rightEye'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'

/** A single landmark in normalised [0,1] frame coordinates, origin top-left. */
export interface Keypoint {
  readonly name: KeypointName
  readonly x: number
  readonly y: number
  /** Detector confidence in [0,1]. */
  readonly score: number
}

/** One detected body pose for a single video frame. */
export interface PoseFrame {
  /** Milliseconds since session start (not wall-clock), so replays are deterministic. */
  readonly timestamp: number
  readonly keypoints: readonly Keypoint[]
}
