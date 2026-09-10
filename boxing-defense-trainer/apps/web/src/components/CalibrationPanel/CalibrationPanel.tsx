/**
 * Responsibility: the calibration half of the trainer screen — the prompt, the
 * countdown, the measured result, and the Recalibrate button.
 *
 * Reads the calibration state from context rather than taking it as props, so
 * the screen above it does not have to thread a baseline through purely to hand
 * it here.
 */
import { calibrationFailureMessage } from '../../boxing'
import { useCalibrationContext } from '../../context'
import { Countdown } from '../Countdown'

export interface CalibrationPanelProps {
  className?: string
}

export function CalibrationPanel({ className }: CalibrationPanelProps) {
  const {
    phase,
    baseline,
    failure,
    prompt,
    countdownFrom,
    recalibrate,
    handleCountdownTick,
    handleCountdownComplete,
  } = useCalibrationContext()

  const isMeasuring = phase === 'countdown' || phase === 'sampling'

  return (
    <section
      data-testid="calibration-panel"
      data-phase={phase}
      className={`flex flex-col gap-3 rounded-panel border border-ink-800 bg-ink-900 p-4 ${className ?? ''}`}
    >
      {isMeasuring && (
        <div className="flex flex-col items-center gap-2">
          <p className="font-mono text-xs tracking-widest text-ink-200">{prompt}</p>
          {/* Remounted per run, so a recalibrate restarts the count. */}
          <Countdown
            key={phase === 'countdown' || phase === 'sampling' ? 'run' : 'idle'}
            from={countdownFrom}
            finalLabel="HOLD"
            onTick={handleCountdownTick}
            onComplete={handleCountdownComplete}
          />
        </div>
      )}

      {phase === 'idle' && (
        <p className="text-sm text-ink-400">
          Calibrate before training, so the trainer knows what your stance looks like at rest.
        </p>
      )}

      {phase === 'failed' && failure && (
        <p className="text-sm text-ember-300">{calibrationFailureMessage(failure)}</p>
      )}

      {phase === 'ready' && baseline && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-ink-400">
          <dt>body width</dt>
          <dd className="text-ink-100">{baseline.bodyWidth.toFixed(3)}</dd>
          <dt>samples</dt>
          <dd className="text-ink-100">{baseline.sampleCount}</dd>
          <dt>head</dt>
          <dd className="text-ink-100">
            {baseline.head.x.toFixed(3)}, {baseline.head.y.toFixed(3)}
          </dd>
          <dt>shoulders</dt>
          <dd className="text-ink-100">
            {baseline.shoulders.center.x.toFixed(3)}, {baseline.shoulders.center.y.toFixed(3)}
          </dd>
        </dl>
      )}

      <button
        type="button"
        onClick={recalibrate}
        disabled={isMeasuring}
        className="self-start rounded-panel border border-ink-700 bg-ink-800 px-3 py-2 font-mono text-xs text-ink-100 transition-colors hover:border-ember-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember-500"
      >
        {phase === 'ready' ? 'Recalibrate' : 'Calibrate'}
      </button>
    </section>
  )
}
