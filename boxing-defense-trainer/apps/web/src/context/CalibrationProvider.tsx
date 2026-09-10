/**
 * Responsibility: run calibration once, near the top of the tree, and publish
 * the result to anything below that needs it.
 *
 * The baseline is needed in three unrelated places — the detector, a HUD
 * readout, and the Recalibrate button — that share no path through the tree
 * except the root. Threading it as props would put a `baseline` prop on every
 * component in between purely to pass it along, which `.claude/RULES.md`'s
 * "keep components small" rules out. Context is the narrower option here.
 *
 * It holds no state of its own: `useCalibration` owns that, and this only makes
 * it reachable.
 */
import type { ReactNode } from 'react'

import { CalibrationContext } from './CalibrationContext'
import { useCalibration } from '../hooks/useCalibration'
import type { DetectionStatus, PoseLandmarks } from '../types'

export interface CalibrationProviderProps {
  /** The live pose, from `usePoseDetection`. */
  landmarks: PoseLandmarks | null
  detectionStatus: DetectionStatus
  children: ReactNode
}

export function CalibrationProvider({
  landmarks,
  detectionStatus,
  children,
}: CalibrationProviderProps) {
  const calibration = useCalibration(landmarks, detectionStatus)

  return <CalibrationContext value={calibration}>{children}</CalibrationContext>
}
