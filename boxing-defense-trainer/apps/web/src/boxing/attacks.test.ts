/**
 * Unit tests for the attack catalogue and the stance adapter.
 *
 * The catalogue's exact numbers are asserted deliberately rather than checked
 * loosely: they are the drill's difficulty, and a silent change to a duration
 * changes what the app teaches. When they are recalibrated against footage,
 * these expectations should change in the same commit.
 */
import { describe, expect, it } from 'vitest'

import {
  ALL_PUNCHES,
  ATTACK_CATALOGUE,
  attackFor,
  mirrorDefense,
  punchHand,
  resolveForStance,
} from './attacks'
import type { Attack, DefenseType, PunchType, Stance } from '../types'

const STANCES: readonly Stance[] = ['orthodox', 'southpaw']

const ALL_DEFENSE_TYPES: readonly DefenseType[] = [
  'slipLeft',
  'slipRight',
  'rollLeft',
  'rollRight',
  'stepBack',
  'guard',
  'parry',
]

describe('ATTACK_CATALOGUE', () => {
  it('covers every punch type exactly once', () => {
    const keys = Object.keys(ATTACK_CATALOGUE) as PunchType[]

    expect([...ALL_PUNCHES].sort()).toEqual([...keys].sort())
    expect(new Set(ALL_PUNCHES).size).toBe(ALL_PUNCHES.length)
  })

  it.each([
    ['jab', 700, ['slipLeft', 'slipRight', 'parry', 'stepBack']],
    ['cross', 850, ['slipLeft', 'slipRight', 'parry', 'stepBack']],
    ['leadHook', 800, ['rollLeft', 'guard', 'stepBack']],
    ['rearHook', 900, ['rollRight', 'guard', 'stepBack']],
    ['leadUppercut', 750, ['stepBack', 'guard', 'parry']],
    ['rearUppercut', 900, ['stepBack', 'guard', 'parry']],
  ] as const)(
    'describes %s with the expected duration and defenses',
    (punch, duration, defenses) => {
      const attack = ATTACK_CATALOGUE[punch]

      expect(attack.duration).toBe(duration)
      expect(attack.expectedDefenses).toEqual(defenses)
    },
  )

  it('gives every entry an id and name matching its key', () => {
    for (const punch of ALL_PUNCHES) {
      const attack = ATTACK_CATALOGUE[punch]

      expect(attack.name).toBe(punch)
      expect(attack.id).toBe(punch)
    }
  })

  it('gives every punch a positive duration and at least one answer', () => {
    for (const punch of ALL_PUNCHES) {
      const attack = ATTACK_CATALOGUE[punch]

      expect(attack.duration).toBeGreaterThan(0)
      expect(attack.expectedDefenses.length).toBeGreaterThan(0)
    }
  })

  it('lists no defense twice for the same punch', () => {
    for (const punch of ALL_PUNCHES) {
      const defenses = ATTACK_CATALOGUE[punch].expectedDefenses

      expect(new Set(defenses).size).toBe(defenses.length)
    }
  })

  it('makes rear-hand punches slower than their lead-hand counterparts', () => {
    // Rear-hand punches cross more distance and telegraph more, so they must
    // give the user a longer window. If this ever inverts, the drill is
    // training the wrong reaction speed.
    expect(ATTACK_CATALOGUE.cross.duration).toBeGreaterThan(ATTACK_CATALOGUE.jab.duration)
    expect(ATTACK_CATALOGUE.rearHook.duration).toBeGreaterThan(ATTACK_CATALOGUE.leadHook.duration)
    expect(ATTACK_CATALOGUE.rearUppercut.duration).toBeGreaterThan(
      ATTACK_CATALOGUE.leadUppercut.duration,
    )
  })
})

describe('punchHand', () => {
  it('throws lead-hand punches with the left hand in orthodox', () => {
    expect(punchHand('jab', 'orthodox')).toBe('left')
    expect(punchHand('leadHook', 'orthodox')).toBe('left')
    expect(punchHand('leadUppercut', 'orthodox')).toBe('left')
  })

  it('throws rear-hand punches with the right hand in orthodox', () => {
    expect(punchHand('cross', 'orthodox')).toBe('right')
    expect(punchHand('rearHook', 'orthodox')).toBe('right')
    expect(punchHand('rearUppercut', 'orthodox')).toBe('right')
  })

  it('swaps the hand for every punch in southpaw', () => {
    for (const punch of ALL_PUNCHES) {
      expect(punchHand(punch, 'southpaw')).not.toBe(punchHand(punch, 'orthodox'))
    }
  })
})

