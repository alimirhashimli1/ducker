/**
 * Responsibility: generate attack sequences for a given difficulty. Nothing
 * else — it does not time them, render them, or know whether the user defended.
 *
 * Determinism matters: the generator takes an explicit random source so a
 * session can be replayed from a seed in tests.
 */
import type { AttackSequence, Difficulty } from '../../types'

/** A 0..1 random source, injected so sequences are reproducible in tests. */
export type RandomSource = () => number

export interface GenerateSequenceOptions {
  readonly difficulty: Difficulty
  readonly random?: RandomSource
}

/**
 * Build one attack sequence appropriate to the given difficulty.
 *
 * TODO: draw a combo of DIFFICULTY[difficulty].comboLength punches, space them
 * by interPunchMs, and attach the valid defenses for each punch type.
 */
export function generateAttackSequence(options: GenerateSequenceOptions): AttackSequence {
  return {
    id: `sequence-${options.difficulty}-pending`,
    difficulty: options.difficulty,
    attacks: [],
  }
}
