/**
 * Responsibility: turn a burst of pose samples into a `NeutralStanceBaseline` —
 * the measurement of the user standing still that every later movement is
 * judged against.
 *
 * Pure and synchronous. It is handed samples and returns a baseline; it does not
 * capture them, time them, or know a countdown exists. That is
 * `hooks/useCalibration.ts`.
 *
 * ## Why this has to run before detection
 *
 * Every threshold in `config/thresholds.ts` is a ratio of shoulder width, and
 * every movement is a displacement from rest. Both halves of that come from
 * here. Without a baseline the detector has no idea whether a head at y=0.42 is
 * a slip or simply where the user's head lives, and no idea whether a 0.08
 * displacement is a twitch or a full lean. Detection against an absent or stale
 * baseline is not degraded — it is meaningless.
 *
 * That is also why recalibration matters: the baseline is invalidated by the
 * user stepping toward the camera, the laptop being nudged, or a different
 * person taking a turn.
 */
import { distance, midpoint } from '../utils/geometry'
import { THRESHOLDS } from './config/thresholds'
import type { KeypointName, NeutralStanceBaseline, Point2D, PoseLandmarks } from '../types'

/** Landmarks a sample must show confidently for it to be worth averaging. */
const REQUIRED: readonly KeypointName[] = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftHip',
  'rightHip',
]

export type CalibrationFailure =
  /** Nothing was captured at all — the camera or detector was not running. */
  | 'noSamples'
  /** Samples arrived, but too few showed the whole torso confidently. */
  | 'notEnoughConfidentSamples'
  /** The user was found, but too far away or side-on to measure. */
  | 'bodyNotVisible'

export type CalibrationResult =
  | { readonly ok: true; readonly baseline: NeutralStanceBaseline }
  | { readonly ok: false; readonly reason: CalibrationFailure }

/**
 * The fewest usable samples worth trusting.
 *
 * Averaging cuts random jitter by roughly the square root of the sample count,
 * so four samples halve it and sixteen quarter it. Below this the "baseline"
 * would carry most of the noise of a single frame while looking authoritative.
 */
const MIN_USABLE_SAMPLES = 5

/**
 * A body narrower than this, in normalised frame units, is too far away or too
 * side-on for the shoulder width to be a meaningful unit — every threshold
 * derived from it would be a fraction of a fraction of the frame, and noise
 * would swamp them.
 */
const MIN_BODY_WIDTH = 0.05

/** Whether every landmark the baseline needs is confidently placed. */
function isUsable(sample: PoseLandmarks): boolean {
  return REQUIRED.every((name) => sample[name].score >= THRESHOLDS.pose.minKeypointScore)
}

/**
 * Average one landmark across the samples, weighted by the detector's own
 * confidence in it.
 *
 * ## The averaging approach, and why this one
 *
 * Pose jitter is roughly zero-mean noise around the true position: the model
 * reports the same shoulder a pixel or two either side, frame to frame. The
 * arithmetic mean is the right estimator for that — it cancels, and the error
 * falls as 1/sqrt(n).
 *
 * A plain mean has one weakness: a tracking glitch, where the model briefly puts
 * a landmark somewhere impossible, is an outlier that drags the result with full
 * weight. The usual fix is a median, but that throws away the variance reduction
 * the mean is here for.
 *
 * Weighting by `score` gets both. Glitched landmarks almost always come with low
 * confidence, so they contribute proportionally little without being discarded
 * outright, and the estimator stays a mean. Samples that fail `isUsable` are
 * already gone before this runs, so this handles the softer cases the gate lets
 * through.
 *
 * Falls back to an unweighted mean if every weight is zero, which can only
 * happen if the confidence gate is configured down to zero.
 */
function weightedAverage(samples: readonly PoseLandmarks[], name: KeypointName): Point2D {
  let totalWeight = 0
  let x = 0
  let y = 0

  for (const sample of samples) {
    const landmark = sample[name]
    const weight = landmark.score

    totalWeight += weight
    x += landmark.x * weight
    y += landmark.y * weight
  }

  if (totalWeight === 0) {
    const count = samples.length
    return {
      x: samples.reduce((sum, s) => sum + s[name].x, 0) / count,
      y: samples.reduce((sum, s) => sum + s[name].y, 0) / count,
    }
  }

  return { x: x / totalWeight, y: y / totalWeight }
}

/**
 * Measure the user's resting stance.
 *
 * Returns a result rather than throwing or returning null, because the caller
 * has something different to say for each failure: "step into frame" is not the
 * same advice as "stand closer to the camera".
 */
export function calibrate(samples: readonly PoseLandmarks[]): CalibrationResult {
  if (samples.length === 0) {
    return { ok: false, reason: 'noSamples' }
  }

  const usable = samples.filter(isUsable)

  if (usable.length < MIN_USABLE_SAMPLES) {
    return { ok: false, reason: 'notEnoughConfidentSamples' }
  }

  const leftShoulder = weightedAverage(usable, 'leftShoulder')
  const rightShoulder = weightedAverage(usable, 'rightShoulder')
  const bodyWidth = distance(leftShoulder, rightShoulder)

  if (bodyWidth < MIN_BODY_WIDTH) {
    return { ok: false, reason: 'bodyNotVisible' }
  }

  const leftHip = weightedAverage(usable, 'leftHip')
  const rightHip = weightedAverage(usable, 'rightHip')

  return {
    ok: true,
    baseline: {
      head: weightedAverage(usable, 'nose'),
      shoulders: {
        left: leftShoulder,
        right: rightShoulder,
        center: midpoint(leftShoulder, rightShoulder),
      },
      hips: {
        left: leftHip,
        right: rightHip,
        center: midpoint(leftHip, rightHip),
      },
      wrists: {
        left: weightedAverage(usable, 'leftWrist'),
        right: weightedAverage(usable, 'rightWrist'),
      },
      bodyWidth,
      sampleCount: usable.length,
    },
  }
}

/** What to tell the user when calibration could not produce a baseline. */
export function calibrationFailureMessage(reason: CalibrationFailure): string {
  switch (reason) {
    case 'noSamples':
      return 'The camera saw nothing. Check it is on, then try again.'
    case 'notEnoughConfidentSamples':
      return 'Could not see you clearly. Make sure your head, shoulders and hips are all in frame.'
    case 'bodyNotVisible':
      return 'You look too far from the camera. Step closer and face it square on.'
  }
}
