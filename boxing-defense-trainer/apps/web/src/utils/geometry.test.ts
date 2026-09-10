/**
 * Unit tests for the vector helpers.
 *
 * Small functions, but every detector is built on them, and their degenerate
 * cases are the dangerous part: a NaN escaping `normalize` fails every `>`
 * comparison silently, which downstream looks exactly like "no defense
 * detected" — forever, with no error anywhere.
 */
import { describe, expect, it } from 'vitest'

import {
  add,
  angleBetween,
  clamp01,
  distance,
  dot,
  magnitude,
  midpoint,
  normalize,
  scalarProjection,
  scale,
  subtract,
} from './geometry'

describe('vector arithmetic', () => {
  it('subtracts to give the vector from a to b', () => {
    expect(subtract({ x: 3, y: 4 }, { x: 1, y: 1 })).toEqual({ x: 2, y: 3 })
  })

  it('adds and scales', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 })
    expect(scale({ x: 1, y: -2 }, 3)).toEqual({ x: 3, y: -6 })
  })

  it('measures length and distance', () => {
    expect(magnitude({ x: 3, y: 4 })).toBe(5)
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })

  it('finds the midpoint', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 4, y: 2 })).toEqual({ x: 2, y: 1 })
  })

  it('dots', () => {
    expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11)
    // Perpendicular vectors.
    expect(dot({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0)
  })
})

describe('normalize', () => {
  it('produces a unit vector', () => {
    expect(magnitude(normalize({ x: 3, y: 4 }))).toBeCloseTo(1, 10)
  })

  it('returns zero for zero rather than NaN', () => {
    // Two landmarks reported at the same point is rare but real. NaN here would
    // make every threshold comparison false and detection would simply stop,
    // with nothing to indicate why.
    const result = normalize({ x: 0, y: 0 })

    expect(result).toEqual({ x: 0, y: 0 })
    expect(Number.isNaN(result.x)).toBe(false)
  })
})

describe('scalarProjection', () => {
  it('measures how far a vector runs along an axis', () => {
    expect(scalarProjection({ x: 5, y: 3 }, { x: 1, y: 0 })).toBeCloseTo(5, 10)
  })

  it('is signed, so the opposite direction is negative', () => {
    // This is what lets one detector answer "did the head go left" and its twin
    // answer "did it go right" from the same measurement.
    expect(scalarProjection({ x: -5, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(-5, 10)
  })

  it('ignores the length of the axis, only its direction', () => {
    const short = scalarProjection({ x: 4, y: 0 }, { x: 1, y: 0 })
    const long = scalarProjection({ x: 4, y: 0 }, { x: 100, y: 0 })

    expect(short).toBeCloseTo(long, 10)
  })

  it('is zero perpendicular to the axis', () => {
    expect(scalarProjection({ x: 0, y: 7 }, { x: 1, y: 0 })).toBeCloseTo(0, 10)
  })

  it('returns zero against a degenerate axis', () => {
    expect(scalarProjection({ x: 3, y: 4 }, { x: 0, y: 0 })).toBe(0)
  })
})

describe('angleBetween', () => {
  it('is zero for parallel vectors and PI for opposed ones', () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0, 10)
    expect(angleBetween({ x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(Math.PI, 10)
  })

  it('is a right angle for perpendicular vectors', () => {
    expect(angleBetween({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2, 10)
  })

  it('never returns NaN from floating-point overshoot', () => {
    // acos of anything a hair outside [-1,1] is NaN, and normalising two nearly
    // identical vectors is exactly how you get there.
    const angle = angleBetween({ x: 0.1, y: 0.2 }, { x: 0.1, y: 0.2 })

    expect(Number.isNaN(angle)).toBe(false)
    expect(angle).toBeCloseTo(0, 10)
  })

  it('returns zero against a degenerate vector', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(0)
  })
})

describe('clamp01', () => {
  it('passes through values already in range', () => {
    expect(clamp01(0.4)).toBe(0.4)
  })

  it('clamps both ends', () => {
    expect(clamp01(-2)).toBe(0)
    expect(clamp01(9)).toBe(1)
  })
})
