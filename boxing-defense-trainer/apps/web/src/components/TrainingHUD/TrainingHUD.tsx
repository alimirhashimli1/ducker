/**
 * Responsibility: show the live state of a session and expose its controls.
 * It reflects the state machine; it never advances it itself.
 */
import type { Difficulty, TrainingPhase } from '../../types'

export interface TrainingHUDProps {
  phase?: TrainingPhase
  difficulty?: Difficulty
  /** Time left in the round, in ms. */
  timeRemainingMs?: number
  onStart?: () => void
  onPause?: () => void
  onEnd?: () => void
  className?: string
}

// TODO: lay out round/difficulty/time readouts and wire the control callbacks.
export function TrainingHUD({ className }: TrainingHUDProps) {
  return <div className={className} data-testid="training-hud" />
}
