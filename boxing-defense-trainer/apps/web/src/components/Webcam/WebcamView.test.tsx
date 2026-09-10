/**
 * Component tests for the camera preview.
 *
 * Mostly about the states around a camera that is not working. A denied
 * permission that renders as an empty black box is indistinguishable from a
 * broken app, so each status has to say something.
 */
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { WebcamView } from './WebcamView'
import type { WebcamStatus } from '../../hooks/useWebcam'

const ref = () => createRef<HTMLVideoElement>()

describe('WebcamView', () => {
  it('mirrors the video so the user sees themselves as in a mirror', () => {
    render(<WebcamView videoRef={ref()} status="active" enabled />)

    expect(screen.getByTestId('webcam-video').getAttribute('class')).toContain('-scale-x-100')
  })

  it('renders the overlay slot unmirrored, so its text stays readable', () => {
    render(
      <WebcamView videoRef={ref()} status="active" enabled>
        <p>Move into view of the camera.</p>
      </WebcamView>,
    )

    const message = screen.getByText('Move into view of the camera.')
    expect(message.closest('.-scale-x-100')).toBeNull()
  })

  it.each([
    ['idle', 'Camera off.'],
    ['requesting', 'Waiting for camera permission…'],
    ['denied', 'Camera permission was refused. Allow it in your browser settings to train.'],
    ['error', 'No camera available.'],
  ] as const)('explains the %s state', (status: WebcamStatus, message) => {
    render(<WebcamView videoRef={ref()} status={status} enabled={false} />)

    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it('shows no message once the camera is live', () => {
    render(<WebcamView videoRef={ref()} status="active" enabled />)

    expect(screen.queryByText('Camera off.')).not.toBeInTheDocument()
  })

  it('asks for the opposite of the current state when toggled', () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <WebcamView videoRef={ref()} status="idle" enabled={false} onToggle={onToggle} />,
    )

    screen.getByRole('button', { name: 'camera on' }).click()
    expect(onToggle).toHaveBeenCalledWith(true)

    rerender(<WebcamView videoRef={ref()} status="active" enabled onToggle={onToggle} />)
    screen.getByRole('button', { name: 'camera off' }).click()
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('omits the toggle when no handler is given', () => {
    render(<WebcamView videoRef={ref()} status="active" enabled />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is muted and inline, which is what autoplay requires', () => {
    // Browsers refuse to autoplay video that is not muted and inline, so the
    // preview would sit black without these.
    //
    // Asserted on the properties, not the attributes: React applies `muted` as
    // a DOM property and reflects nothing to the markup, so `toHaveAttribute`
    // would fail against a correct component.
    render(<WebcamView videoRef={ref()} status="active" enabled />)
    const video = screen.getByTestId<HTMLVideoElement>('webcam-video')

    expect(video.muted).toBe(true)
    expect(video.playsInline).toBe(true)
  })
})
