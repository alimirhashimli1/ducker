/**
 * Responsibility: acquire the camera stream and render the mirrored video
 * element, including its permission and error states. Frames stay local.
 */
export interface WebcamProps {
  /** Called once the stream is live and the video element is playing. */
  onReady?: (video: HTMLVideoElement) => void
  /** Called when the camera is unavailable or permission is refused. */
  onError?: (error: Error) => void
  className?: string
}

// TODO: request getUserMedia, attach the stream, handle denied/unavailable states.
export function Webcam({ className }: WebcamProps) {
  return <div className={className} data-testid="webcam" />
}
