/**
 * Component tests for the skeleton overlay.
 *
 * The message case matters most: "Move into view of the camera." is the app's
 * only cue that the camera works but nobody is in frame, and without it a user
 * standing out of shot sees a blank box and assumes the app is broken.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PoseOverlay } from './PoseOverlay'
import { THRESHOLDS } from '../../boxing'
import type { KeypointName, PoseLandmarks } from '../../types'

const NAMES: readonly KeypointName[] = [
  'nose',
  'leftEye',
  'rightEye',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
]

function landmarks(score = 0.9): PoseLandmarks {
  return Object.fromEntries(
    NAMES.map((name) => [name, { name, x: 0.5, y: 0.5, score }]),
  ) as PoseLandmarks
}

describe('PoseOverlay', () => {
  it('tells the user to move into view when nobody is detected', () => {
    render(<PoseOverlay detectionStatus="noPerson" />)

    expect(screen.getByText('Move into view of the camera.')).toBeInTheDocument()
  })

  it('does not show that message once a person is tracked', () => {
    render(<PoseOverlay detectionStatus="ok" landmarks={landmarks()} />)

    expect(screen.queryByText('Move into view of the camera.')).not.toBeInTheDocument()
  })

  it('draws nothing before detection has started', () => {
    render(<PoseOverlay detectionStatus="notStarted" />)

    expect(screen.getByTestId('pose-overlay').querySelector('line')).toBeNull()
    expect(screen.queryByText('Move into view of the camera.')).not.toBeInTheDocument()
  })

  it('draws a point per landmark and the segments between them', () => {
    render(<PoseOverlay detectionStatus="ok" landmarks={landmarks()} />)
    const overlay = screen.getByTestId('pose-overlay')

    expect(overlay.querySelectorAll('circle')).toHaveLength(NAMES.length)
    expect(overlay.querySelectorAll('line').length).toBeGreaterThan(0)
  })

  it('scales normalised landmarks into the viewBox', () => {
    const posed = landmarks()
    render(
      <PoseOverlay
        detectionStatus="ok"
        landmarks={{ ...posed, nose: { name: 'nose', x: 0.25, y: 0.75, score: 0.9 } }}
      />,
    )

    // 0.25 of a 100-unit viewBox.
    const nose = screen.getByTestId('pose-overlay').querySelector('circle')
    expect(nose?.getAttribute('cx')).toBe('25')
  })

  it('mirrors by default and can be told not to', () => {
    // The video underneath is flipped; the skeleton has to be flipped with it.
    const { rerender } = render(<PoseOverlay detectionStatus="ok" landmarks={landmarks()} />)
    expect(screen.getByTestId('pose-overlay').getAttribute('class')).toContain('-scale-x-100')

    rerender(<PoseOverlay detectionStatus="ok" landmarks={landmarks()} mirrored={false} />)
    expect(screen.getByTestId('pose-overlay').getAttribute('class')).not.toContain('-scale-x-100')
  })

  it('does not mirror the message, which would make it unreadable', () => {
    render(<PoseOverlay detectionStatus="noPerson" />)

    expect(screen.getByTestId('pose-overlay').getAttribute('class')).not.toContain('-scale-x-100')
  })

  it('dims landmarks below the confidence threshold', () => {
    // The threshold is read from the boxing config, never declared here.
    const low = THRESHOLDS.pose.minKeypointScore - 0.1
    render(<PoseOverlay detectionStatus="ok" landmarks={landmarks(low)} />)

    const circles = screen.getByTestId('pose-overlay').querySelectorAll('circle')
    for (const circle of circles) {
      expect(circle.getAttribute('class')).not.toContain('fill-ember-300')
    }
  })

  it('highlights landmarks at or above the threshold', () => {
    render(
      <PoseOverlay detectionStatus="ok" landmarks={landmarks(THRESHOLDS.pose.minKeypointScore)} />,
    )

    const circles = screen.getByTestId('pose-overlay').querySelectorAll('circle')
    for (const circle of circles) {
      expect(circle.getAttribute('class')).toContain('fill-ember-300')
    }
  })
})
