/**
 * Unit tests for the defense catalogue and the reverse lookup.
 *
 * The point of most of these is the *derivation*: `punchesAnsweredBy` inverts
 * the attack catalogue rather than restating it, so the tests assert the two
 * agree in both directions. A test that hard-coded the expected punch lists
 * would pass even if the inversion silently stopped tracking `attacks.ts`,
 * which is the exact failure the derivation exists to prevent.
 */
import { describe, expect, it } from 'vitest'

import { ALL_PUNCHES, ATTACK_CATALOGUE, attackFor } from './attacks'
import { ALL_DEFENSES, DEFENSE_CATALOGUE, isValidDefense, punchesAnsweredBy } from './defenses'
import type { DefenseType, Stance } from '../types'

const STANCES: readonly Stance[] = ['orthodox', 'southpaw']

describe('DEFENSE_CATALOGUE', () => {
  it('covers every defense type exactly once', () => {
    const keys = Object.keys(DEFENSE_CATALOGUE) as DefenseType[]

    expect([...ALL_DEFENSES].sort()).toEqual([...keys].sort())
    expect(new Set(ALL_DEFENSES).size).toBe(ALL_DEFENSES.length)
  })

  it('gives every defense a type matching its key, a name and a description', () => {
    for (const defense of ALL_DEFENSES) {
      const meta = DEFENSE_CATALOGUE[defense]

      expect(meta.type).toBe(defense)
      expect(meta.displayName.length).toBeGreaterThan(0)
      expect(meta.description.length).toBeGreaterThan(0)
    }
  })

  it('marks exactly the slips and rolls as lateral', () => {
    // `lateral` is what decides whether a movement mirrors between stances, so
    // it has to agree with mirrorDefense. Getting this wrong would flip a
    // step-back for southpaws.
    const lateral = ALL_DEFENSES.filter((defense) => DEFENSE_CATALOGUE[defense].lateral)

    expect([...lateral].sort()).toEqual(['rollLeft', 'rollRight', 'slipLeft', 'slipRight'])
  })

  it('gives each defense a distinct display name', () => {
    const names = ALL_DEFENSES.map((defense) => DEFENSE_CATALOGUE[defense].displayName)

    expect(new Set(names).size).toBe(names.length)
  })
})

describe('punchesAnsweredBy', () => {
  it('reverses the orthodox catalogue', () => {
    expect(punchesAnsweredBy('slipLeft', 'orthodox')).toEqual(['jab', 'cross'])
    expect(punchesAnsweredBy('slipRight', 'orthodox')).toEqual(['jab', 'cross'])
    expect(punchesAnsweredBy('rollLeft', 'orthodox')).toEqual(['leadHook'])
    expect(punchesAnsweredBy('rollRight', 'orthodox')).toEqual(['rearHook'])
    expect(punchesAnsweredBy('parry', 'orthodox')).toEqual([
      'jab',
      'cross',
      'leadUppercut',
      'rearUppercut',
    ])
    expect(punchesAnsweredBy('guard', 'orthodox')).toEqual([
      'leadHook',
      'rearHook',
      'leadUppercut',
      'rearUppercut',
    ])
  })

  it('answers the mirrored hook for southpaw', () => {
    // The reverse lookup has to be stance-aware, not just the forward one:
    // rolling left answers the lead hook against an orthodox opponent and the
    // rear hook against a southpaw.
    expect(punchesAnsweredBy('rollLeft', 'southpaw')).toEqual(['rearHook'])
    expect(punchesAnsweredBy('rollRight', 'southpaw')).toEqual(['leadHook'])
  })

  it('leaves non-lateral defenses answering the same punches in both stances', () => {
    for (const defense of ['stepBack', 'guard', 'parry'] as const) {
      expect(punchesAnsweredBy(defense, 'southpaw')).toEqual(punchesAnsweredBy(defense, 'orthodox'))
    }
  })

  it('agrees with the attack catalogue in both directions', () => {
    // The derivation is only correct if it is a true inverse: every punch that
    // lists a defense appears under it, and nothing else does.
    for (const stance of STANCES) {
      for (const defense of ALL_DEFENSES) {
        const answered = punchesAnsweredBy(defense, stance)

        for (const punch of ALL_PUNCHES) {
          const lists = attackFor(punch, stance).expectedDefenses.includes(defense)

          expect(answered.includes(punch)).toBe(lists)
        }
      }
    }
  })

  it('returns an entry for every defense, empty rather than missing', () => {
    for (const stance of STANCES) {
      for (const defense of ALL_DEFENSES) {
        expect(Array.isArray(punchesAnsweredBy(defense, stance))).toBe(true)
      }
    }
  })

  it('accounts for every punch/defense pair in the catalogue', () => {
    // Guards against an inversion that quietly drops entries: the total number
    // of pairs on both sides has to match.
    for (const stance of STANCES) {
      const forward = ALL_PUNCHES.reduce(
        (total, punch) => total + attackFor(punch, stance).expectedDefenses.length,
        0,
      )
      const reverse = ALL_DEFENSES.reduce(
        (total, defense) => total + punchesAnsweredBy(defense, stance).length,
        0,
      )

      expect(reverse).toBe(forward)
    }
  })

  it('lists no punch twice under one defense', () => {
    for (const stance of STANCES) {
      for (const defense of ALL_DEFENSES) {
        const answered = punchesAnsweredBy(defense, stance)

        expect(new Set(answered).size).toBe(answered.length)
      }
    }
  })
})

describe('isValidDefense', () => {
  it('accepts a defense the attack lists', () => {
    expect(isValidDefense(ATTACK_CATALOGUE.jab, 'parry')).toBe(true)
    expect(isValidDefense(ATTACK_CATALOGUE.jab, 'slipLeft')).toBe(true)
    expect(isValidDefense(ATTACK_CATALOGUE.leadHook, 'rollLeft')).toBe(true)
  })

  it('rejects a defense the attack does not list', () => {
    // Slipping laterally against a hook moves into it, and rolling under an
    // uppercut drops the head onto it. Neither should score.
    expect(isValidDefense(ATTACK_CATALOGUE.jab, 'rollLeft')).toBe(false)
    expect(isValidDefense(ATTACK_CATALOGUE.leadHook, 'slipLeft')).toBe(false)
    expect(isValidDefense(ATTACK_CATALOGUE.leadUppercut, 'rollLeft')).toBe(false)
  })

  it('follows the attack it is given rather than the catalogue', () => {
    // Scoring passes the stance-resolved attack, so a southpaw lead hook must
    // accept the mirrored roll and reject the orthodox one.
    const southpawLeadHook = attackFor('leadHook', 'southpaw')

    expect(isValidDefense(southpawLeadHook, 'rollRight')).toBe(true)
    expect(isValidDefense(southpawLeadHook, 'rollLeft')).toBe(false)
  })

  it('agrees with the reverse lookup for every pair', () => {
    for (const stance of STANCES) {
      for (const punch of ALL_PUNCHES) {
        const attack = attackFor(punch, stance)

        for (const defense of ALL_DEFENSES) {
          expect(isValidDefense(attack, defense)).toBe(
            punchesAnsweredBy(defense, stance).includes(punch),
          )
        }
      }
    }
  })
})
