/**
 * Responsibility: own the phase transitions of a training session. It is a pure
 * reducer — every transition is a function of the current state and one event,
 * with time supplied by the caller rather than read from a clock.
 */
import type { AttackSequence, Difficulty, ScoreEvent, TrainingPhase } from '../../types'

/** Everything known about a session in progress. */
export interface TrainingState {
  readonly phase: TrainingPhase
  readonly difficulty: Difficulty
  /** The sequence currently being thrown, if any. */
  readonly currentSequence: AttackSequence | null
  /** Exchanges scored so far, oldest first. */
  readonly events: readonly ScoreEvent[]
  /** Session-relative time, in ms, of the last applied event. */
  readonly elapsedMs: number
}

/** Everything that can move a session between phases. */
export type TrainingEvent =
  | { readonly kind: 'calibrationRequested' }
  | { readonly kind: 'calibrationCompleted' }
  | { readonly kind: 'countdownFinished'; readonly at: number }
  | { readonly kind: 'sequenceStarted'; readonly sequence: AttackSequence }
  | { readonly kind: 'exchangeScored'; readonly event: ScoreEvent }
  | { readonly kind: 'paused' }
  | { readonly kind: 'resumed' }
  | { readonly kind: 'sessionEnded' }

export const initialTrainingState: TrainingState = {
  phase: 'idle',
  difficulty: 'rookie',
  currentSequence: null,
  events: [],
  elapsedMs: 0,
}

/**
 * Apply one event to the session state.
 *
 * TODO: implement the transition table. Unknown transitions must return the
 * state unchanged rather than throw, so a stray event cannot break a session.
 */
export function trainingReducer(state: TrainingState, _event: TrainingEvent): TrainingState {
  return state
}
