import type { GuardianState, GuardianVerdict } from '@/lib/foundation/observer/types'

/** Days before Guardian re-surfaces a theme the user dismissed. */
export const PROPOSAL_REJECT_COOLDOWN_DAYS = 30

/** Days before a deferred ("Not now") theme can surface again. */
export const PROPOSAL_DEFER_COOLDOWN_DAYS = 14

/** Strong-signal bar for surfacing contradicting proposals (vision drift filter). */
export const MIN_SURFACE_CONTRADICTING = 6

export type GuardianThresholdConfig = {
  /** Below this count → reject_internal regardless of state */
  minSupportingRows: number
  minSurfaceConsistent: number
  minSurfaceExtending: number
}

/**
 * Calibrated 2026-07-06 via scripts/calibrate-guardian-thresholds.ts.
 * Hold at ≥3/≥4 until organic changelog volume grows — surfaced proposals had
 * strong approve rate on Agent7even checkpoint; lower thresholds add noise.
 */
export const GUARDIAN_THRESHOLDS: GuardianThresholdConfig = {
  minSupportingRows: 3,
  minSurfaceConsistent: 3,
  minSurfaceExtending: 4,
}

export const GUARDIAN_MODEL = 'anthropic/claude-sonnet-4'

/** Deterministic verdict — overrides LLM verdict so contradicting never surfaces. */
export function applyGuardianVerdict(
  state: GuardianState,
  supportingCount: number,
  thresholds: GuardianThresholdConfig = GUARDIAN_THRESHOLDS,
): GuardianVerdict {
  if (supportingCount < thresholds.minSupportingRows) {
    return 'reject_internal'
  }
  if (state === 'contradicting') {
    if (supportingCount >= MIN_SURFACE_CONTRADICTING) {
      return 'surface'
    }
    return 'hold'
  }
  if (
    state === 'consistent' &&
    supportingCount >= thresholds.minSurfaceConsistent
  ) {
    return 'surface'
  }
  if (
    state === 'extending' &&
    supportingCount >= thresholds.minSurfaceExtending
  ) {
    return 'surface'
  }
  return 'reject_internal'
}
