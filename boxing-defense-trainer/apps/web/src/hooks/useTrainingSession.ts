/**
 * Responsibility: run the training loop. It owns the clock and the pose buffer,
 * and dispatches events at the state machine; it decides nothing about boxing.
 *
 * Every judgement here is delegated:
 *
 * - what to throw, and how long to wait  -> `boxing/attackEngine.ts`
 * - what the user just did               -> `boxing/defenseDetector.ts`
 * - what it was worth                    -> `boxing/scoring.ts`
 * - whether the transition is legal      -> `boxing/trainingStateMachine.ts`
 * - how long a round is                  -> `isRoundComplete`, in the machine
 *
 * If a formula or a threshold ever appears in this file, it is in the wrong
 * place. What belongs here is `setTimeout`, `requestAnimationFrame`, refs, and
 * the wiring between them — the things the domain deliberately refuses to own.
 *
 * ## The two clocks
 *
 * Phase changes are driven by timers, one per state, from a single effect keyed
 * on the phase. Detection is driven by pose frames arriving. Keeping them
 * separate is what stops a slow frame from stretching the drill's timing.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import {
  THRESHOLDS,
  detectDefense,
  generateNextSequence,
  getInterAttackDelay,
  initialTrainingState,
  punchHand,
  scoreDefense,
  timingToleranceFactorFor,
  toDefenseResult,
  trainingReducer,
} from '../boxing'
import type { LateralDirection } from '../boxing'
import type { BoxerAction } from '../animations/boxerAnimations'
import type {
  Attack,
  DefenseResult,
  DetectionStatus,
  DifficultyLevel,
  NeutralStanceBaseline,
  PoseLandmarks,
  Stance,
  TrainingMode,
  TrainingSessionState,
  TrainingState,
} from '../types'

const { session } = THRESHOLDS

/** How many recent frames the detector may look back over, for parry travel. */
const HISTORY_FRAMES = 6

/** Phases where the round clock is running. */
const RUNNING_PHASES: readonly TrainingState[] = [
  'WAITING_FOR_ATTACK',
  'ATTACKING',
  'WAITING_FOR_DEFENSE',
  'EVALUATING',
  'RESULT',
]

export interface UseTrainingSessionInput {
  /** Live pose, from `usePoseDetection`. */
  landmarks: PoseLandmarks | null
  detectionStatus: DetectionStatus
  /** From `useCalibration`. The loop cannot start without one. */
  baseline: NeutralStanceBaseline | null
  stance?: Stance
  mode?: TrainingMode
  difficulty?: DifficultyLevel
}

export interface UseTrainingSessionResult {
  readonly state: TrainingSessionState
  /** What the Boxer should be drawing right now. */
  readonly currentAction: BoxerAction
  /** True once a baseline exists and a round can be started. */
  readonly canStart: boolean
  /** Time on the round clock, in ms. Stops while paused. */
  readonly elapsedMs: number
  /** The exchange most recently scored, for the live verdict. */
  readonly lastResult: DefenseResult | null
  readonly startRound: () => void
  readonly pause: () => void
  readonly resume: () => void
  readonly stop: () => void
}

/**
 * Which side of the defender a punch arrives on.
 *
 * The boxers face each other, so the attacker's left hand reaches the
 * defender's right. `punchHand` gives the throwing hand; this mirrors it.
 *
 * Only the parry detector needs this, and only to pick which wrist to watch.
 */
function incomingSideFor(attack: Attack, stance: Stance): LateralDirection {
  return punchHand(attack.name, stance) === 'left' ? 'right' : 'left'
}

