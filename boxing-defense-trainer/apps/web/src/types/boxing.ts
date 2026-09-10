/**
 * Responsibility: the domain vocabulary of the trainer — stance, what a punch
 * is, what counts as a defense, and how an exchange is scored. Pure type
 * declarations shared by `src/boxing/` and the UI layer.
 */

/**
 * Which foot and hand the boxer leads with. Orthodox leads with the left,
 * southpaw with the right; everything lateral in the domain mirrors between
 * the two. See `resolveForStance` in `src/boxing/attacks.ts`.
 */
export type Stance = 'orthodox' | 'southpaw'

/**
 * Punches the trainer can throw at the user.
 *
 * Named by role rather than by side — `leadHook`, not `leftHook` — because the
 * hand that throws a lead hook depends on stance. Keeping the label
 * stance-relative means the catalogue in `src/boxing/attacks.ts` is written
 * once and mirrored on demand, rather than duplicated per stance.
 */
export type PunchType = 'jab' | 'cross' | 'leadHook' | 'rearHook' | 'leadUppercut' | 'rearUppercut'

/**
 * Defensive movements the user can perform in response.
 *
 * `slip*` and `roll*` are named from the defender's point of view: `slipLeft`
 * means the defender's head moves to their own left.
 */
export type DefenseType =
  'slipLeft' | 'slipRight' | 'rollLeft' | 'rollRight' | 'stepBack' | 'guard' | 'parry'

/** How hard the trainer is working the user. Higher is faster and less forgiving. */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5

/**
 * What kind of drill is being run.
 *
 * - `beginner`   — single punches, generous timing, one defense at a time.
 * - `combination` — multi-punch combos thrown as one unit.
 * - `reaction`   — unpredictable timing, tightened reaction window.
 */
export type TrainingMode = 'beginner' | 'combination' | 'reaction'

/**
 * A single incoming punch.
 *
 * `id` identifies the punch *occurrence*. Entries in the canonical catalogue use
 * the punch name as their id, but a generated combination may throw the same
 * punch twice, so a sequence builder must assign a unique id per occurrence —
 * scoring keys exchanges by `id` and would otherwise conflate the two.
 */
export interface Attack {
  readonly id: string
  readonly name: PunchType
  /** Time from the start of the punch to the moment it lands, in ms. */
  readonly duration: number
  /** Defenses that count as a correct answer to this punch. */
  readonly expectedDefenses: readonly DefenseType[]
}

/**
 * An ordered combination of punches thrown as one unit.
 *
 * A plain array: a sequence carries no identity or metadata of its own, and the
 * difficulty and mode that produced it live on the session state instead.
 */
export type AttackSequence = readonly Attack[]

/**
 * The graded result of one attack/defense exchange. All scores are 0-100.
 *
 * Lives here rather than beside `scoring.ts` because the state machine stores
 * it and the UI renders it, so it is shared vocabulary rather than one module's
 * private return type.
 */
export interface DefenseScore {
  /** Whether the detected defense was one the attack actually expected. */
  readonly correct: boolean
  /**
   * Signed milliseconds between the punch landing and the defense.
   * Negative is early. For a miss this is the full window we waited.
   */
  readonly reactionMs: number
  readonly reactionScore: number
  readonly movementScore: number
  readonly balanceScore: number
  /** Weighted blend of the three, or zero if the defense was wrong or missed. */
  readonly total: number
}
