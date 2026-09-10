/**
 * Responsibility: the setup screen. Pick a stance, a mode and a difficulty,
 * then start. It holds the choices and hands them upward; it starts nothing
 * itself.
 */
import { useState } from 'react'

import { ALL_DEFENSES, DEFENSE_CATALOGUE } from '../boxing'
import type { DifficultyLevel, Stance, TrainingMode } from '../types'

export interface SessionConfig {
  readonly stance: Stance
  readonly mode: TrainingMode
  readonly difficulty: DifficultyLevel
}

export interface HomeProps {
  initial: SessionConfig
  onStart: (config: SessionConfig) => void
}

const STANCES: readonly { value: Stance; label: string; hint: string }[] = [
  { value: 'orthodox', label: 'Orthodox', hint: 'Left foot and hand forward' },
  { value: 'southpaw', label: 'Southpaw', hint: 'Right foot and hand forward' },
]

const MODES: readonly { value: TrainingMode; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'Single punches, generous timing' },
  { value: 'combination', label: 'Combination', hint: 'Two and three punch combos' },
  { value: 'reaction', label: 'Reaction', hint: 'Unpredictable timing and length' },
]

const LEVELS: readonly DifficultyLevel[] = [1, 2, 3, 4, 5]

/** One row of mutually exclusive choices. */
function Choice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly { value: T; label: string; hint?: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-500">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-w-24 flex-col gap-0.5 rounded-panel border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember-500 ${
                selected
                  ? 'border-ember-700 bg-ember-950 text-ember-100'
                  : 'border-ink-800 bg-ink-900 text-ink-300 hover:border-ink-700 hover:text-ink-100'
              }`}
            >
              <span className="font-mono text-sm">{option.label}</span>
              {option.hint && <span className="text-[11px] text-ink-500">{option.hint}</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Home({ initial, onStart }: HomeProps) {
  const [config, setConfig] = useState<SessionConfig>(initial)

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink-50">
          Boxing Defense <span className="text-ember-500">Trainer</span>
        </h1>
        <p className="max-w-md text-sm text-ink-400">
          Stand where your camera can see your head, shoulders and hips. You will calibrate your
          stance, then defend against punches.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Choice
          legend="Stance"
          options={STANCES}
          value={config.stance}
          onChange={(stance) => setConfig((prev) => ({ ...prev, stance }))}
        />
        <Choice
          legend="Mode"
          options={MODES}
          value={config.mode}
          onChange={(mode) => setConfig((prev) => ({ ...prev, mode }))}
        />
        <Choice
          legend="Difficulty"
          options={LEVELS.map((value) => ({ value, label: String(value) }))}
          value={config.difficulty}
          onChange={(difficulty) => setConfig((prev) => ({ ...prev, difficulty }))}
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onStart(config)}
          className="self-start rounded-panel border border-ember-700 bg-ember-900 px-5 py-3 font-mono text-sm text-ember-50 shadow-ember transition-colors hover:bg-ember-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember-500"
        >
          Start
        </button>
        <p className="text-[11px] text-ink-500">
          Defenses you can score:{' '}
          {ALL_DEFENSES.map((d) => DEFENSE_CATALOGUE[d].displayName).join(', ')}.
        </p>
      </div>
    </main>
  )
}
