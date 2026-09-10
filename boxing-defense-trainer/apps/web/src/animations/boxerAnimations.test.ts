/**
 * Unit tests for the boxer's motion data.
 *
 * `boxerVariants` is derived from `boxerPoses` rather than written out, so what
 * matters is that the derivation is total — every part carries every action —
 * and that the punches stay visually distinguishable from one another. The
 * second part is the interesting one: nothing else in the suite can catch a
 * hook that has been tuned until it looks like a straight punch.
 *
 * These run in the `domain` project, with no DOM. Variants are data.
 */
import { describe, expect, it } from 'vitest'

import {
  BOXER_ACTIONS,
  BOXER_PARTS,
  actionDurationMs,
  boxerPoses,
  boxerVariants,
  transitionFor,
  type BoxerAction,
} from './boxerAnimations'
import { ALL_PUNCHES } from '../boxing'

const PUNCHES = BOXER_ACTIONS.filter((a): a is Exclude<BoxerAction, 'idle'> => a !== 'idle')

describe('BOXER_ACTIONS', () => {
  it('is idle plus exactly the punches the domain knows about', () => {
    // The figure must be able to draw every punch the engine can throw. If a
    // punch were added to the catalogue and not here, the boxer would silently
    // stand still for it.
    expect([...PUNCHES].sort()).toEqual([...ALL_PUNCHES].sort())
    expect(BOXER_ACTIONS[0]).toBe('idle')
  })

  it('lists no action twice', () => {
    expect(new Set(BOXER_ACTIONS).size).toBe(BOXER_ACTIONS.length)
  })
})

describe('boxerVariants', () => {
  it('gives every part a variant for every action, and no others', () => {
    // Framer falls back silently when a variant key is missing — the limb just
    // does not move — so totality is the property worth pinning.
    for (const part of BOXER_PARTS) {
      expect(Object.keys(boxerVariants[part]).sort()).toEqual([...BOXER_ACTIONS].sort())
    }
  })

  it('covers every part', () => {
    expect(Object.keys(boxerVariants).sort()).toEqual([...BOXER_PARTS].sort())
  })

  it('attaches a transition to every variant', () => {
    for (const part of BOXER_PARTS) {
      for (const action of BOXER_ACTIONS) {
        expect(boxerVariants[part][action]).toHaveProperty('transition')
      }
    }
  })

  it('rests every part at neutral in idle', () => {
    // Idle is the guard. A part left offset there would make the figure sit
    // permanently crooked between punches.
    for (const part of BOXER_PARTS) {
      const idle = boxerVariants[part]['idle'] as Record<string, unknown>

      for (const [key, value] of Object.entries(idle)) {
        if (key === 'transition') continue
        expect(value, `${part}.idle.${key}`).toBe(key === 'scale' ? 1 : 0)
      }
    }
  })
})

describe('punch poses', () => {
  it('moves the throwing arm and leaves the other at guard', () => {
    // The defining property: a jab must not move the rear glove. If both arms
    // moved, the user could not read which hand is coming.
    for (const punch of PUNCHES) {
      const pose = boxerPoses[punch]
      const throwing = punch.startsWith('lead') || punch === 'jab' ? 'leadArm' : 'rearArm'
      const idleSide = throwing === 'leadArm' ? 'rearArm' : 'leadArm'

      expect(pose[throwing].gloveScale, `${punch} throwing arm`).toBeGreaterThan(1)
      expect(pose[idleSide], `${punch} guard arm`).toEqual(boxerPoses.idle.leadArm)
    }
  })

  it('turns the hips further on rear-hand punches than lead-hand ones', () => {
    // The hip turn is the power, and it is the clearest tell that a cross is
    // not a jab when both are travelling at the camera.
    expect(Math.abs(boxerPoses.cross.torso.rotate)).toBeGreaterThan(
      Math.abs(boxerPoses.jab.torso.rotate),
    )
    expect(Math.abs(boxerPoses.rearHook.torso.rotate)).toBeGreaterThan(
      Math.abs(boxerPoses.leadHook.torso.rotate),
    )
  })

  it('carries straight punches with scale and hooks with lateral travel', () => {
    // The 2D convention that makes the punches tell each other apart head-on.
    const jab = boxerPoses.jab.leadArm
    const hook = boxerPoses.leadHook.leadArm

    expect(jab.gloveScale).toBeGreaterThan(hook.gloveScale)
    expect(Math.abs(hook.gloveX)).toBeGreaterThan(Math.abs(jab.gloveX))
  })

  it('drives uppercuts upward, unlike every other punch', () => {
    for (const uppercut of ['leadUppercut', 'rearUppercut'] as const) {
      const arm =
        uppercut === 'leadUppercut' ? boxerPoses[uppercut].leadArm : boxerPoses[uppercut].rearArm

      // Negative y is upward in SVG.
      expect(arm.gloveY).toBeLessThan(-20)
      expect(boxerPoses[uppercut].torso.y).toBeLessThan(0)
    }
  })

  it('sends the two hooks in opposite directions', () => {
    expect(Math.sign(boxerPoses.leadHook.leadArm.gloveX)).not.toBe(
      Math.sign(boxerPoses.rearHook.rearArm.gloveX),
    )
  })

  it('gives every punch a visibly distinct glove target', () => {
    // Guards the whole point of the file: six punches that animate to the same
    // place would be six identical animations.
    const targets = PUNCHES.map((punch) => {
      const arm = punch.startsWith('lead') || punch === 'jab' ? 'leadArm' : 'rearArm'
      const { gloveX, gloveY, gloveScale } = boxerPoses[punch][arm]
      return `${gloveX}:${gloveY}:${gloveScale}`
    })

    expect(new Set(targets).size).toBe(PUNCHES.length)
  })
})

describe('timing', () => {
  it('makes the jab the fastest punch', () => {
    for (const punch of PUNCHES) {
      if (punch === 'jab') continue
      expect(actionDurationMs('jab')).toBeLessThanOrEqual(actionDurationMs(punch))
    }
  })

  it('gives every action a positive duration', () => {
    for (const action of BOXER_ACTIONS) {
      expect(actionDurationMs(action)).toBeGreaterThan(0)
    }
  })

  it('keeps punches short enough to read as punches', () => {
    // Cosmetic, not the reaction window — but a half-second animation would
    // stop looking like a punch being thrown.
    for (const punch of PUNCHES) {
      expect(actionDurationMs(punch)).toBeLessThan(500)
    }
  })

  it('loops idle and does not loop punches', () => {
    // A punch that repeated forever would never fire onAnimationComplete, and
    // the figure would never return to guard.
    expect(transitionFor('idle')).toHaveProperty('repeat', Infinity)

    for (const punch of PUNCHES) {
      expect(transitionFor(punch)).not.toHaveProperty('repeat')
    }
  })
})
