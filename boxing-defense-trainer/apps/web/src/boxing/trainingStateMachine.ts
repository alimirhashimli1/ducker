/**
 * Responsibility: own the phases of a training session. A pure reducer — every
 * transition is a function of the current state and one event, with time
 * supplied by the caller rather than read from a clock.
 *
 * ## No state-machine library, deliberately
 *
 * XState and its peers earn their weight when a chart has parallel regions,
 * nested states, guards that need visualising, or activities with their own
 * lifecycles. This chart has eleven states, one linear cycle and exactly one
 * conditional branch. A typed transition table expresses that in a few dozen
 * lines that any reader can check against the diagram in
 * `docs/architecture/training-loop.md`, with no runtime dependency, no
 * interpreter to reason about, and no second vocabulary layered over the plain
 * reducer React already provides.
 *
 * If the chart ever grows parallel regions — scoring a combination while the
 * next punch is already winding up, say — that judgement should be revisited.
 * It is a small file to replace.
 *
 * ## Why invalid transitions are rejected rather than tolerated
 *
 * The spec warns about overlapping animations and races. Both come from the
 * same shape of bug: a timer that fired late, or a detection that arrived after
 * its window closed, dispatching an event the session has already moved past. A
 * table that only permits the transitions the diagram draws makes those events
 * inert instead of letting them start a second punch on top of the first.
 *
 * A rejected event returns the **same state object**, so `next === state`
 * identifies a rejection without needing an error channel.
 */
import { THRESHOLDS } from './config/thresholds'
import type {
  Attack,
  DefenseResult,
  DefenseScore,
  DifficultyLevel,
  RoundStats,
  Stance,
  TrainingMode,
  TrainingSessionState,
  TrainingState,
} from '../types'

/** Everything that can move a session between phases. */
export type TrainingEvent =
  | { readonly kind: 'CALIBRATE_REQUESTED' }
  | { readonly kind: 'CALIBRATION_SUCCEEDED' }
  | { readonly kind: 'CALIBRATION_FAILED' }
  | { readonly kind: 'ROUND_STARTED' }
  | { readonly kind: 'COUNTDOWN_FINISHED' }
  | { readonly kind: 'ATTACK_LAUNCHED'; readonly attack: Attack; readonly at: number }
  | { readonly kind: 'ATTACK_WENT_LIVE' }
  | { readonly kind: 'DEFENSE_DETECTED' }
  | { readonly kind: 'DEFENSE_WINDOW_CLOSED' }
  | { readonly kind: 'EXCHANGE_SCORED'; readonly result: DefenseResult }
  | { readonly kind: 'RESULT_DISMISSED' }
  | { readonly kind: 'ROUND_PAUSED' }
  | { readonly kind: 'ROUND_RESUMED' }
  | { readonly kind: 'SESSION_RESET' }
  | { readonly kind: 'STANCE_SELECTED'; readonly stance: Stance }
  | { readonly kind: 'MODE_SELECTED'; readonly mode: TrainingMode }
  | { readonly kind: 'DIFFICULTY_SELECTED'; readonly difficulty: DifficultyLevel }

export type TrainingEventKind = TrainingEvent['kind']

/** A transition target: one state, or the choices a conditional branch picks from. */
type Target = TrainingState | readonly TrainingState[]

/**
 * The whole chart. Anything not listed here cannot happen.
 *
 * This is the single source of truth for what is legal; the diagram in
 * `docs/architecture/training-loop.md` is drawn from it and should be updated
 * with it.
 */
