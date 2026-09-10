/**
 * Responsibility: decide which defensive movement, if any, a pose represents.
 * Geometry only — it has no idea which punch is incoming and never decides
 * whether the movement was the *right* answer. That is `scoring.ts`.
 *
 * The most accuracy-sensitive module in the app, and the one most likely to be
 * wrong in ways nothing else notices: a detector that fires slightly too easily
 * produces a trainer that praises movements the user never made.
 *
 * ## Two conventions everything here depends on
 *
 * **Distances are ratios of `baseline.bodyWidth`.** Never pixels, never raw
 * normalised units. That is what makes one threshold work for a tall user two
 * metres away and a shorter one at one metre.
 *
 * **Left and right are the boxer's own, derived from the baseline.** Whether the
 * subject's left shoulder sits at a higher or lower x depends on the detector's
 * labelling convention and on whether the image is mirrored. Rather than assume,
 * `lateralAxis` reads the direction out of the calibrated shoulders themselves,
 * so a slip to the boxer's left is correct under either convention. Hard-coding
 * "left means smaller x" is the easiest way to silently invert every lateral
 * detector, and it would still pass a test written under the same assumption.
 *
 * ## Adding a defense
 *
 * Write a `detectX` function and add one entry to `DETECTORS`. Nothing existing
 * changes — see the detector table in `README.md`.
 */
import {
  clamp01,
  distance,
  magnitude,
  midpoint,
  scalarProjection,
  subtract,
} from '../utils/geometry'
import { THRESHOLDS } from './config/thresholds'
import type {
  DefenseType,
  KeypointName,
  NeutralStanceBaseline,
  Point2D,
  PoseLandmarks,
  Stance,
} from '../types'

/** A defensive movement recognised in the pose stream. */
export interface DefenseDetection {
  readonly type: DefenseType
  /** How big the movement was, in shoulder-widths. Comparable across users. */
  readonly magnitude: number
  /** How sure we are, in [0,1]. Combines how far past threshold with landmark quality. */
  readonly confidence: number
}

/** The boxer's own left or right — never the viewer's. */
export type LateralDirection = 'left' | 'right'

/** Everything a detector may look at. */
export interface DetectionContext {
  readonly landmarks: PoseLandmarks
  readonly baseline: NeutralStanceBaseline
  /** Recent frames, oldest first. Used where a movement is only visible over time. */
  readonly history: readonly PoseLandmarks[]
  readonly stance: Stance
  /** Which side a punch is arriving on, when one is. Parry needs it. */
  readonly incomingSide?: LateralDirection
}

const { movement, pose } = THRESHOLDS

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A unit-ish vector pointing toward the boxer's own left, taken from the
 * calibrated shoulders.
 *
 * Reading the direction from the body rather than assuming it is what makes
 * every lateral detector convention-independent.
 */
function lateralAxis(baseline: NeutralStanceBaseline, direction: LateralDirection): Point2D {
  const toLeft = subtract(baseline.shoulders.left, baseline.shoulders.right)
  return direction === 'left' ? toLeft : { x: -toLeft.x, y: -toLeft.y }
}

/** Mean detector confidence across the landmarks a heuristic actually used. */
function quality(landmarks: PoseLandmarks, used: readonly KeypointName[]): number {
  const total = used.reduce((sum, name) => sum + landmarks[name].score, 0)
  return total / used.length
}

/**
 * Turn "how far past the threshold" into a confidence.
 *
 * Half confidence exactly at the threshold, rising to full at twice it, then
 * scaled by how well the model actually saw the landmarks involved. A movement
 * that only just qualifies genuinely is uncertain, and a movement measured off
 * landmarks the model was guessing at should not be trusted however large it
 * looks.
 */
function confidenceFor(
  measured: number,
  threshold: number,
  landmarks: PoseLandmarks,
  used: readonly KeypointName[],
): number {
  const past = threshold === 0 ? 1 : measured / threshold
  return clamp01(0.5 + 0.5 * (past - 1)) * quality(landmarks, used)
}

/** Whether the model saw these landmarks well enough to measure anything. */
function isVisible(landmarks: PoseLandmarks, used: readonly KeypointName[]): boolean {
  return used.every((name) => landmarks[name].score >= pose.minKeypointScore)
}

/** Current shoulder-to-shoulder width, the live equivalent of `baseline.bodyWidth`. */
function currentBodyWidth(landmarks: PoseLandmarks): number {
  return distance(landmarks.leftShoulder, landmarks.rightShoulder)
}

/* -------------------------------------------------------------------------- */
/* Detectors                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A slip: the head leaves the centreline sideways, without dropping.
 *
 * The vertical check is what separates it from a roll. Both move the head
 * sideways; only a roll takes it down. Without this, every roll would also
 * report as a slip and the more specific answer would be a coin toss.
 */
