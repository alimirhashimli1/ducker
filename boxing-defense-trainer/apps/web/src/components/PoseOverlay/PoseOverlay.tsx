/**
 * Responsibility: draw the detected skeleton over the video, and tell the user
 * when there is nothing to draw. Rendering only — it interprets nothing about
 * what the pose means.
 *
 * SVG rather than canvas: the segments are a direct function of the landmarks,
 * so declaring them lets React do the diffing, and it leaves the overlay
 * inspectable in a test and in devtools. A canvas would need an imperative draw
 * loop to say the same thing.
 */
import { THRESHOLDS } from '../../boxing'
import type { DetectionStatus, KeypointName, PoseLandmarks } from '../../types'

export interface PoseOverlayProps {
  /** The most recent pose, or null while tracking is lost. */
  landmarks?: PoseLandmarks | null
  detectionStatus: DetectionStatus
  /**
   * Whether the video underneath is mirrored. The skeleton is flipped to match
   * it; the message is not, so it stays readable.
   */
  mirrored?: boolean
  className?: string
}

/**
 * The segments that make the landmarks read as a body.
 *
 * Shoulders and hips first so the torso reads as a frame, then the limbs. The
 * head is a single line either side of the nose rather than a drawn face — this
 * is a tracking aid, not a portrait.
 */
const SEGMENTS: readonly (readonly [KeypointName, KeypointName])[] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftHip', 'rightHip'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftHip', 'leftKnee'],
  ['rightHip', 'rightKnee'],
  ['nose', 'leftEye'],
  ['nose', 'rightEye'],
]

/** Landmarks are normalised to [0,1]; the viewBox is 100 units square. */
const SCALE = 100

export function PoseOverlay({
  landmarks,
  detectionStatus,
  mirrored = true,
  className,
}: PoseOverlayProps) {
  if (detectionStatus === 'noPerson') {
    return (
      <div
        data-testid="pose-overlay"
        data-status={detectionStatus}
        className={`flex h-full w-full items-center justify-center ${className ?? ''}`}
      >
        <p className="rounded-panel bg-ink-950/75 px-3 py-2 text-center text-xs text-ink-100">
          Move into view of the camera.
        </p>
      </div>
    )
  }

  if (detectionStatus === 'notStarted' || !landmarks) {
    return <div data-testid="pose-overlay" data-status={detectionStatus} className={className} />
  }

  // Confidence styling only. The threshold itself is a tuning value and lives
  // in the boxing config, not here.
  const isConfident = (name: KeypointName) =>
    landmarks[name].score >= THRESHOLDS.pose.minKeypointScore

  return (
    <svg
      data-testid="pose-overlay"
      data-status={detectionStatus}
      viewBox={`0 0 ${SCALE} ${SCALE}`}
      // preserveAspectRatio="none" so the overlay stretches exactly as the
      // video does, and the flip matches the video's own mirroring.
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`${mirrored ? '-scale-x-100' : ''} h-full w-full ${className ?? ''}`}
    >
      {SEGMENTS.map(([from, to]) => (
        <line
          key={`${from}-${to}`}
          x1={landmarks[from].x * SCALE}
          y1={landmarks[from].y * SCALE}
          x2={landmarks[to].x * SCALE}
          y2={landmarks[to].y * SCALE}
          strokeWidth={0.9}
          strokeLinecap="round"
          className={
            isConfident(from) && isConfident(to) ? 'stroke-ember-500/80' : 'stroke-ink-500/40'
          }
        />
      ))}

      {(Object.keys(landmarks) as KeypointName[]).map((name) => (
        <circle
          key={name}
          cx={landmarks[name].x * SCALE}
          cy={landmarks[name].y * SCALE}
          r={1.1}
          className={isConfident(name) ? 'fill-ember-300' : 'fill-ink-500/50'}
        />
      ))}
    </svg>
  )
}
