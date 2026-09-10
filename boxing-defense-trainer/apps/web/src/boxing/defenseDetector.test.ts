/**
 * Unit tests for defense detection, against synthetic poses — no webcam.
 *
 * Every detector gets a pair: a clear movement it must recognise, and a small
 * or wrong movement it must refuse. The refusals are the more valuable half. A
 * detector that fires too readily produces a trainer that congratulates the user
 * for movements they never made, and nothing downstream can tell the difference
 * between a real slip and a lucky twitch.
 *
 * Poses are built by displacing a calibrated neutral stance in shoulder-widths,
 * so the fixtures read in the same units as the thresholds they are testing.
 */
import { describe, expect, it } from 'vitest'

import {
  detectDefense,
  detectGuard,
  detectParry,
  detectRoll,
  detectSlip,
  detectStepBack,
} from './defenseDetector'
import { THRESHOLDS } from './config/thresholds'
import type { KeypointName, NeutralStanceBaseline, PoseLandmarks } from '../types'

const { movement } = THRESHOLDS

/**
 * A square-on neutral stance.
 *
 * The subject's left shoulder is placed at the LOWER x, which is one of the two
 * possible conventions. The detectors read the direction out of the baseline
 * rather than assuming it, and `mirroredWorld` below checks that by flipping it.
 */
const NEUTRAL: Record<KeypointName, { x: number; y: number }> = {
  nose: { x: 0.5, y: 0.2 },
  leftEye: { x: 0.47, y: 0.18 },
  rightEye: { x: 0.53, y: 0.18 },
  leftShoulder: { x: 0.4, y: 0.35 },
  rightShoulder: { x: 0.6, y: 0.35 },
  leftElbow: { x: 0.36, y: 0.5 },
  rightElbow: { x: 0.64, y: 0.5 },
  leftWrist: { x: 0.44, y: 0.26 },
  rightWrist: { x: 0.56, y: 0.26 },
  leftHip: { x: 0.44, y: 0.6 },
  rightHip: { x: 0.56, y: 0.6 },
  leftKnee: { x: 0.44, y: 0.8 },
  rightKnee: { x: 0.56, y: 0.8 },
}

/** Shoulder width of the neutral stance: 0.6 - 0.4. */
const WIDTH = 0.2

type Displacement = Partial<Record<KeypointName, { dx?: number; dy?: number; score?: number }>>

/** A pose, displaced from neutral in shoulder-widths. */
function pose(displace: Displacement = {}, source = NEUTRAL): PoseLandmarks {
  return Object.fromEntries(
    (Object.keys(source) as KeypointName[]).map((name) => {
      const d = displace[name] ?? {}
      return [
        name,
        {
          name,
          x: source[name].x + (d.dx ?? 0) * WIDTH,
          y: source[name].y + (d.dy ?? 0) * WIDTH,
          score: d.score ?? 0.95,
        },
      ]
    }),
  ) as PoseLandmarks
}

/** Apply the same displacement to every landmark. */
function displaceAll(displace: { dx?: number; dy?: number }): Displacement {
  return Object.fromEntries(
    (Object.keys(NEUTRAL) as KeypointName[]).map((name) => [name, displace]),
  )
}

const BASELINE: NeutralStanceBaseline = {
  head: NEUTRAL.nose,
  shoulders: {
    left: NEUTRAL.leftShoulder,
    right: NEUTRAL.rightShoulder,
    center: { x: 0.5, y: 0.35 },
  },
  hips: { left: NEUTRAL.leftHip, right: NEUTRAL.rightHip, center: { x: 0.5, y: 0.6 } },
  wrists: { left: NEUTRAL.leftWrist, right: NEUTRAL.rightWrist },
  bodyWidth: WIDTH,
  sampleCount: 30,
}

/** Comfortably past a threshold, and comfortably short of it. */
const past = (threshold: number) => threshold * 1.6
const short = (threshold: number) => threshold * 0.4

