/**
 * Responsibility: compose the trainer screen — camera feed, pose overlay,
 * sparring partner, HUD and score readout — and wire them to the session hook.
 *
 * Currently a scaffold placeholder: the component tree exists but nothing is
 * wired up yet.
 */

// TODO: compose Webcam + PoseOverlay + Boxer + TrainingHUD + ScoreDisplay,
// driven by useTrainingSession().
export function TrainerPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-3 bg-ink-950 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-100 sm:text-3xl">
        Boxing Defense Trainer <span className="text-ember-500">—</span> MVP scaffold
      </h1>
      <p className="max-w-md text-sm text-ink-300">
        Structure, tooling and design tokens are in place. No training logic yet.
      </p>
    </main>
  )
}
