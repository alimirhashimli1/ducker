/**
 * Responsibility: draw the sparring partner and play the punch it is told to
 * play. Purely presentational — it is told what to show, never what it means.
 *
 * It does not decide when to punch. The only timing it owns is the return to
 * guard once a punch has finished drawing, which is a property of the animation
 * rather than of the drill, and it is driven by Framer's own completion
 * callback rather than by a timer that could drift out of step with it.
 *
 * See ./README.md for the props contract and for how to add a punch.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'

import { boxerVariants, type BoxerAction } from '../../animations/boxerAnimations'
import type { Stance } from '../../types'
import { BoxerArm } from './BoxerArm'
import { BoxerLeg } from './BoxerLeg'
import {
  HEAD,
  LEAD_ARM,
  LEAD_LEG,
  REAR_ARM,
  REAR_LEG,
  TORSO,
  TORSO_PIVOT,
  VIEW_BOX,
  pivotAt,
} from './geometry'

export interface BoxerProps {
  /** Which side the partner leads with. Southpaw is drawn mirrored. */
  stance: Stance
  /** The punch to play, or `'idle'` for the resting guard. */
  currentAction: BoxerAction
  /**
   * Called once the punch has finished drawing and the figure has returned to
   * guard. The parent needs this to set `currentAction` back to `'idle'`;
   * without it, asking for the same punch twice in a row is not a prop change
   * and nothing replays.
   */
  onActionComplete?: () => void
  className?: string
}

/** The torso outline, widest at the shoulders. */
const TORSO_POINTS = [
  `${100 - TORSO.shoulderHalfWidth},${TORSO.shoulderY}`,
  `${100 + TORSO.shoulderHalfWidth},${TORSO.shoulderY}`,
  `${100 + TORSO.hipHalfWidth},${TORSO.hipY}`,
  `${100 - TORSO.hipHalfWidth},${TORSO.hipY}`,
].join(' ')

export function Boxer({ stance, currentAction, onActionComplete, className }: BoxerProps) {
  // Mirrored from the prop rather than read directly, so the figure can drop
  // back to guard on its own without the parent having to have noticed yet.
  //
  // Adjusted during render rather than in an effect. This is React's documented
  // pattern for resetting state when a prop changes: an effect would render the
  // stale action once, then re-render, which for an animation means a frame of
  // the wrong pose. React re-runs this component immediately without committing
  // the discarded render.
  const [playing, setPlaying] = useState<BoxerAction>(currentAction)
  const [lastRequested, setLastRequested] = useState<BoxerAction>(currentAction)

  if (currentAction !== lastRequested) {
    setLastRequested(currentAction)
    setPlaying(currentAction)
  }

  const handleComplete = (definition: unknown) => {
    // Framer reports every completed variant, including the return to guard.
    // Only the punch finishing is interesting; reacting to 'idle' as well would
    // notify the parent twice for one punch.
    if (definition === 'idle') {
      return
    }

    setPlaying('idle')
    onActionComplete?.()
  }

  return (
    <motion.svg
      data-testid="boxer"
      data-stance={stance}
      data-action={playing}
      viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      role="img"
      aria-label={`Sparring partner in ${stance} stance${playing === 'idle' ? '' : `, throwing a ${playing}`}`}
      // A southpaw is the mirror image of an orthodox boxer, so the whole
      // figure flips rather than every variant being written twice. Which arm
      // is "lead" follows from the flip.
      className={`${stance === 'southpaw' ? '-scale-x-100' : ''} ${className ?? ''}`}
      initial="idle"
      animate={playing}
      onAnimationComplete={handleComplete}
    >
      <BoxerLeg side="rear" geometry={REAR_LEG} />
      <BoxerLeg side="lead" geometry={LEAD_LEG} />

      {/* Rear arm first so the lead arm and its glove sit in front of it. */}
      <BoxerArm side="rear" geometry={REAR_ARM} />

      <motion.g
        data-testid="boxer-torso"
        variants={boxerVariants.torso}
        style={pivotAt(TORSO_PIVOT)}
      >
        <polygon points={TORSO_POINTS} className="fill-ink-800 stroke-ink-700" strokeWidth={3} />

        <motion.g data-testid="boxer-head" variants={boxerVariants.head}>
          <circle
            cx={HEAD.cx}
            cy={HEAD.cy}
            r={HEAD.r}
            className="fill-ink-700 stroke-ink-600"
            strokeWidth={3}
          />
        </motion.g>
      </motion.g>

      <BoxerArm side="lead" geometry={LEAD_ARM} />
    </motion.svg>
  )
}