describe('detectSlip', () => {
  it('detects a clear slip to the boxer left', () => {
    // The subject's left shoulder is at lower x here, so their left is -x.
    const slipped = pose({ nose: { dx: -past(movement.slipLateralRatio) } })

    const detection = detectSlip(slipped, BASELINE, 'left')

    expect(detection?.type).toBe('slipLeft')
    expect(detection!.magnitude).toBeCloseTo(past(movement.slipLateralRatio), 5)
    expect(detection!.confidence).toBeGreaterThan(0.5)
  })

  it('detects a clear slip to the boxer right', () => {
    const slipped = pose({ nose: { dx: past(movement.slipLateralRatio) } })

    expect(detectSlip(slipped, BASELINE, 'right')?.type).toBe('slipRight')
  })

  it('does NOT detect a slip from small head jitter', () => {
    // The single most important refusal: a boxer standing still is never
    // perfectly still, and every one of those frames must score nothing.
    const jitter = pose({ nose: { dx: -short(movement.slipLateralRatio) } })

    expect(detectSlip(jitter, BASELINE, 'left')).toBeNull()
  })

  it('does NOT report a slip in the direction the head did not go', () => {
    const slipped = pose({ nose: { dx: -past(movement.slipLateralRatio) } })

    expect(detectSlip(slipped, BASELINE, 'right')).toBeNull()
  })

  it('does NOT call a roll a slip, however far sideways it went', () => {
    // Both move the head sideways; only a roll takes it down. Without the
    // vertical check the more specific answer would be a coin toss.
    const rolled = pose({
      nose: { dx: -past(movement.slipLateralRatio), dy: past(movement.rollVerticalRatio) },
    })

    expect(detectSlip(rolled, BASELINE, 'left')).toBeNull()
  })

  it('refuses to measure landmarks the model could not see', () => {
    const unseen = pose({
      nose: { dx: -past(movement.slipLateralRatio), score: 0.1 },
    })

    expect(detectSlip(unseen, BASELINE, 'left')).toBeNull()
  })
})

describe('detectRoll', () => {
  const rolling = (direction: -1 | 1) => ({
    nose: {
      dx: direction * past(movement.rollHorizontalRatio),
      dy: past(movement.rollVerticalRatio),
    },
    leftHip: { dy: past(movement.rollHipDropRatio) },
    rightHip: { dy: past(movement.rollHipDropRatio) },
  })

  it('detects a clear roll to the boxer left', () => {
    const detection = detectRoll(pose(rolling(-1)), BASELINE, 'left')

    expect(detection?.type).toBe('rollLeft')
    expect(detection!.confidence).toBeGreaterThan(0.5)
  })

  it('detects a clear roll to the boxer right', () => {
    expect(detectRoll(pose(rolling(1)), BASELINE, 'right')?.type).toBe('rollRight')
  })

  it('does NOT detect a roll from a shallow bob', () => {
    const bob = pose({
      nose: { dx: -short(movement.rollHorizontalRatio), dy: short(movement.rollVerticalRatio) },
    })

    expect(detectRoll(bob, BASELINE, 'left')).toBeNull()
  })

  it('does NOT detect a roll when the head drops but the hips do not', () => {
    // A roll is driven from the legs. Head-only is a nod, and rewarding it
    // would teach the user a movement that gets them hit.
    const nod = pose({
      nose: {
        dx: -past(movement.rollHorizontalRatio),
        dy: past(movement.rollVerticalRatio),
      },
    })

    expect(detectRoll(nod, BASELINE, 'left')).toBeNull()
  })

  it('does NOT detect a roll from a straight drop with no arc', () => {
    const duck = pose({
      nose: { dy: past(movement.rollVerticalRatio) },
      leftHip: { dy: past(movement.rollHipDropRatio) },
      rightHip: { dy: past(movement.rollHipDropRatio) },
    })

    expect(detectRoll(duck, BASELINE, 'left')).toBeNull()
  })
})

describe('detectStepBack', () => {
  /** Narrow the shoulders about their centre, as retreating does. */
  const retreat = (shrink: number) => ({
    leftShoulder: { dx: shrink / 2 },
    rightShoulder: { dx: -shrink / 2 },
  })

  it('detects a clear step back', () => {
    const detection = detectStepBack(pose(retreat(past(movement.stepBackRatio))), BASELINE)

    expect(detection?.type).toBe('stepBack')
    expect(detection!.confidence).toBeGreaterThan(0.5)
  })

  it('does NOT detect a step back from a slight lean', () => {
    expect(detectStepBack(pose(retreat(short(movement.stepBackRatio))), BASELINE)).toBeNull()
  })

  it('does NOT mistake turning side-on for a retreat', () => {
    // Pivoting narrows the shoulders exactly as retreating does. The head
    // leaving the centreline is what tells them apart.
    const pivot = pose({
      ...retreat(past(movement.stepBackRatio)),
      nose: { dx: past(movement.slipLateralRatio) },
    })

    expect(detectStepBack(pivot, BASELINE)).toBeNull()
  })

  it('does NOT fire when the user steps toward the camera', () => {
    const advance = pose(retreat(-past(movement.stepBackRatio)))

    expect(detectStepBack(advance, BASELINE)).toBeNull()
  })
})

