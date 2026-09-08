/**
 * Responsibility: classify a rolling window of pose frames into a single
 * defensive movement, or nothing. It reads geometry only — it has no idea which
 * punch is incoming and never decides whether the defense was correct.
 */
import type { DefenseType, PoseFrame } from '../../types'

/** A defensive movement recognised in the pose stream. */
export interface DefenseDetection {
  readonly type: DefenseType
  /** Detector confidence in [0,1]. */
  readonly confidence: number
  /** Session-relative timestamp, in ms, at which the movement peaked. */
  readonly at: number
}

/**
 * Inspect the most recent pose frames and report a defensive movement.
 *
 * TODO: normalise head/wrist travel against shoulder width and compare with the
 * MOVEMENT ratios in ../config/thresholds.ts; return null below POSE gates.
 */
export function detectDefense(_frames: readonly PoseFrame[]): DefenseDetection | null {
  return null
}
