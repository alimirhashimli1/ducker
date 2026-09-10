/**
 * Responsibility: draw one arm as a nested joint chain — upper arm, then
 * forearm, then glove — so rotations compose the way a real arm does.
 *
 * The nesting is the whole point. The forearm group sits inside the upper arm
 * group, so rotating at the shoulder carries the elbow, forearm and glove with
 * it and each variant only has to describe its own joint. Flattening this would
 * mean every variant re-deriving where the elbow ended up.
 *
 * It renders and nothing else: variants arrive from `boxerAnimations`, and the
 * variant to play is propagated by the parent's `animate` prop.
 */
import { motion } from 'framer-motion'

import { boxerVariants } from '../../animations/boxerAnimations'
import { pivotAt, STROKE, type ArmGeometry } from './geometry'

export interface BoxerArmProps {
  /** Which arm this is; selects both the variants and the test id. */
  side: 'lead' | 'rear'
  geometry: ArmGeometry
}

export function BoxerArm({ side, geometry }: BoxerArmProps) {
  const { shoulder, elbow, glove } = geometry

  return (
    <motion.g
      data-testid={`boxer-${side}-upper-arm`}
      variants={boxerVariants[side === 'lead' ? 'leadUpperArm' : 'rearUpperArm']}
      style={pivotAt(shoulder)}
    >
      <line
        x1={shoulder.x}
        y1={shoulder.y}
        x2={elbow.x}
        y2={elbow.y}
        className="stroke-ink-600"
        strokeWidth={STROKE.upperArm}
        strokeLinecap="round"
      />

      <motion.g
        data-testid={`boxer-${side}-forearm`}
        variants={boxerVariants[side === 'lead' ? 'leadForearm' : 'rearForearm']}
        style={pivotAt(elbow)}
      >
        <line
          x1={elbow.x}
          y1={elbow.y}
          x2={glove.x}
          y2={glove.y}
          className="stroke-ink-600"
          strokeWidth={STROKE.forearm}
          strokeLinecap="round"
        />

        {/*
          The glove is the only accented element on the figure. Per the palette
          note in tailwind.config.ts the accent marks what demands attention,
          and what the user must read is which hand is coming.
        */}
        <motion.g
          data-testid={`boxer-${side}-glove`}
          variants={boxerVariants[side === 'lead' ? 'leadGlove' : 'rearGlove']}
          style={pivotAt(glove)}
        >
          <circle
            cx={glove.x}
            cy={glove.y}
            r={STROKE.gloveRadius}
            className="fill-ember-600 stroke-ember-800"
            strokeWidth={2}
          />
        </motion.g>
      </motion.g>
    </motion.g>
  )
}
