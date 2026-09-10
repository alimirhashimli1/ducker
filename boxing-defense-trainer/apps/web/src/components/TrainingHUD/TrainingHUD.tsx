/**
 * Responsibility: show the live state of a round and expose its two controls.
 * It reflects the state machine; it never advances it itself.
 *
 * Purely presentational — every value arrives as a prop from
 * `useTrainingSession`. Deliberately sparse: the spec asks for an uncluttered
 * training screen, and the user's attention belongs on the boxer, not here.
 */
import { ScoreDisplay } from '../ScoreDisplay'
import type { DefenseResult, RoundStats, TrainingState } from '../../types'

export interface TrainingHUDProps {
  phase: TrainingState
  stats: RoundStats
  /** Punches in a full round, so progress reads "3 / 10". */
  attacksPerRound: number
  /** Round clock, in ms. */
  elapsedMs: number
  averageScore: number
  averageReactionMs: number
  /** The exchange most recently scored. */
  lastResult?: DefenseResult | null
  onStart: () => void
  onPause: () => void
  onResume: () => void
  canStart: boolean
  className?: string
}

/** m:ss — a round is minutes long, so hours would be noise. */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Phases where the loop is mid-round and can be paused. */
const RUNNING: readonly TrainingState[] = [
  'WAITING_FOR_ATTACK',
  'ATTACKING',
  'WAITING_FOR_DEFENSE',
  'EVALUATING',
  'RESULT',
]

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="font-mono text-lg tabular-nums text-ink-100">{value}</dd>
    </div>
  )
}

export function TrainingHUD({
  phase,
  stats,
  attacksPerRound,
  elapsedMs,
  averageScore,
  averageReactionMs,
  lastResult,
  onStart,
  onPause,
  onResume,
  canStart,
  className,
}: TrainingHUDProps) {
  const isRunning = RUNNING.includes(phase)
  const isPaused = phase === 'PAUSED'

  return (
    <section
      data-testid="training-hud"
      data-phase={phase}
      className={`flex flex-col gap-4 rounded-panel border border-ink-800 bg-ink-900/80 p-4 shadow-panel ${className ?? ''}`}
    >
      <dl className="grid grid-cols-2 gap-4">
        <Stat label="Punch" value={`${stats.attacksThrown} / ${attacksPerRound}`} />
        <Stat label="Time" value={formatClock(elapsedMs)} />
        <Stat label="Score" value={String(Math.round(averageScore))} />
        <Stat
          label="Reaction"
          value={stats.reactionSamples === 0 ? '—' : `${Math.round(averageReactionMs)}ms`}
        />
      </dl>

      {/* Reserved height, so the panel does not jump as results come and go. */}
      <div className="min-h-[7.5rem]">
        <ScoreDisplay result={lastResult} bare />
      </div>

      {isRunning ? (
        <button
          type="button"
          onClick={onPause}
          className="rounded-panel border border-ink-700 px-3 py-2 font-mono text-xs text-ink-200 transition-colors hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember-500"
        >
          Pause
        </button>
      ) : (
        <button
          type="button"
          onClick={isPaused ? onResume : onStart}
          disabled={!isPaused && !canStart}
          className="rounded-panel border border-ember-800 bg-ember-950 px-3 py-2 font-mono text-xs text-ember-100 transition-colors hover:bg-ember-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember-500"
        >
          {isPaused ? 'Resume' : 'Start'}
        </button>
      )}
    </section>
  )
}
