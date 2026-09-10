/**
 * Tests for the training loop's clock.
 *
 * The state machine's legal transitions are already covered in
 * `boxing/trainingStateMachine.test.ts`. What is only testable here is the part
 * the domain deliberately refuses to own: the timers that walk the round from
 * one phase to the next, and — the behaviour the spec is most explicit about —
 * that the round keeps punching on its own, with no button between exchanges,
 * until the domain says it is over.
 *
 * That is exactly the property a manual pass is worst at confirming. Watching a
 * round and seeing punches arrive tells you the loop ran ten times; it does not
 * tell you it would have stopped at ten, or that a pause really stopped the
 * clock rather than hiding it.
 *
 * Landmarks are left null throughout, so nothing is ever detected and every
 * exchange scores as a miss. The loop's shape is the subject here, not the
 * detector's judgement — that is covered in `boxing/defenseDetector.test.ts`.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTrainingSession } from './useTrainingSession'
import { THRESHOLDS } from '../boxing'
import type { NeutralStanceBaseline } from '../types'

const { session } = THRESHOLDS

/** A plausible resting stance. Only its presence matters here, not its values. */
const BASELINE: NeutralStanceBaseline = {
  head: { x: 0.5, y: 0.2 },
  shoulders: {
    left: { x: 0.4, y: 0.35 },
    right: { x: 0.6, y: 0.35 },
    center: { x: 0.5, y: 0.35 },
  },
  hips: {
    left: { x: 0.44, y: 0.6 },
    right: { x: 0.56, y: 0.6 },
    center: { x: 0.5, y: 0.6 },
  },
  wrists: { left: { x: 0.44, y: 0.28 }, right: { x: 0.56, y: 0.28 } },
  bodyWidth: 0.2,
  sampleCount: session.calibrationFrames,
}

function setup(overrides: Partial<Parameters<typeof useTrainingSession>[0]> = {}) {
  return renderHook(() =>
    useTrainingSession({
      landmarks: null,
      detectionStatus: 'ok',
      baseline: BASELINE,
      stance: 'orthodox',
      mode: 'beginner',
      difficulty: 3,
      ...overrides,
    }),
  )
}

/**
 * Let every timer that is due run, and React commit what they dispatched.
 *
 * One `advanceTimersByTime` is not enough: each phase schedules the next only
 * once it has been committed, so the round advances in beats rather than all at
 * once. Stepping repeatedly is what walks it forward.
 */
const runFor = async (ms: number, step = 100) => {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step)
    })
  }
}

