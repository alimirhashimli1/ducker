/**
 * Responsibility: the shape of pose data as it enters the application from the
 * webcam pose detector.
 *
 * Deliberately detector-agnostic. Nothing outside the adapter that wraps the
 * detector may import a vendor SDK's types — not MediaPipe's `NormalizedLandmark`,
 * not TensorFlow's `Keypoint`. The domain depends on the abstraction declared
 * here and the detector is mapped down to it, so swapping detectors is a change
 * to one adapter rather than to every consumer (Dependency Inversion, per
 * `.claude/RULES.md`).
 *
 * That mapping is also where a vendor's landmark *indices* stop: MediaPipe
 * reports landmark 11 where we want `leftShoulder`, and that translation
 * belongs in the adapter, never in the boxing domain.
 */

/**
 * Landmarks the trainer cares about.
 *
 * A detector reports many more — MediaPipe Pose emits 33 — and we map down to
 * this set. Shoulders and hips carry the torso frame that every measurement is
 * normalised against, wrists and elbows carry guard and parry, and knees carry
 * the weight shift that separates a real slip from a lean.
 */
export type KeypointName =
  | 'nose'
  | 'leftEye'
  | 'rightEye'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftElbow'
  | 'rightElbow'
  | 'leftWrist'
  | 'rightWrist'
  | 'leftHip'
  | 'rightHip'
  | 'leftKnee'
  | 'rightKnee'

/**
 * A single landmark in normalised [0,1] frame coordinates, origin top-left.
 *
 * Normalised rather than pixels so thresholds hold across camera resolutions.
 * Note y grows *downward*: a head drop is an increase in y.
 */
export interface Keypoint {
  readonly name: KeypointName
  readonly x: number
  readonly y: number
  /** Detector confidence in [0,1]. */
  readonly score: number
}

/**
 * Every landmark for one frame, addressable by name.
 *
 * The record form is what geometry code wants — `landmarks.leftShoulder` rather
 * than a find() over an array — and being a total record means a consumer
 * cannot forget to handle a missing landmark. An occluded landmark is still
 * present here, carrying a low `score`; callers gate on that rather than on
 * existence.
 */
export type PoseLandmarks = Readonly<Record<KeypointName, Keypoint>>

/** One detected body pose for a single video frame. */
export interface PoseFrame {
  /** Milliseconds since session start (not wall-clock), so replays are deterministic. */
  readonly timestamp: number
  readonly landmarks: PoseLandmarks
}

/**
 * Whether the detector is currently seeing a usable pose.
 *
 * Declared here rather than beside the hook because both the hook that produces
 * it and the components that render it need the vocabulary.
 *
 * - `notStarted` — the detector is not running: camera off, or model loading.
 * - `noPerson`   — running, but nobody is in frame.
 * - `ok`         — a pose is being tracked.
 */
export type DetectionStatus = 'notStarted' | 'noPerson' | 'ok'

/** A point in normalised [0,1] frame coordinates, origin top-left. */
export interface Point2D {
  readonly x: number
  readonly y: number
}

/**
 * The user's resting boxing stance, measured once before a round.
 *
 * Every defensive movement is judged as a departure from this: a slip is the
 * head leaving `head`, a step back is the shoulders shrinking away from
 * `bodyWidth`. Without it there is no "normal" to compare against, so detection
 * cannot run — see the calibration section of `src/boxing/README.md`.
 *
 * All positions are in the same normalised [0,1] frame coordinates as the
 * landmarks they were averaged from.
 */
export interface NeutralStanceBaseline {
  /** The nose at rest — the reference point for slips, rolls and lean-backs. */
  readonly head: Point2D
  readonly shoulders: {
    readonly left: Point2D
    readonly right: Point2D
    /** Midpoint, the centreline a slip moves off. */
    readonly center: Point2D
  }
  readonly hips: {
    readonly left: Point2D
    readonly right: Point2D
    readonly center: Point2D
  }
  /**
   * Where the gloves sit in the resting guard.
   *
   * Needed because a guard is a movement *toward* the head, and "toward" is
   * meaningless without knowing where the hands already were. Unlike the torso
   * landmarks these are not required for calibration to succeed — a hand can be
   * occluded without invalidating the stance — so they may be less reliable
   * than the rest of the baseline.
   */
  readonly wrists: {
    readonly left: Point2D
    readonly right: Point2D
  }
  /**
   * Shoulder-to-shoulder distance at rest.
   *
   * The unit every threshold in `config/thresholds.ts` is expressed in: a
   * `slipLateralRatio` of 0.35 means 35% of this. It is what makes a threshold
   * hold for any body at any distance from the camera.
   */
  readonly bodyWidth: number
  /** How many usable samples were averaged. Higher means less jitter. */
  readonly sampleCount: number
}
