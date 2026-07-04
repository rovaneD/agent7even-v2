import type { GuardianState, GuardianVerdict } from '@/lib/foundation/observer/types'

/** Tune after human checkpoint — not hardcoded in LLM prompts. */
export const GUARDIAN_THRESHOLDS = {
  /** Below this count → reject_internal regardless of state */
  minSupportingRows: 3,
  minSurfaceConsistent: 3,
  minSurfaceExtending: 4,
} as const

export const GUARDIAN_MODEL = 'anthropic/claude-sonnet-4'

/** Deterministic verdict — overrides LLM verdict so contradicting never surfaces. */
export function applyGuardianVerdict(
  state: GuardianState,
  supportingCount: number,
): GuardianVerdict {
  if (supportingCount < GUARDIAN_THRESHOLDS.minSupportingRows) {
    return 'reject_internal'
  }
  if (state === 'contradicting') {
    return 'hold'
  }
  if (
    state === 'consistent' &&
    supportingCount >= GUARDIAN_THRESHOLDS.minSurfaceConsistent
  ) {
    return 'surface'
  }
  if (
    state === 'extending' &&
    supportingCount >= GUARDIAN_THRESHOLDS.minSurfaceExtending
  ) {
    return 'surface'
  }
  return 'reject_internal'
}