describe('detectGuard', () => {
  const gloves = (gapRatio: number): PoseLandmarks =>
    pose({
      leftWrist: {
        dx: (NEUTRAL.nose.x - NEUTRAL.leftWrist.x) / WIDTH,
        dy: (NEUTRAL.nose.y + gapRatio * WIDTH - NEUTRAL.leftWrist.y) / WIDTH,
      },
      rightWrist: {
        dx: (NEUTRAL.nose.x - NEUTRAL.rightWrist.x) / WIDTH,
        dy: (NEUTRAL.nose.y + gapRatio * WIDTH - NEUTRAL.rightWrist.y) / WIDTH,
      },
    })

  it('detects gloves pulled tight to the head', () => {
    const detection = detectGuard(gloves(movement.guardHandToHeadRatio * 0.3), BASELINE)

    expect(detection?.type).toBe('guard')
    expect(detection!.confidence).toBeGreaterThan(0.5)
  })

  it('does NOT detect a guard from hands at rest', () => {
    // The resting stance already has the hands up. A guard is tightening from
    // there, not merely being there — otherwise every idle frame scores.
    expect(detectGuard(pose(), BASELINE)).toBeNull()
  })

  it('does NOT detect a guard when only one glove comes up', () => {
    const oneHand = pose({
      leftWrist: {
        dx: (NEUTRAL.nose.x - NEUTRAL.leftWrist.x) / WIDTH,
        dy: (NEUTRAL.nose.y - NEUTRAL.leftWrist.y) / WIDTH,
      },
    })

    expect(detectGuard(oneHand, BASELINE)).toBeNull()
  })

  it('holds while slipping, because it measures against the current head', () => {
    const slipDx = -past(movement.slipLateralRatio)
    const slippingWithGuard = pose({
      nose: { dx: slipDx },
      leftWrist: {
        dx: (NEUTRAL.nose.x - NEUTRAL.leftWrist.x) / WIDTH + slipDx,
        dy: (NEUTRAL.nose.y - NEUTRAL.leftWrist.y) / WIDTH,
      },
      rightWrist: {
        dx: (NEUTRAL.nose.x - NEUTRAL.rightWrist.x) / WIDTH + slipDx,
        dy: (NEUTRAL.nose.y - NEUTRAL.rightWrist.y) / WIDTH,
      },
    })

    expect(detectGuard(slippingWithGuard, BASELINE)?.type).toBe('guard')
  })
})

describe('detectParry', () => {
  const history = [pose()]

  it('detects a hand pushing out toward the incoming punch', () => {
    const parried = pose({
      rightWrist: { dx: past(movement.parryHandTravelRatio) },
    })

    const detection = detectParry(parried, BASELINE, 'right', history)

    expect(detection?.type).toBe('parry')
    expect(detection!.confidence).toBeGreaterThan(0.5)
  })

  it('does NOT detect a parry from a small hand drift', () => {
    const drift = pose({ rightWrist: { dx: short(movement.parryHandTravelRatio) } })

    expect(detectParry(drift, BASELINE, 'right', history)).toBeNull()
  })

  it('does NOT detect a parry from the hand on the other side', () => {
    const wrongHand = pose({ leftWrist: { dx: -past(movement.parryHandTravelRatio) } })

    expect(detectParry(wrongHand, BASELINE, 'right', history)).toBeNull()
  })

  it('does NOT detect a parry when the whole body carried the hand', () => {
    // A hand moving because its owner turned is not a parry. The wrist has to
    // outrun the head it is protecting.
    const wholeBody = pose(displaceAll({ dx: past(movement.parryHandTravelRatio) }))

    expect(detectParry(wholeBody, BASELINE, 'right', history)).toBeNull()
  })

  it('does NOT detect a parry without history to measure travel against', () => {
    const parried = pose({ rightWrist: { dx: past(movement.parryHandTravelRatio) } })

    expect(detectParry(parried, BASELINE, 'right', [])).toBeNull()
  })
})

