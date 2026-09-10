/**
 * Unit tests for scoring.
 *
 * Scoring is where the drill's opinions live — what it rewards is what the user
 * will learn to do. So these pin the *shape* of the rules (a wrong defense
 * scores nothing; small delays cost nothing) rather than the exact numbers,
 * which are weights meant to be retuned.
 */
import { describe, expect, it } from 'vitest'

import { scoreBalance, scoreDefense, scoreMovement, scoreReaction } from './scoring'
import { ATTACK_CATALOGUE } from './attacks'
import { THRESHOLDS } from './config/thresholds'
import type { DefenseDetection } from './defenseDetector'
import type { KeypointName, NeutralStanceBaseline, PoseLandmarks } from '../types'

const { movement, scoring, timing } = THRESHOLDS

const NAMES: readonly KeypointName[] = [
  'nose',
  'leftEye',
  'rightEye',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
]

const WIDTH = 0.2

const BASELINE: NeutralStanceBaseline = {
  head: { x: 0.5, y: 0.2 },
  shoulders: { left: { x: 0.4, y: 0.35 }, right: { x: 0.6, y: 0.35 }, center: { x: 0.5, y: 0.35 } },
  hips: { left: { x: 0.44, y: 0.6 }, right: { x: 0.56, y: 0.6 }, center: { x: 0.5, y: 0.6 } },
  wrists: { left: { x: 0.44, y: 0.26 }, right: { x: 0.56, y: 0.26 } },
  bodyWidth: WIDTH,
  sampleCount: 30,
}

/** A pose with the head displaced from neutral by `driftRatio` shoulder-widths. */
function poseWithDrift(driftRatio: number): PoseLandmarks {
  return Object.fromEntries(
    NAMES.map((name) => [
      name,
      {
        name,
        x: name === 'nose' ? BASELINE.head.x + driftRatio * WIDTH : 0.5,
        y: name === 'nose' ? BASELINE.head.y : 0.4,
        score: 0.95,
      },
    ]),
  ) as PoseLandmarks
}

const detection = (overrides: Partial<DefenseDetection> = {}): DefenseDetection => ({
  type: 'slipLeft',
  magnitude: scoring.movementFullCreditRatio,
  confidence: 0.9,
  ...overrides,
})

const JAB = ATTACK_CATALOGUE.jab
const ATTACK_START = 1000
const LANDS_AT = ATTACK_START + JAB.duration

/** Everything scoreDefense needs, with the interesting parts overridable. */
const input = (overrides: Partial<Parameters<typeof scoreDefense>[0]> = {}) => ({
  attack: JAB,
  detection: detection(),
  attackStartTime: ATTACK_START,
  detectedAt: LANDS_AT,
  baseline: BASELINE,
  recoveryPose: poseWithDrift(0),
  ...overrides,
})

describe('scoreReaction', () => {
  it('gives full marks for a defense exactly on the punch', () => {
    expect(scoreReaction(0)).toBe(100)
  })

  it('does not punish small delays inside the tolerance window', () => {
    // The explicit requirement. A drill that docked points for being 40ms out
    // would be scoring detector jitter, not the boxer.
    expect(scoreReaction(timing.reactionToleranceMs - 1)).toBe(100)
    expect(scoreReaction(timing.reactionToleranceMs)).toBe(100)
  })

  it('treats early and late symmetrically', () => {
    const late = scoreReaction(timing.reactionToleranceMs + 100)
    const early = scoreReaction(-(timing.reactionToleranceMs + 100))

    expect(early).toBe(late)
  })

  it('tapers to zero at the miss window', () => {
    const halfway = scoreReaction((timing.reactionToleranceMs + timing.missWindowMs) / 2)

    expect(scoreReaction(timing.missWindowMs)).toBe(0)
    expect(halfway).toBeGreaterThan(0)
    expect(halfway).toBeLessThan(100)
  })

  it('scales its windows by the difficulty tolerance factor', () => {
    // A late reaction that fails at level 5 should still earn something at
    // level 1, without scoring needing to know levels exist.
    const offBy = timing.reactionToleranceMs * 1.5

    expect(scoreReaction(offBy, 2)).toBeGreaterThan(scoreReaction(offBy, 1))
  })
})

describe('scoreMovement', () => {
  it('gives full marks for a committed movement', () => {
    expect(scoreMovement(scoring.movementFullCreditRatio)).toBe(100)
    expect(scoreMovement(scoring.movementFullCreditRatio * 2)).toBe(100)
  })

  it('scores nothing at the noise floor', () => {
    expect(scoreMovement(movement.minMovementRatio)).toBe(0)
    expect(scoreMovement(0)).toBe(0)
  })

  it('scales in between', () => {
    const middle = (movement.minMovementRatio + scoring.movementFullCreditRatio) / 2

    expect(scoreMovement(middle)).toBeGreaterThan(0)
    expect(scoreMovement(middle)).toBeLessThan(100)
  })
})

