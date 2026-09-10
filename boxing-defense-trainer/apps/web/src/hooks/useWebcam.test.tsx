/**
 * Tests for camera acquisition.
 *
 * `getUserMedia` is stubbed, so what is under test is the state machine around
 * it — particularly that the camera is always released. A leaked track leaves
 * the user's camera light on after they navigated away, which is the kind of bug
 * that destroys trust in an app that asks for a webcam.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWebcam } from './useWebcam'

const stop = vi.fn()
const getUserMedia = vi.fn()

function fakeStream() {
  return { getTracks: () => [{ stop }] } as unknown as MediaStream
}

beforeEach(() => {
  stop.mockReset()
  getUserMedia.mockReset().mockResolvedValue(fakeStream())
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
})

afterEach(() => vi.clearAllMocks())

describe('useWebcam', () => {
  it('starts idle and asks for nothing until told', () => {
    const { result } = renderHook(() => useWebcam())

    expect(result.current.status).toBe('idle')
    expect(getUserMedia).not.toHaveBeenCalled()
  })

  it('goes active once permission is granted', async () => {
    const { result } = renderHook(() => useWebcam())

    act(() => result.current.start())

    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(result.current.error).toBeNull()
  })

  it('never requests audio', async () => {
    const { result } = renderHook(() => useWebcam())

    act(() => result.current.start())
    await waitFor(() => expect(result.current.status).toBe('active'))

    // Asking for a microphone the trainer does not use would be an unnecessary
    // and alarming permission prompt.
    expect(getUserMedia.mock.calls[0]?.[0]).toMatchObject({ audio: false })
  })

  it('distinguishes a refused permission from a broken camera', async () => {
    getUserMedia.mockRejectedValue(new DOMException('no', 'NotAllowedError'))
    const { result } = renderHook(() => useWebcam())

    act(() => result.current.start())

    await waitFor(() => expect(result.current.status).toBe('denied'))
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('reports other failures as error, not denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('gone', 'NotFoundError'))
    const { result } = renderHook(() => useWebcam())

    act(() => result.current.start())

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('reports error when the API is missing, as on an insecure origin', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    const { result } = renderHook(() => useWebcam())

    act(() => result.current.start())

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('stops every track when stopped', async () => {
    const { result } = renderHook(() => useWebcam())

    act(() => result.current.start())
    await waitFor(() => expect(result.current.status).toBe('active'))

    act(() => result.current.stop())

    expect(stop).toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('stops every track on unmount', async () => {
    const { result, unmount } = renderHook(() => useWebcam())

    act(() => result.current.start())
    await waitFor(() => expect(result.current.status).toBe('active'))

    unmount()

    expect(stop).toHaveBeenCalled()
  })

  it('releases a stream that arrives after being stopped', async () => {
    // The permission prompt can outlive the user's interest in it. Without this
    // the camera light stays on with nothing holding the stream.
    let grant: (stream: MediaStream) => void = () => undefined
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )

    const { result } = renderHook(() => useWebcam())

    act(() => result.current.start())
    expect(result.current.status).toBe('requesting')

    act(() => result.current.stop())
    await act(async () => {
      grant(fakeStream())
      await Promise.resolve()
    })

    await waitFor(() => expect(stop).toHaveBeenCalled())
    expect(result.current.status).toBe('idle')
  })

  it('ignores a second start while one is already in flight', async () => {
    const { result } = renderHook(() => useWebcam())

    act(() => {
      result.current.start()
      result.current.start()
    })

    await waitFor(() => expect(result.current.status).toBe('active'))
    // Two prompts for one camera is a bug the user sees.
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })
})
