/**
 * Responsibility: run the pose model over the video feed and publish the result
 * in this app's own vocabulary.
 *
 * ## This file is the MediaPipe boundary
 *
 * It is the ONLY module permitted to import from `@mediapipe/tasks-vision`.
 * Everything downstream — components, the boxing domain, the state machine —
 * consumes `PoseLandmarks` from `src/types/pose.ts`, which owes nothing to any
 * vendor. Swapping MediaPipe for TensorFlow, or for recorded fixtures in a test,
 * is a rewrite of this file and of nothing else (Dependency Inversion, per
 * `.claude/RULES.md`).
 *
 * That includes the landmark *indices*: BlazePose's "landmark 11 is the left
 * shoulder" is knowledge that stops here.
 *
 * ## No pose maths
 *
 * This hook maps and publishes. It does not measure angles, compare distances,
 * decide whether a movement is a slip, or apply confidence thresholds. That is
 * `src/boxing/defenseDetector.ts`, against tunables in
 * `src/boxing/config/thresholds.ts`.
 */
import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

import { POSE_MODEL_URL, POSE_WASM_BASE } from './poseAssets'
import type { DetectionStatus, Keypoint, KeypointName, PoseLandmarks } from '../types'

export interface UsePoseDetectionResult {
  /** The most recent pose, or null when nobody is tracked. */
  landmarks: PoseLandmarks | null
  detectionStatus: DetectionStatus
  /** Set if the model failed to load. */
  error: Error | null
  /** False while the WASM runtime and model are still downloading. */
  isReady: boolean
}

/**
 * Where each landmark we care about sits in BlazePose's 33-point output.
 *
 * The single place these indices are allowed to appear. Note the names are from
 * the *subject's* point of view, not the viewer's — MediaPipe's "left shoulder"
 * is the shoulder on the person's own left, which appears on the right of an
 * unmirrored image.
 */
const LANDMARK_INDEX: Readonly<Record<KeypointName, number>> = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
}

const KEYPOINT_NAMES = Object.keys(LANDMARK_INDEX) as KeypointName[]

/**
 * Map one detected pose down to the landmarks the trainer uses.
 *
 * `visibility` becomes `score`. A landmark the model could not see is still
 * present in the record, carrying a low score — `PoseLandmarks` is a total
 * record by design, so consumers gate on confidence rather than on existence.
 */
function toPoseLandmarks(detected: readonly NormalizedLandmark[]): PoseLandmarks {
  const entries = KEYPOINT_NAMES.map((name): [KeypointName, Keypoint] => {
    const landmark = detected[LANDMARK_INDEX[name]]

    return [
      name,
      {
        name,
        x: landmark?.x ?? 0,
        y: landmark?.y ?? 0,
        score: landmark?.visibility ?? 0,
      },
    ]
  })

  return Object.fromEntries(entries) as PoseLandmarks
}

/**
 * Run the pose model over a video element.
 *
 * `videoRef` must be **stable across renders** — the one `useWebcam` returns
 * is. A ref created inline in the render body is a new object each time, which
 * makes the effect below tear the landmarker down and reload the model on every
 * render: the app appears to work, slowly, while refetching the model forever.
 */
export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): UsePoseDetectionResult {
  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null)
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('notStarted')
  const [error, setError] = useState<Error | null>(null)
  const [isReady, setIsReady] = useState(false)

  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  // detectForVideo rejects a timestamp that has not advanced, and the camera
  // produces frames more slowly than the display refreshes.
  const lastFrameTimeRef = useRef(-1)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let frameHandle = 0

    const detect = () => {
      // requestAnimationFrame rather than setInterval: detection is only useful
      // if it lands on the same cadence the overlay is drawn at. An interval
      // would drift against the frame clock and queue work in a background tab.
      frameHandle = requestAnimationFrame(detect)

      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return
      }

      // The display refreshes faster than the camera delivers; re-running the
      // model on a frame already seen costs time and returns the same answer.
      if (video.currentTime === lastFrameTimeRef.current) {
        return
      }
      lastFrameTimeRef.current = video.currentTime

      const result = landmarker.detectForVideo(video, performance.now())
      const pose = result.landmarks[0]

      if (!pose || pose.length === 0) {
        setDetectionStatus('noPerson')
        setLandmarks(null)
        return
      }

      setDetectionStatus('ok')
      setLandmarks(toPoseLandmarks(pose))
    }

    const load = async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(POSE_WASM_BASE)
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          // One boxer. Tracking a second person in frame would only give the
          // detector someone else's arms to score.
          numPoses: 1,
        })

        if (cancelled) {
          landmarker.close()
          return
        }

        landmarkerRef.current = landmarker
        setIsReady(true)
        setDetectionStatus('noPerson')
        frameHandle = requestAnimationFrame(detect)
      } catch (cause) {
        if (cancelled) {
          return
        }
        setError(cause instanceof Error ? cause : new Error(String(cause)))
        setDetectionStatus('notStarted')
      }
    }

    void load()

    return () => {
      cancelled = true
      cancelAnimationFrame(frameHandle)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      lastFrameTimeRef.current = -1
      setIsReady(false)
      // Cleared here rather than in the effect body so a re-enable does not
      // briefly publish the pose from the last time the camera was on.
      setLandmarks(null)
      setDetectionStatus('notStarted')
    }
  }, [enabled, videoRef])

  // Derived rather than stored, so switching off reports `notStarted`
  // immediately instead of after an effect has run.
  return {
    landmarks: enabled ? landmarks : null,
    detectionStatus: enabled ? detectionStatus : 'notStarted',
    error,
    isReady: enabled && isReady,
  }
}
