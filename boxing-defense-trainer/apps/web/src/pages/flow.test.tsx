/**
 * A walk through the real screen flow: Home -> Training -> Results.
 *
 * This is not a substitute for the manual pass. The camera and the pose model
 * are stubbed, so nothing here says whether a real slip is detected or whether
 * the skeleton lands on real shoulders — that still needs a person in front of a
 * webcam, per `docs/architecture/testing-strategy.md`.
 *
 * What it does cover is the wiring between screens, which is exactly what breaks
 * silently: a page that renders nothing because a provider is missing, a Start
 * button that leads nowhere, a Results screen that cannot render the summary it
 * was handed.
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(() => Promise.resolve({})) },
  PoseLandmarker: {
    createFromOptions: vi.fn(() =>
      Promise.resolve({ detectForVideo: () => ({ landmarks: [] }), close: vi.fn() }),
    ),
  },
}))

Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: { getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] })) },
})

const { default: App } = await import('../App')
const { Results } = await import('./Results')
const { emptyRoundStats, toDefenseResult, ATTACK_CATALOGUE, accumulate } = await import('../boxing')

/**
 * Click and let React commit.
 *
 * A bare .click() only queues the update; the next line would read state from
 * before the click, which is a property of React batching rather than of the
 * component.
 */
const press = (name: string | RegExp) => act(() => screen.getByRole('button', { name }).click())

describe('the screen flow', () => {
  it('starts on Home with the setup choices', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /boxing defense/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Orthodox/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Beginner/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
  })

  it('marks the chosen options and carries them into training', async () => {
    render(<App />)

    press(/Southpaw/)
    press(/Reaction/)
    press('4')

    expect(screen.getByRole('button', { name: /Southpaw/ })).toHaveAttribute('aria-pressed', 'true')

    press('Start')

    // The training screen echoes the configuration it was handed.
    await waitFor(() =>
      expect(screen.getByText(/reaction · level 4 · southpaw/i)).toBeInTheDocument(),
    )
  })

  it('shows the boxer, the HUD and the camera on the training screen', async () => {
    render(<App />)
    press('Start')

    await waitFor(() => expect(screen.getByTestId('training-hud')).toBeInTheDocument())
    expect(screen.getByTestId('boxer')).toBeInTheDocument()
    expect(screen.getByTestId('webcam-view')).toBeInTheDocument()
    expect(screen.getByTestId('calibration-panel')).toBeInTheDocument()
  })

  it('cannot start a round before calibrating', async () => {
    // The machine gates on a baseline; this is the button honouring that.
    render(<App />)
    press('Start')

    await waitFor(() => expect(screen.getByTestId('training-hud')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Start', hidden: false })).toBeDisabled()
  })

  it('lets the camera be hidden, per the uncluttered requirement', async () => {
    render(<App />)
    press('Start')

    await waitFor(() => expect(screen.getByTestId('webcam-view')).toBeInTheDocument())
    press('hide camera')

    await waitFor(() => expect(screen.queryByTestId('webcam-view')).not.toBeInTheDocument())
  })

  it('returns to Home when the round is quit', async () => {
    render(<App />)
    press('Start')

    await waitFor(() => expect(screen.getByTestId('training-hud')).toBeInTheDocument())
    press('quit')

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Orthodox/ })).toBeInTheDocument(),
    )
  })
})

describe('the results screen', () => {
  const jab = ATTACK_CATALOGUE.jab
  const graded = (correct: boolean, detected: 'slipLeft' | null) =>
    toDefenseResult(jab, detected, {
      correct,
      reactionMs: correct ? 55 : 600,
      reactionScore: correct ? 100 : 0,
      movementScore: correct ? 80 : 0,
      balanceScore: correct ? 90 : 0,
      total: correct ? 91 : 0,
    })

  const summary = () => {
    const results = [graded(true, 'slipLeft'), graded(false, null), graded(true, 'slipLeft')]
    return { stats: results.reduce(accumulate, emptyRoundStats), results }
  }

  it('reports the round totals', () => {
    render(<Results summary={summary()} onTrainAgain={vi.fn()} />)

    expect(screen.getByText(/2 of 3 punches answered correctly/i)).toBeInTheDocument()
    expect(screen.getByText('Avg reaction')).toBeInTheDocument()
  })

  it('lists every punch, so the user can see which ones went badly', () => {
    // The point of keeping per-exchange results rather than only the averages.
    render(<Results summary={summary()} onTrainAgain={vi.fn()} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByLabelText('Correct')).toHaveLength(2)
    expect(screen.getAllByLabelText('Wrong')).toHaveLength(1)
    expect(screen.getByText('no defense')).toBeInTheDocument()
  })

  it('offers a way back to Home', () => {
    const onTrainAgain = vi.fn()
    render(<Results summary={summary()} onTrainAgain={onTrainAgain} />)

    press('Train again')

    expect(onTrainAgain).toHaveBeenCalled()
  })

  it('does not show a reaction average when nothing was ever detected', () => {
    // Averaging over zero samples would print NaN.
    const results = [graded(false, null)]
    render(
      <Results
        summary={{ stats: results.reduce(accumulate, emptyRoundStats), results }}
        onTrainAgain={vi.fn()}
      />,
    )

    // Twice over: the reaction headline, and the missed punch's own row.
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
