/**
 * Responsibility: the end-of-round summary. Totals at the top, then every
 * exchange so the user can see *which* punches went badly — "you missed both
 * rear hooks" is coaching, "you averaged 62" is not.
 */
import { ATTACK_CATALOGUE, DEFENSE_CATALOGUE, averageReactionMs, averageScore } from '../boxing'
import type { RoundSummary } from './Training'

export interface ResultsProps {
  summary: RoundSummary
  onTrainAgain: () => void
}

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-panel border border-ink-800 bg-ink-900 px-4 py-3">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="font-mono text-2xl tabular-nums text-ink-50">{value}</dd>
    </div>
  )
}

export function Results({ summary, onTrainAgain }: ResultsProps) {
  const { stats, results } = summary

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-50">Round complete</h1>
        <p className="text-sm text-ink-400">
          {stats.correctCount} of {stats.attacksThrown} punches answered correctly.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Headline label="Avg score" value={String(Math.round(averageScore(stats)))} />
        <Headline
          label="Avg reaction"
          value={stats.reactionSamples === 0 ? '—' : `${Math.round(averageReactionMs(stats))}ms`}
        />
        <Headline label="Defended" value={`${stats.correctCount}`} />
        <Headline label="Missed" value={`${stats.missedCount}`} />
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-ink-500">Every punch</h2>

        <ol className="flex flex-col divide-y divide-ink-800 overflow-hidden rounded-panel border border-ink-800">
          {results.map((result, index) => (
            <li
              key={`${result.attackId}-${index}`}
              className="flex items-center justify-between gap-3 bg-ink-900 px-4 py-2"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-label={result.score.correct ? 'Correct' : 'Wrong'}
                  className={`font-mono text-sm ${
                    result.score.correct ? 'text-ember-400' : 'text-ink-600'
                  }`}
                >
                  {result.score.correct ? '✓' : '✗'}
                </span>
                <span className="font-mono text-sm text-ink-100">
                  {ATTACK_CATALOGUE[result.punch].name}
                </span>
                <span className="text-xs text-ink-500">
                  {result.detected ? DEFENSE_CATALOGUE[result.detected].displayName : 'no defense'}
                </span>
              </span>

              <span className="flex items-center gap-4 font-mono text-xs tabular-nums text-ink-400">
                <span>{result.detected ? `${Math.round(result.score.reactionMs)}ms` : '—'}</span>
                <span className="w-8 text-right text-ink-100">
                  {Math.round(result.score.total)}
                </span>
              </span>
            </li>
          ))}
        </ol>

        {stats.bestStreak > 1 && (
          <p className="text-xs text-ink-500">Best streak: {stats.bestStreak} in a row.</p>
        )}
      </section>

      <button
        type="button"
        onClick={onTrainAgain}
        className="self-start rounded-panel border border-ember-700 bg-ember-900 px-5 py-3 font-mono text-sm text-ember-50 shadow-ember transition-colors hover:bg-ember-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember-500"
      >
        Train again
      </button>
    </main>
  )
}
