/**
 * Responsibility: how the sparring partner moves for each punch, as Framer
 * Motion variants. Declarative data only — no components, no side effects, and
 * no opinion about when any of it plays.
 *
 * Durations here are cosmetic, per `src/animations/README.md`. They are how long
 * the *drawing* takes, not how long the user has to react: the reaction window
 * is `Attack.duration` from `src/boxing/attacks.ts`, and when the training loop
 * is wired up it should override the transition rather than these values being
 * quietly treated as game timing.
 *
 * ## Why poses are written once and variants derived
 *
 * Framer needs one `Variants` object per animated element, each keyed by action
 * — ten parts times seven actions is seventy targets. Written out by hand that
 * is unreadable and impossible to tune, because a single punch is smeared
 * across ten places. So each punch is described here as one coherent `BoxerPose`
 * — what the torso, head and both arms do — and `boxerVariants` inverts that
 * into the per-part shape Framer wants. Tuning a punch means editing one entry.
 *
 * ## The 2D convention
 *
 * The boxer faces the viewer, so a punch travelling *toward* the camera has
 * almost no screen displacement. It is read instead as the glove growing
 * (`gloveScale`) — that is what makes a jab legible head-on. Hooks and uppercuts
 * travel across the frame and so are carried by `gloveX` / `gloveY` instead.
 * That difference is what makes the six punches distinguishable rather than six
 * variations of "arm moves".
 */
import type { Transition, Variants } from 'framer-motion'

import type { PunchType } from '../types'

/** Everything the boxer can be doing. `idle` is the resting guard. */
export const BOXER_ACTIONS = [
  'idle',
  'jab',
  'cross',
  'leadHook',
  'rearHook',
  'leadUppercut',
  'rearUppercut',
] as const satisfies readonly ['idle', ...PunchType[]]

export type BoxerAction = (typeof BOXER_ACTIONS)[number]

/** The independently animated groups of the figure. */
export const BOXER_PARTS = [
  'torso',
  'head',
  'leadUpperArm',
  'leadForearm',
  'leadGlove',
  'rearUpperArm',
  'rearForearm',
  'rearGlove',
  'leadLeg',
  'rearLeg',
] as const

export type BoxerPart = (typeof BOXER_PARTS)[number]

/**
 * One arm's contribution to a pose.
 *
 * Rotations are degrees about the joint above the segment — the upper arm turns
 * at the shoulder, the forearm at the elbow. The groups are nested in the SVG,
 * so these compose the way a real arm does and each value can be read on its
 * own.
 */
interface ArmPose {
  /** Shoulder rotation. Positive swings the arm downward on screen. */
  readonly upperRotate: number
  /** Elbow rotation, relative to the upper arm. Negative straightens forward. */
  readonly forearmRotate: number
  /** How much nearer the camera the glove reads as being. 1 is the guard. */
  readonly gloveScale: number
  /** Screen travel, in viewBox units. */
  readonly gloveX: number
  readonly gloveY: number
}

/** The whole figure at the peak of one action. */
interface BoxerPose {
  readonly torso: { readonly rotate: number; readonly y: number }
  readonly head: { readonly x: number; readonly y: number }
  readonly leadArm: ArmPose
  readonly rearArm: ArmPose
  /** Weight shift through the legs, in degrees. */
  readonly legs: { readonly lead: number; readonly rear: number }
  /** How long the movement out to this pose takes, in ms. */
  readonly durationMs: number
}

/** The resting guard: both gloves up, nothing extended. */
const GUARD: ArmPose = {
  upperRotate: 0,
  forearmRotate: 0,
  gloveScale: 1,
  gloveX: 0,
  gloveY: 0,
}

/**
 * The six punches plus the guard.
 *
 * Rear-hand punches rotate the torso further than lead-hand ones because that
 * is where their power comes from — the hip turn is the punch. It is also the
 * clearest tell that a cross is not a jab when both are travelling at the
 * camera.
 */
