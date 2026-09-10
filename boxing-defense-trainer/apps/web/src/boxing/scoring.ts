/**
 * Responsibility: judge one attack/defense exchange. Given what the punch
 * expected, what the user actually did, and when, produce a score.
 *
 * Deliberately isolated. It does not detect movement, generate attacks, or run
 * the session — it is handed the result of all three and returns numbers. That
 * is what lets the scoring rules be argued about and retuned without touching
 * anything that produces the inputs.
 *
 * ## The three components
 *
 * A defense is graded on being *in time*, being *committed*, and *recovering*.
 * Each is scored 0-100 on its own, and the total is a weighted blend of them —
 * see `THRESHOLDS.scoring.weights`, and the retuning notes in `README.md`.
 *
 * ## What a wrong defense scores
 *
 * **Total zero, sub-scores still reported.** A perfectly fast, committed,
 * balanced slip against a hook is still a punch in the face, and awarding it
 * partial credit would teach the user that the choice of defense barely
 * matters — which is the one thing this drill exists to teach.
 *
 * The three sub-scores are computed and returned anyway, so the UI can say
 * "fast and committed, but you slipped into it" rather than a bare "wrong".
 * That is feedback without reward, which is the distinction that matters here.
 */
import { clamp01, distance } from '../utils/geometry'
import { THRESHOLDS } from './config/thresholds'
import type {
  Attack,
  DefenseScore,
  DefenseType,
  NeutralStanceBaseline,
  PoseLandmarks,
} from '../types'
import type { DefenseDetection } from './defenseDetector'

const { movement, scoring, timing } = THRESHOLDS

export interface ScoreDefenseInput {
  /** The punch thrown. Supplies both `expectedDefenses` and `duration`. */
  readonly attack: Attack
  /** What the detector saw, or null if nothing was recognised. */
  readonly detection: DefenseDetection | null
  /** When the punch started, on the session clock. */
  readonly attackStartTime: number
  /** When the defense was detected. Ignored when `detection` is null. */
  readonly detectedAt: number
  /** Needed to measure how far from neutral the user ended up. */
  readonly baseline: NeutralStanceBaseline
  /**
   * A pose sampled shortly after the defense, for the balance score.
   *
   * Optional: when absent, balance is dropped from the total and the remaining
   * weights are renormalised, rather than scoring zero for a measurement that
   * was never taken.
   */
  readonly recoveryPose?: PoseLandmarks | null
  /**
   * Scales the timing windows for difficulty; 1 leaves them as configured.
   * Passed in rather than read from a level, so scoring stays independent of
   * `difficulty.ts`.
   */
  readonly toleranceFactor?: number
}

/** A miss: nothing detected, or detected so late the exchange had closed. */
function missed(waitedMs: number): DefenseScore {
  return {
    correct: false,
    reactionMs: waitedMs,
    reactionScore: 0,
    movementScore: 0,
    balanceScore: 0,
    total: 0,
  }
}

/** Linear fall from 100 at or below `best`, to 0 at or above `worst`. */
function taper(value: number, best: number, worst: number): number {
  if (worst <= best) {
    return value <= best ? 100 : 0
  }

  return 100 * clamp01((worst - value) / (worst - best))
}

/** Linear rise from 0 at or below `floor`, to 100 at or above `ceiling`. */
function ramp(value: number, floor: number, ceiling: number): number {
  if (ceiling <= floor) {
    return value >= ceiling ? 100 : 0
  }

  return 100 * clamp01((value - floor) / (ceiling - floor))
}

/**
 * How well timed the defense was.
 *
 * Anything inside the tolerance window scores full marks — the spec is explicit
 * that small delays are not punished, and a drill that shaved points for being
 * 40ms out would be measuring detector jitter rather than the user.
 *
 * Outside it, the score tapers to zero at the miss window.
 *
 * Early and late are treated symmetrically. Moving well before the punch is
 * anticipation rather than reaction, and in a drill built to train reaction that
 * is not obviously better than being equally late. If footage says otherwise,
 * this is the function to split in two.
 */
