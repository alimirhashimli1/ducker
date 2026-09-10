/**
 * Component tests for the Boxer figure.
 *
 * These cover structure and the props contract — that every animatable group is
 * present, that stance mirrors, and that a punch reports completion so the
 * parent can return it to idle. They say nothing about whether the animation
 * *looks* right; that needs eyes, and `src/pages/BoxerPreview.tsx` is where you
 * use them.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Boxer } from './Boxer'
import { BOXER_ACTIONS } from '../../animations/boxerAnimations'

describe('Boxer', () => {
  it('renders every animatable group', () => {
    // Each of these is a variant target. A missing group means a limb that
    // silently never moves.
    render(<Boxer stance="orthodox" currentAction="idle" />)

    for (const id of [
      'boxer-torso',
      'boxer-head',
      'boxer-lead-upper-arm',
      'boxer-lead-forearm',
      'boxer-lead-glove',
      'boxer-rear-upper-arm',
      'boxer-rear-forearm',
      'boxer-rear-glove',
      'boxer-lead-leg',
      'boxer-rear-leg',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })

  it('mirrors the figure for southpaw and not for orthodox', () => {
    // Stance is expressed as a horizontal flip rather than a second set of
    // variants; this is the assertion that pins that decision.
    const { rerender } = render(<Boxer stance="orthodox" currentAction="idle" />)
    expect(screen.getByTestId('boxer').getAttribute('class')).not.toContain('-scale-x-100')

    rerender(<Boxer stance="southpaw" currentAction="idle" />)
    expect(screen.getByTestId('boxer').getAttribute('class')).toContain('-scale-x-100')
  })

  it('describes itself for screen readers', () => {
    render(<Boxer stance="southpaw" currentAction="cross" />)

    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Sparring partner in southpaw stance, throwing a cross',
    )
  })

  it.each(BOXER_ACTIONS)('accepts %s without crashing', (action) => {
    render(<Boxer stance="orthodox" currentAction={action} />)

    expect(screen.getByTestId('boxer')).toBeInTheDocument()
  })

  it('reports completion once a punch has finished and returns to guard', async () => {
    // The contract the parent depends on: without this callback, asking for the
    // same punch twice is not a prop change and nothing replays.
    const onActionComplete = vi.fn()

    render(<Boxer stance="orthodox" currentAction="jab" onActionComplete={onActionComplete} />)

    await waitFor(() => expect(onActionComplete).toHaveBeenCalled(), { timeout: 3000 })
    await waitFor(() => expect(screen.getByTestId('boxer')).toHaveAttribute('data-action', 'idle'))
  })

  it('does not report completion for the idle loop', async () => {
    // Idle repeats forever and is not an action the parent asked for; notifying
    // on it would reset state the parent never set.
    const onActionComplete = vi.fn()

    render(<Boxer stance="orthodox" currentAction="idle" onActionComplete={onActionComplete} />)

    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(onActionComplete).not.toHaveBeenCalled()
  })
})
