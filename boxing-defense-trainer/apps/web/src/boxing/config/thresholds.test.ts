/**
 * Unit tests for the tuning constants.
 *
 * These are sanity bounds, not assertions of the right value — every number in
 * `thresholds.ts` is an uncalibrated estimate and is expected to move once it is
 * tuned against footage. What must not change is that the values stay coherent:
 * positive, ordered, and inside the ranges the units imply. A ratio of 4.0
 * shoulder-widths or a negative time window is a typo, and these catch it
 * without freezing the tuning.
 */
import { describe, expect, it } from 'vitest'

import { THRESHOLDS } from './thresholds'
import type { DifficultyLevel } from '../../types'

const LEVELS: readonly DifficultyLevel[] = [1, 2, 3, 4, 5]

/** Every distance in the config, as [name, value] pairs. */
const movementEntries = Object.entries(THRESHOLDS.movement)

/** Every duration in the config. */
const timingEntries = Object.entries(THRESHOLDS.timing)

describe('THRESHOLDS.movement', () => {
  it.each(movementEntries)('%s is greater than zero', (_name, value) => {
    expect(value).toBeGreaterThan(0)
  })

  it.each(movementEntries)('%s is a plausible fraction of shoulder width', (_name, value) => {
    // Distances are ratios of shoulder width. Anything at or above 1 would mean
    // the head travelling further than the shoulders are wide, which no real
    // defensive movement does — that would be a unit mix-up, most likely
    // pixels.
    expect(value).toBeLessThan(1)
  })

  it('sets the noise floor below every movement it gates', () => {
    // minMovementRatio rejects frames as jitter before the specific thresholds
    // are applied. If it were the largest value, every real defense would be
    // discarded as noise and nothing would ever score.
    const others = movementEntries
      .filter(([name]) => name !== 'minMovementRatio')
      .map(([, value]) => value)

    for (const value of others) {
      expect(THRESHOLDS.movement.minMovementRatio).toBeLessThan(value)
    }
  })

  it('requires a roll to travel further down than across', () => {
    // A roll is a weave under the punch: the drop is the movement, the lateral
    // arc only distinguishes it from a straight duck. Inverting these would
    // accept a sway as a roll.
    expect(THRESHOLDS.movement.rollVerticalRatio).toBeGreaterThan(
      THRESHOLDS.movement.rollHorizontalRatio,
    )
  })

  it('asks less of a balance reset than of the defenses it follows', () => {
    // balanceReturnRatio is how close to neutral the user must be before the
    // next punch. If it exceeded the slip threshold, a completed slip could
    // never be recovered from in time and the drill would stall.
    expect(THRESHOLDS.movement.balanceReturnRatio).toBeLessThan(
      THRESHOLDS.movement.slipLateralRatio,
    )
  })
})

describe('THRESHOLDS.timing', () => {
  it.each(timingEntries)('%s is a positive duration', (_name, value) => {
    expect(value).toBeGreaterThan(0)
  })

  it.each(timingEntries)('%s is within a plausible range for one exchange', (_name, value) => {
    // Milliseconds. A window longer than a few seconds would outlast the
    // exchange it is scoring.
    expect(value).toBeLessThan(5000)
  })

  it('widens from clean through late to missed', () => {
    // The windows are nested: a defense inside the tolerance is clean, inside
    // the late window is late, and past the miss window is missed. Out of
    // order, an outcome would be unreachable.
    expect(THRESHOLDS.timing.reactionToleranceMs).toBeLessThan(THRESHOLDS.timing.lateWindowMs)
    expect(THRESHOLDS.timing.lateWindowMs).toBeLessThan(THRESHOLDS.timing.missWindowMs)
  })
})

describe('THRESHOLDS.pose', () => {
  it('keeps the confidence gates inside [0,1]', () => {
    // Detector scores are normalised, so a gate outside this range either never
    // admits a frame or never rejects one.
    expect(THRESHOLDS.pose.minKeypointScore).toBeGreaterThan(0)
    expect(THRESHOLDS.pose.minKeypointScore).toBeLessThanOrEqual(1)
    expect(THRESHOLDS.pose.minVisibleKeypointRatio).toBeGreaterThan(0)
    expect(THRESHOLDS.pose.minVisibleKeypointRatio).toBeLessThanOrEqual(1)
  })

  it('smooths over a whole number of frames, at least one', () => {
    expect(THRESHOLDS.pose.smoothingWindowFrames).toBeGreaterThanOrEqual(1)
    expect(Number.isInteger(THRESHOLDS.pose.smoothingWindowFrames)).toBe(true)
  })
})

