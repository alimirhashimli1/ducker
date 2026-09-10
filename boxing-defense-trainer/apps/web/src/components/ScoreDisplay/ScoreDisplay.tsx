/**
 * Responsibility: render one exchange's breakdown — which defense was read,
 * whether it was the right answer, and how the three components graded.
 *
 * It formats numbers it is handed. It computes no scores: every figure here
 * comes from `boxing/scoring.ts`.
 */
import { DEFENSE_CATALOGUE } from '../../boxing'
import type { DefenseResult } from '../../types'

export interface ScoreDisplayProps {
  /** The exchange to show, or null before the first one is scored. */
  result?: DefenseResult | null
  /** Hides the component's own frame, for embedding in a panel that has one. */
  bare?: boolean
  className?: string
}

const ROWS = [
  ['Reaction', (r: DefenseResult) => r.score.reactionScore],
  ['Movement', (r: DefenseResult) => r.score.movementScore],
  ['Balance', (r: DefenseResult) => r.score.balanceScore],
] as const

export function ScoreDisplay({ result, bare = false, className }: ScoreDisplayProps) {
  const frame = bare ? '' : 'rounded-panel border border-ink-800 bg-ink-900 p-3'

  if (!result) {
    return <div data-testid="score-display" className={`${frame} ${className ?? ''}`} />
  }

  const { detected, score } = result
  // A miss has no defense to name, so it says so rather than showing a blank.
  const label = detected ? DEFENSE_CATALOGUE[detected].displayName : 'No defense'

  return (
    <div
      data-testid="score-display"
      data-correct={score.correct}
      className={`flex flex-col gap-2 ${frame} ${className ?? ''}`}
    >
      <p className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm text-ink-100">{label}</span>
        <span
          aria-label={score.correct ? 'Correct defense' : 'Wrong defense'}
          className={`font-mono text-sm ${score.correct ? 'text-ember-400' : 'text-ink-500'}`}
        >
          {score.correct ? '✓' : '✗'}
        </span>
      </p>

      <dl className="flex flex-col gap-0.5 font-mono text-xs">
        {ROWS.map(([name, read]) => (
          <div key={name} className="flex items-center justify-between gap-3">
            <dt className="text-ink-400">{name}</dt>
            <dd className="tabular-nums text-ink-200">{Math.round(read(result))}</dd>
          </div>
        ))}

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-ink-800 pt-1">
          <dt className="text-ink-300">Total</dt>
          <dd className="tabular-nums text-ink-100">{Math.round(score.total)}</dd>
        </div>
      </dl>
    </div>
  )
}
