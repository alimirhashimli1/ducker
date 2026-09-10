/**
 * Responsibility: run the calibration ritual. Prompt the user into stance, count
 * them down, collect pose samples across the tail of that countdown, hand them
 * to `boxing/calibration.ts`, and hold the resulting baseline.
 *
 * The measurement itself is not here. This hook owns *when* samples are taken;
 * what they mean is pure logic in the domain, which is what lets the averaging
 * be tested without a camera, a clock or React.
 *
 * Samples accumulate in a ref, not in state. Pose updates arrive at the frame
 * rate, and re-rendering thirty times a second to grow an array would cost more
 * than the detection does.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { calibrate, THRESHOLDS } from '../boxing'
import type { CalibrationFailure } from '../boxing'
import type { DetectionStatus, NeutralStanceBaseline, PoseLandmarks } from '../types'

/**
 * - `idle`      — no baseline and not measuring; nothing has been asked for.
 * - `countdown` — "STAND IN YOUR BOXING STANCE" is up and the clock is running.
 * - `sampling`  — the final seconds, poses are being collected.
 * - `ready`     — a baseline exists and training can begin.
 * - `failed`    — the samples were unusable; `failure` says why.
 */
export type CalibrationPhase = 'idle' | 'countdown' | 'sampling' | 'ready' | 'failed'

export const CALIBRATION_PROMPT = 'STAND IN YOUR BOXING STANCE'

export interface UseCalibrationResult {
  phase: CalibrationPhase
  /** The measured stance, or null until calibration succeeds. */
  baseline: NeutralStanceBaseline | null
  /** Set only in the `failed` phase. */
  failure: CalibrationFailure | null
  /** Shown while measuring; null otherwise. */
  prompt: string | null
  /** Seconds the countdown should run for. */
  countdownFrom: number
  /** Start, or restart, measuring. Discards any existing baseline. */
  recalibrate: () => void
  /** Wire to `Countdown`'s `onTick`; opens the sampling window near zero. */
  handleCountdownTick: (secondsRemaining: number) => void
  /** Wire to `Countdown`'s `onComplete`; computes the baseline. */
  handleCountdownComplete: () => void
}

export function useCalibration(
  landmarks: PoseLandmarks | null,
  detectionStatus: DetectionStatus,
): UseCalibrationResult {
  const [phase, setPhase] = useState<CalibrationPhase>('idle')
  const [baseline, setBaseline] = useState<NeutralStanceBaseline | null>(null)
  const [failure, setFailure] = useState<CalibrationFailure | null>(null)

  const samplesRef = useRef<PoseLandmarks[]>([])
  const previousPhaseRef = useRef<CalibrationPhase>(phase)

  // Collect while sampling. Keyed off the landmarks object identity, which
  // changes once per detected frame.
  useEffect(() => {
    const windowJustOpened = previousPhaseRef.current !== 'sampling' && phase === 'sampling'
    previousPhaseRef.current = phase

    if (phase !== 'sampling' || detectionStatus !== 'ok' || !landmarks) {
      return
    }

    // The frame already on screen when the window opened was captured before
    // it, while the user was still settling into stance. This effect re-runs on
    // the phase change itself, so without this that stale frame is the first
    // thing averaged in — which is the exact bias the window exists to avoid.
    if (windowJustOpened) {
      return
    }

    samplesRef.current.push(landmarks)
  }, [landmarks, phase, detectionStatus])

  const recalibrate = useCallback(() => {
    samplesRef.current = []
    setBaseline(null)
    setFailure(null)
    setPhase('countdown')
  }, [])

  const handleCountdownTick = useCallback((secondsRemaining: number) => {
    // Sampling opens for the tail of the countdown only. Earlier seconds are
    // the user still walking into position, and averaging those in would bias
    // the baseline toward wherever they were on the way.
    if (secondsRemaining > 0 && secondsRemaining <= THRESHOLDS.session.calibrationSamplingSeconds) {
      setPhase('sampling')
    }
  }, [])

  const handleCountdownComplete = useCallback(() => {
    const result = calibrate(samplesRef.current)
    samplesRef.current = []

    if (result.ok) {
      setBaseline(result.baseline)
      setFailure(null)
      setPhase('ready')
      return
    }

    setBaseline(null)
    setFailure(result.reason)
    setPhase('failed')
  }, [])

  const isMeasuring = phase === 'countdown' || phase === 'sampling'

  return {
    phase,
    baseline,
    failure,
    prompt: isMeasuring ? CALIBRATION_PROMPT : null,
    countdownFrom: THRESHOLDS.session.countdownSeconds,
    recalibrate,
    handleCountdownTick,
    handleCountdownComplete,
  }
}
