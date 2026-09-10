/**
 * Responsibility: where the sparring partner's joints are, in SVG user units.
 *
 * Separated from the components so the figure's proportions can be adjusted
 * without reading JSX, and so every rotation origin is declared once. A joint
 * coordinate appearing in two places is how an arm ends up pivoting from
 * somewhere that is not its shoulder.
 *
 * These are layout values, not tuning values: nothing here affects what the
 * trainer judges, so they do not belong in `src/boxing/config/thresholds.ts`.
 *
 * The figure faces the viewer and is drawn in its ORTHODOX arrangement, with the
 * lead side at higher x — a boxer's left hand is on the viewer's right. Southpaw
 * is the same drawing flipped horizontally; see `Boxer.tsx`.
 */

/** The drawing canvas. Everything below is in these coordinates. */
export const VIEW_BOX = { width: 200, height: 280 } as const

export interface Point {
  readonly x: number
  readonly y: number
}

/** One arm's three joints, from shoulder outward. */
export interface ArmGeometry {
  readonly shoulder: Point
  readonly elbow: Point
  readonly glove: Point
}

/** One leg's joints, from hip down. */
export interface LegGeometry {
  readonly hip: Point
  readonly knee: Point
  readonly foot: Point
}

export const HEAD = { cx: 100, cy: 58, r: 19 } as const

/** The torso outline, shoulders down to hips. */
export const TORSO = {
  shoulderY: 88,
  hipY: 168,
  shoulderHalfWidth: 34,
  hipHalfWidth: 24,
} as const

/**
 * The torso pivots at the hips, not its centre: a punch is driven by the hip
 * turn, so rotating about the middle of the chest reads as a wobble.
 */
export const TORSO_PIVOT: Point = { x: 100, y: TORSO.hipY }

export const LEAD_ARM: ArmGeometry = {
  shoulder: { x: 134, y: 88 },
  elbow: { x: 152, y: 118 },
  // Gloves rest high and close: this is the guard, not a rest position.
  glove: { x: 132, y: 92 },
}

export const REAR_ARM: ArmGeometry = {
  shoulder: { x: 66, y: 88 },
  elbow: { x: 48, y: 118 },
  glove: { x: 68, y: 92 },
}

export const LEAD_LEG: LegGeometry = {
  hip: { x: 118, y: 168 },
  knee: { x: 132, y: 212 },
  foot: { x: 142, y: 262 },
}

export const REAR_LEG: LegGeometry = {
  hip: { x: 82, y: 168 },
  knee: { x: 68, y: 212 },
  foot: { x: 54, y: 262 },
}

/** Stroke weights, heaviest limb first, so the figure reads at small sizes. */
export const STROKE = {
  upperArm: 15,
  forearm: 13,
  leg: 17,
  gloveRadius: 13,
} as const

/**
 * The transform origin for an animated SVG group, in viewBox coordinates.
 *
 * Framer Motion owns `transform-origin` on any element whose transform it
 * animates: a plain `transformOrigin` in `style` survives only until the first
 * rotation, at which point it is replaced with the default `50% 50%` and the
 * limb starts pivoting around its own middle. So the origin has to be handed to
 * Framer as `originX`/`originY` instead.
 *
 * They must be **px strings**. A bare number is read as a fraction of the
 * element, so `134` becomes `13400%` rather than 134 user units.
 *
 * `transformBox: 'view-box'` is set explicitly rather than relied on as a
 * default, so these coordinates are the same ones the geometry above is written
 * in.
 */
export function pivotAt(point: Point): {
  transformBox: 'view-box'
  originX: string
  originY: string
} {
  return {
    transformBox: 'view-box',
    originX: `${point.x}px`,
    originY: `${point.y}px`,
  }
}