describe('THRESHOLDS.scoring', () => {
  it('ranks the outcomes clean > late > wrong > missed', () => {
    expect(THRESHOLDS.scoring.cleanPoints).toBeGreaterThan(THRESHOLDS.scoring.latePoints)
    expect(THRESHOLDS.scoring.latePoints).toBeGreaterThan(THRESHOLDS.scoring.wrongPoints)
    expect(THRESHOLDS.scoring.wrongPoints).toBeGreaterThan(THRESHOLDS.scoring.missedPoints)
  })

  it('penalises a missed defense rather than merely not rewarding it', () => {
    // Taking a clean punch should cost. Zero would make ignoring the drill
    // score the same as covering up.
    expect(THRESHOLDS.scoring.missedPoints).toBeLessThan(0)
  })

  it('keeps the streak bonus small next to the base award', () => {
    // The bonus is added per punch of an unbroken streak. If it approached the
    // clean award, a long streak would dominate the score and a single clean
    // defense would stop mattering.
    expect(THRESHOLDS.scoring.streakBonusPerClean).toBeGreaterThan(0)
    expect(THRESHOLDS.scoring.streakBonusPerClean).toBeLessThan(THRESHOLDS.scoring.cleanPoints)
  })
})

describe('THRESHOLDS.difficulty', () => {
  it('covers levels 1 through 5', () => {
    expect(Object.keys(THRESHOLDS.difficulty).map(Number).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it.each(LEVELS)('level %i has positive, whole-punch pacing', (level) => {
    const settings = THRESHOLDS.difficulty[level]

    expect(settings.comboLength).toBeGreaterThanOrEqual(1)
    expect(Number.isInteger(settings.comboLength)).toBe(true)
    expect(settings.interPunchMs).toBeGreaterThan(0)
    expect(settings.restBetweenSequencesMs).toBeGreaterThan(0)
    expect(settings.timingToleranceFactor).toBeGreaterThan(0)
  })

  it('gets monotonically harder as the level rises', () => {
    // The whole meaning of the scale. Any non-monotonic step would make a
    // "harder" level easier in one dimension.
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      const lower = THRESHOLDS.difficulty[LEVELS[i]!]
      const higher = THRESHOLDS.difficulty[LEVELS[i + 1]!]

      expect(higher.comboLength).toBeGreaterThanOrEqual(lower.comboLength)
      expect(higher.interPunchMs).toBeLessThan(lower.interPunchMs)
      expect(higher.restBetweenSequencesMs).toBeLessThan(lower.restBetweenSequencesMs)
      expect(higher.timingToleranceFactor).toBeLessThan(lower.timingToleranceFactor)
    }
  })

  it('brackets the tolerance factor around 1 at the middle level', () => {
    // The factor scales THRESHOLDS.timing, so level 3 is the calibrated
    // baseline: easier levels loosen it, harder levels tighten it.
    expect(THRESHOLDS.difficulty[1].timingToleranceFactor).toBeGreaterThan(1)
    expect(THRESHOLDS.difficulty[3].timingToleranceFactor).toBe(1)
    expect(THRESHOLDS.difficulty[5].timingToleranceFactor).toBeLessThan(1)
  })
})

describe('THRESHOLDS.session', () => {
  it('counts down and calibrates over positive whole units', () => {
    expect(THRESHOLDS.session.countdownSeconds).toBeGreaterThan(0)
    expect(Number.isInteger(THRESHOLDS.session.countdownSeconds)).toBe(true)
    expect(THRESHOLDS.session.calibrationFrames).toBeGreaterThan(0)
    expect(Number.isInteger(THRESHOLDS.session.calibrationFrames)).toBe(true)
  })
})

describe('THRESHOLDS as a whole', () => {
  it('contains no NaN, Infinity or negative-zero anywhere', () => {
    // A typo in a numeric literal can produce these silently, and a NaN
    // threshold makes every comparison false rather than throwing.
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${path} is not finite`).toBe(true)
        expect(Object.is(value, -0), `${path} is negative zero`).toBe(false)
        return
      }

      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, `${path}.${key}`)
      }
    }

    walk(THRESHOLDS, 'THRESHOLDS')
  })
})
