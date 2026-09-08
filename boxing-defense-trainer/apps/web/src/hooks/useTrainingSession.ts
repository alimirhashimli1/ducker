/**
 * Responsibility: bind the pure training state machine to React and to the
 * clock. It owns the effects — ticking, scheduling sequences, dispatching
 * events — while every decision is delegated to src/boxing/.
 */
import { initialTrainingState, type TrainingEvent, type TrainingState } from '../boxing'

export interface UseTrainingSessionResult {
  readonly state: TrainingState
  readonly dispatch: (event: TrainingEvent) => void
}

/**
 * Drive one training session.
 *
 * TODO: back this with useReducer(trainingReducer) and a requestAnimationFrame
 * loop that converts elapsed time into TrainingEvents.
 */
export function useTrainingSession(): UseTrainingSessionResult {
  return {
    state: initialTrainingState,
    dispatch: () => undefined,
  }
}
