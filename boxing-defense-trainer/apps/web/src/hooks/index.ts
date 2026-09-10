/**
 * Responsibility: the import site for the app's hooks, so components depend on
 * `../hooks` rather than on individual files.
 */
export { useWebcam } from './useWebcam'
export type { UseWebcamResult, WebcamStatus } from './useWebcam'

export { usePoseDetection } from './usePoseDetection'
export type { UsePoseDetectionResult } from './usePoseDetection'

export { useCalibration, CALIBRATION_PROMPT } from './useCalibration'
export type { CalibrationPhase, UseCalibrationResult } from './useCalibration'

export { useTrainingSession } from './useTrainingSession'
export type { UseTrainingSessionResult } from './useTrainingSession'
