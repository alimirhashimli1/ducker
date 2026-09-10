/**
 * Component tests for the countdown.
 *
 * It owns a timer, so time is faked and driven explicitly. The `onTick`
 * contract is the load-bearing one: calibration decides when to start sampling
 * from it, and a tick that fired late — or not at all for the starting value —
 * would silently shift the sampling window.
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Countdown } from './Countdown'

/**
 * Advance one second, then let React render and schedule the next timeout.
 *
 * Each step has to be its own `act`: the following second's timeout does not
 * exist until the effect re-runs, so a single `advanceTimersByTime(2000)` fires
 * one tick, not two.
 */
const tick = (seconds = 1) => {
  for (let i = 0; i < seconds; i += 1) {
    act(() => void vi.advanceTimersByTime(1000))
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Countdown', () => {
  it('renders the starting number immediately', () => {
    render(<Countdown from={3} />)

    expect(screen.getByTestId('countdown')).toHaveTextContent('3')
  })

  it('counts down once per second', () => {
    render(<Countdown from={3} />)

    tick(1)
    expect(screen.getByTestId('countdown')).toHaveTextContent('2')

    tick(1)
    expect(screen.getByTestId('countdown')).toHaveTextContent('1')
  })

  it('shows the final label instead of zero', () => {
    render(<Countdown from={1} finalLabel="HOLD" />)

    tick(1)
    expect(screen.getByTestId('countdown')).toHaveTextContent('HOLD')
  })

  it('defaults the final label to BOX', () => {
    render(<Countdown from={1} />)

    tick(1)
    expect(screen.getByTestId('countdown')).toHaveTextContent('BOX')
  })

  it('reports completion once it reaches zero', () => {
    const onComplete = vi.fn()
    render(<Countdown from={2} onComplete={onComplete} />)

    tick(1)
    expect(onComplete).not.toHaveBeenCalled()

    tick(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('ticks with the starting value too, not just the decrements', () => {
    // Calibration opens its sampling window off these. Skipping the first tick
    // would make a from=1 countdown never open one at all.
    const onTick = vi.fn()
    render(<Countdown from={2} onTick={onTick} />)

    expect(onTick).toHaveBeenCalledWith(2)

    tick(1)
    expect(onTick).toHaveBeenCalledWith(1)

    tick(1)
    expect(onTick).toHaveBeenCalledWith(0)
  })

  it('stops at zero rather than counting negative', () => {
    render(<Countdown from={1} />)

    tick(5)
    expect(screen.getByTestId('countdown')).toHaveAttribute('data-remaining', '0')
  })

  it('restarts when `from` changes', () => {
    const { rerender } = render(<Countdown from={3} />)

    tick(2)
    expect(screen.getByTestId('countdown')).toHaveTextContent('1')

    rerender(<Countdown from={5} />)
    expect(screen.getByTestId('countdown')).toHaveTextContent('5')
  })

  it('clears its timer on unmount', () => {
    const onComplete = vi.fn()
    const { unmount } = render(<Countdown from={2} onComplete={onComplete} />)

    unmount()
    tick(5)

    expect(onComplete).not.toHaveBeenCalled()
  })
})
