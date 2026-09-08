/**
 * Responsibility: the public surface of the boxing domain. The React layer
 * imports from `../boxing`, never from a file deep inside it, so the domain's
 * internal structure can change without touching the UI.
 */
export { generateAttackSequence } from './engine/attackEngine'
export type { GenerateSequenceOptions, RandomSource } from './engine/attackEngine'

export { detectDefense } from './engine/defenseDetector'
export type { DefenseDetection } from './engine/defenseDetector'

export { scoreAttack, summariseSession } from './engine/scoring'
export { nextDifficulty } from './engine/difficulty'

export { initialTrainingState, trainingReducer } from './state/trainingMachine'
export type { TrainingEvent, TrainingState } from './state/trainingMachine'

export { COUNTDOWN_SECONDS, DIFFICULTY, MOVEMENT, POSE, SCORING, TIMING } from './config/thresholds'
