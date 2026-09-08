/**
 * Responsibility: draw the sparring partner and telegraph the incoming punch.
 * Purely presentational — it is told what to show, never what it means.
 */
import type { Attack } from '../../types'

export interface BoxerProps {
  /** The punch currently being thrown, or null when the partner is at rest. */
  attack?: Attack | null
  /** Progress through the current punch's wind-up, in [0,1]. */
  progress?: number
  className?: string
}

// TODO: render stance + per-AttackType throwing animation, driven by `progress`.
export function Boxer({ className }: BoxerProps) {
  return <div className={className} data-testid="boxer" />
}
