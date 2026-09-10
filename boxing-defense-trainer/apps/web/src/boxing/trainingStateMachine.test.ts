/**
 * Unit tests for the training loop's transition table.
 *
 * The rejections matter more than the acceptances. The spec warns about
 * overlapping animations and races, and both come from the same shape of bug:
 * a timer that fired late, or a detection that arrived after its window closed,
 * dispatching an event the session has already moved past. A table that only
 * permits what the diagram draws makes those events inert — these tests are
 * what keep it that way.
 */
import { describe, expect, it } from 'vitest'

import {
  accumulate,
  allowedTargets,
  averageReactionMs,
  averageScore,
  canTransition,
  emptyRoundStats,
  initialTrainingState,
  isRoundComplete,
  toDefenseResult,
  trainingReducer,
  type TrainingEvent,
} from './trainingStateMachine'
import { ATTACK_CATALOGUE } from './attacks'
import { THRESHOLDS } from './config/thresholds'
import type { DefenseResult, DefenseScore, TrainingSessionState, TrainingState } from '../types'

const ALL_STATES: readonly TrainingState[] = [
  'IDLE',
  'CALIBRATING',
  'READY',
  'COUNTDOWN',
  'WAITING_FOR_ATTACK',
  'ATTACKING',
  'WAITING_FOR_DEFENSE',
  'EVALUATING',
  'RESULT',
  'PAUSED',
  'SUMMARY',
]

const JAB = ATTACK_CATALOGUE.jab

const score = (overrides: Partial<DefenseScore> = {}): DefenseScore => ({
  correct: true,
  reactionMs: 40,
  reactionScore: 100,
  movementScore: 100,
  balanceScore: 100,
  total: 100,
  ...overrides,
})

const at = (
  state: TrainingState,
  over: Partial<TrainingSessionState> = {},
): TrainingSessionState => ({
  ...initialTrainingState,
  state,
  ...over,
})

/** Walk the happy path up to a given phase. */
function driveTo(target: TrainingState): TrainingSessionState {
  const path: TrainingEvent[] = [
    { kind: 'CALIBRATE_REQUESTED' },
    { kind: 'CALIBRATION_SUCCEEDED' },
    { kind: 'ROUND_STARTED' },
    { kind: 'COUNTDOWN_FINISHED' },
    { kind: 'ATTACK_LAUNCHED', attack: JAB, at: 1000 },
    { kind: 'ATTACK_WENT_LIVE' },
    { kind: 'DEFENSE_DETECTED' },
    { kind: 'EXCHANGE_SCORED', result: toDefenseResult(JAB, 'slipLeft', score()) },
  ]

  let state = initialTrainingState
  for (const event of path) {
    if (state.state === target) break
    state = trainingReducer(state, event)
  }
  return state
}

describe('the happy path', () => {
  it('runs IDLE through to RESULT in the documented order', () => {
    const seen: TrainingState[] = [initialTrainingState.state]
    let state = initialTrainingState

    for (const event of [
      { kind: 'CALIBRATE_REQUESTED' },
      { kind: 'CALIBRATION_SUCCEEDED' },
      { kind: 'ROUND_STARTED' },
      { kind: 'COUNTDOWN_FINISHED' },
      { kind: 'ATTACK_LAUNCHED', attack: JAB, at: 1000 },
      { kind: 'ATTACK_WENT_LIVE' },
      { kind: 'DEFENSE_DETECTED' },
      { kind: 'EXCHANGE_SCORED', result: toDefenseResult(JAB, 'slipLeft', score()) },
    ] as TrainingEvent[]) {
      state = trainingReducer(state, event)
      seen.push(state.state)
    }

    expect(seen).toEqual([
      'IDLE',
      'CALIBRATING',
      'READY',
      'COUNTDOWN',
      'WAITING_FOR_ATTACK',
      'ATTACKING',
      'WAITING_FOR_DEFENSE',
      'EVALUATING',
      'RESULT',
    ])
  })

  it('loops back for another punch without anyone pressing anything', () => {
    // The UX requirement: no button between attacks.
    const state = trainingReducer(driveTo('RESULT'), { kind: 'RESULT_DISMISSED' })

    expect(state.state).toBe('WAITING_FOR_ATTACK')
  })

  it('reaches the summary once the round is spent', () => {
    const spent = at('RESULT', {
      stats: { ...emptyRoundStats, attacksThrown: THRESHOLDS.session.attacksPerRound },
    })

    expect(trainingReducer(spent, { kind: 'RESULT_DISMISSED' }).state).toBe('SUMMARY')
  })

  it('treats a missed defense as a normal path to EVALUATING', () => {
    const live = driveTo('WAITING_FOR_DEFENSE')

    expect(trainingReducer(live, { kind: 'DEFENSE_WINDOW_CLOSED' }).state).toBe('EVALUATING')
  })
})

