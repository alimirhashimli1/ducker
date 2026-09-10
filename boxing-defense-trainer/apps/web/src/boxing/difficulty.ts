/**
 * Responsibility: what a given training mode and difficulty level *mean* in
 * concrete terms — how long a sequence is, which punches it may draw from, and
 * how long to wait before the next one. It is the policy layer between the raw
 * numbers in `config/thresholds.ts` and the generator in `attackEngine.ts`.
 *
 * It exists so that tuning difficulty never means editing the engine
 * (Open/Closed). The engine asks "what shape of sequence should I build?" and
 * this module answers; adding a sixth level or a fourth mode is a change here
 * and nowhere else.
 *
 * The numbers themselves live in `config/thresholds.ts`, per `.claude/RULES.md`.
 * This module composes them with the mode; it does not restate them. What it
 * does own is the *structural* part of difficulty that is not a single number:
 * which punches are unlocked at each level, and how the modes differ in shape.
 */
import { ALL_PUNCHES } from './attacks'
import { THRESHOLDS } from './config/thresholds'
import type { DifficultyLevel, PunchType, RoundStats, TrainingMode } from '../types'

/** The shape of one sequence to generate. */
export interface SequenceShape {
  /** Fewest punches in the sequence; always at least 1. */
  readonly minLength: number
  /** Most punches in the sequence; never below `minLength`. */
  readonly maxLength: number
  /** The punches this level has unlocked, in catalogue order. */
  readonly punchPool: readonly PunchType[]
  /** Whether the same punch may be thrown twice in a row. */
  readonly allowImmediateRepeat: boolean
  /** Gap between punches *within* the sequence, in ms. */
  readonly interPunchMs: number
}

/** The window a delay may fall in, in ms. Inclusive at both ends. */
export interface DelayRange {
  readonly minMs: number
  readonly maxMs: number
}

/**
 * Which punches each level may draw from.
 *
 * Complexity is introduced by unlocking punches, not by throwing everything
 * faster: a beginner works straight punches until they are automatic, and hooks
 * and uppercuts arrive once there is something to hook around. Ordered from
 * most to least fundamental, and every pool is a prefix of the next, so a level
 * never *loses* a punch it had.
 */
const PUNCH_POOL_BY_LEVEL: Readonly<Record<DifficultyLevel, readonly PunchType[]>> = {
  1: ['jab', 'cross'],
  2: ['jab', 'cross', 'leadHook'],
  3: ['jab', 'cross', 'leadHook', 'rearHook'],
  4: ['jab', 'cross', 'leadHook', 'rearHook', 'leadUppercut'],
  5: ALL_PUNCHES,
}

/** The punches available at a difficulty level. */
export function punchPoolFor(difficulty: DifficultyLevel): readonly PunchType[] {
  return PUNCH_POOL_BY_LEVEL[difficulty]
}

/**
 * How long a sequence should be, per mode.
 *
 * The mode decides the shape, the level decides the ceiling:
 *
 * - `beginner` is always exactly one punch, at every level. A beginner drill
 *   that sometimes threw combinations would stop being a beginner drill; what
 *   changes with level here is speed and which punch, never the count.
 * - `combination` is 2–3 punches at every level, which is what makes it a
 *   combination drill rather than a longer version of the others.
 * - `reaction` runs from a single punch up to the level's combo length. The
 *   variation *is* the mode: the user must not be able to predict how many are
 *   coming.
 */
function lengthRangeFor(
  mode: TrainingMode,
  difficulty: DifficultyLevel,
): { readonly min: number; readonly max: number } {
  const comboLength = THRESHOLDS.difficulty[difficulty].comboLength

  switch (mode) {
    case 'beginner':
      return { min: 1, max: 1 }
    case 'combination':
      return { min: 2, max: 3 }
    case 'reaction':
      // Level 1's combo length is 1, so the range collapses to a single punch
      // rather than inverting.
      return { min: 1, max: Math.max(1, comboLength) }
  }
}

/**
 * Everything the generator needs to build one sequence.
 *
 * Immediate repeats are allowed only in reaction mode: a double jab is real
 * boxing, but in a beginner or combination drill a repeated punch reads as the
 * generator glitching rather than as a deliberate choice.
 */
export function sequenceShapeFor(mode: TrainingMode, difficulty: DifficultyLevel): SequenceShape {
  const { min, max } = lengthRangeFor(mode, difficulty)

  return {
    minLength: min,
    maxLength: max,
    punchPool: punchPoolFor(difficulty),
    allowImmediateRepeat: mode === 'reaction',
    interPunchMs: THRESHOLDS.difficulty[difficulty].interPunchMs,
  }
}

/**
 * The window the gap before the next sequence should fall in.
 *
 * Beginner and combination are metronomic — a fixed rest, so the user can
 * settle into a rhythm and think about the movement. Reaction deliberately is
 * not: the rest is jittered either side of the base so the next punch cannot be
 * anticipated from timing alone, which is the whole point of the mode.
 *
 * The jitter is clamped so the window never reaches zero, however the
 * thresholds are later tuned.
 */
export function delayRangeFor(mode: TrainingMode, difficulty: DifficultyLevel): DelayRange {
  const { restBetweenSequencesMs, delayJitterMs } = THRESHOLDS.difficulty[difficulty]

  if (mode !== 'reaction') {
    return { minMs: restBetweenSequencesMs, maxMs: restBetweenSequencesMs }
  }

  // A jitter wider than the rest itself would put the floor at or below zero,
  // stacking the next sequence on top of the current one.
  const jitter = Math.min(delayJitterMs, restBetweenSequencesMs - 1)

  return {
    minMs: restBetweenSequencesMs - jitter,
    maxMs: restBetweenSequencesMs + jitter,
  }
}

/** The scaling applied to the timing windows at a level; lower is stricter. */
export function timingToleranceFactorFor(difficulty: DifficultyLevel): number {
  return THRESHOLDS.difficulty[difficulty].timingToleranceFactor
}

/**
 * Choose the difficulty for the next round.
 *
 * Lives here rather than beside the engine because a level and the meaning of that
 * level are one concept: promoting a user to level 4 is only meaningful
 * alongside the parameters above that say what level 4 is.
 *
 * TODO: promote after a sustained clean rate, demote after repeated misses,
 * clamped to the 1..5 range of DifficultyLevel.
 */
export function nextDifficulty(current: DifficultyLevel, _stats: RoundStats): DifficultyLevel {
  return current
}