describe('mirrorDefense', () => {
  it('swaps the lateral defenses', () => {
    expect(mirrorDefense('slipLeft')).toBe('slipRight')
    expect(mirrorDefense('slipRight')).toBe('slipLeft')
    expect(mirrorDefense('rollLeft')).toBe('rollRight')
    expect(mirrorDefense('rollRight')).toBe('rollLeft')
  })

  it('leaves the non-lateral defenses alone', () => {
    // Stepping back, covering up and parrying are the same movement whichever
    // way round the boxer is squared.
    expect(mirrorDefense('stepBack')).toBe('stepBack')
    expect(mirrorDefense('guard')).toBe('guard')
    expect(mirrorDefense('parry')).toBe('parry')
  })

  it('is its own inverse', () => {
    for (const defense of ALL_DEFENSE_TYPES) {
      expect(mirrorDefense(mirrorDefense(defense))).toBe(defense)
    }
  })
})

describe('resolveForStance', () => {
  it('returns the catalogue entry untouched for orthodox', () => {
    // Orthodox is the frame the catalogue is written in, so there is nothing to
    // adapt and nothing to allocate.
    const jab = ATTACK_CATALOGUE.jab

    expect(resolveForStance(jab, 'orthodox')).toBe(jab)
  })

  it('flips the roll direction of a hook for southpaw', () => {
    // The whole point of the adapter: a southpaw is a mirror image, so the roll
    // that takes the user under an orthodox lead hook takes them into a
    // southpaw's.
    expect(attackFor('leadHook', 'orthodox').expectedDefenses).toEqual([
      'rollLeft',
      'guard',
      'stepBack',
    ])
    expect(attackFor('leadHook', 'southpaw').expectedDefenses).toEqual([
      'rollRight',
      'guard',
      'stepBack',
    ])
    expect(attackFor('rearHook', 'southpaw').expectedDefenses).toEqual([
      'rollLeft',
      'guard',
      'stepBack',
    ])
  })

  it('keeps the punch name, id and duration', () => {
    // Lead/rear is already stance-relative, so a southpaw lead hook is still a
    // lead hook. Only the physical direction, and so the defenses, mirror.
    for (const punch of ALL_PUNCHES) {
      const orthodox = attackFor(punch, 'orthodox')
      const southpaw = attackFor(punch, 'southpaw')

      expect(southpaw.name).toBe(orthodox.name)
      expect(southpaw.id).toBe(orthodox.id)
      expect(southpaw.duration).toBe(orthodox.duration)
    }
  })

  it('offers the same set of answers to the straight punches in both stances', () => {
    // Not a special case in the implementation: it falls out of mirroring a set
    // that already contains both directions. A jab can be slipped either way
    // whoever throws it.
    for (const punch of ['jab', 'cross'] as const) {
      const orthodox = attackFor(punch, 'orthodox').expectedDefenses
      const southpaw = attackFor(punch, 'southpaw').expectedDefenses

      expect([...southpaw].sort()).toEqual([...orthodox].sort())
    }
  })

  it('mirrors the order of the two slips even where the set is unchanged', () => {
    // Documenting rather than endorsing: mirroring maps element-wise, so
    // slipLeft and slipRight swap positions. Nothing depends on the order today
    // — scoring only tests membership — but if the UI ever presents the first
    // entry as the primary answer, this is where that decision surfaces.
    expect(ATTACK_CATALOGUE.jab.expectedDefenses).toEqual([
      'slipLeft',
      'slipRight',
      'parry',
      'stepBack',
    ])
    expect(attackFor('jab', 'southpaw').expectedDefenses).toEqual([
      'slipRight',
      'slipLeft',
      'parry',
      'stepBack',
    ])
  })

  it('mirrors back to the original when applied twice', () => {
    for (const punch of ALL_PUNCHES) {
      const original = ATTACK_CATALOGUE[punch]
      const thereAndBack = resolveForStance(resolveForStance(original, 'southpaw'), 'southpaw')

      expect(thereAndBack.expectedDefenses).toEqual(original.expectedDefenses)
    }
  })

  it('does not mutate the catalogue', () => {
    // The catalogue is module-level shared state; a mutating adapter would
    // corrupt every later lookup in the session.
    const before = structuredClone(ATTACK_CATALOGUE) as Record<PunchType, Attack>

    for (const punch of ALL_PUNCHES) {
      for (const stance of STANCES) {
        attackFor(punch, stance)
      }
    }

    expect(ATTACK_CATALOGUE).toEqual(before)
  })

  it('never produces a defense outside the known set', () => {
    const known = new Set<DefenseType>(ALL_DEFENSE_TYPES)

    for (const punch of ALL_PUNCHES) {
      for (const stance of STANCES) {
        for (const defense of attackFor(punch, stance).expectedDefenses) {
          expect(known.has(defense)).toBe(true)
        }
      }
    }
  })
})