export const boxerPoses: Readonly<Record<BoxerAction, BoxerPose>> = {
  idle: {
    torso: { rotate: 0, y: 0 },
    head: { x: 0, y: 0 },
    leadArm: GUARD,
    rearArm: GUARD,
    legs: { lead: 0, rear: 0 },
    durationMs: 2400,
  },

  // Straight punches: little screen travel, carried by the glove growing.
  jab: {
    torso: { rotate: -3, y: 0 },
    head: { x: -2, y: 0 },
    leadArm: { upperRotate: -6, forearmRotate: 12, gloveScale: 1.5, gloveX: -10, gloveY: 4 },
    rearArm: GUARD,
    legs: { lead: -1, rear: 0 },
    // The fastest punch in boxing, and the animation has to read that way.
    durationMs: 200,
  },
  cross: {
    torso: { rotate: 8, y: 0 },
    head: { x: 3, y: 0 },
    leadArm: GUARD,
    rearArm: { upperRotate: 8, forearmRotate: -14, gloveScale: 1.68, gloveX: 16, gloveY: 2 },
    legs: { lead: 0, rear: 4 },
    durationMs: 280,
  },

  // Hooks: an arc across the frame, so the travel is lateral and the glove
  // grows far less than on a straight punch.
  leadHook: {
    torso: { rotate: -9, y: 0 },
    head: { x: -3, y: 0 },
    leadArm: { upperRotate: -34, forearmRotate: -30, gloveScale: 1.22, gloveX: -34, gloveY: -6 },
    rearArm: GUARD,
    legs: { lead: -3, rear: 1 },
    durationMs: 300,
  },
  rearHook: {
    torso: { rotate: 10, y: 0 },
    head: { x: 3, y: 0 },
    rearArm: { upperRotate: 34, forearmRotate: 30, gloveScale: 1.28, gloveX: 34, gloveY: -6 },
    leadArm: GUARD,
    legs: { lead: 1, rear: 5 },
    durationMs: 320,
  },

  // Uppercuts: the arc is vertical and the whole figure drives upward, which is
  // what separates them from a hook at the same distance.
  leadUppercut: {
    torso: { rotate: -5, y: -5 },
    head: { x: -1, y: -3 },
    leadArm: { upperRotate: 15, forearmRotate: -48, gloveScale: 1.4, gloveX: -13, gloveY: -32 },
    rearArm: GUARD,
    legs: { lead: -3, rear: 1 },
    durationMs: 280,
  },
  rearUppercut: {
    torso: { rotate: 8, y: -6 },
    head: { x: 1, y: -3 },
    rearArm: { upperRotate: -15, forearmRotate: 48, gloveScale: 1.46, gloveX: 13, gloveY: -32 },
    leadArm: GUARD,
    legs: { lead: 1, rear: 5 },
    durationMs: 300,
  },
}

/** How long the movement out to an action's pose takes, in ms. */
export function actionDurationMs(action: BoxerAction): number {
  return boxerPoses[action].durationMs
}

/**
 * The transition for one action.
 *
 * `easeOut` because a punch is fastest at the start and decelerates into the
 * target — linear motion reads as a machine, not a person. Idle is the
 * exception: a slow symmetrical breathing loop, so the figure is not
 * unnervingly still between punches.
 */
export function transitionFor(action: BoxerAction): Transition {
  const duration = actionDurationMs(action) / 1000

  if (action === 'idle') {
    return { duration, ease: 'easeInOut', repeat: Infinity, repeatType: 'mirror' }
  }

  return { duration, ease: 'easeOut' }
}

/** Read one part's target out of a pose. */
function targetFor(part: BoxerPart, pose: BoxerPose): Record<string, number> {
  const arm = part.startsWith('lead') ? pose.leadArm : pose.rearArm

  switch (part) {
    case 'torso':
      return { rotate: pose.torso.rotate, y: pose.torso.y }
    case 'head':
      return { x: pose.head.x, y: pose.head.y }
    case 'leadUpperArm':
    case 'rearUpperArm':
      return { rotate: arm.upperRotate }
    case 'leadForearm':
    case 'rearForearm':
      return { rotate: arm.forearmRotate }
    case 'leadGlove':
    case 'rearGlove':
      return { scale: arm.gloveScale, x: arm.gloveX, y: arm.gloveY }
    case 'leadLeg':
      return { rotate: pose.legs.lead }
    case 'rearLeg':
      return { rotate: pose.legs.rear }
  }
}

/** Build one part's variants across every action. */
function variantsForPart(part: BoxerPart): Variants {
  const variants: Variants = {}

  for (const action of BOXER_ACTIONS) {
    variants[action] = {
      ...targetFor(part, boxerPoses[action]),
      transition: transitionFor(action),
    }
  }

  return variants
}

/**
 * Framer Motion variants for every animated group, each keyed by every action.
 *
 * Derived from `boxerPoses` rather than written out, so a part can never be
 * missing an action and a punch can never be half-defined.
 *
 * Note that nothing here mentions stance. A southpaw is the mirror image of an
 * orthodox boxer, so `Boxer` flips the whole figure horizontally instead — the
 * lead arm is whichever arm ends up on the correct side. Duplicating every
 * variant for southpaw would double the tuning surface for no gain, and the two
 * copies would drift.
 */
export const boxerVariants: Readonly<Record<BoxerPart, Variants>> = Object.fromEntries(
  BOXER_PARTS.map((part) => [part, variantsForPart(part)]),
) as Record<BoxerPart, Variants>
