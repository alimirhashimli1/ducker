/**
 * Tests for the calibration flow.
 *
 * What matters here is *when* samples are taken, not what they mean — the
 * measurement is covered in `boxing/calibration.test.ts`. The window is the
 * whole point: sampling the entire countdown would average in the user still
 * walking into position, biasing the baseline toward wherever they were on the
 * way.
 */
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useCalibration } from './useCalibration'
import { THRESHOLDS } from '../boxing'
import type { KeypointName, PoseLandmarks } from '../types'

const NAMES: readonly KeypointName[] = [
  'nose',
  'leftEye',
  'rightEye',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
]

/** A fresh object each call, so React sees a new frame. */
function stance(noseX = 0.5): PoseLandmarks {
  const x: Record<string, number> = {
    nose: noseX,
    leftShoulder: 0.4,
    rightShoulder: 0.6,
    leftHip: 0.44,
    rightHip: 0.56,
  }

  return Object.fromEntries(
    NAMES.map((name) => [name, { name, x: x[name] ?? 0.5, y: 0.4, score: 0.9 }]),
  ) as PoseLandmarks
}

/** Drive the hook the way the Countdown component does. */
function runCountdown(
  result: { current: ReturnType<typeof useCalibration> },
  rerender: (props: { landmarks: PoseLandmarks | null }) => void,
  framesPerSecond = 10,
) {
  for (let second = THRESHOLDS.session.countdownSeconds; second > 0; second -= 1) {
    act(() => result.current.handleCountdownTick(second))
    for (let frame = 0; frame < framesPerSecond; frame += 1) {
      act(() => rerender({ landmarks: stance() }))
    }
  }
  act(() => result.current.handleCountdownComplete())
}

function setup(initial: PoseLandmarks | null = stance()) {
  return renderHook(({ landmarks }) => useCalibration(landmarks, 'ok'), {
    initialProps: { landmarks: initial },
  })
}

describe('useCalibration', () => {
  it('starts with no baseline and nothing running', () => {
    const { result } = setup()

    expect(result.current.phase).toBe('idle')
    expect(result.current.baseline).toBeNull()
    expect(result.current.prompt).toBeNull()
  })

  it('prompts the user into stance while measuring', () => {
    const { result } = setup()

    act(() => result.current.recalibrate())

    expect(result.current.phase).toBe('countdown')
    expect(result.current.prompt).toBe('STAND IN YOUR BOXING STANCE')
  })

  it('counts down from the configured length', () => {
    const { result } = setup()

    expect(result.current.countdownFrom).toBe(THRESHOLDS.session.countdownSeconds)
  })

  it('does not sample until the tail of the countdown', () => {
    const { result } = setup()

    act(() => result.current.recalibrate())
    act(() => result.current.handleCountdownTick(THRESHOLDS.session.countdownSeconds))

    // Still walking into position at this point.
    expect(result.current.phase).toBe('countdown')
  })

  it('opens the sampling window inside the configured tail', () => {
    const { result } = setup()

    act(() => result.current.recalibrate())
    act(() => result.current.handleCountdownTick(THRESHOLDS.session.calibrationSamplingSeconds))

    expect(result.current.phase).toBe('sampling')
  })

  it('produces a baseline from the frames seen while sampling', () => {
    const { result, rerender } = setup()

    act(() => result.current.recalibrate())
    runCountdown(result, rerender)

    expect(result.current.phase).toBe('ready')
    expect(result.current.baseline).not.toBeNull()
    expect(result.current.baseline!.bodyWidth).toBeCloseTo(0.2, 5)
  })

  it('averages only the sampling-window frames, not the whole countdown', () => {
    // The frames before the window put the nose somewhere else entirely. If they
    // leaked in, the baseline would land between the two positions.
    const { result, rerender } = setup()

    act(() => result.current.recalibrate())

    act(() => result.current.handleCountdownTick(THRESHOLDS.session.countdownSeconds))
    for (let i = 0; i < 20; i += 1) {
      act(() => rerender({ landmarks: stance(0.2) }))
    }

    act(() => result.current.handleCountdownTick(THRESHOLDS.session.calibrationSamplingSeconds))
    for (let i = 0; i < 20; i += 1) {
      act(() => rerender({ landmarks: stance(0.5) }))
    }
    act(() => result.current.handleCountdownComplete())

    expect(result.current.baseline!.head.x).toBeCloseTo(0.5, 5)
  })

  it('fails, with a reason, when nobody was in frame', () => {
    const { result } = setup(null)

    act(() => result.current.recalibrate())
    act(() => result.current.handleCountdownTick(1))
    act(() => result.current.handleCountdownComplete())

    expect(result.current.phase).toBe('failed')
    expect(result.current.failure).toBe('noSamples')
    expect(result.current.baseline).toBeNull()
  })

  it('discards the previous baseline when recalibrating', () => {
    // A stale baseline is worse than none: it looks valid while describing a
    // stance the user is no longer standing in.
    const { result, rerender } = setup()

    act(() => result.current.recalibrate())
    runCountdown(result, rerender)
    expect(result.current.baseline).not.toBeNull()

    act(() => result.current.recalibrate())

    expect(result.current.baseline).toBeNull()
    expect(result.current.phase).toBe('countdown')
  })

  it('does not carry samples over between runs', () => {
    const { result, rerender } = setup()

    act(() => result.current.recalibrate())
    runCountdown(result, rerender)
    const first = result.current.baseline!.sampleCount

    act(() => result.current.recalibrate())
    runCountdown(result, rerender)

    expect(result.current.baseline!.sampleCount).toBe(first)
  })

  it('ignores frames while the detector reports no person', () => {
    const { result, rerender } = renderHook(
      ({ landmarks, status }) => useCalibration(landmarks, status),
      { initialProps: { landmarks: stance(), status: 'noPerson' as const } },
    )

    act(() => result.current.recalibrate())
    act(() => result.current.handleCountdownTick(1))
    for (let i = 0; i < 20; i += 1) {
      act(() => rerender({ landmarks: stance(), status: 'noPerson' as const }))
    }
    act(() => result.current.handleCountdownComplete())

    expect(result.current.phase).toBe('failed')
  })
})
