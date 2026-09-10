/**
 * Responsibility: the application root. It decides which screen is showing and
 * carries the little state that outlives a screen — the chosen settings, and
 * the round just finished.
 *
 * ## Why no router
 *
 * There are three screens and no URLs worth having. Nothing here is
 * addressable: you cannot deep-link into a training round, because a round is a
 * live camera session that has to be calibrated first, and a bookmarked
 * /results would name a round that no longer exists. The browser's back button
 * has no sensible meaning mid-round either — "back" during a live exchange is a
 * bug, not a feature.
 *
 * react-router would buy history, params and nested layouts, and this app wants
 * none of the three. A typed union and a `switch` is the whole requirement, and
 * it makes the illegal states unrepresentable: Results cannot render without a
 * summary, because the type says so.
 *
 * If the app ever grows shareable links — a saved session, a coach's view — a
 * router becomes the right answer and this is a small thing to replace.
 */
import { useState } from 'react'

import { Home, Results, Training } from './pages'
import type { RoundSummary, SessionConfig } from './pages'

type Screen =
  | { readonly name: 'home' }
  | { readonly name: 'training' }
  | { readonly name: 'results'; readonly summary: RoundSummary }

const DEFAULT_CONFIG: SessionConfig = { stance: 'orthodox', mode: 'beginner', difficulty: 3 }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [config, setConfig] = useState<SessionConfig>(DEFAULT_CONFIG)

  switch (screen.name) {
    case 'home':
      return (
        <Home
          initial={config}
          onStart={(next) => {
            setConfig(next)
            setScreen({ name: 'training' })
          }}
        />
      )

    case 'training':
      return (
        <Training
          config={config}
          onComplete={(summary) => setScreen({ name: 'results', summary })}
          onQuit={() => setScreen({ name: 'home' })}
        />
      )

    case 'results':
      return <Results summary={screen.summary} onTrainAgain={() => setScreen({ name: 'home' })} />
  }
}
