/**
 * Responsibility: the shape of a training session as the state machine sees it
 * — which phase the loop is in, what is being thrown right now, what has been
 * scored, and the running tally. Pure type declarations; the transition table
 * itself lives in `src/boxing/trainingStateMachine.ts`.
 */
import type {
  Attack,
  DefenseScore,
  DefenseType,
  DifficultyLevel,
  PunchType,
  Stance,
  TrainingMode,
} from './boxing'

/**
 * The phases of the training loop.
 *
 * The loop runs IDLE -> CALIBRATING -> READY -> COUNTDOWN, then cycles
 * WAITING_FOR_ATTACK -> ATTACKING -> WAITING_FOR_DEFENSE -> EVALUATING ->
 * RESULT and back to WAITING_FOR_ATTACK, automatically and without the user
 * pressing anything, until the round's punches are spent and it ends at
 * SUMMARY.
 *
 * - `IDLE`                — nothing running; the entry and reset state.
 * - `CALIBRATING`         — sampling the user's neutral pose to normalise against.
 * - `READY`               — calibrated, waiting for the user to start a round.
 * - `COUNTDOWN`           — pre-round countdown is running.
 * - `WAITING_FOR_ATTACK`  — resting between punches; nothing incoming yet.
 * - `ATTACKING`           — a punch is winding up and has not become live.
 * - `WAITING_FOR_DEFENSE` — the punch is live; the reaction window is open.
 * - `EVALUATING`          — the window closed; the exchange is being scored.
 * - `RESULT`              — one exchange's result is on screen, briefly.
 * - `PAUSED`              — the round is suspended; the user stopped the clock.
 * - `SUMMARY`             — the round is over and the totals are shown.
 *
 * Screaming case, unlike the rest of the codebase's types, because these are
 * state *values* in a machine rather than a general-purpose vocabulary — it
 * makes a transition table readable at a glance.
 */
export type TrainingState =
  | 'IDLE'
  | 'CALIBRATING'
  | 'READY'
  | 'COUNTDOWN'
  | 'WAITING_FOR_ATTACK'
  | 'ATTACKING'
  | 'WAITING_FOR_DEFENSE'
  | 'EVALUATING'
  | 'RESULT'
  | 'PAUSED'
  | 'SUMMARY'

/**
 * What happened in one exchange: the punch, what the user did about it, and how
 * it graded.
 *
 * Kept per exchange rather than only folded into `RoundStats`, because the
 * results screen has to say *which* punches went badly — "you missed both rear
 * hooks" is coaching, "you averaged 62" is not.
 */
export interface DefenseResult {
  /** The attack's per-occurrence id, unique within its sequence. */
  readonly attackId: string
  readonly punch: PunchType
  /** What the detector recognised, or null if the user did nothing in time. */
  readonly detected: DefenseType | null
  readonly score: DefenseScore
}

/**
 * The running tally for a round.
 *
 * An accumulator: it holds only what can be folded in one exchange at a time,
 * so it stays a fixed size however long a round runs. Sums are kept alongside
 * their counts so the means are derivable without re-reading every result.
 */
export interface RoundStats {
  readonly attacksThrown: number
  /** Exchanges answered with a defense the attack expected. */
  readonly correctCount: number
  /** Exchanges where nothing was detected in time. */
  readonly missedCount: number
  /** Sum of `DefenseScore.total`; the divisor is `attacksThrown`. */
  readonly totalScore: number
  /** Sum of reaction times over the exchanges that produced a detection. */
  readonly totalReactionMs: number
  /** How many exchanges contributed to `totalReactionMs`; the divisor for the mean. */
  readonly reactionSamples: number
  /** Consecutive correct defenses up to now; resets on any other outcome. */
  readonly currentStreak: number
  readonly bestStreak: number
}

/**
 * Everything known about a session in progress.
 *
 * Deliberately flat and serialisable — no class instances, no functions, no
 * timers. A session can therefore be snapshotted, diffed in a test, or replayed
 * from a list of events.
 */
export interface TrainingSessionState {
  readonly state: TrainingState
  /** The punch in flight, or null outside ATTACKING/WAITING_FOR_DEFENSE. */
  readonly currentAttack: Attack | null
  /** When the current punch started, on the caller's clock. */
  readonly attackStartTime: number | null
  readonly stance: Stance
  readonly mode: TrainingMode
  readonly difficulty: DifficultyLevel
  readonly stats: RoundStats
  /** Every exchange scored this round, oldest first. */
  readonly results: readonly DefenseResult[]
}
