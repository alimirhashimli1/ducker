/**
 * Responsibility: the single source of truth for every tunable number in the
 * boxing domain. Import `THRESHOLDS`; never re-declare a literal at a call site.
 *
 * Two conventions hold throughout:
 *
 * - **Distances are ratios of shoulder width, not pixels.** Shoulder width is
 *   the one body measurement that stays stable as the user moves toward or away
 *   from the camera, so normalising against it makes a threshold hold at any
 *   camera distance and for any body size. A value of `0.35` means "35% of the
 *   distance between the shoulders".
 * - **Times are milliseconds.**
 *
 * TODO(tuning): every value below is a starting estimate to be calibrated
 * against recorded training footage. None of them are measured yet.
 */
import type { DifficultyLevel } from '../../types'

export const THRESHOLDS = {
  /**
   * Geometry that decides whether a movement is a given defense. All measured
   * against the user's calibrated neutral pose, in shoulder-widths.
   */
  movement: {
    /**
     * Lateral head travel that counts as a slip.
     * Raise it and small head movement stops registering, so the user must
     * commit to a real slip; lower it and incidental swaying scores as a slip.
     */
    slipLateralRatio: 0.35,

    /**
     * Head drop that counts as a roll. A roll is a drop *and* a lateral arc, so
     * both this and `rollHorizontalRatio` must be met.
     * Raise it and shallow ducking stops counting; lower it and a nod registers.
     */
    rollVerticalRatio: 0.3,

    /**
     * Lateral travel across the arc of a roll, which is what separates a roll
     * from a straight-down duck.
     * Raise it and the user must weave properly under the punch; lower it and a
     * vertical crouch is accepted as a roll.
     */
    rollHorizontalRatio: 0.22,

    /**
     * Hip drop that corroborates a roll.
     *
     * A roll is driven from the legs, so the hips fall with the head. Requiring
     * both separates a real weave from a nod, which moves the head alone.
     * Raise it and the user must sit deeper into the movement; lower it and
     * bending only at the neck starts to count.
     */
    rollHipDropRatio: 0.12,

    /**
     * How far the shoulders must appear to narrow to count as a step back,
     * as a fraction of their calibrated width.
     *
     * A single camera has no depth, so distance is inferred from apparent size:
     * moving away shrinks the shoulders in frame. 0.12 is roughly one good step
     * back from arm's length.
     *
     * Note this one is a fraction of the baseline width, not a displacement in
     * shoulder-widths like its neighbours.
     * Raise it and only a committed retreat counts, so leaning away is ignored;
     * lower it and turning slightly side-on reads as a step back, because that
     * also narrows the shoulders.
     */
    stepBackRatio: 0.12,

    /**
     * Maximum wrist-to-head distance for the hands to count as a guard.
     * This is an upper bound: the movement qualifies when the wrists are
     * *closer* than this.
     * Raise it and a loose, hands-down guard is accepted; lower it and the user
     * must bring the gloves tight to the head.
     */
    guardHandToHeadRatio: 0.4,

    /**
     * Forward wrist travel that counts as a parry — a short, deliberate push
     * across the centreline to deflect a straight punch.
     * Raise it and only a committed parry registers; lower it and any hand
     * twitch near the centreline scores as one.
     */
    parryHandTravelRatio: 0.18,

    /**
     * Floor for any movement to be considered at all, below which the frame is
     * treated as noise rather than intent. Applied before the specific
     * thresholds above.
     * Raise it and detector jitter stops producing phantom defenses, at the cost
     * of missing genuinely subtle movement; lower it and the detector gets
     * twitchier.
     */
    minMovementRatio: 0.08,

    /**
     * How close the user must return to their neutral pose before the next
     * punch is thrown — the check that they recovered their balance and guard
     * rather than staying slipped off-centre.
     * Raise it and the user is allowed to still be drifting when the next punch
     * starts; lower it and they must reset precisely, which is stricter and
     * slows the drill.
     */
    balanceReturnRatio: 0.15,
  },

  /** Timing windows, in milliseconds, that decide whether a defense counts. */
  timing: {
    /**
     * Tolerance around the moment a punch lands within which a defense is still
     * `clean`. Applied symmetrically, so it forgives moving early as well as
     * late, and is scaled per difficulty by `timingToleranceFactor`.
     * Raise it and the drill becomes more forgiving; lower it and the user must
     * time the punch precisely.
     */
    reactionToleranceMs: 180,

    /**
     * Outside the clean window but within this one, a defense scores as `late`.
     * Raise it and slow reactions still earn partial credit; lower it and they
     * fall through to `missed`.
     */
    lateWindowMs: 420,

    /**
     * Nothing detected within this long after the punch lands counts as
     * `missed`, and the exchange closes.
     * Raise it and the trainer waits longer before giving up, which slows the
     * drill; lower it and the round moves on faster.
     */
    missWindowMs: 600,
  },

  /**
   * Pose-detection confidence gates. A frame that fails these is unusable and
   * must not be scored — a missed detection is not the same as a missed defense.
   */
  pose: {
    /**
     * Minimum per-landmark confidence for a landmark to be trusted.
     * Raise it and only crisp landmarks are used, so occlusion drops frames
     * rather than producing bad geometry; lower it and noisy landmarks leak in.
     */
    minKeypointScore: 0.45,

    /**
     * Minimum fraction of required landmarks that must clear the gate above
     * before the frame is scored at all.
     * Raise it and partially visible bodies are rejected; lower it and the
     * detector guesses from incomplete skeletons.
     */
    minVisibleKeypointRatio: 0.8,

    /**
     * Frames of history smoothed over to reject jitter.
     * Raise it and detection is steadier but lags behind the movement; lower it
     * and it responds faster but flickers.
     */
    smoothingWindowFrames: 4,
  },

  /** Points awarded per outcome. */
  scoring: {
    cleanPoints: 100,
    latePoints: 50,
    wrongPoints: 0,
    /** Negative: taking a clean punch should cost, not merely fail to earn. */
    missedPoints: -25,
    /** Added per punch of an unbroken clean streak, on top of the base points. */
    streakBonusPerClean: 5,

    /**
     * Movement magnitude, in shoulder-widths, that earns full marks for
     * commitment. Below `movement.minMovementRatio` scores nothing; between the
     * two it scales linearly.
     * Raise it and the user must throw their whole body into a defense to score
     * well; lower it and a minimal qualifying movement already earns full marks.
     */
    movementFullCreditRatio: 0.5,

    /**
     * How the three components of a defense combine into its total.
     *
     * Reaction is weighted heaviest because this is a reaction trainer: being
     * in the right place too late is the failure the app exists to fix.
     * Movement comes next — a committed defense is a real one. Balance is
     * weighted lightest because recovering is what makes the *next* defense
     * possible rather than this one correct.
     *
     * They are normalised at use, so these can be edited freely without having
     * to keep them summing to one.
     */
    weights: {
      reaction: 0.5,
      movement: 0.3,
      balance: 0.2,
    },
  },

  /**
   * Pacing of generated sequences, per difficulty.
   *
   * `delayJitterMs` is the +/- spread applied to `restBetweenSequencesMs` in
   * reaction mode. Raise it and the user cannot anticipate the next punch from
   * rhythm alone, which is the point of that mode; lower it and the drill
   * becomes metronomic and easy to game. It grows with level because
   * unpredictability is part of what makes a level harder.
   *
   * It must stay below `restBetweenSequencesMs` at every level, or the delay
   * range would reach zero and punches would overlap.
   */
  difficulty: {
    1: {
      comboLength: 1,
      interPunchMs: 1100,
      restBetweenSequencesMs: 2800,
      timingToleranceFactor: 1.6,
      delayJitterMs: 150,
    },
    2: {
      comboLength: 2,
      interPunchMs: 900,
      restBetweenSequencesMs: 2400,
      timingToleranceFactor: 1.35,
      delayJitterMs: 250,
    },
    3: {
      comboLength: 3,
      interPunchMs: 700,
      restBetweenSequencesMs: 1900,
      timingToleranceFactor: 1,
      delayJitterMs: 400,
    },
    4: {
      comboLength: 4,
      interPunchMs: 550,
      restBetweenSequencesMs: 1500,
      timingToleranceFactor: 0.85,
      delayJitterMs: 550,
    },
    5: {
      comboLength: 5,
      interPunchMs: 420,
      restBetweenSequencesMs: 1200,
      timingToleranceFactor: 0.7,
      delayJitterMs: 700,
    },
  },

  /** Whole-session settings. */
  session: {
    /** Countdown shown before a round starts, in seconds. */
    countdownSeconds: 3,
    /** Frames of neutral pose averaged during CALIBRATING to fix the baseline. */
    calibrationFrames: 30,

    /**
     * How much of the tail of the countdown is spent sampling the stance.
     * Raise it and the baseline averages over more frames, so it is steadier
     * but includes the user still settling into stance; lower it and only the
     * final, most-settled moment is measured, from fewer frames.
     */
    calibrationSamplingSeconds: 1,

    /**
     * Punches in a round, after which the loop stops and shows the summary.
     * Raise it for a longer round; lower it to get to the results sooner.
     */
    attacksPerRound: 10,

    /**
     * How long a single exchange's result stays on screen before the next punch
     * is queued.
     * Raise it and the user has time to read the feedback but the round drags;
     * lower it and the drill flows better but the feedback flashes past.
     */
    resultDisplayMs: 900,

    /**
     * How far through a punch's animation it becomes "live" — the point the
     * reaction window opens, as a fraction of the punch's duration.
     *
     * Before this the punch is wind-up: a defense then is anticipation, not
     * reaction, and the user could beat the drill by moving on sight of any
     * movement at all. After it the punch is committed and unavoidable.
     * Raise it and the user gets less warning; lower it and the drill rewards
     * twitching at the first frame of the animation.
     */
    attackLiveFraction: 0.6,

    /**
     * How long after a defense to wait before sampling the pose for the balance
     * score.
     * Raise it and balance measures a settled recovery, at the cost of delaying
     * the next punch; lower it and it measures the user still mid-movement,
     * which scores everyone badly.
     */
    balanceSampleDelayMs: 250,
  },
} as const

/** Pacing for one difficulty level. */
export type DifficultySettings = (typeof THRESHOLDS)['difficulty'][DifficultyLevel]