describe('detectDefense', () => {
  const context = (
    landmarks: PoseLandmarks,
    extra: Partial<Parameters<typeof detectDefense>[0]> = {},
  ) => ({
    landmarks,
    baseline: BASELINE,
    history: [pose()],
    stance: 'orthodox' as const,
    ...extra,
  })

  it('returns null for a boxer standing still', () => {
    expect(detectDefense(context(pose()))).toBeNull()
  })

  it('returns null for jitter below every threshold', () => {
    const jitter = pose({
      nose: { dx: 0.01, dy: 0.01 },
      leftWrist: { dx: 0.01 },
      rightWrist: { dx: -0.01 },
    })

    expect(detectDefense(context(jitter))).toBeNull()
  })

  it('recognises a slip through the registry', () => {
    const slipped = pose({ nose: { dx: -past(movement.slipLateralRatio) } })

    expect(detectDefense(context(slipped))?.type).toBe('slipLeft')
  })

  it('prefers the roll when a movement is both a roll and sideways', () => {
    // Several detectors can fire at once. The registry returns the most
    // confident, not the first, so its order is not a hidden priority list.
    const rolled = pose({
      nose: {
        dx: -past(movement.rollHorizontalRatio),
        dy: past(movement.rollVerticalRatio),
      },
      leftHip: { dy: past(movement.rollHipDropRatio) },
      rightHip: { dy: past(movement.rollHipDropRatio) },
    })

    expect(detectDefense(context(rolled))?.type).toBe('rollLeft')
  })

  it('never looks for a parry when no punch is incoming', () => {
    const handOut = pose({ rightWrist: { dx: past(movement.parryHandTravelRatio) } })

    expect(detectDefense(context(handOut))?.type).not.toBe('parry')
  })

  it('finds the parry once a side is given', () => {
    const handOut = pose({ rightWrist: { dx: past(movement.parryHandTravelRatio) } })

    expect(detectDefense(context(handOut, { incomingSide: 'right' }))?.type).toBe('parry')
  })

  it('refuses to detect anything without a usable baseline', () => {
    // A zero body width means every ratio divides by zero. Detection without a
    // calibrated baseline is undefined, not merely inaccurate.
    const slipped = pose({ nose: { dx: -past(movement.slipLateralRatio) } })

    expect(detectDefense(context(slipped, { baseline: { ...BASELINE, bodyWidth: 0 } }))).toBeNull()
  })

  it('reports magnitude in shoulder-widths, comparable across body sizes', () => {
    // The same movement on a user twice as wide, twice as far away, must
    // measure the same. This is the whole reason for normalising.
    const slipped = pose({ nose: { dx: -past(movement.slipLateralRatio) } })
    const small = detectDefense(context(slipped))

    const scaled = Object.fromEntries(
      (Object.keys(NEUTRAL) as KeypointName[]).map((name) => [
        name,
        { ...slipped[name], x: slipped[name].x * 0.5, y: slipped[name].y * 0.5 },
      ]),
    ) as PoseLandmarks

    const halfBaseline: NeutralStanceBaseline = {
      ...BASELINE,
      head: { x: BASELINE.head.x * 0.5, y: BASELINE.head.y * 0.5 },
      shoulders: {
        left: { x: BASELINE.shoulders.left.x * 0.5, y: BASELINE.shoulders.left.y * 0.5 },
        right: { x: BASELINE.shoulders.right.x * 0.5, y: BASELINE.shoulders.right.y * 0.5 },
        center: { x: BASELINE.shoulders.center.x * 0.5, y: BASELINE.shoulders.center.y * 0.5 },
      },
      bodyWidth: WIDTH * 0.5,
    }

    const large = detectDefense(context(scaled, { baseline: halfBaseline }))

    expect(large?.type).toBe(small?.type)
    expect(large!.magnitude).toBeCloseTo(small!.magnitude, 6)
  })
})

describe('mirrored coordinate convention', () => {
  it('still reports the boxer own left when the image convention is flipped', () => {
    // The detectors read left/right out of the calibrated shoulders rather than
    // assuming which has the larger x. Under the opposite convention — the
    // subject's left shoulder at higher x — a slip to their left must still
    // report slipLeft. Hard-coding the axis would pass a test written under one
    // convention and be inverted in the real world.
    const flip = (p: { x: number; y: number }) => ({ x: 1 - p.x, y: p.y })

    const mirroredNeutral = Object.fromEntries(
      (Object.keys(NEUTRAL) as KeypointName[]).map((name) => [name, flip(NEUTRAL[name])]),
    ) as Record<KeypointName, { x: number; y: number }>

    const mirroredBaseline: NeutralStanceBaseline = {
      ...BASELINE,
      head: flip(BASELINE.head),
      shoulders: {
        left: flip(BASELINE.shoulders.left),
        right: flip(BASELINE.shoulders.right),
        center: flip(BASELINE.shoulders.center),
      },
      hips: {
        left: flip(BASELINE.hips.left),
        right: flip(BASELINE.hips.right),
        center: flip(BASELINE.hips.center),
      },
      wrists: { left: flip(BASELINE.wrists.left), right: flip(BASELINE.wrists.right) },
    }

    // In this world the boxer's left is +x, so slipping left increases x.
    const slipped = pose({ nose: { dx: past(movement.slipLateralRatio) } }, mirroredNeutral)

    expect(detectSlip(slipped, mirroredBaseline, 'left')?.type).toBe('slipLeft')
    expect(detectSlip(slipped, mirroredBaseline, 'right')).toBeNull()
  })
})
