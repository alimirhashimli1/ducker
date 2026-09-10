/**
 * Responsibility: the catalogue of defensive movements — what each one is
 * called, what it does, and which punches it answers. It describes defenses; it
 * does not detect them in a pose stream (`defenseDetector.ts`) or decide
 * whether one was performed in time (`scoring.ts`).
 *
 * The punch/defense pairing is *derived* from `attacks.ts` rather than restated
 * here. Writing it out twice would let the two drift, and the attack catalogue
 * is the side that scoring reads, so it is the side that must be authoritative.
 */
import { ALL_PUNCHES, attackFor } from './attacks'
import type { Attack, DefenseType, PunchType, Stance } from '../types'

/** How a defense is described to the user. */
export interface DefenseMeta {
  readonly type: DefenseType
  /** Short label for the HUD. */
  readonly displayName: string
  /** One line on what the movement actually is, for coaching text and tooltips. */
  readonly description: string
  /** Whether the movement is handed, and so mirrors between stances. */
  readonly lateral: boolean
}

export const DEFENSE_CATALOGUE: Readonly<Record<DefenseType, DefenseMeta>> = {
  slipLeft: {
    type: 'slipLeft',
    displayName: 'Slip left',
    description: 'Move the head off the centreline to your left, letting a straight punch pass.',
    lateral: true,
  },
  slipRight: {
    type: 'slipRight',
    displayName: 'Slip right',
    description: 'Move the head off the centreline to your right, letting a straight punch pass.',
    lateral: true,
  },
  rollLeft: {
    type: 'rollLeft',
    displayName: 'Roll left',
    description: 'Bend the knees and weave under the punch on an arc to your left.',
    lateral: true,
  },
  rollRight: {
    type: 'rollRight',
    displayName: 'Roll right',
    description: 'Bend the knees and weave under the punch on an arc to your right.',
    lateral: true,
  },
  stepBack: {
    type: 'stepBack',
    displayName: 'Step back',
    description: 'Break the distance so the punch falls short.',
    lateral: false,
  },
  guard: {
    type: 'guard',
    displayName: 'Guard',
    description: 'Bring both gloves tight to the head and absorb the punch on the arms.',
    lateral: false,
  },
  parry: {
    type: 'parry',
    displayName: 'Parry',
    description: 'Meet the incoming hand and deflect it across the centreline.',
    lateral: false,
  },
}

/** The catalogue in a stable order, for iteration and display. */
export const ALL_DEFENSES: readonly DefenseType[] = [
  'slipLeft',
  'slipRight',
  'rollLeft',
  'rollRight',
  'stepBack',
  'guard',
  'parry',
]

/**
 * Invert the attack catalogue: for each defense, the punches it answers.
 *
 * Built once per stance at module load. `Record<DefenseType, …>` over a literal
 * union is a total mapped type, so every defense has an entry — a defense that
 * answers nothing gets an empty list rather than being absent.
 */
function buildPunchIndex(stance: Stance): Readonly<Record<DefenseType, readonly PunchType[]>> {
  const index: Record<DefenseType, PunchType[]> = {
    slipLeft: [],
    slipRight: [],
    rollLeft: [],
    rollRight: [],
    stepBack: [],
    guard: [],
    parry: [],
  }

  for (const punch of ALL_PUNCHES) {
    for (const defense of attackFor(punch, stance).expectedDefenses) {
      index[defense].push(punch)
    }
  }

  return index
}

const PUNCH_INDEX: Readonly<Record<Stance, Readonly<Record<DefenseType, readonly PunchType[]>>>> = {
  orthodox: buildPunchIndex('orthodox'),
  southpaw: buildPunchIndex('southpaw'),
}

/**
 * The punches a given defense is a correct answer to, against the given stance.
 *
 * Derived from `ATTACK_CATALOGUE`, so adding a punch or changing its expected
 * defenses updates this automatically.
 */
export function punchesAnsweredBy(defense: DefenseType, stance: Stance): readonly PunchType[] {
  return PUNCH_INDEX[stance][defense]
}

/** Whether a defense is a correct answer to a specific attack. */
export function isValidDefense(attack: Attack, defense: DefenseType): boolean {
  return attack.expectedDefenses.includes(defense)
}
