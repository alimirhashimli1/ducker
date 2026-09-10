/**
 * Responsibility: coordinate maths on normalised [0,1] points. Domain-neutral —
 * it knows about vectors, not about boxing.
 *
 * The detectors in `src/boxing/defenseDetector.ts` are the main consumer. Every
 * bit of vector arithmetic they need lives here so each detector reads as the
 * heuristic it implements rather than as a wall of subtractions, and so the
 * arithmetic is tested once instead of once per detector.
 *
 * A note on the coordinate frame: y grows **downward**, as it does in every
 * image format. A head dropping is an increase in y, and a positive angle turns
 * clockwise on screen. Getting this backwards is the single easiest way to
 * invert a detector.
 */
import type { Point2D } from '../types'

export type { Point2D }

/** The vector from `a` to `b`. */
export function subtract(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function add(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function scale(v: Point2D, factor: number): Point2D {
  return { x: v.x * factor, y: v.y * factor }
}

/** Length of a vector. */
export function magnitude(v: Point2D): number {
  return Math.hypot(v.x, v.y)
}

/** Euclidean distance between two normalised points. */
export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Midpoint of two normalised points. */
export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function dot(a: Point2D, b: Point2D): number {
  return a.x * b.x + a.y * b.y
}

/**
 * A unit vector in the same direction as `v`.
 *
 * Returns the zero vector for zero input rather than NaN, so a degenerate frame
 * — two landmarks reported at the same point — produces a movement of zero
 * rather than poisoning every comparison downstream. NaN fails every `>`
 * silently, which would look like "no defense detected" forever.
 */
export function normalize(v: Point2D): Point2D {
  const length = magnitude(v)
  return length === 0 ? { x: 0, y: 0 } : { x: v.x / length, y: v.y / length }
}

/**
 * How far `v` extends along `axis`, signed.
 *
 * The workhorse of the lateral detectors: it answers "how far did the head move
 * toward the boxer's own left" without ever needing to know which way that is
 * on screen. Positive means along the axis, negative means against it.
 */
export function scalarProjection(v: Point2D, axis: Point2D): number {
  return dot(v, normalize(axis))
}

/** The angle between two vectors, in radians, in [0, PI]. */
export function angleBetween(a: Point2D, b: Point2D): number {
  const lengths = magnitude(a) * magnitude(b)
  if (lengths === 0) {
    return 0
  }

  // Clamped because floating-point error can push the quotient a hair outside
  // [-1, 1], and Math.acos returns NaN there.
  return Math.acos(Math.min(1, Math.max(-1, dot(a, b) / lengths)))
}

/** Clamp to [0, 1]. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