describe('invalid transitions', () => {
  it('rejects every event the chart does not draw, by identity', () => {
    // Identity, not deep equality: `next === state` is how a caller can tell a
    // rejection from a no-op transition without an error channel.
    const state = at('ATTACKING')

    for (const kind of ['COUNTDOWN_FINISHED', 'EXCHANGE_SCORED', 'DEFENSE_DETECTED'] as const) {
      const event = { kind, result: toDefenseResult(JAB, null, score()) } as TrainingEvent
      expect(trainingReducer(state, event)).toBe(state)
    }
  })

  it('cannot launch a second attack while one is in flight', () => {
    // The overlapping-animation bug the spec warns about, in one assertion.
    const attacking = driveTo('ATTACKING')
    const again: TrainingEvent = { kind: 'ATTACK_LAUNCHED', attack: JAB, at: 2000 }

    expect(trainingReducer(attacking, again)).toBe(attacking)
    expect(canTransition('ATTACKING', 'ATTACK_LAUNCHED')).toBe(false)
  })

  it('ignores a defense detected after the window closed', () => {
    // A late frame arriving while the exchange is already being scored.
    const evaluating = driveTo('EVALUATING')

    expect(trainingReducer(evaluating, { kind: 'DEFENSE_DETECTED' })).toBe(evaluating)
  })

  it('ignores a window-closed timer that fires after a defense was found', () => {
    const evaluating = driveTo('EVALUATING')

    expect(trainingReducer(evaluating, { kind: 'DEFENSE_WINDOW_CLOSED' })).toBe(evaluating)
  })

  it('cannot start a round before calibrating', () => {
    expect(canTransition('IDLE', 'ROUND_STARTED')).toBe(false)
    expect(trainingReducer(initialTrainingState, { kind: 'ROUND_STARTED' })).toBe(
      initialTrainingState,
    )
  })

  it('cannot skip the countdown', () => {
    expect(canTransition('READY', 'COUNTDOWN_FINISHED')).toBe(false)
  })

  it('allows a reset from every state except IDLE, which is already reset', () => {
    for (const state of ALL_STATES) {
      expect(canTransition(state, 'SESSION_RESET')).toBe(state !== 'IDLE')
    }
  })

  it('never lets an event lead somewhere the table does not list', () => {
    // The exhaustive check: every state, every event, the result is either a
    // declared target or the state unchanged.
    const events: TrainingEvent[] = [
      { kind: 'CALIBRATE_REQUESTED' },
      { kind: 'CALIBRATION_SUCCEEDED' },
      { kind: 'CALIBRATION_FAILED' },
      { kind: 'ROUND_STARTED' },
      { kind: 'COUNTDOWN_FINISHED' },
      { kind: 'ATTACK_LAUNCHED', attack: JAB, at: 0 },
      { kind: 'ATTACK_WENT_LIVE' },
      { kind: 'DEFENSE_DETECTED' },
      { kind: 'DEFENSE_WINDOW_CLOSED' },
      { kind: 'EXCHANGE_SCORED', result: toDefenseResult(JAB, null, score()) },
      { kind: 'RESULT_DISMISSED' },
      { kind: 'ROUND_PAUSED' },
      { kind: 'ROUND_RESUMED' },
      { kind: 'SESSION_RESET' },
    ]

    for (const from of ALL_STATES) {
      for (const event of events) {
        const next = trainingReducer(at(from), event)
        const targets = allowedTargets(from, event.kind)

        if (targets.length === 0) {
          expect(next.state).toBe(from)
        } else {
          expect(targets).toContain(next.state)
        }
      }
    }
  })
})

