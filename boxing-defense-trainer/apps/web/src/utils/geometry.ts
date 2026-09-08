/**
 * Responsibility: coordinate maths on normalised [0,1] points. Domain-neutral —
 * it knows about vectors, not about boxing.
 */

export interface Point2D {
  readonly x: number
  readonly y: number
}

/** Euclidean distance between two normalised points. */
// TODO: implement.
export function distance(_a: Point2D, _b: Point2D): number {
  return 0
}

/** Midpoint of two normalised points. */
// TODO: implement.
export function midpoint(_a: Point2D, _b: Point2D): Point2D {
  return { x: 0, y: 0 }
}
