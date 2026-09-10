/**
 * Responsibility: own the camera. It asks for permission, holds the
 * `MediaStream`, attaches it to a video element and reports what state that is
 * in. Nothing else in the app calls `getUserMedia`.
 *
 * No pose logic lives here. This hook does not know a model exists — it
 * produces a playing `<video>` and stops there, which is what lets the detector
 * be swapped, or driven from a recorded file in a test, without the camera code
 * changing.
 *
 * Frames never leave the device: the stream is attached to a local element and
 * is never uploaded, recorded or posted anywhere.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * - `idle`       — not started, or stopped.
 * - `requesting` — the browser permission prompt is up.
 * - `active`     — the stream is live and the video is playing.
 * - `denied`     — the user refused, or policy blocks the camera.
 * - `error`      — anything else: no camera, device in use, insecure origin.
 */
export type WebcamStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error'

export interface UseWebcamResult {
  /** Attach to a `<video>`. The hook sets `srcObject` on it. */
  videoRef: React.RefObject<HTMLVideoElement | null>
  status: WebcamStatus
  /** Set alongside `denied` and `error`; null otherwise. */
  error: Error | null
  start: () => void
  stop: () => void
}

/**
 * 16:9 at a modest resolution.
 *
 * The aspect ratio is requested rather than left to the browser so the pose
 * overlay, which stretches to its container, lines up with the video underneath
 * it. Resolution is kept low deliberately: the model downsamples anyway, and a
 * 1080p stream costs frame rate for landmarks that are no better.
 */
const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
  audio: false,
}

/** Permission refusal, as opposed to the camera being broken or absent. */
function isPermissionDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
  )
}

export function useWebcam(
  constraints: MediaStreamConstraints = DEFAULT_CONSTRAINTS,
): UseWebcamResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Guards the gap between asking for the camera and being handed it: the user
  // can stop, or the component can unmount, while the prompt is still up.
  const wantsStreamRef = useRef(false)

  const [status, setStatus] = useState<WebcamStatus>('idle')
  const [error, setError] = useState<Error | null>(null)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const stop = useCallback(() => {
    wantsStreamRef.current = false
    releaseStream()
    setStatus('idle')
    setError(null)
  }, [releaseStream])

  const start = useCallback(() => {
    if (wantsStreamRef.current) {
      return
    }

    wantsStreamRef.current = true
    setError(null)
    setStatus('requesting')

    const run = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          // Also what a non-HTTPS origin looks like: the API is simply absent.
          throw new Error('This browser has no camera API available on a secure origin.')
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        // Stopped or unmounted while the prompt was up. Releasing here is what
        // keeps the camera light from staying on.
        if (!wantsStreamRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          // Autoplay is only permitted for muted, inline video.
          video.muted = true
          video.playsInline = true
          await video.play().catch(() => undefined)
        }

        setStatus('active')
      } catch (cause) {
        if (!wantsStreamRef.current) {
          return
        }

        wantsStreamRef.current = false
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        setStatus(isPermissionDenied(cause) ? 'denied' : 'error')
      }
    }

    void run()
  }, [constraints])

  // Release the camera on unmount, whatever state it is in.
  useEffect(() => {
    return () => {
      wantsStreamRef.current = false
      releaseStream()
    }
  }, [releaseStream])

  return { videoRef, status, error, start, stop }
}