describe('pausing', () => {
  it('can be paused from anywhere inside the loop', () => {
    for (const phase of [
      'WAITING_FOR_ATTACK',
      'ATTACKING',
      'WAITING_FOR_DEFENSE',
      'RESULT',
    ] as const) {
      expect(canTransition(phase, 'ROUND_PAUSED')).toBe(true)
    }
  })

  it('cannot be paused before a round is running', () => {
    expect(canTransition('IDLE', 'ROUND_PAUSED')).toBe(false)
    expect(canTransition('READY', 'ROUND_PAUSED')).toBe(false)
    expect(canTransition('COUNTDOWN', 'ROUND_PAUSED')).toBe(false)
  })

  it('abandons the punch that was in flight', () => {
    // Its clock stopped when the user paused, so scoring a reaction against it
    // afterwards would be meaningless.
    const paused = trainingReducer(driveTo('ATTACKING'), { kind: 'ROUND_PAUSED' })

    expect(paused.state).toBe('PAUSED')
    expect(paused.currentAttack).toBeNull()
    expect(paused.attackStartTime).toBeNull()
  })

  it('resumes to the rest between punches, never mid-punch', () => {
    const paused = trainingReducer(driveTo('WAITING_FOR_DEFENSE'), { kind: 'ROUND_PAUSED' })

    expect(trainingReducer(paused, { kind: 'ROUND_RESUMED' }).state).toBe('WAITING_FOR_ATTACK')
  })

  it('keeps the round score across a pause', () => {
    const scored = at('RESULT', {
      stats: { ...emptyRoundStats, attacksThrown: 3, correctCount: 2, totalScore: 210 },
    })
    const paused = trainingReducer(scored, { kind: 'ROUND_PAUSED' })

    expect(paused.stats.attacksThrown).toBe(3)
    expect(paused.stats.totalScore).toBe(210)
  })
})

describe('recovery and restart', () => {
  it('returns to IDLE when calibration fails, not to READY', () => {
    // READY would be a lie: there is no baseline to train against.
    expect(trainingReducer(at('CALIBRATING'), { kind: 'CALIBRATION_FAILED' }).state).toBe('IDLE')
  })

  it('lets a finished round be re-run without recalibrating', () => {
    expect(canTransition('SUMMARY', 'ROUND_STARTED')).toBe(true)
  })

  it('lets the user recalibrate from READY and from SUMMARY', () => {
    expect(canTransition('READY', 'CALIBRATE_REQUESTED')).toBe(true)
    expect(canTransition('SUMMARY', 'CALIBRATE_REQUESTED')).toBe(true)
  })

  it('clears the previous round when a new one starts', () => {
    // A second round inheriting the first one's score would be a scoreboard
    // that only ever goes up.
    const finished = at('SUMMARY', {
      stats: { ...emptyRoundStats, attacksThrown: 10, totalScore: 900 },
      results: [toDefenseResult(JAB, 'slipLeft', score())],
    })

    const next = trainingReducer(finished, { kind: 'ROUND_STARTED' })

    expect(next.stats).toEqual(emptyRoundStats)
    expect(next.results).toEqual([])
  })

  it('keeps the chosen stance, mode and difficulty across a reset', () => {
    const configured = at('RESULT', { stance: 'southpaw', mode: 'reaction', difficulty: 5 })
    const next = trainingReducer(configured, { kind: 'SESSION_RESET' })

    expect(next.state).toBe('IDLE')
    expect(next.stance).toBe('southpaw')
    expect(next.mode).toBe('reaction')
    expect(next.difficulty).toBe(5)
  })

  it('only accepts settings changes while the user is not mid-round', () => {
    expect(canTransition('READY', 'STANCE_SELECTED')).toBe(true)
    expect(canTransition('SUMMARY', 'DIFFICULTY_SELECTED')).toBe(true)
    // Switching stance mid-punch would invalidate the mirroring already applied.
    expect(canTransition('WAITING_FOR_DEFENSE', 'STANCE_SELECTED')).toBe(false)
  })
})

