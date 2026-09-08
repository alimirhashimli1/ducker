/**
 * Responsibility: display the pre-round countdown beat. It renders the value it
 * is handed and reports completion; it does not own the clock.
 */
export interface CountdownProps {
  /** Whole seconds remaining. Zero renders the final "BOX" beat. */
  secondsRemaining?: number
  onComplete?: () => void
  className?: string
}

// TODO: render the number/BOX beat and fire onComplete at zero.
export function Countdown({ className }: CountdownProps) {
  return <div className={className} data-testid="countdown" />
}
