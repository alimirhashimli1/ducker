/**
 * Responsibility: draw one leg, pivoting at the hip.
 *
 * The legs barely move — a few degrees of weight shift on rear-hand punches.
 * That is deliberate: the hip drive is what tells the user a cross is coming,
 * and it only reads as drive if the legs are otherwise planted.
 */
import { motion } from 'framer-motion'

import { boxerVariants } from '../../animations/boxerAnimations'
import { pivotAt, STROKE, type LegGeometry } from './geometry'

export interface BoxerLegProps {
  side: 'lead' | 'rear'
  geometry: LegGeometry
}

export function BoxerLeg({ side, geometry }: BoxerLegProps) {
  const { hip, knee, foot } = geometry

  return (
    <motion.g
      data-testid={`boxer-${side}-leg`}
      variants={boxerVariants[side === 'lead' ? 'leadLeg' : 'rearLeg']}
      style={pivotAt(hip)}
    >
      <polyline
        points={`${hip.x},${hip.y} ${knee.x},${knee.y} ${foot.x},${foot.y}`}
        className="stroke-ink-700"
        strokeWidth={STROKE.leg}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </motion.g>
  )
}
