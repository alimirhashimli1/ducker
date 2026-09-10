/**
 * Responsibility: count down from a number and say when it reaches zero. It
 * renders the beat and owns only its own tick.
 *
 * The clock is deliberately internal, so a caller gets a countdown by mounting
 * one rather than by wiring a timer. `onTick` is how a caller that needs to act
 * partway through — calibration samples the last second — stays in step without
 * running a second clock that could drift against this one.
 *
 * Remounting restarts it: change `from`, or give it a `key`, to run it again.
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

import { countdownBeat } from '../../animations/variants'

export interface CountdownProps {
  /** Seconds to count from. Counting starts on mount. */
  from: number
  /** Fired once, when the count reaches zero. */
  onComplete?: () => void
  /** Fired with the seconds remaining, each time it changes, including `from`. */
  onTick?: (secondsRemaining: number) => void
  /** Shown in place of "0" on the final beat. */
  finalLabel?: string
  className?: string
}

export function Countdown({
  from,
  onComplete,
  onTick,
  finalLabel = 'BOX',
  className,
}: CountdownProps) {
  const [remaining, setRemaining] = useState(from)
  const [startedFrom, setStartedFrom] = useState(from)

  // Adjusted during render rather than in an effect: an effect would paint one
  // frame of the old number before resetting, so a restarted countdown would
  // visibly flash the tail of the previous run.
  if (from !== startedFrom) {
    setStartedFrom(from)
    setRemaining(from)
  }

  useEffect(() => {
    onTick?.(remaining)

    if (remaining <= 0) {
      onComplete?.()
      return
    }

    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => clearTimeout(timer)
    // onTick/onComplete are intentionally excluded: an inline callback would
    // otherwise restart the tick on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [remaining])

  return (
    <motion.div
      data-testid="countdown"
      data-remaining={remaining}
      key={remaining}
      variants={countdownBeat}
      initial="hidden"
      animate="visible"
      aria-live="assertive"
      className={`font-mono text-6xl font-semibold tabular-nums text-ember-500 ${className ?? ''}`}
    >
      {remaining > 0 ? remaining : finalLabel}
    </motion.div>
  )
}
