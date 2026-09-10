/**
 * Responsibility: show the camera feed. It is handed a video ref and a status
 * and renders them; it never asks for a camera itself — that is `useWebcam`.
 *
 * The video is mirrored so the user sees themselves as in a mirror, which is
 * what makes "move your left hand" mean the hand that moves on the left of the
 * screen. Only the `<video>` is flipped: the overlay layer above it is not, so
 * any text it renders stays readable. See `PoseOverlay`'s `mirrored` prop for
 * how the skeleton is aligned against the flipped video.
 */
import type { ReactNode, RefObject } from 'react'

import type { WebcamStatus } from '../../hooks/useWebcam'

export interface WebcamViewProps {
  /** From `useWebcam`. The hook attaches the stream to this element. */
  videoRef: RefObject<HTMLVideoElement | null>
  status: WebcamStatus
  /** Whether the camera should be on. Purely reported — this component toggles nothing. */
  enabled: boolean
  /** Called with the requested next state when the toggle is pressed. */
  onToggle?: (next: boolean) => void
  /** Drawn over the video, unmirrored. The pose overlay goes here. */
  children?: ReactNode
  className?: string
}

const STATUS_MESSAGE: Record<WebcamStatus, string | null> = {
  idle: 'Camera off.',
  requesting: 'Waiting for camera permission…',
  active: null,
  denied: 'Camera permission was refused. Allow it in your browser settings to train.',
  error: 'No camera available.',
}

export function WebcamView({
  videoRef,
  status,
  enabled,
  onToggle,
  children,
  className,
}: WebcamViewProps) {
  const message = STATUS_MESSAGE[status]

  return (
    <div
      data-testid="webcam-view"
      data-status={status}
      className={`relative aspect-video overflow-hidden rounded-panel border border-ink-700 bg-ink-900 shadow-panel ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        data-testid="webcam-video"
        muted
        playsInline
        // Mirrored: the user is looking at themselves, not at a recording.
        className="-scale-x-100 h-full w-full object-cover"
      />

      {/* Overlay layer. Not mirrored, so text inside it reads normally. */}
      <div className="pointer-events-none absolute inset-0">{children}</div>

      {message !== null && (
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-ink-300">
          {message}
        </p>
      )}

      {onToggle && (
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          aria-pressed={enabled}
          className="absolute bottom-2 right-2 rounded-panel border border-ink-700 bg-ink-950/80 px-2 py-1 font-mono text-[11px] text-ink-200 transition-colors hover:border-ember-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember-500"
        >
          {enabled ? 'camera off' : 'camera on'}
        </button>
      )}
    </div>
  )
}
