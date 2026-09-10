/**
 * Unit tests for the difficulty policy.
 *
 * These assert the *shape* of the policy rather than its exact numbers, for the
 * same reason as `config/thresholds.test.ts`: the values are uncalibrated and
 * expected to move. What must hold is that the modes stay distinguishable and
 * that the levels stay ordered.
 */
import { describe, expect, it } from 'vitest'

import {
  delayRangeFor,
  punchPoolFor,
  sequenceShapeFor,
  timingToleranceFactorFor,
} from './difficulty'
import { ALL_PUNCHES } from './attacks'
import { THRESHOLDS } from './config/thresholds'
import type { DifficultyLevel, TrainingMode } from '../types'

const LEVELS: readonly DifficultyLevel[] = [1, 2, 3, 4, 5]
const MODES: readonly TrainingMode[] = ['beginner', 'combination', 'reaction']

describe('punchPoolFor', () => {
  it('gives every level a non-empty pool', () => {
    for (const level of LEVELS) {
      expect(punchPoolFor(level).length).toBeGreaterThan(0)
    }
  })

  it('starts with straight punches only', () => {
    expect(punchPoolFor(1)).toEqual(['jab', 'cross'])
  })

  it('unlocks the whole catalogue by level 5', () => {
    expect([...punchPoolFor(5)].sort()).toEqual([...ALL_PUNCHES].sort())
  })

  it('never takes a punch away as the level rises', () => {
    // Each pool must be a superset of the one below. A level that dropped a
    // punch would make a "harder" level teach less.
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      const lower = punchPoolFor(LEVELS[i]!)
      const higher = new Set(punchPoolFor(LEVELS[i + 1]!))

      for (const punch of lower) {
        expect(higher.has(punch)).toBe(true)
      }
    }
  })

  it('grows or holds, never shrinks', () => {
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      expect(punchPoolFor(LEVELS[i + 1]!).length).toBeGreaterThanOrEqual(
        punchPoolFor(LEVELS[i]!).length,
      )
    }
  })

  it('lists no punch twice', () => {
    for (const level of LEVELS) {
      const pool = punchPoolFor(level)

      expect(new Set(pool).size).toBe(pool.length)
    }
  })
})

describe('sequenceShapeFor', () => {
  it('pins beginner mode to exactly one punch at every level', () => {
    for (const level of LEVELS) {
      const shape = sequenceShapeFor('beginner', level)

      expect(shape.minLength).toBe(1)
      expect(shape.maxLength).toBe(1)
    }
  })

  it('pins combination mode to 2-3 punches at every level', () => {
    for (const level of LEVELS) {
      const shape = sequenceShapeFor('combination', level)

      expect(shape.minLength).toBe(2)
      expect(shape.maxLength).toBe(3)
    }
  })

  it('lets reaction mode run from one punch up to the level combo length', () => {
    for (const level of LEVELS) {
      const shape = sequenceShapeFor('reaction', level)

      expect(shape.minLength).toBe(1)
      expect(shape.maxLength).toBe(Math.max(1, THRESHOLDS.difficulty[level].comboLength))
    }
  })

  it('never inverts the range, including at level 1 where the combo length is 1', () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        const shape = sequenceShapeFor(mode, level)

        expect(shape.minLength).toBeGreaterThanOrEqual(1)
        expect(shape.maxLength).toBeGreaterThanOrEqual(shape.minLength)
      }
    }
  })

  it('allows immediate repeats only in reaction mode', () => {
    for (const level of LEVELS) {
      expect(sequenceShapeFor('beginner', level).allowImmediateRepeat).toBe(false)
      expect(sequenceShapeFor('combination', level).allowImmediateRepeat).toBe(false)
      expect(sequenceShapeFor('reaction', level).allowImmediateRepeat).toBe(true)
    }
  })

  it('carries the level punch pool and inter-punch gap', () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        const shape = sequenceShapeFor(mode, level)

        expect(shape.punchPool).toEqual(punchPoolFor(level))
        expect(shape.interPunchMs).toBe(THRESHOLDS.difficulty[level].interPunchMs)
      }
    }
  })

  it('keeps reaction mode able to outgrow a combination', () => {
    // Reaction is the mode that should be able to surprise the user with a long
    // sequence; if it could never exceed a combination, the two would collapse
    // into each other at the top of the scale.
    expect(sequenceShapeFor('reaction', 5).maxLength).toBeGreaterThan(
      sequenceShapeFor('combination', 5).maxLength,
    )
  })
})

describe('delayRangeFor', () => {
  it('is a single fixed value outside reaction mode', () => {
    // Beginner and combination are deliberately metronomic.
    for (const mode of ['beginner', 'combination'] as const) {
      for (const level of LEVELS) {
        const { minMs, maxMs } = delayRangeFor(mode, level)

        expect(minMs).toBe(maxMs)
        expect(minMs).toBe(THRESHOLDS.difficulty[level].restBetweenSequencesMs)
      }
    }
  })

  it('spreads either side of the base rest in reaction mode', () => {
    for (const level of LEVELS) {
      const { minMs, maxMs } = delayRangeFor('reaction', level)
      const base = THRESHOLDS.difficulty[level].restBetweenSequencesMs

      expect(minMs).toBeLessThan(base)
      expect(maxMs).toBeGreaterThan(base)
      expect(base - minMs).toBe(maxMs - base)
    }
  })

  it('never lets the floor reach zero', () => {
    // A zero or negative rest would stack the next sequence onto the current
    // one. The clamp must hold however the jitter is later tuned.
    for (const mode of MODES) {
      for (const level of LEVELS) {
        expect(delayRangeFor(mode, level).minMs).toBeGreaterThan(0)
      }
    }
  })

  it('holds the floor above zero even if jitter is tuned past the rest', () => {
    // Exercises the clamp directly rather than trusting today's numbers: at
    // every level the jitter applied is capped at rest - 1.
    for (const level of LEVELS) {
      const { restBetweenSequencesMs, delayJitterMs } = THRESHOLDS.difficulty[level]
      const { minMs } = delayRangeFor('reaction', level)
      const applied = restBetweenSequencesMs - minMs

      expect(applied).toBe(Math.min(delayJitterMs, restBetweenSequencesMs - 1))
      expect(minMs).toBeGreaterThanOrEqual(1)
    }
  })

  it('rests less at higher difficulty', () => {
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      expect(delayRangeFor('combination', LEVELS[i + 1]!).minMs).toBeLessThan(
        delayRangeFor('combination', LEVELS[i]!).minMs,
      )
    }
  })

  it('grows more unpredictable at higher difficulty', () => {
    // Unpredictability is part of what makes a level harder, so the reaction
    // window should widen as the rest shortens.
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      const lower = delayRangeFor('reaction', LEVELS[i]!)
      const higher = delayRangeFor('reaction', LEVELS[i + 1]!)

      expect(higher.maxMs - higher.minMs).toBeGreaterThan(lower.maxMs - lower.minMs)
    }
  })
})

describe('timingToleranceFactorFor', () => {
  it('reports the level scaling and tightens as the level rises', () => {
    for (const level of LEVELS) {
      expect(timingToleranceFactorFor(level)).toBe(
        THRESHOLDS.difficulty[level].timingToleranceFactor,
      )
    }

    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      expect(timingToleranceFactorFor(LEVELS[i + 1]!)).toBeLessThan(
        timingToleranceFactorFor(LEVELS[i]!),
      )
    }
  })
})
