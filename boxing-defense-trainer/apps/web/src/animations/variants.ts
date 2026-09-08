/**
 * Responsibility: the app's shared motion vocabulary, as Framer Motion
 * variants. Purely declarative data — no components, no side effects.
 *
 * Durations here are cosmetic. Anything that affects whether a defense counts
 * belongs in src/boxing/config/thresholds.ts instead.
 */
import type { Variants } from 'framer-motion'

/** Panel/HUD entrance: a short rise and fade, nothing showy. */
export const panelEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

/** The verdict flash shown after each exchange. */
// TODO: define per-outcome variants (clean / late / wrong / missed).
export const verdictFlash: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

/** The countdown number beat. */
// TODO: define the scale/settle beat for each countdown tick.
export const countdownBeat: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
}
