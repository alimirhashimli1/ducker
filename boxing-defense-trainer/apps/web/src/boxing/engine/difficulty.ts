/**
 * Responsibility: decide which difficulty the next round should run at, based
 * on how the user performed. It is the only place the progression policy lives.
 */
import type { Difficulty, SessionScore } from '../../types'

/**
 * Choose the difficulty for the next round.
 *
 * TODO: promote after a sustained clean rate, demote after repeated misses,
 * using thresholds from ../config/thresholds.ts.
 */
export function nextDifficulty(current: Difficulty, _score: SessionScore): Difficulty {
  return current
}