describe('session data', () => {
  it('records the attack and its start time when a punch is launched', () => {
    const state = trainingReducer(driveTo('WAITING_FOR_ATTACK'), {
      kind: 'ATTACK_LAUNCHED',
      attack: JAB,
      at: 1234,
    })

    expect(state.currentAttack).toBe(JAB)
    expect(state.attackStartTime).toBe(1234)
  })

  it('clears the punch once its result has been shown', () => {
    const state = trainingReducer(driveTo('RESULT'), { kind: 'RESULT_DISMISSED' })

    expect(state.currentAttack).toBeNull()
    expect(state.attackStartTime).toBeNull()
  })

  it('keeps every result of the round, oldest first', () => {
    let state = driveTo('EVALUATING')
    state = trainingReducer(state, {
      kind: 'EXCHANGE_SCORED',
      result: toDefenseResult(JAB, 'slipLeft', score({ total: 90 })),
    })

    expect(state.results).toHaveLength(1)
    expect(state.results[0]?.punch).toBe('jab')
    expect(state.results[0]?.detected).toBe('slipLeft')
  })
})

describe('accumulate', () => {
  const result = (over: Partial<DefenseResult> = {}): DefenseResult => ({
    ...toDefenseResult(JAB, 'slipLeft', score()),
    ...over,
  })

  it('counts a correct defense', () => {
    const stats = accumulate(emptyRoundStats, result())

    expect(stats.attacksThrown).toBe(1)
    expect(stats.correctCount).toBe(1)
    expect(stats.missedCount).toBe(0)
    expect(stats.totalScore).toBe(100)
  })

  it('counts a miss and does not let it pollute the reaction average', () => {
    // A miss has no reaction time to average; including the miss window would
    // make a bad round look merely slow.
    const stats = accumulate(
      emptyRoundStats,
      result({ detected: null, score: score({ correct: false, reactionMs: 600, total: 0 }) }),
    )

    expect(stats.missedCount).toBe(1)
    expect(stats.reactionSamples).toBe(0)
    expect(stats.totalReactionMs).toBe(0)
    expect(averageReactionMs(stats)).toBe(0)
  })

  it('tracks the best streak and resets the current one on a failure', () => {
    let stats = emptyRoundStats
    stats = accumulate(stats, result())
    stats = accumulate(stats, result())
    expect(stats.currentStreak).toBe(2)

    stats = accumulate(stats, result({ score: score({ correct: false, total: 0 }) }))

    expect(stats.currentStreak).toBe(0)
    expect(stats.bestStreak).toBe(2)
  })

  it('averages score over every attack, including the missed ones', () => {
    // Missing counts against you; it is not simply left out.
    let stats = accumulate(emptyRoundStats, result({ score: score({ total: 100 }) }))
    stats = accumulate(
      stats,
      result({ detected: null, score: score({ correct: false, total: 0 }) }),
    )

    expect(averageScore(stats)).toBe(50)
  })

  it('reports zero averages before anything has been thrown', () => {
    expect(averageScore(emptyRoundStats)).toBe(0)
    expect(averageReactionMs(emptyRoundStats)).toBe(0)
  })
})

describe('isRoundComplete', () => {
  it('is false until the round has thrown its punches', () => {
    expect(isRoundComplete(emptyRoundStats)).toBe(false)
    expect(
      isRoundComplete({
        ...emptyRoundStats,
        attacksThrown: THRESHOLDS.session.attacksPerRound - 1,
      }),
    ).toBe(false)
  })

  it('is true at the configured count', () => {
    expect(
      isRoundComplete({ ...emptyRoundStats, attacksThrown: THRESHOLDS.session.attacksPerRound }),
    ).toBe(true)
  })
})
