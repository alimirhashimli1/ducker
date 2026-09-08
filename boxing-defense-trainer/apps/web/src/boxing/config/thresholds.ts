/**
 * Responsibility: the single source of truth for every tunable number in the
 * boxing domain. Nothing here is final — these are starting values to be tuned
 * against real footage. Import the named constant; never re-declare a literal
 * at a call site.
 *
 * TODO(tuning): calibrate all values below against recorded training sessions.
 */
import type { Difficulty } from '../../types'

/** Timing windows, in milliseconds, that decide whether a defense counts. */
export const TIMING = {
  /** A defense this far before/after the punch lands still scores as `clean`. */
  cleanWindowMs: 180,
  /** Outside `cleanWindowMs` but within this window scores as `late`. */
  lateWindowMs: 420,
  /** Nothing detected within this window after the punch counts as `missed`. */
  missWindowMs: 600,
} as const

/** Pose-detection confidence gates. A frame below these is treated as unusable. */
export const POSE = {
  /** Minimum per-keypoint confidence for a landmark to be trusted. */
  minKeypointScore: 0.45,
  /** Minimum fraction of required landmarks present before we score at all. */
  minVisibleKeypointRatio: 0.8,
  /** Frames of history the detector smooths over, to reject jitter. */
  smoothingWindowFrames: 4,
} as const

/**
 * Geometric thresholds for classifying a movement as a defense.
 * Distances are normalised to shoulder width so they hold at any camera distance.
 */
export const MOVEMENT = {
  /** Lateral head travel, in shoulder-widths, that counts as a slip. */
  slipLateralRatio: 0.35,
  /** Vertical head drop, in shoulder-widths, that counts as a duck. */
  duckVerticalRatio: 0.3,
  /** Backward head travel, in shoulder-widths, that counts as a lean-back. */
  leanBackRatio: 0.25,
  /** Wrist height relative to the eye line, in shoulder-widths, for a block. */
  blockGuardHeightRatio: 0.15,
} as const

/** Points awarded per outcome. */
export const SCORING = {
  cleanPoints: 100,
  latePoints: 50,
  wrongPoints: 0,
  missedPoints: -25,
  /** Bonus multiplier applied at the end of an unbroken clean streak. */
  streakBonusPerClean: 5,
} as const

/** Per-difficulty pacing of generated sequences. */
export const DIFFICULTY: Readonly<
  Record<
    Difficulty,
    {
      /** Punches per generated sequence. */
      readonly comboLength: number
      /** Delay between punches within a combo, in ms. */
      readonly interPunchMs: number
      /** Rest between sequences, in ms. */
      readonly restBetweenSequencesMs: number
      /** Multiplier applied to TIMING windows; lower = stricter. */
      readonly timingToleranceFactor: number
    }
  >
> = {
  rookie: {
    comboLength: 2,
    interPunchMs: 900,
    restBetweenSequencesMs: 2500,
    timingToleranceFactor: 1.5,
  },
  amateur: {
    comboLength: 3,
    interPunchMs: 650,
    restBetweenSequencesMs: 1800,
    timingToleranceFactor: 1,
  },
  pro: {
    comboLength: 5,
    interPunchMs: 420,
    restBetweenSequencesMs: 1200,
    timingToleranceFactor: 0.7,
  },
}

/** Countdown shown before a session starts, in seconds. */
export const COUNTDOWN_SECONDS = 3