const TRANSITIONS: Readonly<Record<TrainingState, Partial<Record<TrainingEventKind, Target>>>> = {
  IDLE: {
    CALIBRATE_REQUESTED: 'CALIBRATING',
  },
  CALIBRATING: {
    CALIBRATION_SUCCEEDED: 'READY',
    // Back to the start rather than stuck: the user needs to reposition and
    // try again, and READY would be a lie.
    CALIBRATION_FAILED: 'IDLE',
    SESSION_RESET: 'IDLE',
  },
  READY: {
    ROUND_STARTED: 'COUNTDOWN',
    // Re-measuring from READY is the Recalibrate button.
    CALIBRATE_REQUESTED: 'CALIBRATING',
    SESSION_RESET: 'IDLE',
  },
  COUNTDOWN: {
    COUNTDOWN_FINISHED: 'WAITING_FOR_ATTACK',
    SESSION_RESET: 'IDLE',
  },
  WAITING_FOR_ATTACK: {
    ATTACK_LAUNCHED: 'ATTACKING',
    ROUND_PAUSED: 'PAUSED',
    SESSION_RESET: 'IDLE',
  },
  ATTACKING: {
    ATTACK_WENT_LIVE: 'WAITING_FOR_DEFENSE',
    ROUND_PAUSED: 'PAUSED',
    SESSION_RESET: 'IDLE',
  },
  WAITING_FOR_DEFENSE: {
    DEFENSE_DETECTED: 'EVALUATING',
    DEFENSE_WINDOW_CLOSED: 'EVALUATING',
    ROUND_PAUSED: 'PAUSED',
    SESSION_RESET: 'IDLE',
  },
  EVALUATING: {
    EXCHANGE_SCORED: 'RESULT',
    SESSION_RESET: 'IDLE',
  },
  RESULT: {
    // The one conditional branch: loop for another punch, or end the round.
    // Which one is decided by `isRoundComplete`, never by the caller — that is
    // what keeps "how long is a round" a domain rule rather than UI timing.
    RESULT_DISMISSED: ['WAITING_FOR_ATTACK', 'SUMMARY'],
    ROUND_PAUSED: 'PAUSED',
    SESSION_RESET: 'IDLE',
  },
  PAUSED: {
    // Resuming returns to the rest between punches, never to the punch that was
    // in flight: its clock stopped when the user paused, and scoring a reaction
    // against a paused clock would be meaningless. The interrupted punch is
    // abandoned, and since stats only accumulate on EXCHANGE_SCORED it never
    // counted.
    ROUND_RESUMED: 'WAITING_FOR_ATTACK',
    SESSION_RESET: 'IDLE',
  },
  SUMMARY: {
    // A finished round is re-runnable without re-calibrating.
    ROUND_STARTED: 'COUNTDOWN',
    CALIBRATE_REQUESTED: 'CALIBRATING',
    SESSION_RESET: 'IDLE',
  },
}

/** Settings changes that apply in any state where the user could be adjusting them. */
const SETTINGS_STATES: readonly TrainingState[] = ['IDLE', 'READY', 'SUMMARY']

/** A round that has not started: every counter at zero. */
export const emptyRoundStats: RoundStats = {
  attacksThrown: 0,
  correctCount: 0,
  missedCount: 0,
  totalScore: 0,
  totalReactionMs: 0,
  reactionSamples: 0,
  currentStreak: 0,
  bestStreak: 0,
}

export const initialTrainingState: TrainingSessionState = {
  state: 'IDLE',
  currentAttack: null,
  attackStartTime: null,
  stance: 'orthodox',
  mode: 'beginner',
  difficulty: 3,
  stats: emptyRoundStats,
  results: [],
}

/** The states an event may legally lead to from here. Empty means rejected. */
export function allowedTargets(
  state: TrainingState,
  kind: TrainingEventKind,
): readonly TrainingState[] {
  const target = TRANSITIONS[state][kind]

  if (target === undefined) {
    return SETTINGS_STATES.includes(state) && isSettingsEvent(kind) ? [state] : []
  }

  return typeof target === 'string' ? [target] : target
}

/** Whether an event is legal in a given state. */
export function canTransition(state: TrainingState, kind: TrainingEventKind): boolean {
  return allowedTargets(state, kind).length > 0
}

function isSettingsEvent(kind: TrainingEventKind): boolean {
  return kind === 'STANCE_SELECTED' || kind === 'MODE_SELECTED' || kind === 'DIFFICULTY_SELECTED'
}

