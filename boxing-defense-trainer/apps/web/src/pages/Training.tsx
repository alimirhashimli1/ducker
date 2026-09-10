/**
 * Responsibility: the training screen — the sparring partner in the middle, the
 * camera in the corner, the HUD beside it. A composition root: it acquires the
 * camera and pose stream, hands them to the hooks, and lays out what comes back.
 *
 * No logic beyond wiring. Every judgement belongs to `src/boxing/`, and every
 * timer to `useTrainingSession`.
 */
import { useEffect, useState } from 'react'

import { THRESHOLDS, averageReactionMs, averageScore } from '../boxing'
import { Boxer } from '../components/Boxer'
import { CalibrationPanel } from '../components/CalibrationPanel'
import { PoseOverlay } from '../components/PoseOverlay'
import { TrainingHUD } from '../components/TrainingHUD'
import { WebcamView } from '../components/Webcam'
import { CalibrationProvider, useCalibrationContext } from '../context'
import { usePoseDetection, useTrainingSession, useWebcam } from '../hooks'
import type { DefenseResult, DetectionStatus, PoseLandmarks, RoundStats } from '../types'
import type { SessionConfig } from './Home'

export interface RoundSummary {
  readonly stats: RoundStats
  readonly results: readonly DefenseResult[]
}

export interface TrainingProps {
  config: SessionConfig
  onComplete: (summary: RoundSummary) => void
  onQuit: () => void
}

/** Inside the provider, so it can read the baseline calibration produced. */
function Round({
  config,
  landmarks,
  detectionStatus,
  onComplete,
}: {
  config: SessionConfig
  landmarks: PoseLandmarks | null
  detectionStatus: DetectionStatus
  onComplete: (summary: RoundSummary) => void
}) {
  const { baseline } = useCalibrationContext()
  const session = useTrainingSession({ landmarks, detectionStatus, baseline, ...config })

  // The round ending is the machine's decision; this only forwards it. In an
  // effect, not during render: calling the parent's setter while rendering is
  // how you get a render-phase update warning and a lost frame.
  const { state: phase, stats, results } = session.state
  useEffect(() => {
    if (phase === 'SUMMARY') {
      onComplete({ stats, results })
    }
  }, [phase, stats, results, onComplete])

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex items-center justify-center rounded-panel bg-ink-900/50">
        <Boxer
          stance={session.state.stance}
          currentAction={session.currentAction}
          className="h-[26rem] w-auto max-w-full"
        />
      </div>

      <TrainingHUD
        phase={session.state.state}
        stats={session.state.stats}
        attacksPerRound={THRESHOLDS.session.attacksPerRound}
        elapsedMs={session.elapsedMs}
        averageScore={averageScore(session.state.stats)}
        averageReactionMs={averageReactionMs(session.state.stats)}
        lastResult={session.lastResult}
        onStart={session.startRound}
        onPause={session.pause}
        onResume={session.resume}
        canStart={session.canStart}
      />
    </div>
  )
}

export function Training({ config, onComplete, onQuit }: TrainingProps) {
  const [cameraVisible, setCameraVisible] = useState(true)
  const { videoRef, status, error, start, stop } = useWebcam()
  const pose = usePoseDetection(videoRef, status === 'active')

  // The camera is the point of this screen, so it starts itself rather than
  // making the user press a second button after Start on Home. On mount only:
  // restarting whenever status returns to idle would fight the quit button.
  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only, see above
  }, [])

  return (
    <CalibrationProvider landmarks={pose.landmarks} detectionStatus={pose.detectionStatus}>
      <main className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-6 py-6">
        <header className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-500">
            {config.mode} · level {config.difficulty} · {config.stance}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraVisible(!cameraVisible)}
              className="rounded-panel border border-ink-800 px-2 py-1 font-mono text-[11px] text-ink-400 transition-colors hover:text-ink-100"
            >
              {cameraVisible ? 'hide camera' : 'show camera'}
            </button>
            <button
              type="button"
              onClick={() => {
                stop()
                onQuit()
              }}
              className="rounded-panel border border-ink-800 px-2 py-1 font-mono text-[11px] text-ink-400 transition-colors hover:text-ink-100"
            >
              quit
            </button>
          </div>
        </header>

        <Round
          config={config}
          landmarks={pose.landmarks}
          detectionStatus={pose.detectionStatus}
          onComplete={onComplete}
        />

        <div className="flex flex-col gap-3 lg:absolute lg:bottom-6 lg:left-6 lg:w-64">
          {cameraVisible && (
            <WebcamView videoRef={videoRef} status={status} enabled>
              <PoseOverlay landmarks={pose.landmarks} detectionStatus={pose.detectionStatus} />
            </WebcamView>
          )}
          <CalibrationPanel />
        </div>

        {(error ?? pose.error) && (
          <p className="rounded-panel border border-ember-800 bg-ember-950 px-3 py-2 text-xs text-ember-100">
            {(error ?? pose.error)?.message}
          </p>
        )}
      </main>
    </CalibrationProvider>
  )
}
