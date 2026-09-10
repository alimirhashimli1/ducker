/**
 * Unit tests for sequence generation.
 *
 * The engine is random, so most of these run many draws and assert an invariant
 * that must hold for every one of them — a property, not an example. Where an
 * exact result matters, randomness is injected as a stub so the outcome is
 * pinned rather than sampled.
 *
 * `sweep` uses a deterministic cycling source rather than `Math.random` so a
 * failure reproduces exactly instead of appearing once in a hundred CI runs.
 */
import { describe, expect, it } from 'vitest'

import {
  generateNextSequence,
  getInterAttackDelay,
  getIntraSequenceDelay,
  type RandomSource,
} from './attackEngine'
import { delayRangeFor, punchPoolFor, sequenceShapeFor } from './difficulty'
import { ATTACK_CATALOGUE } from './attacks'
import { THRESHOLDS } from './config/thresholds'
import type { DifficultyLevel, PunchType, Stance, TrainingMode } from '../types'

const LEVELS: readonly DifficultyLevel[] = [1, 2, 3, 4, 5]
const MODES: readonly TrainingMode[] = ['beginner', 'combination', 'reaction']
const STANCES: readonly Stance[] = ['orthodox', 'southpaw']

/**
 * A RandomSource that walks a fixed set of values, so every branch is reached
 * across a sweep and any failure is reproducible.
 */
function cyclingRandom(): RandomSource {
  const values = [0, 0.09, 0.17, 0.25, 0.33, 0.41, 0.5, 0.58, 0.66, 0.75, 0.83, 0.91, 0.999]
  let i = 0

  return () => {
    const value = values[i % values.length]!
    i += 1
    return value
  }
}

/** Run `check` over every mode/level/stance combination, many draws each. */
function sweep(check: (mode: TrainingMode, level: DifficultyLevel, stance: Stance) => void): void {
  for (const mode of MODES) {
    for (const level of LEVELS) {
      for (const stance of STANCES) {
        check(mode, level, stance)
      }
    }
  }
}