export function useTrainingSession(input: UseTrainingSessionInput): UseTrainingSessionResult {
  const { landmarks, detectionStatus, baseline, stance, mode, difficulty } = input

  const [state, dispatch] = useReducer(trainingReducer, {
    ...initialTrainingState,
    ...(stance ? { stance } : {}),
    ...(mode ? { mode } : {}),
    ...(difficulty ? { difficulty } : {}),
  })

  // Refs, not state: these are read inside timers and frame callbacks, and
  // re-rendering on every pose frame would cost more than the detection does.
  const historyRef = useRef<PoseLandmarks[]>([])
  const detectionRef = useRef<ReturnType<typeof detectDefense>>(null)
  const detectedAtRef = useRef<number>(0)
  const latestRef = useRef<PoseLandmarks | null>(null)

  // Keep the latest frame, plus a short rolling window for the detectors that
  // need travel over time. In an effect rather than during render: writing a
  // ref while rendering is what makes a component's output depend on how many
  // times React chose to call it.
  useEffect(() => {
    latestRef.current = landmarks

    if (!landmarks) {
      return
    }

    historyRef.current = [...historyRef.current, landmarks].slice(-HISTORY_FRAMES)
  }, [landmarks])

  const toleranceFactor = timingToleranceFactorFor(state.difficulty)

  // Calibration is measured by `useCalibration`, but the loop's chart owns the
  // CALIBRATING and READY phases, so the arrival of a baseline is walked
  // through them here. Dispatch rather than setState: a reducer action is not a
  // cascading render, and this is genuinely synchronising with state owned
  // elsewhere, which is what effects are for.
  useEffect(() => {
    if (baseline && state.state === 'IDLE') {
      dispatch({ kind: 'CALIBRATE_REQUESTED' })
      dispatch({ kind: 'CALIBRATION_SUCCEEDED' })
    }
  }, [baseline, state.state])

  /* ---------------------------------------------------------------------- */
  /* Detection: driven by frames arriving, not by the phase clock            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (state.state !== 'WAITING_FOR_DEFENSE' || !landmarks || !baseline || !state.currentAttack) {
      return
    }
    if (detectionStatus !== 'ok') {
      return
    }

    const detection = detectDefense({
      landmarks,
      baseline,
      history: historyRef.current,
      stance: state.stance,
      incomingSide: incomingSideFor(state.currentAttack, state.stance),
    })

    if (!detection) {
      return
    }

    // First recognised movement wins the exchange. Continuing to watch would
    // let a user flail until something scored.
    detectionRef.current = detection
    detectedAtRef.current = performance.now()
    dispatch({ kind: 'DEFENSE_DETECTED' })
  }, [landmarks, detectionStatus, baseline, state.state, state.currentAttack, state.stance])

  /* ---------------------------------------------------------------------- */
  /* Phases: one timer per state, from one place                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const { state: phase, currentAttack, attackStartTime } = state

    if (phase === 'WAITING_FOR_ATTACK') {
      const delay = getInterAttackDelay(state.mode, state.difficulty)
      const timer = setTimeout(() => {
        // One punch per exchange for now: the loop scores a single attack at a
        // time, so a generated combination is taken one punch deep. Throwing a
        // whole combo is the next thing this loop should learn.
        const attack = generateNextSequence(state.mode, state.difficulty, state.stance)[0]
        if (attack) {
          dispatch({ kind: 'ATTACK_LAUNCHED', attack, at: performance.now() })
        }
      }, delay)

      return () => clearTimeout(timer)
    }

    if (phase === 'ATTACKING' && currentAttack) {
      // The punch becomes live partway through its animation: before that it is
      // wind-up, and reacting to wind-up is anticipation rather than reaction.
      const timer = setTimeout(
        () => dispatch({ kind: 'ATTACK_WENT_LIVE' }),
        currentAttack.duration * session.attackLiveFraction,
      )

      return () => clearTimeout(timer)
    }

    if (phase === 'WAITING_FOR_DEFENSE' && currentAttack && attackStartTime !== null) {
      // Close the window where scoring would call it a miss anyway, rather than
      // at the tolerance window — closing earlier would discard defenses that
      // scoring would still have graded as late.
      const landsAt = attackStartTime + currentAttack.duration
      const closesIn =
        landsAt + THRESHOLDS.timing.missWindowMs * toleranceFactor - performance.now()
      const timer = setTimeout(
        () => dispatch({ kind: 'DEFENSE_WINDOW_CLOSED' }),
        Math.max(0, closesIn),
      )

      return () => clearTimeout(timer)
    }

    if (phase === 'EVALUATING' && currentAttack && attackStartTime !== null && baseline) {
      // Wait before scoring, so the balance sample catches a recovery rather
      // than the user still mid-movement.
      const timer = setTimeout(() => {
        const detection = detectionRef.current
        const score = scoreDefense({
          attack: currentAttack,
          detection,
          attackStartTime,
          detectedAt: detectedAtRef.current,
          baseline,
          recoveryPose: latestRef.current,
          toleranceFactor,
        })

        dispatch({
          kind: 'EXCHANGE_SCORED',
          result: toDefenseResult(currentAttack, detection?.type ?? null, score),
        })

        detectionRef.current = null
      }, session.balanceSampleDelayMs)

      return () => clearTimeout(timer)
    }

    if (phase === 'RESULT') {
      // The loop continues on its own — no button between punches, per the UX
      // requirement. Whether this is the last punch is the machine's call.
      const timer = setTimeout(
        () => dispatch({ kind: 'RESULT_DISMISSED' }),
        session.resultDisplayMs,
      )

      return () => clearTimeout(timer)
    }

    return undefined
  }, [state, baseline, toleranceFactor])

  /* ---------------------------------------------------------------------- */

  const [elapsedMs, setElapsedMs] = useState(0)
  const accumulatedRef = useRef(0)

  const startRound = useCallback(() => {
    // Reset here, in the handler, rather than in an effect watching COUNTDOWN:
    // a new round starts because the user asked, and resuming from a pause must
    // not reset the clock.
    accumulatedRef.current = 0
    setElapsedMs(0)
    dispatch({ kind: 'ROUND_STARTED' })
    // The countdown is a UI beat; the machine only needs to know it finished.
    // Driven here rather than by a mounted Countdown so the loop owns its clock.
    setTimeout(() => dispatch({ kind: 'COUNTDOWN_FINISHED' }), session.countdownSeconds * 1000)
  }, [])

  const pause = useCallback(() => dispatch({ kind: 'ROUND_PAUSED' }), [])
  const resume = useCallback(() => dispatch({ kind: 'ROUND_RESUMED' }), [])
  const stop = useCallback(() => dispatch({ kind: 'SESSION_RESET' }), [])

  // The machine gates on calibration; this is only what the button reads.
  const canStart = baseline !== null && (state.state === 'READY' || state.state === 'SUMMARY')

  /* ---------------------------------------------------------------------- */
  /* The round clock                                                        */
  /* ---------------------------------------------------------------------- */

  // Accumulated rather than derived from a single start timestamp, so pausing
  // stops the clock instead of merely hiding it. A paused round that resumed
  // showing wall time since it began would be lying about how long the user
  // actually trained.
  const isRunning = RUNNING_PHASES.includes(state.state)

  useEffect(() => {
    if (!isRunning) {
      return
    }

    let since = performance.now()
    const tick = setInterval(() => {
      const now = performance.now()
      accumulatedRef.current += now - since
      since = now
      setElapsedMs(accumulatedRef.current)
    }, 250)

    return () => clearInterval(tick)
  }, [isRunning])

  const lastResult = state.results[state.results.length - 1] ?? null

  const currentAction: BoxerAction = useMemo(() => {
    const throwing = state.state === 'ATTACKING' || state.state === 'WAITING_FOR_DEFENSE'
    return throwing && state.currentAttack ? state.currentAttack.name : 'idle'
  }, [state.state, state.currentAttack])

  return { state, currentAction, canStart, elapsedMs, lastResult, startRound, pause, resume, stop }
}
