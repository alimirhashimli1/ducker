/**
 * Responsibility: paint a detected pose over the video feed. Rendering only —
 * it interprets nothing about what the pose means.
 */
import type { PoseFrame } from '../../types'

export interface PoseOverlayProps {
  /** The most recent detected pose, or null while tracking is lost. */
  pose?: PoseFrame | null
  /** Intrinsic size of the video underneath, so the overlay can scale to it. */
  sourceSize?: { readonly width: number; readonly height: number }
  className?: string
}

// TODO: draw keypoints + skeleton segments to a canvas scaled to sourceSize.
export function PoseOverlay({ className }: PoseOverlayProps) {
  return <div className={className} data-testid="pose-overlay" />
}