export function scoreReaction(reactionMs: number, toleranceFactor = 1): number {
  const tolerance = timing.reactionToleranceMs * toleranceFactor
  const missAt = timing.missWindowMs * toleranceFactor
  const offBy = Math.abs(reactionMs)

  return taper(offBy, tolerance, missAt)
}

/**
 * How committed the movement was.
 *
 * Scaled from the noise floor — where a movement barely counts as movement — up
 * to the full-credit magnitude.
 *
 * A known limitation: magnitudes are not comparable between defenses. A slip is
 * measured as head displacement, a step back as a fraction of shoulder width,
 * and the two are not the same kind of number, so step-backs currently score
 * lower for the same quality of movement. The fix once there is footage is a
 * per-defense full-credit ratio; the shape of this function does not change.
 */
export function scoreMovement(magnitude: number): number {
  return ramp(magnitude, movement.minMovementRatio, scoring.movementFullCreditRatio)
}

/**
 * How well the user recovered their stance.
 *
 * Measured as how far the head sits from its calibrated resting position
 * shortly after the defense. Inside `balanceReturnRatio` is a full recovery;
 * still displaced by a slip's worth scores nothing, because a boxer stranded
 * off-centre is not ready for the next punch.
 */
export function scoreBalance(recoveryPose: PoseLandmarks, baseline: NeutralStanceBaseline): number {
  if (baseline.bodyWidth <= 0) {
    return 0
  }

  const drift = distance(recoveryPose.nose, baseline.head) / baseline.bodyWidth

  return taper(drift, movement.balanceReturnRatio, movement.slipLateralRatio)
}

/** Whether a detected defense is one the attack expected. */
function isExpected(expected: readonly DefenseType[], detected: DefenseType): boolean {
  return expected.includes(detected)
}

/**
 * Blend the components, renormalising over whichever were actually measured.
 *
 * Renormalising rather than defaulting a missing component to zero: a balance
 * score that was never sampled is unknown, and scoring unknown as bad would
 * quietly cap every total at 80.
 */
function weightedTotal(parts: readonly (readonly [number, number])[]): number {
  const totalWeight = parts.reduce((sum, [, weight]) => sum + weight, 0)

  if (totalWeight === 0) {
    return 0
  }

  return parts.reduce((sum, [score, weight]) => sum + score * weight, 0) / totalWeight
}

/**
 * Score one attack/defense exchange.
 *
 * The punch lands at `attackStartTime + attack.duration`; every timing here is
 * relative to that moment, not to when the punch started. Reacting to a jab as
 * it lands is on time; reacting the instant it was thrown is precognition.
 */
export function scoreDefense(input: ScoreDefenseInput): DefenseScore {
  const {
    attack,
    detection,
    attackStartTime,
    detectedAt,
    baseline,
    recoveryPose,
    toleranceFactor = 1,
  } = input

  const missWindow = timing.missWindowMs * toleranceFactor

  if (!detection) {
    return missed(missWindow)
  }

  const landsAt = attackStartTime + attack.duration
  const reactionMs = detectedAt - landsAt

  // Detected, but after the exchange had already closed. Scoring this as a late
  // defense would credit the user for a movement that happened after they were
  // hit.
  if (reactionMs > missWindow) {
    return missed(reactionMs)
  }

  const correct = isExpected(attack.expectedDefenses, detection.type)
  const reactionScore = scoreReaction(reactionMs, toleranceFactor)
  const movementScore = scoreMovement(detection.magnitude)
  const balanceScore = recoveryPose ? scoreBalance(recoveryPose, baseline) : 0

  const total = correct
    ? weightedTotal([
        [reactionScore, scoring.weights.reaction],
        [movementScore, scoring.weights.movement],
        // Weight zero when unmeasured, which drops it from the blend entirely.
        [balanceScore, recoveryPose ? scoring.weights.balance : 0],
      ])
    : 0

  return { correct, reactionMs, reactionScore, movementScore, balanceScore, total }
}