describe('useTrainingSession', () => {
  beforeEach(() => {
    // `performance.now` too: the loop times reactions with it, and leaving it on
    // the real clock while timers are faked would make every reaction look
    // instant.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('becomes ready to start once a baseline exists', () => {
    const { result } = setup()

    expect(result.current.state.state).toBe('READY')
    expect(result.current.canStart).toBe(true)
  })

  it('will not start without a baseline', () => {
    const { result } = setup({ baseline: null })

    expect(result.current.state.state).toBe('IDLE')
    expect(result.current.canStart).toBe(false)
  })

  it('counts down before the first punch', async () => {
    const { result } = setup()

    act(() => result.current.startRound())
    expect(result.current.state.state).toBe('COUNTDOWN')

    await runFor(session.countdownSeconds * 1000)
    expect(result.current.state.state).toBe('WAITING_FOR_ATTACK')
  })

  it('runs a whole round to the summary with no button presses after Start', async () => {
    // The spec's automatic looping, stated as a test: one press, ten punches.
    const { result } = setup()

    act(() => result.current.startRound())
    await runFor(session.countdownSeconds * 1000)

    // Generous: the round is ~10 exchanges of a few seconds. It stops when the
    // machine reaches SUMMARY, so an early finish costs nothing.
    for (let i = 0; i < 600 && result.current.state.state !== 'SUMMARY'; i++) {
      await runFor(200, 100)
    }

    expect(result.current.state.state).toBe('SUMMARY')
    expect(result.current.state.stats.attacksThrown).toBe(session.attacksPerRound)
    expect(result.current.state.results).toHaveLength(session.attacksPerRound)
  })

  it('visits every phase of an exchange, in order', async () => {
    const { result } = setup()
    const seen: string[] = []

    act(() => result.current.startRound())
    await runFor(session.countdownSeconds * 1000)

    for (let i = 0; i < 200; i++) {
      const phase = result.current.state.state
      if (seen[seen.length - 1] !== phase) {
        seen.push(phase)
      }
      if (result.current.state.stats.attacksThrown >= 2) {
        break
      }
      await runFor(100, 100)
    }

    // The second lap proves it looped rather than merely reached the end once.
    expect(seen.slice(0, 5)).toEqual([
      'WAITING_FOR_ATTACK',
      'ATTACKING',
      'WAITING_FOR_DEFENSE',
      'EVALUATING',
      'RESULT',
    ])
    expect(seen[5]).toBe('WAITING_FOR_ATTACK')
  })

  it('scores an undefended punch as a miss', async () => {
    // Landmarks are null, so nothing is ever detected.
    const { result } = setup()

    act(() => result.current.startRound())
    await runFor(session.countdownSeconds * 1000)

    for (let i = 0; i < 200 && result.current.state.results.length === 0; i++) {
      await runFor(100, 100)
    }

    const [first] = result.current.state.results
    expect(first).toBeDefined()
    expect(first!.detected).toBeNull()
    expect(first!.score.correct).toBe(false)
    expect(result.current.state.stats.missedCount).toBe(1)
    expect(result.current.lastResult).toEqual(first)
  })

  it('stops the round clock while paused, rather than hiding it', async () => {
    // The distinction matters: a clock that kept counting through a pause would
    // report time the user did not actually train.
    const { result } = setup()

    act(() => result.current.startRound())
    await runFor(session.countdownSeconds * 1000)
    await runFor(2000)

    act(() => result.current.pause())
    expect(result.current.state.state).toBe('PAUSED')

    const frozen = result.current.elapsedMs
    expect(frozen).toBeGreaterThan(0)

    await runFor(3000)
    expect(result.current.elapsedMs).toBe(frozen)

    act(() => result.current.resume())
    expect(result.current.state.state).toBe('WAITING_FOR_ATTACK')

    await runFor(2000)
    expect(result.current.elapsedMs).toBeGreaterThan(frozen)
  })

  it('throws no punch while paused', async () => {
    const { result } = setup()

    act(() => result.current.startRound())
    await runFor(session.countdownSeconds * 1000)
    act(() => result.current.pause())

    const thrown = result.current.state.stats.attacksThrown
    await runFor(10000)

    expect(result.current.state.stats.attacksThrown).toBe(thrown)
  })

  it('draws the punch it is currently throwing, and idles otherwise', async () => {
    const { result } = setup()

    expect(result.current.currentAction).toBe('idle')

    act(() => result.current.startRound())
    await runFor(session.countdownSeconds * 1000)

    for (let i = 0; i < 200 && result.current.state.state !== 'ATTACKING'; i++) {
      await runFor(100, 100)
    }

    expect(result.current.state.state).toBe('ATTACKING')
    expect(result.current.currentAction).toBe(result.current.state.currentAttack?.name)
  })

  it('starts a fresh round from the summary without re-calibrating', async () => {
    const { result } = setup()

    act(() => result.current.startRound())
    await runFor(session.countdownSeconds * 1000)
    for (let i = 0; i < 600 && result.current.state.state !== 'SUMMARY'; i++) {
      await runFor(200, 100)
    }
    expect(result.current.state.state).toBe('SUMMARY')

    expect(result.current.canStart).toBe(true)
    act(() => result.current.startRound())

    expect(result.current.state.state).toBe('COUNTDOWN')
    expect(result.current.state.stats.attacksThrown).toBe(0)
    expect(result.current.elapsedMs).toBe(0)
  })
})