export function detectSlip(
  landmarks: PoseLandmarks,
  baseline: NeutralStanceBaseline,
  direction: LateralDirection,
): DefenseDetection | null {
  const used: readonly KeypointName[] = ['nose', 'leftShoulder', 'rightShoulder']
  if (!isVisible(landmarks, used)) {
    return null
  }

  const travel = subtract(landmarks.nose, baseline.head)
  const sideways = scalarProjection(travel, lateralAxis(baseline, direction)) / baseline.bodyWidth
  const drop = (landmarks.nose.y - baseline.head.y) / baseline.bodyWidth

  if (sideways < movement.slipLateralRatio || sideways < movement.minMovementRatio) {
    return null
  }

  // Dropped far enough that this is a roll, not a slip.
  if (drop >= movement.rollVerticalRatio) {
    return null
  }

  return {
    type: direction === 'left' ? 'slipLeft' : 'slipRight',
    magnitude: sideways,
    confidence: confidenceFor(sideways, movement.slipLateralRatio, landmarks, used),
  }
}

/**
 * A roll: weaving under the punch — the head drops and arcs sideways, driven
 * from the legs.
 *
 * All three parts are required. Head-down alone is a duck, head-sideways alone
 * is a slip, and head-down without the hips following is a nod. Demanding the
 * hips drop too is what stops a user bobbing their neck from scoring a roll.
 */
export function detectRoll(
  landmarks: PoseLandmarks,
  baseline: NeutralStanceBaseline,
  direction: LateralDirection,
): DefenseDetection | null {
  const used: readonly KeypointName[] = [
    'nose',
    'leftShoulder',
    'rightShoulder',
    'leftHip',
    'rightHip',
  ]
  if (!isVisible(landmarks, used)) {
    return null
  }

  // y grows downward, so a drop is a positive difference.
  const headDrop = (landmarks.nose.y - baseline.head.y) / baseline.bodyWidth
  const hips = midpoint(landmarks.leftHip, landmarks.rightHip)
  const hipDrop = (hips.y - baseline.hips.center.y) / baseline.bodyWidth
  const across =
    scalarProjection(subtract(landmarks.nose, baseline.head), lateralAxis(baseline, direction)) /
    baseline.bodyWidth

  if (headDrop < movement.rollVerticalRatio) {
    return null
  }
  if (hipDrop < movement.rollHipDropRatio) {
    return null
  }
  if (across < movement.rollHorizontalRatio) {
    return null
  }

  // The drop is the movement; the arc only says which way it went.
  return {
    type: direction === 'left' ? 'rollLeft' : 'rollRight',
    magnitude: headDrop,
    confidence: confidenceFor(headDrop, movement.rollVerticalRatio, landmarks, used),
  }
}

/**
 * A step back: the whole body retreats.
 *
 * A single camera has no depth, so distance is inferred from apparent size —
 * moving away narrows the shoulders in frame. That proxy has a known weakness:
 * turning side-on narrows them too. Requiring the head to stay near the
 * centreline rejects the most common case of that, a user pivoting rather than
 * retreating.
 */
export function detectStepBack(
  landmarks: PoseLandmarks,
  baseline: NeutralStanceBaseline,
): DefenseDetection | null {
  const used: readonly KeypointName[] = ['nose', 'leftShoulder', 'rightShoulder']
  if (!isVisible(landmarks, used)) {
    return null
  }

  const shrink = (baseline.bodyWidth - currentBodyWidth(landmarks)) / baseline.bodyWidth

  if (shrink < movement.stepBackRatio) {
    return null
  }

  // Turning side-on also narrows the shoulders. A retreat keeps the head over
  // the centreline; a pivot swings it off.
  const sideways =
    Math.abs(
      scalarProjection(subtract(landmarks.nose, baseline.head), lateralAxis(baseline, 'left')),
    ) / baseline.bodyWidth

  if (sideways >= movement.slipLateralRatio) {
    return null
  }

  return {
    type: 'stepBack',
    magnitude: shrink,
    confidence: confidenceFor(shrink, movement.stepBackRatio, landmarks, used),
  }
}

/**
 * A guard: both gloves pulled tight to the head.
 *
 * Measured against the *current* head, not the baseline one — a guard held while
 * slipping is still a guard — but required to be tighter than the calibrated
 * resting guard, so a user who simply stands with their hands up does not score
 * a guard on every frame.
 */
