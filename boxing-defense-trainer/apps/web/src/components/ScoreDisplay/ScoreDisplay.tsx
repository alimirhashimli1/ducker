/**
 * Responsibility: render scoring feedback — live verdicts and the final
 * summary. It formats numbers it is given and computes no scores itself.
 */
import type { ScoreEvent, SessionScore } from '../../types'

export interface ScoreDisplayProps {
  /** The most recent exchange, for the live verdict flash. */
  latestEvent?: ScoreEvent | null
  /** Populated once the session reaches its `complete` phase. */
  summary?: SessionScore | null
  className?: string
}

// TODO: render the running total, streak, live verdict and end-of-session summary.
export function ScoreDisplay({ className }: ScoreDisplayProps) {
  return <div className={className} data-testid="score-display" />
}
