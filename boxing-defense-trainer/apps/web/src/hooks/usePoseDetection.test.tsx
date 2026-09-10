/**
 * Tests for the MediaPipe boundary.
 *
 * MediaPipe is mocked, which is the point: what is being tested is the
 * adapter — that BlazePose's 33-point output is mapped onto the trainer's own
 * 13 landmarks with the right indices, and that "nobody in frame" is reported
 * rather than silently passing through empty data. Those are the parts a
 * detector swap would have to reproduce.
 *
 * Getting an index wrong here is close to undetectable downstream: the skeleton
 * still draws, the numbers still look plausible, and a knee is quietly scored as
 * a wrist. Hence the explicit assertions on specific landmarks.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const detectForVideo = vi.fn()
const close = vi.fn()
const createFromOptions = vi.fn()

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(() => Promise.resolve({})) },
  PoseLandmarker: {
    createFromOptions: (...args: unknown[]): unknown => createFromOptions(...args) as unknown,
  },
}))

const { usePoseDetection } = await import('./usePoseDetection')

/** BlazePose emits 33 landmarks; index i is encoded so it can be identified. */
function blazePoseFrame(): { x: number; y: number; z: number; visibility: number }[] {
  return Array.from({ length: 33 }, (_, index) => ({
    x: index / 100,
    y: 1 - index / 100,
    z: 0,
    visibility: 0.9,
  }))
}

/** A video element that always looks like it has a fresh frame ready. */
function fakeVideo() {
  let time = 0
  return {
    get readyState() {
      return 2
    },
    get currentTime() {
      time += 1
      return time
    },
  } as unknown as HTMLVideoElement
}

/**
 * A ref that is stable across renders, exactly as useWebcam's is. Creating one
 * inline in the render callback would give the effect a new dependency every
 * render, tearing the landmarker down and rebuilding it forever.
 */
function videoRef() {
  const ref = createRef<HTMLVideoElement>()
  Object.assign(ref, { current: fakeVideo() })
  return ref
}

let ref: ReturnType<typeof videoRef>

beforeEach(() => {
  ref = videoRef()
  detectForVideo.mockReset()
  close.mockReset()
  createFromOptions.mockReset()
  createFromOptions.mockResolvedValue({ detectForVideo, close })
})

afterEach(() => vi.clearAllMocks())

describe('usePoseDetection', () => {
  it('reports notStarted and runs nothing while disabled', () => {
    const { result } = renderHook(() => usePoseDetection(ref, false))

    expect(result.current.detectionStatus).toBe('notStarted')
    expect(result.current.landmarks).toBeNull()
    expect(createFromOptions).not.toHaveBeenCalled()
  })

  it('loads the model for video, tracking a single pose', async () => {
    detectForVideo.mockReturnValue({ landmarks: [] })
    const { result } = renderHook(() => usePoseDetection(ref, true))

    await waitFor(() => expect(result.current.isReady).toBe(true))

    const options = createFromOptions.mock.calls[0]?.[1] as Record<string, unknown>
    expect(options['runningMode']).toBe('VIDEO')
    // A second person in frame would only give the detector someone else's arms.
    expect(options['numPoses']).toBe(1)
  })

  it('reports noPerson when the detector returns no pose', async () => {
    detectForVideo.mockReturnValue({ landmarks: [] })
    const { result } = renderHook(() => usePoseDetection(ref, true))

    await waitFor(() => expect(result.current.detectionStatus).toBe('noPerson'))
    expect(result.current.landmarks).toBeNull()
  })

  it('maps BlazePose indices onto the trainer landmarks', async () => {
    detectForVideo.mockReturnValue({ landmarks: [blazePoseFrame()] })
    const { result } = renderHook(() => usePoseDetection(ref, true))

    await waitFor(() => expect(result.current.detectionStatus).toBe('ok'))

    const landmarks = result.current.landmarks
    expect(landmarks).not.toBeNull()

    // x was encoded as index/100, so it reads back the index that was used.
    const indexOf = (name: keyof NonNullable<typeof landmarks>) =>
      Math.round(landmarks![name].x * 100)

    expect(indexOf('nose')).toBe(0)
    expect(indexOf('leftEye')).toBe(2)
    expect(indexOf('rightEye')).toBe(5)
    expect(indexOf('leftShoulder')).toBe(11)
    expect(indexOf('rightShoulder')).toBe(12)
    expect(indexOf('leftElbow')).toBe(13)
    expect(indexOf('rightElbow')).toBe(14)
    expect(indexOf('leftWrist')).toBe(15)
    expect(indexOf('rightWrist')).toBe(16)
    expect(indexOf('leftHip')).toBe(23)
    expect(indexOf('rightHip')).toBe(24)
    expect(indexOf('leftKnee')).toBe(25)
    expect(indexOf('rightKnee')).toBe(26)
  })

  it('returns a total record, every landmark named and scored', async () => {
    detectForVideo.mockReturnValue({ landmarks: [blazePoseFrame()] })
    const { result } = renderHook(() => usePoseDetection(ref, true))

    await waitFor(() => expect(result.current.landmarks).not.toBeNull())

    // PoseLandmarks is total by design: consumers gate on score, not existence.
    expect(Object.keys(result.current.landmarks!)).toHaveLength(13)
    for (const [name, keypoint] of Object.entries(result.current.landmarks!)) {
      expect(keypoint.name).toBe(name)
      expect(keypoint.score).toBe(0.9)
    }
  })

  it('carries visibility through as score rather than inventing confidence', async () => {
    const frame = blazePoseFrame()
    frame[15] = { x: 0.5, y: 0.5, z: 0, visibility: 0.05 }
    detectForVideo.mockReturnValue({ landmarks: [frame] })

    const { result } = renderHook(() => usePoseDetection(ref, true))

    await waitFor(() => expect(result.current.landmarks).not.toBeNull())
    // Occluded, but still present — the hook does not drop it or threshold it.
    expect(result.current.landmarks!.leftWrist.score).toBe(0.05)
  })

  it('closes the landmarker when disabled, so the model is not leaked', async () => {
    detectForVideo.mockReturnValue({ landmarks: [] })
    const { result, unmount } = renderHook(() => usePoseDetection(ref, true))

    await waitFor(() => expect(result.current.isReady).toBe(true))
    unmount()

    expect(close).toHaveBeenCalled()
  })

  it('surfaces a model load failure instead of spinning', async () => {
    createFromOptions.mockRejectedValue(new Error('model unreachable'))

    const { result } = renderHook(() => usePoseDetection(ref, true))

    await waitFor(() => expect(result.current.error?.message).toBe('model unreachable'))
    expect(result.current.detectionStatus).toBe('notStarted')
  })
})