/** Whether the round has thrown all its punches. */
export function isRoundComplete(stats: RoundStats): boolean {
  return stats.attacksThrown >= THRESHOLDS.session.attacksPerRound
}

/** Fold one graded exchange into the running tally. */
export function accumulate(stats: RoundStats, result: DefenseResult): RoundStats {
  const { score } = result
  const detected = result.detected !== null
  const streak = score.correct ? stats.currentStreak + 1 : 0

  return {
    attacksThrown: stats.attacksThrown + 1,
    correctCount: stats.correctCount + (score.correct ? 1 : 0),
    missedCount: stats.missedCount + (detected ? 0 : 1),
    totalScore: stats.totalScore + score.total,
    // Only exchanges that produced a detection have a reaction time worth
    // averaging; a miss would drag the mean toward the miss window and make a
    // bad round look merely slow.
    totalReactionMs: stats.totalReactionMs + (detected ? score.reactionMs : 0),
    reactionSamples: stats.reactionSamples + (detected ? 1 : 0),
    currentStreak: streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  }
}

/** Mean score across the round, or 0 before anything has been thrown. */
export function averageScore(stats: RoundStats): number {
  return stats.attacksThrown === 0 ? 0 : stats.totalScore / stats.attacksThrown
}

/** Mean reaction time over the exchanges that produced a detection. */
export function averageReactionMs(stats: RoundStats): number {
  return stats.reactionSamples === 0 ? 0 : stats.totalReactionMs / stats.reactionSamples
}

/** Apply the state change and whatever data the event carries. */
function applyEvent(
  state: TrainingSessionState,
  event: TrainingEvent,
  next: TrainingState,
): TrainingSessionState {
  switch (event.kind) {
    case 'ROUND_STARTED':
      // A new round starts from zero, so a second round does not inherit the
      // first one's score.
      return { ...state, state: next, stats: emptyRoundStats, results: [], currentAttack: null }

    case 'ATTACK_LAUNCHED':
      return { ...state, state: next, currentAttack: event.attack, attackStartTime: event.at }

    case 'EXCHANGE_SCORED':
      return {
        ...state,
        state: next,
        stats: accumulate(state.stats, event.result),
        results: [...state.results, event.result],
      }

    case 'RESULT_DISMISSED':
    case 'ROUND_PAUSED':
      // The punch is spent either way: dismissed after scoring, or abandoned
      // because its clock stopped.
      return { ...state, state: next, currentAttack: null, attackStartTime: null }

    case 'SESSION_RESET':
      return {
        ...initialTrainingState,
        stance: state.stance,
        mode: state.mode,
        difficulty: state.difficulty,
      }

    case 'STANCE_SELECTED':
      return { ...state, state: next, stance: event.stance }

    case 'MODE_SELECTED':
      return { ...state, state: next, mode: event.mode }

    case 'DIFFICULTY_SELECTED':
      return { ...state, state: next, difficulty: event.difficulty }

    default:
      return { ...state, state: next }
  }
}

/**
 * Apply one event to the session.
 *
 * An event the chart does not permit in the current state returns the state
 * **unchanged and by identity**, so a late timer or a stray detection cannot
 * start a second punch on top of the first.
 */
export function trainingReducer(
  state: TrainingSessionState,
  event: TrainingEvent,
): TrainingSessionState {
  const targets = allowedTargets(state.state, event.kind)

  if (targets.length === 0) {
    return state
  }

  const next =
    event.kind === 'RESULT_DISMISSED'
      ? isRoundComplete(state.stats)
        ? 'SUMMARY'
        : 'WAITING_FOR_ATTACK'
      : targets[0]!

  return applyEvent(state, event, next)
}

/** Build a result from a scored exchange, for `EXCHANGE_SCORED`. */
export function toDefenseResult(
  attack: Attack,
  detected: DefenseResult['detected'],
  score: DefenseScore,
): DefenseResult {
  return { attackId: attack.id, punch: attack.name, detected, score }
}
