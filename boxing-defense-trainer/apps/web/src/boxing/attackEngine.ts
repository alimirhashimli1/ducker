/**
 * Responsibility: decide *what* the trainer throws next and *how long* to wait
 * before it. Nothing else.
 *
 * It does not run the clock. There is no `setTimeout` here and there must never
 * be one: `getInterAttackDelay` returns a number of milliseconds and something
 * else — the training state machine and the hook that drives it — decides what
 * to do with it. Keeping the decision separate from the waiting is what lets a
 * whole session be generated and asserted in a test in microseconds.
 *
 * It also does not know what any level *means*. Every parameter comes from
 * `difficulty.ts`, so tuning a level, adding a level or adding a mode never
 * requires editing this file (Open/Closed).
 *
 * Randomness is injected rather than reached for (Dependency Inversion). Both
 * functions take an optional `RandomSource`, defaulting to `Math.random`, so
 * callers get the simple signature while tests get exact, reproducible
 * sequences by passing a stub.
 */
import { attackFor } from './attacks'
import { delayRangeFor, sequenceShapeFor } from './difficulty'
import type { AttackSequence, DifficultyLevel, PunchType, Stance, TrainingMode } from '../types'

/**
 * A source of numbers in [0, 1), the same contract as `Math.random`.
 *
 * Injected so a session can be replayed from a seed and so tests can assert an
 * exact sequence rather than a statistical property.
 */
export type RandomSource = () => number

/**
 * Pick an integer in [min, max], inclusive at both ends.
 *
 * Inclusive because the ranges it is given are inclusive: a combination of
 * "2 to 3 punches" must be able to produce 3.
 */
function randomIntInclusive(min: number, max: number, random: RandomSource): number {
  if (max <= min) {
    return min
  }

  // Math.min guards the case where a RandomSource returns exactly 1, which
  // Math.random never does but a stub in a test very well might.
  return Math.min(max, min + Math.floor(random() * (max - min + 1)))
}

/** Pick one element of a non-empty list. */
function pickFrom<T>(items: readonly T[], random: RandomSource): T {
  const index = randomIntInclusive(0, items.length - 1, random)

  // `items` is always a difficulty punch pool, which is never empty; the throw
  // documents that precondition rather than silently returning undefined.
  const picked = items[index]
  if (picked === undefined) {
    throw new Error('attackEngine: cannot pick from an empty pool')
  }

  return picked
}

/**
 * Choose the punches for one sequence.
 *
 * When immediate repeats are disallowed the previous punch is filtered out
 * rather than redrawn, so the function terminates in a fixed number of steps
 * instead of looping until it gets lucky. With a single-punch pool there is
 * nothing to filter to, so the repeat is allowed rather than deadlocking.
 */
function choosePunches(
  length: number,
  pool: readonly PunchType[],
  allowImmediateRepeat: boolean,
  random: RandomSource,
): readonly PunchType[] {
  const punches: PunchType[] = []

  for (let i = 0; i < length; i += 1) {
    const previous = punches[punches.length - 1]
    const candidates =
      allowImmediateRepeat || previous === undefined || pool.length === 1
        ? pool
        : pool.filter((punch) => punch !== previous)

    punches.push(pickFrom(candidates, random))
  }

  return punches
}

/**
 * Build the next sequence to throw.
 *
 * The returned attacks are already resolved for `stance`, so a southpaw
 * sequence carries the mirrored defenses and the caller never has to remember
 * to adapt them.
 *
 * Each attack gets an id unique *within the sequence* (`jab#0`, `jab#1`), since
 * a combination may throw the same punch twice and scoring keys exchanges by
 * id. Ids are not unique across sequences; if a consumer ever needs to hold
 * exchanges from several sequences at once, it must namespace them by sequence.
 */
export function generateNextSequence(
  mode: TrainingMode,
  difficulty: DifficultyLevel,
  stance: Stance,
  random: RandomSource = Math.random,
): AttackSequence {
  const shape = sequenceShapeFor(mode, difficulty)
  const length = randomIntInclusive(shape.minLength, shape.maxLength, random)
  const punches = choosePunches(length, shape.punchPool, shape.allowImmediateRepeat, random)

  return punches.map((punch, index) => ({
    ...attackFor(punch, stance),
    id: `${punch}#${index}`,
  }))
}

/**
 * How long to wait before throwing the next sequence, in milliseconds.
 *
 * Fixed in beginner and combination mode, jittered in reaction mode — see
 * `delayRangeFor`. The caller is responsible for actually waiting; this only
 * says how long.
 */
export function getInterAttackDelay(
  mode: TrainingMode,
  difficulty: DifficultyLevel,
  random: RandomSource = Math.random,
): number {
  const { minMs, maxMs } = delayRangeFor(mode, difficulty)

  return randomIntInclusive(minMs, maxMs, random)
}

/**
 * The gap between punches *inside* a sequence, in milliseconds.
 *
 * Distinct from `getInterAttackDelay`, which is the rest *between* sequences.
 * Fixed per level rather than random: the rhythm within a combination is part
 * of what makes it a combination.
 */
export function getIntraSequenceDelay(mode: TrainingMode, difficulty: DifficultyLevel): number {
  return sequenceShapeFor(mode, difficulty).interPunchMs
}
