/**
 * Review-stage writes for a product ad (the check and a redo).
 * Both used to save the whole task from a snapshot taken before a slow image call.
 * A still the user remade in that gap was replaced, and a different still finished
 * in the same gap was reverted. These helpers keep the fresh task and change only
 * the still that was actually checked or remade.
 */

export const PRODUCT_STILL_KEYS = ['hero', 'angle', 'group', 'lifestyle', 'texture', 'apply', 'wetGlass'] as const
export type ReviewStillKey = (typeof PRODUCT_STILL_KEYS)[number]
export type StillCheckResult = { passed: boolean; issues: string[] }

export type ReviewTask = {
  stage: string
  stills: Partial<Record<ReviewStillKey, string>>
  checks?: Partial<Record<ReviewStillKey, StillCheckResult>>
  redosLeft: number
  autoRedone?: ReviewStillKey[]
}

export function isReviewStillKey(key: string | undefined): key is ReviewStillKey {
  return !!key && (PRODUCT_STILL_KEYS as readonly string[]).includes(key)
}

/** Paths that must still match for a review write to land. */
export function reviewStillGuards(stills: Partial<Record<ReviewStillKey, string>>): Array<[ReviewStillKey, string]> {
  const guards: Array<[ReviewStillKey, string]> = []
  for (const key of PRODUCT_STILL_KEYS) {
    const path = stills[key]
    if (path) guards.push([key, path])
  }
  return guards
}

export function requestedStillKeys(
  requested: readonly string[] | undefined,
  stills: Partial<Record<ReviewStillKey, string>>,
): ReviewStillKey[] {
  const allow = requested?.length ? new Set(requested) : null
  return PRODUCT_STILL_KEYS.filter(key => !!stills[key] && (!allow || allow.has(key)))
}

/**
 * Attach verdicts only for stills that are still the pictures that were checked.
 * Returns null when the task has left review, so a check cannot rewind a film.
 */
export function applyStillChecks<T extends ReviewTask>(
  checked: T,
  current: T,
  keys: readonly ReviewStillKey[],
  results: readonly StillCheckResult[],
): { input: T; checks: NonNullable<T['checks']> } | null {
  if (current.stage !== 'review') return null
  const checks: NonNullable<T['checks']> = { ...(current.checks ?? {}) }
  keys.forEach((key, i) => {
    const result = results[i]
    if (!result) return
    if (current.stills[key] && current.stills[key] === checked.stills[key]) checks[key] = result
  })
  return { input: { ...current, checks }, checks }
}

export type RedoMergeResult<T> =
  | { ok: true; input: T }
  | { ok: false; reason: 'wrong_stage' | 'replaced' | 'no_redos' | 'already_redone' }

/**
 * Put a remade still onto the task as it is now. A newer copy of this still is left alone.
 * Any other still that landed while this one was generating is kept.
 */
export function mergeProductRedo<T extends ReviewTask>(
  base: T,
  current: T,
  key: ReviewStillKey,
  made: { still: string; wetGlass?: string },
  auto: boolean,
): RedoMergeResult<T> {
  if (current.stage !== 'review') return { ok: false, reason: 'wrong_stage' }
  if (!base.stills[key] || current.stills[key] !== base.stills[key]) return { ok: false, reason: 'replaced' }
  if (auto) {
    if ((current.autoRedone ?? []).includes(key)) return { ok: false, reason: 'already_redone' }
  } else if (current.redosLeft <= 0) {
    return { ok: false, reason: 'no_redos' }
  }
  const checks: NonNullable<T['checks']> = { ...(current.checks ?? {}) }
  delete checks[key]
  const stills: T['stills'] = { ...current.stills, [key]: made.still }
  if (made.wetGlass) {
    stills.wetGlass = made.wetGlass
    delete checks.wetGlass
  }
  return {
    ok: true,
    input: {
      ...current,
      stills,
      checks,
      redosLeft: auto ? current.redosLeft : current.redosLeft - 1,
      autoRedone: auto ? [...(current.autoRedone ?? []), key] : current.autoRedone,
    },
  }
}