export function detectGuard(
  landmarks: PoseLandmarks,
  baseline: NeutralStanceBaseline,
): DefenseDetection | null {
  const used: readonly KeypointName[] = ['nose', 'leftWrist', 'rightWrist']
  if (!isVisible(landmarks, used)) {
    return null
  }

  const leftGap = distance(landmarks.leftWrist, landmarks.nose) / baseline.bodyWidth
  const rightGap = distance(landmarks.rightWrist, landmarks.nose) / baseline.bodyWidth
  const widest = Math.max(leftGap, rightGap)

  // Both hands, or it is a parry or a punch rather than a guard.
  if (widest > movement.guardHandToHeadRatio) {
    return null
  }

  const restingGap =
    Math.max(
      distance(baseline.wrists.left, baseline.head),
      distance(baseline.wrists.right, baseline.head),
    ) / baseline.bodyWidth

  // Tightened, not merely already there.
  if (restingGap - widest < movement.minMovementRatio) {
    return null
  }

  // Guard is the one threshold that is an upper bound, so confidence runs the
  // other way: the tighter the gloves are inside the bound, the surer we are.
  // Half at the bound itself, full with the gloves on the head.
  const tightness = (movement.guardHandToHeadRatio - widest) / movement.guardHandToHeadRatio

  return {
    type: 'guard',
    magnitude: restingGap - widest,
    confidence: clamp01(0.5 + 0.5 * tightness) * quality(landmarks, used),
  }
}

/**
 * A parry: a hand pushes out across the incoming punch to deflect it.
 *
 * The only detector that needs history. A parry is defined by the hand
 * *travelling*, and the baseline says where the hands rest but not where they
 * were an instant ago — and a hand held out is not a parry, it is a lazy guard.
 *
 * The hand that parries is the one on the incoming side.
 */
export function detectParry(
  landmarks: PoseLandmarks,
  baseline: NeutralStanceBaseline,
  incomingSide: LateralDirection,
  history: readonly PoseLandmarks[],
): DefenseDetection | null {
  const wrist: KeypointName = incomingSide === 'left' ? 'leftWrist' : 'rightWrist'
  const used: readonly KeypointName[] = [wrist, 'leftShoulder', 'rightShoulder']
  if (!isVisible(landmarks, used)) {
    return null
  }

  const earliest = history[0]
  if (!earliest || earliest[wrist].score < pose.minKeypointScore) {
    return null
  }

  const travelled = subtract(landmarks[wrist], earliest[wrist])
  const toward =
    scalarProjection(travelled, lateralAxis(baseline, incomingSide)) / baseline.bodyWidth

  if (toward < movement.parryHandTravelRatio) {
    return null
  }

  // A hand carried along by the whole body turning is not a parry. The wrist has
  // to outrun the head it is protecting.
  const headTravel = magnitude(subtract(landmarks.nose, earliest.nose)) / baseline.bodyWidth
  if (toward <= headTravel) {
    return null
  }

  return {
    type: 'parry',
    magnitude: toward,
    confidence: confidenceFor(toward, movement.parryHandTravelRatio, landmarks, used),
  }
}

/* -------------------------------------------------------------------------- */
/* Composition                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Every detector, as uniform closures over the context.
 *
 * The registry is the extension point: a new defense is a new `detectX` above
 * plus one line here. No existing detector changes, and none of them know the
 * others exist (Open/Closed).
 */
const DETECTORS: readonly ((ctx: DetectionContext) => DefenseDetection | null)[] = [
  (ctx) => detectSlip(ctx.landmarks, ctx.baseline, 'left'),
  (ctx) => detectSlip(ctx.landmarks, ctx.baseline, 'right'),
  (ctx) => detectRoll(ctx.landmarks, ctx.baseline, 'left'),
  (ctx) => detectRoll(ctx.landmarks, ctx.baseline, 'right'),
  (ctx) => detectStepBack(ctx.landmarks, ctx.baseline),
  (ctx) => detectGuard(ctx.landmarks, ctx.baseline),
  (ctx) =>
    ctx.incomingSide
      ? detectParry(ctx.landmarks, ctx.baseline, ctx.incomingSide, ctx.history)
      : null,
]

/**
 * Classify the current pose as a defensive movement, or nothing.
 *
 * Runs every detector and returns the most confident answer. Several can fire at
 * once — a user rolling is also, briefly, moving sideways — and picking the most
 * confident rather than the first keeps the registry order from quietly
 * becoming a priority list that nobody documented.
 *
 * Returns null when nothing clears its threshold, which is the common case:
 * most frames are a boxer standing still.
 */
export function detectDefense(context: DetectionContext): DefenseDetection | null {
  if (context.baseline.bodyWidth <= 0) {
    return null
  }

  let best: DefenseDetection | null = null

  for (const detector of DETECTORS) {
    const detection = detector(context)
    if (!detection) {
      continue
    }

    if (!best || detection.confidence > best.confidence) {
      best = detection
    }
  }

  return best
}
