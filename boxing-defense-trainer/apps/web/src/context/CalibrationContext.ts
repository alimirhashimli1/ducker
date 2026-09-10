/**
 * Responsibility: the context object and its consumer hook, kept apart from the
 * provider component so that the module holding the React context exports no
 * JSX. Fast Refresh replaces a module that exports components; a context
 * created in that module would be replaced with it, and every consumer would
 * silently fall back to the default value on the next edit.
 */
import { createContext, useContext } from 'react'

import type { UseCalibrationResult } from '../hooks/useCalibration'

export const CalibrationContext = createContext<UseCalibrationResult | null>(null)

/**
 * Read the calibration state.
 *
 * Throws outside a provider rather than returning null: a component asking for
 * the baseline and silently getting nothing would look like "not calibrated
 * yet" forever, which is far harder to diagnose than a thrown error.
 */
export function useCalibrationContext(): UseCalibrationResult {
  const value = useContext(CalibrationContext)

  if (value === null) {
    throw new Error('useCalibrationContext must be used inside a <CalibrationProvider>')
  }

  return value
}
