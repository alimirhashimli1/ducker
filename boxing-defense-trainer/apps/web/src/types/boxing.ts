/**
 * Responsibility: the domain vocabulary of the trainer — what an attack is,
 * what counts as a defense, how a session is scored and what phase the training
 * loop is in. Pure type declarations shared by `src/boxing/` and the UI layer.
 */

/** Punches the trainer can throw at the user. */
export type AttackType =
  'jab' | 'cross' | 'leftHook' | 'rightHook' | 'leftUppercut' | 'rightUppercut'

/** Defensive movements the user can perform in response. */
export type DefenseType =
  'slipLeft' | 'slipRight' | 'duck' | 'blockLeft' | 'blockRight' | 'leanBack'

export type Difficulty = 'rookie' | 'amateur' | 'pro'

/** A single incoming punch, positioned in time relative to the sequence start. */
export interface Attack {
  readonly id: string
  readonly type: AttackType
  /** Offset in ms from the start of the sequence at which the punch lands. */
  readonly landsAt: number
  /** Defenses that count as a correct answer to this punch. */
  readonly validDefenses: readonly DefenseType[]
}

/** An ordered combination of punches thrown as one unit. */
export interface AttackSequence {
  readonly id: string
  readonly difficulty: Difficulty
  readonly attacks: readonly Attack[]
}

/** How the user answered one attack. */
export type DefenseOutcome = 'clean' | 'late' | 'wrong' | 'missed'

/** The scored result of a single attack/defense exchange. */
export interface ScoreEvent {
  readonly attackId: string
  readonly outcome: DefenseOutcome
  /** Signed ms between the punch landing and the detected defense; negative = early. */
  readonly reactionMs: number
  readonly points: number
}

/** Aggregate result of one training session. */
export interface SessionScore {
  readonly totalPoints: number
  readonly cleanCount: number
  readonly missedCount: number
  readonly averageReactionMs: number
}

/** Phases of the training loop state machine. */
export type TrainingPhase = 'idle' | 'calibrating' | 'countdown' | 'active' | 'paused' | 'complete'
