/**
 * Responsibility: the canonical catalogue of punches the trainer can throw, and
 * the rule for adapting one to the user's stance. It describes what a punch *is*
 * — how long it takes and what answers it — and nothing about when to throw one
 * (that is `attackEngine.ts`) or whether the user answered it correctly
 * (that is `scoring.ts`).
 */
import type { Attack, DefenseType, PunchType, Stance } from '../types'

/**
 * Which physical hand throws a punch, given a stance.
 *
 * This is the whole of "lead/rear semantics": an orthodox boxer leads with the
 * left, a southpaw with the right, so the same `leadHook` is a left hook against
 * one and a right hook against the other. The punch's *name* never changes —
 * that is why the catalogue is written once — but the hand does, and the
 * renderer and the mirroring rule below both need to know which.
 */
export function punchHand(punch: PunchType, stance: Stance): 'left' | 'right' {
  const lead = stance === 'orthodox' ? 'left' : 'right'
  const rear = stance === 'orthodox' ? 'right' : 'left'

  switch (punch) {
    case 'jab':
    case 'leadHook':
    case 'leadUppercut':
      return lead
    case 'cross':
    case 'rearHook':
    case 'rearUppercut':
      return rear
  }
}

/**
 * The mirror image of a defense.
 *
 * Only the lateral defenses have a handedness to mirror; stepping back, covering
 * up and parrying are the same movement whichever way the boxer is squared.
 */
export function mirrorDefense(defense: DefenseType): DefenseType {
  switch (defense) {
    case 'slipLeft':
      return 'slipRight'
    case 'slipRight':
      return 'slipLeft'
    case 'rollLeft':
      return 'rollRight'
    case 'rollRight':
      return 'rollLeft'
    case 'stepBack':
    case 'guard':
    case 'parry':
      return defense
  }
}

/**
 * The canonical punches, defined against an **orthodox** opponent.
 *
 * Durations are the time from the punch starting to the moment it lands, which
 * is the window the user has to react in. Straight punches travel the shortest
 * path and so are the fastest; rear-hand punches cross more distance and carry
 * more wind-up than their lead-hand equivalents.
 *
 * `expectedDefenses` lists every answer that scores, not the single best one:
 * a jab can be slipped either way, parried, or stepped away from, and the drill
 * should credit all four.
 *
 * TODO(tuning): durations and defense sets are boxing-standard starting values,
 * not measured ones — calibrate them against footage alongside
 * `config/thresholds.ts`.
 */
export const ATTACK_CATALOGUE: Readonly<Record<PunchType, Attack>> = {
  // Straight punches come down the centre, so the head has to leave the
  // centreline in either direction, or the hand has to deflect them.
  jab: {
    id: 'jab',
    name: 'jab',
    duration: 700,
    expectedDefenses: ['slipLeft', 'slipRight', 'parry', 'stepBack'],
  },
  cross: {
    id: 'cross',
    name: 'cross',
    duration: 850,
    expectedDefenses: ['slipLeft', 'slipRight', 'parry', 'stepBack'],
  },

  // Hooks arrive on an arc from one side, so slipping laterally moves *into*
  // them. The answer is to go under the arc, cover the side it lands on, or
  // leave its range entirely. The roll goes away from the incoming hand.
  leadHook: {
    id: 'leadHook',
    name: 'leadHook',
    duration: 800,
    expectedDefenses: ['rollLeft', 'guard', 'stepBack'],
  },
  rearHook: {
    id: 'rearHook',
    name: 'rearHook',
    duration: 900,
    expectedDefenses: ['rollRight', 'guard', 'stepBack'],
  },

  // Uppercuts travel upward inside the guard. Rolling drops the head onto them,
  // so the answers are to break the range or meet the hand.
  leadUppercut: {
    id: 'leadUppercut',
    name: 'leadUppercut',
    duration: 750,
    expectedDefenses: ['stepBack', 'guard', 'parry'],
  },
  rearUppercut: {
    id: 'rearUppercut',
    name: 'rearUppercut',
    duration: 900,
    expectedDefenses: ['stepBack', 'guard', 'parry'],
  },
}

/** The catalogue in a stable order, for iteration and random selection. */
export const ALL_PUNCHES: readonly PunchType[] = [
  'jab',
  'cross',
  'leadHook',
  'rearHook',
  'leadUppercut',
  'rearUppercut',
]

/**
 * Adapt a catalogue attack to the stance being boxed against.
 *
 * A southpaw is a mirror image of an orthodox boxer, so every punch arrives from
 * the opposite side and every lateral answer flips with it: the roll that takes
 * the user under an orthodox lead hook takes them into a southpaw's. The punch
 * keeps its name, because `leadHook` is already stance-relative — only the
 * physical direction, and therefore the set of defenses, mirrors.
 *
 * Returns the attack unchanged for orthodox, which is the catalogue's own frame
 * of reference.
 *
 * Note that the straight punches list both slips, so mirroring them is a no-op
 * on the set. That is correct rather than a special case: a jab can be slipped
 * either way regardless of who throws it.
 */
export function resolveForStance(attack: Attack, stance: Stance): Attack {
  if (stance === 'orthodox') {
    return attack
  }

  return {
    ...attack,
    expectedDefenses: attack.expectedDefenses.map(mirrorDefense),
  }
}

/** Look up a punch in the catalogue, already adapted to the given stance. */
export function attackFor(punch: PunchType, stance: Stance): Attack {
  return resolveForStance(ATTACK_CATALOGUE[punch], stance)
}