describe('scoreBalance', () => {
  it('gives full marks for a boxer back on centre', () => {
    // toBeCloseTo, not toBe: the drift is computed through a square root, so a
    // displacement of exactly the threshold lands a few bits either side of it.
    expect(scoreBalance(poseWithDrift(0), BASELINE)).toBe(100)
    expect(scoreBalance(poseWithDrift(movement.balanceReturnRatio), BASELINE)).toBeCloseTo(100, 8)
  })

  it('scores nothing for a boxer left stranded off centre', () => {
    // Still displaced by a slip's worth means not ready for the next punch.
    expect(scoreBalance(poseWithDrift(movement.slipLateralRatio), BASELINE)).toBeCloseTo(0, 8)
  })

  it('scales in between', () => {
    const drift = (movement.balanceReturnRatio + movement.slipLateralRatio) / 2
    const score = scoreBalance(poseWithDrift(drift), BASELINE)

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('scores nothing without a usable baseline to measure against', () => {
    expect(scoreBalance(poseWithDrift(0), { ...BASELINE, bodyWidth: 0 })).toBe(0)
  })
})

describe('scoreDefense', () => {
  it('scores a correct, fast, committed, balanced defense near the top', () => {
    const score = scoreDefense(input())

    expect(score.correct).toBe(true)
    expect(score.reactionMs).toBe(0)
    expect(score.total).toBe(100)
  })

  it('scores a correct but sloppy defense in the middle', () => {
    // Late but inside the miss window, barely committed, and still drifting.
    const sloppy = scoreDefense(
      input({
        detectedAt: LANDS_AT + (timing.reactionToleranceMs + timing.missWindowMs) / 2,
        detection: detection({
          magnitude: (movement.minMovementRatio + scoring.movementFullCreditRatio) / 2,
        }),
        recoveryPose: poseWithDrift((movement.balanceReturnRatio + movement.slipLateralRatio) / 2),
      }),
    )

    expect(sloppy.correct).toBe(true)
    expect(sloppy.total).toBeGreaterThan(0)
    expect(sloppy.total).toBeLessThan(scoreDefense(input()).total)
  })

  it('scores a wrong defense zero, but still reports how it was performed', () => {
    // The documented choice: no partial credit for a well-executed wrong
    // answer, because choosing the right defense is what the drill teaches.
    // The sub-scores survive so the UI can say *why* it was still wrong.
    const wrong = scoreDefense(input({ detection: detection({ type: 'rollLeft' }) }))

    expect(wrong.correct).toBe(false)
    expect(wrong.total).toBe(0)
    expect(wrong.reactionScore).toBe(100)
    expect(wrong.movementScore).toBe(100)
    expect(wrong.balanceScore).toBe(100)
  })

  it('accepts any defense the attack listed, not just the first', () => {
    // A jab can be slipped either way, parried, or stepped away from.
    for (const type of JAB.expectedDefenses) {
      expect(scoreDefense(input({ detection: detection({ type }) })).correct).toBe(true)
    }
  })

  it('records a miss when nothing was detected', () => {
    const miss = scoreDefense(input({ detection: null }))

    expect(miss.correct).toBe(false)
    expect(miss.total).toBe(0)
    expect(miss.reactionScore).toBe(0)
    expect(miss.movementScore).toBe(0)
    expect(miss.balanceScore).toBe(0)
    // No detection to measure, so this reports how long we waited.
    expect(miss.reactionMs).toBe(timing.missWindowMs)
  })

  it('records a miss when the defense arrived after the exchange closed', () => {
    // Credit here would reward a movement that happened after the user was hit.
    const tooLate = scoreDefense(input({ detectedAt: LANDS_AT + timing.missWindowMs + 1 }))

    expect(tooLate.correct).toBe(false)
    expect(tooLate.total).toBe(0)
  })

  it('measures timing from when the punch lands, not when it is thrown', () => {
    // Reacting as a jab lands is on time. Reacting the instant it was thrown is
    // precognition, and the 700ms between the two is the whole reaction window.
    const onTheThrow = scoreDefense(input({ detectedAt: ATTACK_START }))

    expect(onTheThrow.reactionMs).toBe(-JAB.duration)
    expect(scoreDefense(input({ detectedAt: LANDS_AT })).reactionMs).toBe(0)
  })

  it('drops balance from the total rather than scoring it zero when unmeasured', () => {
    // A balance sample that was never taken is unknown, not bad. Scoring it as
    // bad would quietly cap every total at 80.
    const unmeasured = scoreDefense(input({ recoveryPose: null }))

    expect(unmeasured.balanceScore).toBe(0)
    expect(unmeasured.total).toBe(100)
  })

  it('weights reaction most heavily of the three', () => {
    // A reaction trainer: being in the right place too late is the failure the
    // app exists to fix. Losing all of one component should hurt most here.
    const base = input({ detection: detection({ magnitude: scoring.movementFullCreditRatio }) })

    const noReaction = scoreDefense({ ...base, detectedAt: LANDS_AT + timing.missWindowMs })
    const noMovement = scoreDefense({ ...base, detection: detection({ magnitude: 0 }) })
    const noBalance = scoreDefense({
      ...base,
      recoveryPose: poseWithDrift(movement.slipLateralRatio),
    })

    expect(noReaction.total).toBeLessThan(noMovement.total)
    expect(noMovement.total).toBeLessThan(noBalance.total)
  })

  it('keeps every score inside 0-100', () => {
    const extremes = [
      scoreDefense(input()),
      scoreDefense(input({ detection: null })),
      scoreDefense(input({ detection: detection({ magnitude: 99 }) })),
      scoreDefense(input({ detectedAt: LANDS_AT - 10_000 })),
      scoreDefense(input({ recoveryPose: poseWithDrift(50) })),
    ]

    for (const score of extremes) {
      for (const value of [
        score.reactionScore,
        score.movementScore,
        score.balanceScore,
        score.total,
      ]) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
  })
})
