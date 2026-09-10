/**
 * Unit tests for stance calibration.
 *
 * The averaging is the substance here. A baseline that looks plausible but is
 * skewed by a couple of bad frames produces a detector that is subtly wrong
 * about every movement afterwards, and nothing downstream would flag it — so
 * these tests check that the estimator actually rejects and de-weights noise,
 * not merely that it returns numbers.
 */
import { describe, expect, it } from 'vitest'

import { calibrate, calibrationFailureMessage, type CalibrationFailure } from './calibration'
import { THRESHOLDS } from './config/thresholds'
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

/** A confidently detected, square-on stance. */
function stance(
  overrides: Partial<Record<KeypointName, Partial<{ x: number; y: number; score: number }>>> = {},
): PoseLandmarks {
  const base: Record<KeypointName, { x: number; y: number }> = {
    nose: { x: 0.5, y: 0.2 },
    leftEye: { x: 0.47, y: 0.18 },
    rightEye: { x: 0.53, y: 0.18 },
    leftShoulder: { x: 0.4, y: 0.35 },
    rightShoulder: { x: 0.6, y: 0.35 },
    leftElbow: { x: 0.36, y: 0.5 },
    rightElbow: { x: 0.64, y: 0.5 },
    leftWrist: { x: 0.44, y: 0.28 },
    rightWrist: { x: 0.56, y: 0.28 },
    leftHip: { x: 0.44, y: 0.6 },
    rightHip: { x: 0.56, y: 0.6 },
    leftKnee: { x: 0.44, y: 0.8 },
    rightKnee: { x: 0.56, y: 0.8 },
  }

  return Object.fromEntries(
    NAMES.map((name) => [
      name,
      { name, x: base[name].x, y: base[name].y, score: 0.9, ...overrides[name] },
    ]),
  ) as PoseLandmarks
}

const samples = (count: number, sample: PoseLandmarks = stance()) =>
  Array.from({ length: count }, () => sample)

describe('calibrate', () => {
  it('refuses when nothing was captured', () => {
    const result = calibrate([])

    expect(result).toEqual({ ok: false, reason: 'noSamples' })
  })

  it('refuses when too few samples are usable', () => {
    // Four frames of jitter is not a measurement, however confident each one is.
    const result = calibrate(samples(4))

    expect(result.ok).toBe(false)
  })

  it('refuses samples where the torso is not confidently seen', () => {
    const occluded = stance({ leftHip: { score: 0.1 }, rightHip: { score: 0.1 } })
    const result = calibrate(samples(30, occluded))

    expect(result).toEqual({ ok: false, reason: 'notEnoughConfidentSamples' })
  })

  it('refuses a body too small in frame to measure against', () => {
    // Shoulder width is the unit every threshold is expressed in. If it is a
    // sliver of the frame, every derived threshold is noise.
    const distant = stance({ leftShoulder: { x: 0.5 }, rightShoulder: { x: 0.52 } })
    const result = calibrate(samples(30, distant))

    expect(result).toEqual({ ok: false, reason: 'bodyNotVisible' })
  })

  it('measures head, shoulders, hips and body width from a clean stance', () => {
    const result = calibrate(samples(30))

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { baseline } = result
    expect(baseline.head.x).toBeCloseTo(0.5, 5)
    expect(baseline.head.y).toBeCloseTo(0.2, 5)
    expect(baseline.shoulders.center.x).toBeCloseTo(0.5, 5)
    expect(baseline.hips.center.y).toBeCloseTo(0.6, 5)
    // 0.6 - 0.4, the shoulders being level.
    expect(baseline.bodyWidth).toBeCloseTo(0.2, 5)
    expect(baseline.sampleCount).toBe(30)
  })

  it('counts only the usable samples', () => {
    const good = samples(20)
    const bad = samples(10, stance({ nose: { score: 0.05 } }))
    const result = calibrate([...good, ...bad])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.baseline.sampleCount).toBe(20)
  })

  it('averages symmetric jitter away', () => {
    // The reason to average at all: equal and opposite noise should cancel, and
    // land on the true position rather than on either sample.
    const left = stance({ nose: { x: 0.48 } })
    const right = stance({ nose: { x: 0.52 } })
    const result = calibrate([...samples(15, left), ...samples(15, right)])

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.baseline.head.x).toBeCloseTo(0.5, 5)
  })

  it('de-weights a low-confidence outlier instead of letting it drag the mean', () => {
    // A tracking glitch puts the nose across the frame, but the model says it is
    // barely sure. A plain mean would move the baseline a long way; a weighted
    // one barely notices.
    const clean = samples(20)
    const glitch = stance({ nose: { x: 0.95, score: 0.5 } })
    const result = calibrate([...clean, glitch])

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const plainMean = (20 * 0.5 + 0.95) / 21
    const weightedError = Math.abs(result.baseline.head.x - 0.5)
    const plainError = Math.abs(plainMean - 0.5)

    // Weighting does not erase the outlier — a landmark that clears the
    // confidence gate still counts for something — but it must pull the
    // baseline meaningfully back toward the truth.
    expect(result.baseline.head.x).toBeLessThan(plainMean)
    expect(weightedError).toBeLessThan(plainError * 0.75)
  })

  it('is unaffected by sample order', () => {
    const a = calibrate([...samples(10, stance({ nose: { x: 0.48 } })), ...samples(10)])
    const b = calibrate([...samples(10), ...samples(10, stance({ nose: { x: 0.48 } }))])

    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return

    // Compared to a tolerance rather than exactly: summing the same floats in a
    // different order gives answers that differ in the last bits. That is
    // floating point, not order-dependence, and pinning it exactly would make
    // this test fail for a reason nobody cares about.
    expect(a.baseline.head.x).toBeCloseTo(b.baseline.head.x, 12)
    expect(a.baseline.bodyWidth).toBeCloseTo(b.baseline.bodyWidth, 12)
    expect(a.baseline.sampleCount).toBe(b.baseline.sampleCount)
  })

  it('does not mutate the samples it is given', () => {
    const input = samples(20)
    const before = structuredClone(input)

    calibrate(input)

    expect(input).toEqual(before)
  })

  it('treats the confidence gate as the boundary for usability', () => {
    // Pinned against the configured threshold rather than a literal, so tuning
    // the gate does not silently invalidate this test.
    const atGate = stance({ nose: { score: THRESHOLDS.pose.minKeypointScore } })
    const belowGate = stance({ nose: { score: THRESHOLDS.pose.minKeypointScore - 0.01 } })

    expect(calibrate(samples(30, atGate)).ok).toBe(true)
    expect(calibrate(samples(30, belowGate)).ok).toBe(false)
  })
})

describe('calibrationFailureMessage', () => {
  it.each(['noSamples', 'notEnoughConfidentSamples', 'bodyNotVisible'] as const)(
    'gives actionable advice for %s',
    (reason: CalibrationFailure) => {
      const message = calibrationFailureMessage(reason)

      // Each failure needs different advice; "calibration failed" helps nobody.
      expect(message.length).toBeGreaterThan(20)
    },
  )

  it('says something different for each failure', () => {
    const messages = (['noSamples', 'notEnoughConfidentSamples', 'bodyNotVisible'] as const).map(
      calibrationFailureMessage,
    )

    expect(new Set(messages).size).toBe(messages.length)
  })
})
