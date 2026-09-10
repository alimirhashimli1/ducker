/**
 * Responsibility: the public surface of the boxing domain. The React layer
 * imports from `../boxing`, never from a file deep inside it, so the domain's
 * internal structure can change without touching the UI.
 */
export {
  ALL_PUNCHES,
  ATTACK_CATALOGUE,
  attackFor,
  mirrorDefense,
  punchHand,
  resolveForStance,
} from './attacks'

export { ALL_DEFENSES, DEFENSE_CATALOGUE, isValidDefense, punchesAnsweredBy } from './defenses'
export type { DefenseMeta } from './defenses'

export { calibrate, calibrationFailureMessage } from './calibration'
export type { CalibrationFailure, CalibrationResult } from './calibration'

export { generateNextSequence, getInterAttackDelay, getIntraSequenceDelay } from './attackEngine'
export type { RandomSource } from './attackEngine'

export {
  delayRangeFor,
  nextDifficulty,
  punchPoolFor,
  sequenceShapeFor,
  timingToleranceFactorFor,
} from './difficulty'
export type { DelayRange, SequenceShape } from './difficulty'

export {
  detectDefense,
  detectGuard,
  detectParry,
  detectRoll,
  detectSlip,
  detectStepBack,
} from './defenseDetector'
export type { DefenseDetection, DetectionContext, LateralDirection } from './defenseDetector'

export { scoreBalance, scoreDefense, scoreMovement, scoreReaction } from './scoring'
export type { ScoreDefenseInput } from './scoring'

export {
  accumulate,
  allowedTargets,
  averageReactionMs,
  averageScore,
  canTransition,
  emptyRoundStats,
  initialTrainingState,
  isRoundComplete,
  toDefenseResult,
  trainingReducer,
} from './trainingStateMachine'
export type { TrainingEvent, TrainingEventKind } from './trainingStateMachine'

export { THRESHOLDS } from './config/thresholds'
export type { DifficultySettings } from './config/thresholds'