describe('generateNextSequence', () => {
  it('never returns a multi-punch sequence in beginner mode', () => {
    // The defining property of the mode. A beginner drill that occasionally
    // threw two punches would stop being a beginner drill.
    const random = cyclingRandom()

    for (const level of LEVELS) {
      for (const stance of STANCES) {
        for (let draw = 0; draw < 200; draw += 1) {
          expect(generateNextSequence('beginner', level, stance, random)).toHaveLength(1)
        }
      }
    }
  })

  it('returns 2 to 3 punches in combination mode at every level', () => {
    const random = cyclingRandom()

    for (const level of LEVELS) {
      for (const stance of STANCES) {
        for (let draw = 0; draw < 200; draw += 1) {
          const sequence = generateNextSequence('combination', level, stance, random)

          expect(sequence.length).toBeGreaterThanOrEqual(2)
          expect(sequence.length).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('produces both 2 and 3 punch combinations, not just one length', () => {
    // Guards a range that is technically satisfied but never actually varies —
    // an off-by-one in the inclusive bound would pin every combo to 2.
    const random = cyclingRandom()
    const lengths = new Set<number>()

    for (let draw = 0; draw < 200; draw += 1) {
      lengths.add(generateNextSequence('combination', 3, 'orthodox', random).length)
    }

    expect([...lengths].sort()).toEqual([2, 3])
  })

  it('varies its length in reaction mode', () => {
    // The unpredictability is the mode. At level 5 the range is 1..5, and a
    // generator that always returned the same length would defeat the drill.
    const random = cyclingRandom()
    const lengths = new Set<number>()

    for (let draw = 0; draw < 300; draw += 1) {
      lengths.add(generateNextSequence('reaction', 5, 'orthodox', random).length)
    }

    expect(lengths.size).toBeGreaterThan(1)
  })

  it('stays inside the length range the difficulty policy declares', () => {
    const random = cyclingRandom()

    sweep((mode, level, stance) => {
      const shape = sequenceShapeFor(mode, level)

      for (let draw = 0; draw < 60; draw += 1) {
        const sequence = generateNextSequence(mode, level, stance, random)

        expect(sequence.length).toBeGreaterThanOrEqual(shape.minLength)
        expect(sequence.length).toBeLessThanOrEqual(shape.maxLength)
      }
    })
  })

  it('never returns an empty sequence', () => {
    const random = cyclingRandom()

    sweep((mode, level, stance) => {
      for (let draw = 0; draw < 40; draw += 1) {
        expect(generateNextSequence(mode, level, stance, random).length).toBeGreaterThan(0)
      }
    })
  })

  it('only throws punches the level has unlocked', () => {
    // Complexity is introduced by unlocking punches, so a level 1 drill must
    // never produce an uppercut however the dice fall.
    const random = cyclingRandom()

    sweep((mode, level, stance) => {
      const pool = new Set<PunchType>(punchPoolFor(level))

      for (let draw = 0; draw < 60; draw += 1) {
        for (const attack of generateNextSequence(mode, level, stance, random)) {
          expect(pool.has(attack.name)).toBe(true)
        }
      }
    })
  })

  it('keeps level 1 to straight punches only', () => {
    const random = cyclingRandom()

    for (let draw = 0; draw < 200; draw += 1) {
      for (const attack of generateNextSequence('reaction', 1, 'orthodox', random)) {
        expect(['jab', 'cross']).toContain(attack.name)
      }
    }
  })

  it('does not repeat a punch back-to-back outside reaction mode', () => {
    // A double jab is real boxing, but in a beginner or combination drill a
    // repeat reads as the generator glitching rather than a deliberate choice.
    const random = cyclingRandom()

    for (const mode of ['beginner', 'combination'] as const) {
      for (const level of LEVELS) {
        for (let draw = 0; draw < 120; draw += 1) {
          const names = generateNextSequence(mode, level, 'orthodox', random).map((a) => a.name)

          for (let i = 1; i < names.length; i += 1) {
            expect(names[i]).not.toBe(names[i - 1])
          }
        }
      }
    }
  })

  it('gives every attack in a sequence a unique id', () => {
    // Scoring keys exchanges by id, so a combination that threw the same punch
    // twice would otherwise conflate the two into one result.
    const random = cyclingRandom()

    sweep((mode, level, stance) => {
      for (let draw = 0; draw < 60; draw += 1) {
        const ids = generateNextSequence(mode, level, stance, random).map((a) => a.id)

        expect(new Set(ids).size).toBe(ids.length)
      }
    })
  })

  it('carries the catalogue duration through unchanged', () => {
    const random = cyclingRandom()

    sweep((mode, level, stance) => {
      for (let draw = 0; draw < 40; draw += 1) {
        for (const attack of generateNextSequence(mode, level, stance, random)) {
          expect(attack.duration).toBe(ATTACK_CATALOGUE[attack.name].duration)
        }
      }
    })
  })

  it('returns southpaw sequences with mirrored defenses already applied', () => {
    // The caller should never have to remember to adapt for stance. A hook
    // drawn for a southpaw must arrive carrying the mirrored roll.
    const random = cyclingRandom()
    let sawHook = false

    for (let draw = 0; draw < 300; draw += 1) {
      for (const attack of generateNextSequence('reaction', 5, 'southpaw', random)) {
        if (attack.name === 'leadHook') {
          sawHook = true
          expect(attack.expectedDefenses).toEqual(['rollRight', 'guard', 'stepBack'])
        }

        if (attack.name === 'rearHook') {
          sawHook = true
          expect(attack.expectedDefenses).toEqual(['rollLeft', 'guard', 'stepBack'])
        }
      }
    }

    // Without this the assertions above could vacuously pass on zero hooks.
    expect(sawHook).toBe(true)
  })

  it('gives orthodox and southpaw opposite roll directions for the same punch', () => {
    // Beginner mode at level 5: the length range is 1..1 so no randomness is
    // spent on it, and 0.4 lands on leadHook in the six-punch pool. Identical
    // randomness on both sides means the same punch is drawn and stance is the
    // only difference between the two sequences.
    const drawsLeadHook: RandomSource = () => 0.4

    const orthodox = generateNextSequence('beginner', 5, 'orthodox', drawsLeadHook)
    const southpaw = generateNextSequence('beginner', 5, 'southpaw', drawsLeadHook)

    expect(orthodox[0]!.name).toBe('leadHook')
    expect(southpaw[0]!.name).toBe('leadHook')
    expect(southpaw[0]!.id).toBe(orthodox[0]!.id)

    // Same punch, opposite roll: the mirroring survived generation.
    expect(orthodox[0]!.expectedDefenses).toEqual(['rollLeft', 'guard', 'stepBack'])
    expect(southpaw[0]!.expectedDefenses).toEqual(['rollRight', 'guard', 'stepBack'])
  })

  it('is deterministic for a given random source', () => {
    // The reason randomness is injected at all: a session must be replayable
    // from a seed, in a bug report as much as in a test.
    const first = generateNextSequence('reaction', 4, 'orthodox', cyclingRandom())
    const second = generateNextSequence('reaction', 4, 'orthodox', cyclingRandom())

    expect(first).toEqual(second)
  })

  it('tolerates a random source that returns exactly 1', () => {
    // Math.random never does, but a stub might, and an unguarded
    // floor(r * n) would index one past the end of the pool.
    const one: RandomSource = () => 1

    sweep((mode, level, stance) => {
      const sequence = generateNextSequence(mode, level, stance, one)

      expect(sequence.length).toBeGreaterThan(0)
      for (const attack of sequence) {
        expect(attack.name).toBeDefined()
      }
    })
  })
})

describe('getInterAttackDelay', () => {
  it('returns the fixed rest in beginner and combination mode', () => {
    // These modes are deliberately metronomic, so the user can settle into a
    // rhythm and think about the movement.
    const random = cyclingRandom()

    for (const mode of ['beginner', 'combination'] as const) {
      for (const level of LEVELS) {
        const expected = THRESHOLDS.difficulty[level].restBetweenSequencesMs

        for (let draw = 0; draw < 40; draw += 1) {
          expect(getInterAttackDelay(mode, level, random)).toBe(expected)
        }
      }
    }
  })

  it('stays inside the difficulty-appropriate range in reaction mode', () => {
    const random = cyclingRandom()

    for (const level of LEVELS) {
      const { minMs, maxMs } = delayRangeFor('reaction', level)

      for (let draw = 0; draw < 300; draw += 1) {
        const delay = getInterAttackDelay('reaction', level, random)

        expect(delay).toBeGreaterThanOrEqual(minMs)
        expect(delay).toBeLessThanOrEqual(maxMs)
      }
    }
  })

  it('actually varies the delay in reaction mode', () => {
    // A range that is respected but never explored would leave the mode
    // metronomic, which is the one thing it must not be.
    const random = cyclingRandom()
    const seen = new Set<number>()

    for (let draw = 0; draw < 200; draw += 1) {
      seen.add(getInterAttackDelay('reaction', 3, random))
    }

    expect(seen.size).toBeGreaterThan(1)
  })

  it('never returns a non-positive delay', () => {
    // A zero or negative rest would stack the next sequence on top of the
    // current one.
    const random = cyclingRandom()

    sweep((mode, level) => {
      for (let draw = 0; draw < 40; draw += 1) {
        expect(getInterAttackDelay(mode, level, random)).toBeGreaterThan(0)
      }
    })
  })

  it('rests less at higher difficulty', () => {
    const fixed: RandomSource = () => 0.5

    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      const lower = getInterAttackDelay('combination', LEVELS[i]!, fixed)
      const higher = getInterAttackDelay('combination', LEVELS[i + 1]!, fixed)

      expect(higher).toBeLessThan(lower)
    }
  })
})

describe('getIntraSequenceDelay', () => {
  it('reports the level gap between punches within a sequence', () => {
    for (const mode of MODES) {
      for (const level of LEVELS) {
        expect(getIntraSequenceDelay(mode, level)).toBe(THRESHOLDS.difficulty[level].interPunchMs)
      }
    }
  })

  it('tightens as difficulty rises', () => {
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      expect(getIntraSequenceDelay('combination', LEVELS[i + 1]!)).toBeLessThan(
        getIntraSequenceDelay('combination', LEVELS[i]!),
      )
    }
  })
})
